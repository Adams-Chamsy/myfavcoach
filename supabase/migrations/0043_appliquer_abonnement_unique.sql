-- Règle d'abonnement unique -- L4, P4.5d (docs/domaine.md §3.2, tranchée le 31 octobre 2026) :
-- un client ne peut pas avoir deux abonnements EN COURS chez le même coach (tout statut sauf
-- resilie et annule). Avant cette migration, le serveur ne vérifiait rien : un client abonné
-- pouvait payer une seconde fois et finir avec deux abonnements (trouvé en préparant P4.6).
--
-- 1. creer_intention_souscription refuse : deja_abonne (409, docs/api.md §7), avant toute page
--    de paiement.
-- 2. synchroniser_session_paiement : un paiement encaissé malgré tout (deux intentions ouvertes
--    en parallèle) devient une anomalie abonnement_existant, jamais un second abonnement.
-- 3. souscrire_abonnement : le même refus, en invariant.
-- 4. Index unique partiel : la garantie en base, même entre deux transactions simultanées.
-- 5. anomalies_paiement_ouvertes : abonnement_existant n'est jamais retraité (un remboursement
--    se fait à la main, il ne se « rattrape » pas en créant l'abonnement).
--
-- Fonctions remplacées : copies exactes de 0037/0038/0040, plus les seuls blocs marqués 0043.

-- ---------------------------------------------------------------------------------------------
-- 1. creer_intention_souscription
-- ---------------------------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------------------------
-- 2. synchroniser_session_paiement
-- ---------------------------------------------------------------------------------------------

create or replace function public.synchroniser_session_paiement(
  p_evenement_id text,
  p_evenement_type text,
  p_intention_id uuid,
  p_session text,
  p_statut_session text,          -- 'open' | 'complete' | 'expired'
  p_paiement_recu boolean,        -- vrai quand le prestataire a encaissé (carte, ou SEPA confirmé)
  p_paiement_echoue boolean,      -- vrai quand le prélèvement SEPA a été rejeté
  p_moyen public.moyen_paiement_enum,
  p_montant_centimes integer,
  p_client_prestataire text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intention public.intentions_souscription;
  v_abonnement_id uuid;
  v_statut public.abonnement_statut_enum;
  v_statut_coach public.statut_verification_enum;
begin
  if p_evenement_id is not null then
    insert into public.evenements_prestataire (id, type)
    values (p_evenement_id, p_evenement_type)
    on conflict (id) do nothing;
    if not found then
      return 'deja_traite';
    end if;
  end if;

  select * into v_intention from public.intentions_souscription
   where id = p_intention_id for update;
  if not found then
    -- 0038 (docs/backend.md §12, « 5xx seulement quand un nouvel essai pourrait réussir ») :
    -- l'intention est toujours enregistrée AVANT la création de la session ; introuvable, elle a
    -- disparu (compte du client supprimé après avoir payé) et ne reviendra jamais. Refus
    -- définitif -> anomalie, l'événement est accepté, jamais relivré en boucle.
    insert into public.anomalies_paiement (session_prestataire, intention_id, motif)
    values (p_session, p_intention_id, 'intention_inconnue')
    on conflict (session_prestataire, motif) do nothing;
    return 'intention_inconnue';
  end if;
  if v_intention.session_prestataire is null then
    update public.intentions_souscription set session_prestataire = p_session where id = p_intention_id;
  elsif v_intention.session_prestataire <> p_session then
    raise exception 'session_incoherente';
  end if;

  if p_statut_session = 'open' then
    return 'non_terminee';
  elsif p_statut_session = 'expired' then
    return 'expiree';
  elsif p_statut_session is distinct from 'complete' then
    raise exception 'statut_session_inconnu';
  end if;

  -- Défense : le montant encaissé est celui que l'intention a figé, jamais un autre.
  if p_montant_centimes is distinct from v_intention.prix_fige_centimes then
    raise exception 'montant_incoherent';
  end if;
  -- Une carte n'aboutit jamais sans encaissement : un tel état serait une erreur, pas un cas.
  if p_moyen = 'carte' and not p_paiement_recu then
    raise exception 'etat_incoherent';
  end if;

  -- Coach écarté depuis l'intention : seul 'verifiee' est honoré, et seulement tant qu'aucun
  -- abonnement n'existe pour ce paiement (un abonnement SEPA déjà créé suit sa propre machine,
  -- docs/dette.md). Vérifié ICI, avant souscrire_abonnement, parce que celle-ci LÈVE
  -- coach_non_verifie : une exception ferait répondre 500 au webhook, et le prestataire
  -- relivrerait pendant des jours un paiement qu'on ne prendra jamais.
  if not exists (select 1 from public.abonnements where reference_paiement = p_session) then
    select pc.statut_verification into v_statut_coach
      from public.offres o join public.profils_coach pc on pc.id = o.coach_id
     where o.id = v_intention.offre_id;
    if v_statut_coach is distinct from 'verifiee' then
      insert into public.anomalies_paiement
        (session_prestataire, intention_id, motif, statut_coach_constate)
      values (p_session, p_intention_id, 'coach_ecarte', v_statut_coach)
      on conflict (session_prestataire, motif) do nothing;
      return 'coach_ecarte';
    end if;
  end if;

  -- 0043 : règle d'abonnement unique (docs/domaine.md §3.2). Deux intentions ouvertes en
  -- parallèle peuvent toutes deux être payées : la seconde ne crée JAMAIS un second abonnement
  -- en cours. Payée quand même : anomalie (un remboursement est à faire, à la main), 200 au
  -- prestataire -- une relivraison ne changerait rien (docs/backend.md §12). Seulement tant
  -- qu'aucun abonnement n'existe pour CE paiement : un abonnement déjà créé suit sa machine.
  if not exists (select 1 from public.abonnements where reference_paiement = p_session)
     and exists (
       select 1
         from public.abonnements a
         join public.offres o on o.coach_id = a.profil_coach_id
        where o.id = v_intention.offre_id
          and a.profil_client_id = v_intention.profil_client_id
          and a.statut not in ('resilie', 'annule')
     ) then
    insert into public.anomalies_paiement (session_prestataire, intention_id, motif)
    values (p_session, p_intention_id, 'abonnement_existant')
    on conflict (session_prestataire, motif) do nothing;
    return 'abonnement_existant';
  end if;

  -- Idempotente par la référence de paiement (= la session) : rend l'abonnement existant s'il
  -- a déjà été créé par l'autre chemin. Carte -> actif et facturé ; SEPA -> en_attente.
  v_abonnement_id := public.souscrire_abonnement(
    v_intention.profil_client_id, v_intention.offre_id, p_moyen, p_session,
    v_intention.prix_fige_centimes, v_intention.cree_le
  );

  update public.abonnements
     set reference_client_prestataire = p_client_prestataire
   where id = v_abonnement_id and reference_client_prestataire is null;

  select statut into v_statut from public.abonnements where id = v_abonnement_id;
  if p_moyen = 'sepa' and v_statut = 'en_attente_confirmation' then
    if p_paiement_recu then
      perform public.confirmer_premier_prelevement(v_abonnement_id);
    elsif p_paiement_echoue then
      perform public.rejeter_premier_prelevement(v_abonnement_id);
    end if;
  end if;

  return 'abonne';
end;
$$;

revoke execute on function public.synchroniser_session_paiement(
  text, text, uuid, text, text, boolean, boolean, public.moyen_paiement_enum, integer, text
) from public, anon, authenticated, service_role;
grant execute on function public.synchroniser_session_paiement(
  text, text, uuid, text, text, boolean, boolean, public.moyen_paiement_enum, integer, text
) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. souscrire_abonnement
-- ---------------------------------------------------------------------------------------------

create or replace function public.souscrire_abonnement(
  p_profil_client_id uuid,
  p_offre_id uuid,
  p_moyen public.moyen_paiement_enum,
  p_reference_paiement text,
  p_prix_fige_centimes integer,
  p_intention_creee_le timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_offre public.offres;
  v_coach public.profils_coach;
  v_compte_client uuid;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_jour smallint;
begin
  select id into v_id from public.abonnements where reference_paiement = p_reference_paiement;
  if found then
    return v_id;
  end if;

  select compte_id into v_compte_client from public.profils_client where id = p_profil_client_id;
  if v_compte_client is null then
    raise exception 'profil_client_inconnu';
  end if;

  if p_intention_creee_le is null then
    raise exception 'intention_requise';
  end if;

  -- 0038 : l'offre n'est PLUS revérifiée ici (docs/domaine.md §3.3, révisé le 3 octobre 2026).
  -- Elle l'a été à la création de l'intention ; un paiement encaissé est honoré quel que soit
  -- l'état présent de l'offre, et quel que soit le délai avant son traitement. On ne la lit que
  -- pour son coach. Introuvable : impossible par ce chemin (l'intention disparaît avec l'offre,
  -- 0037, on delete cascade) -- invariant, pas un cas.
  select * into v_offre from public.offres where id = p_offre_id;
  if not found then
    raise exception 'offre_indisponible';
  end if;

  select * into v_coach from public.profils_coach where id = v_offre.coach_id;
  if v_coach.statut_verification <> 'verifiee' then
    raise exception 'coach_non_verifie';
  end if;

  -- docs/domaine.md §3.2 : même compte des deux côtés -> refus (409, docs/api.md §1).
  if v_coach.compte_id = v_compte_client then
    raise exception 'auto_abonnement_interdit';
  end if;

  -- 0043 : règle d'abonnement unique (docs/domaine.md §3.2). Invariant : le seul appelant,
  -- synchroniser_session_paiement, consigne ce cas en anomalie AVANT d'appeler. Si cette levée
  -- arrive, c'est un défaut (ou deux traitements simultanés) : le 5xx qui en résulte le rend
  -- visible, et la relivraison suivante tombera sur l'anomalie. L'index unique partiel plus bas
  -- tient la règle même entre deux transactions qui passeraient ce test ensemble.
  if exists (
    select 1 from public.abonnements
     where profil_client_id = p_profil_client_id
       and profil_coach_id = v_offre.coach_id
       and statut not in ('resilie', 'annule')
  ) then
    raise exception 'deja_abonne';
  end if;

  v_jour := public.jour_prelevement_pour(v_aujourdhui);

  insert into public.abonnements (
    profil_client_id, profil_coach_id, offre_id, moyen, reference_paiement,
    prix_fige_centimes, jour_prelevement, statut, actif_depuis_le, prochain_prelevement_le
  )
  values (
    p_profil_client_id, v_offre.coach_id, p_offre_id, p_moyen, p_reference_paiement,
    p_prix_fige_centimes, v_jour,
    case p_moyen when 'carte' then 'actif' else 'en_attente_confirmation' end::public.abonnement_statut_enum,
    -- La contrainte abonnements_actif_depuis_coherent exige actif_depuis_le dès l'insertion en
    -- 'actif' : posée dans l'insertion elle-même, pas par une mise à jour qui suivrait.
    case p_moyen when 'carte' then now() end,
    public.echeance_suivante(v_aujourdhui, v_jour)
  )
  on conflict (reference_paiement) do nothing
  returning id into v_id;

  -- Deux appels simultanés pour le même paiement : le second n'a rien inséré, il rend l'id du
  -- premier, sans rejouer la première entrée en actif.
  if v_id is null then
    select id into v_id from public.abonnements where reference_paiement = p_reference_paiement;
    return v_id;
  end if;

  if p_moyen = 'carte' then
    -- actif_depuis_le est déjà posée par l'insertion : la fonction ne la retouche pas (garde
    -- « is null »), elle pose les deux autres effets.
    perform public.entrer_en_actif_premiere_fois(v_id);
    -- 0036 : la carte est payée à la souscription -> facture et ligne de commission, dans la
    -- même transaction (docs/domaine.md §4.4 : « succès -> facture émise, ligne de commission
    -- créée »). APRÈS entrer_en_actif_premiere_fois : c'est elle qui pose la date de fin de
    -- commission offerte que la ligne lit.
    perform public.emettre_facture_payee(
      v_id, p_reference_paiement, p_prix_fige_centimes,
      v_aujourdhui, public.echeance_suivante(v_aujourdhui, v_jour) - 1
    );
  end if;

  return v_id;
end;
$$;

revoke execute on function public.souscrire_abonnement(
  uuid, uuid, public.moyen_paiement_enum, text, integer, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.souscrire_abonnement(
  uuid, uuid, public.moyen_paiement_enum, text, integer, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. La garantie en base
-- ---------------------------------------------------------------------------------------------

create unique index abonnements_un_en_cours_par_coach
  on public.abonnements (profil_client_id, profil_coach_id)
  where statut not in ('resilie', 'annule');

-- ---------------------------------------------------------------------------------------------
-- 5. anomalies_paiement_ouvertes
-- ---------------------------------------------------------------------------------------------

create or replace function public.anomalies_paiement_ouvertes()
returns table (
  id uuid,
  session_prestataire text,
  motif public.anomalie_paiement_motif_enum,
  constatee_le timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.session_prestataire, a.motif, a.constatee_le
    from public.anomalies_paiement a
   where a.resolue_le is null
     -- motif comparé en texte : abonnement_existant est ajouté à l'énumération par 0042, et une
     -- fonction SQL est analysée à sa création -- le texte évite toute dépendance à l'ordre.
     and a.motif::text not in ('coach_ecarte', 'intention_inconnue', 'abonnement_existant')
   order by a.constatee_le, a.id;
$$;

revoke execute on function public.anomalies_paiement_ouvertes()
  from public, anon, authenticated, service_role;
grant execute on function public.anomalies_paiement_ouvertes() to service_role;
