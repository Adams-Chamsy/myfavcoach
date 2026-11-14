-- Étape serveur de L4 -- DÉCOR (14 novembre 2026 ; docs/decisions-en-attente.md, « Étape
-- serveur »). Les trois trous de P4.7 et la durée de suivi de 27a :
--
--   1. les quatre derniers chiffres du moyen de paiement (04c, écran 20) : lus chez le prestataire
--      par le serveur au moment où le moyen est conservé (0046), posés ici, jamais par
--      l'application ;
--   2. le détail d'un abonnement pour 04c, l'écran 20 et 24b (detail_abonnement) : dernière
--      facture, dernier échec, fin de la période de grâce, date limite de régularisation,
--      prochaine tentative -- toutes calculées par le serveur (docs/api.md §15) ;
--   3. le changement de moyen de paiement après un refus (docs/api.md §7,
--      POST /abonnements/{id}/moyen-paiement) : une page Stripe hébergée en mode « enregistrement »,
--      le nouveau moyen remplace l'ancien, et une tentative de plus est programmée le lendemain,
--      hors du compte de trois (docs/domaine.md §4.4, précisé ce jour).
--
-- Cette migration pose les colonnes, les droits et les fonctions nouvelles, sans changer le
-- comportement du moteur d'échéances ; 0061 pose la règle (la relance après nouveau moyen, la
-- durée de suivi dans mon_avis_possible, le retrait de l'ancienne signature). Même découpe que
-- 0052/0053 : le banc rougit sur une assertion, jamais sur un objet absent.

-- ---------------------------------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------------------------------

-- Les quatre derniers chiffres, lisibles par le client : ce n'est pas un identifiant de paiement
-- (CLAUDE.md §10), c'est ce que la fiche 04c affiche (« Carte •••• 4242 »).
alter table public.abonnements add column moyen_derniers_chiffres text;
alter table public.abonnements
  add constraint abonnements_derniers_chiffres_forme
  check (moyen_derniers_chiffres is null or moyen_derniers_chiffres ~ '^[0-9]{4}$');
grant select (moyen_derniers_chiffres) on public.abonnements to authenticated;

-- La relance demandée par un nouveau moyen de paiement : le jour où une tentative de plus est due
-- (le lendemain de l'enregistrement, à la date de Paris). Effacée à l'ouverture de cette
-- tentative. Serveur seulement.
alter table public.abonnements add column relance_demandee_le date;

-- La session Stripe d'enregistrement d'un nouveau moyen, posée par le serveur à sa création :
-- le constat la relit, comme le constat de souscription relit la session de l'intention.
-- Identifiant de paiement : jamais accordé à l'application.
alter table public.abonnements add column reference_session_nouveau_moyen text;

-- La relance après un nouveau moyen est hors du compte de trois (docs/domaine.md §4.4) : la borne
-- haute de tentatives_numero_borne tombe, la borne basse reste.
alter table public.tentatives_prelevement drop constraint tentatives_numero_borne;
alter table public.tentatives_prelevement
  add constraint tentatives_numero_borne check (tentative_numero >= 1);

-- ---------------------------------------------------------------------------------------------
-- 2. memoriser_moyen_paiement, avec les quatre derniers chiffres
-- ---------------------------------------------------------------------------------------------

-- Même règle que 0046 (posé une fois, jamais écrasé) ; la signature à deux paramètres reste
-- jusqu'à 0061.
create or replace function public.memoriser_moyen_paiement(
  p_reference_paiement text,
  p_moyen_prestataire text,
  p_derniers_chiffres text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.abonnements
     set reference_moyen_prestataire = p_moyen_prestataire,
         moyen_derniers_chiffres = p_derniers_chiffres
   where reference_paiement = p_reference_paiement
     and reference_moyen_prestataire is null;
end;
$$;

revoke execute on function public.memoriser_moyen_paiement(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.memoriser_moyen_paiement(text, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. detail_abonnement : ce que 04c, l'écran 20 et 24b lisent d'un abonnement
-- ---------------------------------------------------------------------------------------------

-- Le client, sur SON abonnement, en espace client (même garde que etat_paiement_abonnement, 0036).
-- Les dates sont calculées ici, jamais par l'écran (docs/api.md §15) :
--   - grace_jusqu_au : dernier jour de suivi d'un impayé -- la suspension tombe le matin de
--     J+7 (appliquer_echeances), le suivi continue donc jusqu'à J+6 inclus ;
--   - regularisation_avant_le : le jour où un suspendu devient résilié, J+37 (0044) ;
--   - prochaine_tentative_le : la relance demandée par un nouveau moyen si elle est à venir,
--     sinon la relance du calendrier (J+1 après la tentative 1, J+3 après la 2), sinon null.
create or replace function public.detail_abonnement(p_abonnement_id uuid)
returns table (
  id uuid,
  statut text,
  moyen text,
  moyen_derniers_chiffres text,
  prix_fige_centimes integer,
  prochain_prelevement_le date,
  pause_jusqu_le date,
  fin_acces_le date,
  offre_titre text,
  offre_engagement_humain text[],
  coach_prenom text,
  coach_nom text,
  coach_commune_base text,
  derniere_facture_montant_centimes integer,
  derniere_facture_payee_le timestamptz,
  dernier_echec_motif text,
  dernier_echec_echeance_le date,
  grace_jusqu_au date,
  regularisation_avant_le date,
  prochaine_tentative_le date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements;
  v_derniere public.tentatives_prelevement;
  v_prochaine date;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'abonnement_introuvable';
  end if;
  select a.* into v_abonnement
    from public.abonnements a
    join public.profils_client pc on pc.id = a.profil_client_id
   where a.id = p_abonnement_id and pc.compte_id = auth.uid();
  if not found then
    raise exception 'abonnement_introuvable';
  end if;

  -- La dernière tentative de l'échéance en cours (prochain_prelevement_le n'avance qu'au succès).
  select t.* into v_derniere
    from public.tentatives_prelevement t
   where t.abonnement_id = v_abonnement.id
     and t.echeance_le = v_abonnement.prochain_prelevement_le
   order by t.tentative_numero desc
   limit 1;

  if v_abonnement.statut in ('impaye', 'suspendu') then
    if v_abonnement.relance_demandee_le is not null then
      v_prochaine := v_abonnement.relance_demandee_le;
    elsif found and v_derniere.statut = 'echouee' and v_abonnement.statut = 'impaye' then
      v_prochaine := case v_derniere.tentative_numero
        when 1 then v_abonnement.prochain_prelevement_le + 1
        when 2 then v_abonnement.prochain_prelevement_le + 3
      end;
    end if;
  end if;

  return query
  select
    v_abonnement.id,
    v_abonnement.statut::text,
    v_abonnement.moyen::text,
    v_abonnement.moyen_derniers_chiffres,
    v_abonnement.prix_fige_centimes,
    v_abonnement.prochain_prelevement_le,
    v_abonnement.pause_jusqu_le,
    v_abonnement.fin_acces_le,
    o.titre,
    o.engagement_humain,
    pc.prenom,
    pc.nom,
    cr.nom,
    (select f.montant_ttc_centimes from public.factures f
      where f.abonnement_id = v_abonnement.id order by f.emise_le desc limit 1),
    (select f.payee_le from public.factures f
      where f.abonnement_id = v_abonnement.id order by f.emise_le desc limit 1),
    (select t.motif_banque::text from public.tentatives_prelevement t
      where t.abonnement_id = v_abonnement.id and t.statut = 'echouee'
      order by t.terminee_le desc limit 1),
    (select t.echeance_le from public.tentatives_prelevement t
      where t.abonnement_id = v_abonnement.id and t.statut = 'echouee'
      order by t.terminee_le desc limit 1),
    case when v_abonnement.statut = 'impaye' then v_abonnement.prochain_prelevement_le + 6 end,
    case when v_abonnement.statut = 'suspendu' then v_abonnement.prochain_prelevement_le + 37 end,
    v_prochaine
  from public.offres o
  join public.profils_coach pc on pc.id = v_abonnement.profil_coach_id
  left join public.communes_reference cr on cr.code_insee = pc.commune_base_insee
  where o.id = v_abonnement.offre_id;
end;
$$;

revoke execute on function public.detail_abonnement(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.detail_abonnement(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Le changement de moyen de paiement
-- ---------------------------------------------------------------------------------------------

-- Le client demande, sur SON abonnement : seulement après un prélèvement refusé (impaye ou
-- suspendu, docs/ecrans/L4-20-paiement-refuse.md). Rend rien ; lève sinon. L'Edge Function
-- abonnement-moyen-paiement l'appelle avec le jeton du client avant d'ouvrir la page Stripe.
create or replace function public.abonnement_pour_nouveau_moyen(p_abonnement_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_statut public.abonnement_statut_enum;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'abonnement_introuvable';
  end if;
  select a.statut into v_statut
    from public.abonnements a
    join public.profils_client pc on pc.id = a.profil_client_id
   where a.id = p_abonnement_id and pc.compte_id = auth.uid();
  if not found then
    raise exception 'abonnement_introuvable';
  end if;
  if v_statut not in ('impaye', 'suspendu') then
    raise exception 'changement_moyen_impossible';
  end if;
end;
$$;

revoke execute on function public.abonnement_pour_nouveau_moyen(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.abonnement_pour_nouveau_moyen(uuid) to authenticated;

-- Le serveur pose la session d'enregistrement qu'il vient de créer (même règle que
-- attacher_session_intention, 0037 : le lien est posé par le serveur, jamais déclaré par le
-- client). Une nouvelle demande remplace la précédente : seule la dernière page ouverte compte.
create or replace function public.poser_session_nouveau_moyen(
  p_abonnement_id uuid,
  p_session text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.abonnements
     set reference_session_nouveau_moyen = p_session
   where id = p_abonnement_id;
  if not found then
    raise exception 'abonnement_introuvable';
  end if;
end;
$$;

revoke execute on function public.poser_session_nouveau_moyen(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.poser_session_nouveau_moyen(uuid, text) to service_role;

-- Le serveur relit la session chez le prestataire (webhook ou constat) et remplace le moyen.
-- Rend la date de la tentative programmée, ou null si rien n'a changé (même moyen relivré :
-- idempotent) ou si l'abonnement n'est plus en défaut de paiement (le moyen est remplacé quand
-- même -- un moyen plus récent est toujours le bon --, aucune relance de plus).
create or replace function public.remplacer_moyen_paiement(
  p_abonnement_id uuid,
  p_moyen_prestataire text,
  p_type public.moyen_paiement_enum,
  p_derniers_chiffres text,
  p_jour date default (now() at time zone 'Europe/Paris')::date
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements;
  v_relance date;
begin
  select * into v_abonnement from public.abonnements where id = p_abonnement_id for update;
  if not found then
    raise exception 'abonnement_introuvable';
  end if;
  if v_abonnement.reference_moyen_prestataire is not distinct from p_moyen_prestataire then
    return v_abonnement.relance_demandee_le;
  end if;
  if v_abonnement.statut in ('impaye', 'suspendu') then
    v_relance := p_jour + 1;
  end if;
  update public.abonnements
     set reference_moyen_prestataire = p_moyen_prestataire,
         moyen = p_type,
         moyen_derniers_chiffres = p_derniers_chiffres,
         relance_demandee_le = coalesce(v_relance, relance_demandee_le)
   where id = p_abonnement_id;
  return v_relance;
end;
$$;

revoke execute on function public.remplacer_moyen_paiement(uuid, text, public.moyen_paiement_enum, text, date)
  from public, anon, authenticated, service_role;
grant execute on function public.remplacer_moyen_paiement(uuid, text, public.moyen_paiement_enum, text, date)
  to service_role;
