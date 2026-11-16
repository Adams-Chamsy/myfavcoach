-- Les deux règles de docs/domaine.md §3.3 -- RÈGLES (16 novembre 2026, L5, P5.3 ; décor : 0071).
--
-- « Aucun fonds retenu pour un coach qui ne peut pas le recevoir » : avec les charges séparées,
-- l'argent du client arrive sur le compte de la plateforme et n'est viré au coach que par un
-- versement. Un coach sans compte opérationnel laisserait la plateforme détenir son argent pour
-- une durée indéterminée. Et une vente produit une facture AU NOM DU COACH : sans son identité
-- fiscale, elle ne serait pas conforme.
--
--   1. publier_offre refuse identite_fiscale_incomplete, puis compte_versement_non_operationnel
--      (après les vérifications de 0008, avant le contrôle des termes de 0065).
--   2. creer_intention_souscription refuse coach_indisponible dans les deux cas, même pour une
--      offre déjà publiée. Le client ne lit pas pourquoi : c'est l'affaire du coach.
--
-- Les deux fonctions sont reprises À L'IDENTIQUE de 0065 et de 0043, ces refus en plus. Mêmes
-- signatures : create or replace conserve les droits, redits par convention (docs/backend.md §4).
-- Les offres déjà publiées ne sont pas retirées : elles cessent seulement de pouvoir être
-- souscrites tant que leur coach n'est pas en règle.

create or replace function public.publier_offre(offre_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offre public.offres;
  v_verifiee boolean;
  v_terme text;
begin
  select o.* into v_offre
    from public.offres o
   where o.id = offre_id
     and o.coach_id in (select id from public.profils_coach where compte_id = auth.uid());

  if not found then
    raise exception 'offre introuvable ou non possedee par ce compte';
  end if;

  if coalesce(array_length(v_offre.engagement_humain, 1), 0) = 0 then
    raise exception 'engagement_humain_requis';
  end if;

  select pc.statut_verification = 'verifiee' into v_verifiee
    from public.profils_coach pc
   where pc.id = v_offre.coach_id;
  if not coalesce(v_verifiee, false) then
    raise exception 'coach_non_verifie';
  end if;

  -- 0072 (docs/domaine.md §3.3, règle 1) : aucune vente sans de quoi émettre la facture au nom
  -- du coach, ni sans compte où lui virer l'argent. L'identité d'abord : c'est ce que le coach
  -- remplit lui-même ; le compte dépend du prestataire.
  if not public.identite_fiscale_complete(v_offre.coach_id) then
    raise exception 'identite_fiscale_incomplete';
  end if;
  if not public.compte_versement_operationnel(v_offre.coach_id) then
    raise exception 'compte_versement_non_operationnel';
  end if;

  v_terme := public.terme_interdit_dans(
    concat_ws(' ', v_offre.titre, v_offre.description, array_to_string(v_offre.benefices, ' '))
  );
  if v_terme is not null then
    -- Le terme trouvé part en DETAIL de la levée : jamais affiché tel quel, lisible au journal.
    raise exception 'termes_interdits' using detail = v_terme;
  end if;

  if 'messagerie avec délai de réponse annoncé' = any (v_offre.engagement_humain) then
    raise exception 'engagement_messagerie_indisponible';
  end if;

  update public.offres set publiee_le = now(), retiree_le = null where id = offre_id;
end;
$$;

revoke execute on function public.publier_offre(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.publier_offre(uuid) to authenticated;

create or replace function public.creer_intention_souscription(p_offre_id uuid)
returns table (
  intention_id uuid,
  titre text,
  prix_centimes integer,
  jour_prelevement smallint,
  prochain_prelevement_le date,
  expire_le timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil_client uuid;
  v_offre public.offres;
  v_coach public.profils_coach;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_jour smallint := public.jour_prelevement_pour(v_aujourdhui);
  v_intention public.intentions_souscription;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'profil_client_requis';
  end if;
  select id into v_profil_client from public.profils_client where compte_id = auth.uid();
  if v_profil_client is null then
    raise exception 'profil_client_requis';
  end if;

  select * into v_offre from public.offres where id = p_offre_id;
  if not found or v_offre.publiee_le is null or v_offre.retiree_le is not null then
    raise exception 'offre_indisponible';
  end if;
  select * into v_coach from public.profils_coach where id = v_offre.coach_id;
  if v_coach.statut_verification <> 'verifiee' then
    raise exception 'coach_non_verifie';
  end if;
  if v_coach.compte_id = auth.uid() then
    raise exception 'auto_abonnement_interdit';
  end if;
  -- 0072 (docs/domaine.md §3.3, règle 2) : « même pour une offre déjà publiée » — un compte peut
  -- perdre son statut après la publication. Refusé AVANT toute page de paiement : aucun fonds
  -- n'est retenu pour un coach qui ne peut pas le recevoir. Le client reçoit un refus neutre ;
  -- la raison, qui regarde le coach, part en DETAIL de la levée.
  if not public.identite_fiscale_complete(v_coach.id) then
    raise exception 'coach_indisponible' using detail = 'identite_fiscale_incomplete';
  end if;
  if not public.compte_versement_operationnel(v_coach.id) then
    raise exception 'coach_indisponible' using detail = 'compte_versement_non_operationnel';
  end if;
  -- 0043 : règle d'abonnement unique (docs/domaine.md §3.2). Refusé AVANT toute page de
  -- paiement : le client ne paie jamais une seconde fois le même suivi.
  if exists (
    select 1 from public.abonnements
     where profil_client_id = v_profil_client
       and profil_coach_id = v_coach.id
       and statut not in ('resilie', 'annule')
  ) then
    raise exception 'deja_abonne';
  end if;

  insert into public.intentions_souscription (profil_client_id, offre_id, titre_fige, prix_fige_centimes)
  values (v_profil_client, p_offre_id, v_offre.titre, v_offre.prix_centimes)
  returning * into v_intention;

  return query select
    v_intention.id, v_intention.titre_fige, v_intention.prix_fige_centimes, v_jour,
    public.echeance_suivante(v_aujourdhui, v_jour), v_intention.expire_le;
end;
$$;

revoke execute on function public.creer_intention_souscription(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.creer_intention_souscription(uuid) to authenticated;
