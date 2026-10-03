-- Intention inconnue et offre retirée : reclassées selon la règle « un point d'entrée de webhook
-- ne répond 5xx que lorsqu'un nouvel essai pourrait réussir » (docs/backend.md §12, écrite le
-- 3 octobre 2026) -- L4, P4.5b.
--
-- 1. souscrire_abonnement ne revérifie plus l'offre (docs/domaine.md §3.3, révisé) : la fenêtre
--    de 30 minutes gouverne la création de la page de paiement, jamais le traitement d'un
--    paiement encaissé. Avant 0038, un événement relivré plus de 30 minutes après l'intention,
--    pour une offre retirée entre-temps, levait offre_indisponible -> 5xx -> relivré en boucle.
-- 2. synchroniser_session_paiement : intention_inconnue n'est plus une exception, mais une
--    anomalie et un résultat.
-- 3. enregistrer_anomalie_paiement : appelée par le point d'entrée quand la synchronisation LÈVE
--    sur une vraie incohérence (montant, session, statut, état) -- rien de métier n'a été écrit,
--    l'erreur reste une erreur, mais elle est consignée et l'événement accepté (200).

-- ---------------------------------------------------------------------------------------------
-- Anomalies : nouveaux motifs
-- ---------------------------------------------------------------------------------------------

-- ADD VALUE dans une transaction : permis, tant que la nouvelle valeur n'est pas UTILISÉE avant
-- la validation. Les corps plpgsql ci-dessous ne la lisent qu'à l'exécution, jamais ici.
alter type public.anomalie_paiement_motif_enum add value 'intention_inconnue';
alter type public.anomalie_paiement_motif_enum add value 'montant_incoherent';
alter type public.anomalie_paiement_motif_enum add value 'session_incoherente';
alter type public.anomalie_paiement_motif_enum add value 'statut_session_inconnu';
alter type public.anomalie_paiement_motif_enum add value 'etat_incoherent';

-- Plus de clé étrangère vers l'intention : une anomalie intention_inconnue désigne justement une
-- intention qui n'existe plus. L'identifiant reste une référence pour le rapprochement, comme les
-- pièces comptables de 0036 (aucune clé étrangère).
alter table public.anomalies_paiement
  drop constraint anomalies_paiement_intention_id_fkey;

-- Le statut du coach n'a de sens que pour coach_ecarte.
alter table public.anomalies_paiement alter column statut_coach_constate drop not null;
alter table public.anomalies_paiement
  add constraint anomalies_paiement_statut_coach_si_ecarte
  check ((motif = 'coach_ecarte') = (statut_coach_constate is not null));

-- ---------------------------------------------------------------------------------------------
-- 1. souscrire_abonnement : l'offre n'est plus revérifiée
-- ---------------------------------------------------------------------------------------------

-- Corps de 0036 recopié tel quel, sauf le bloc marqué « 0038 ». Même signature :
-- p_intention_creee_le n'est plus lue que pour sa présence (intention_requise) -- la garder évite
-- de changer la signature, donc les droits et tous les appelants, pour un paramètre devenu muet.
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
-- 2. synchroniser_session_paiement : intention_inconnue devient une anomalie
-- ---------------------------------------------------------------------------------------------

-- Corps de 0037 recopié tel quel, sauf le bloc marqué « 0038 ».
-- Rend désormais : 'deja_traite' | 'non_terminee' | 'expiree' | 'abonne' | 'coach_ecarte' |
-- 'intention_inconnue'. Lève encore -- vraies incohérences, rien d'écrit : session_incoherente,
-- statut_session_inconnu, montant_incoherent, etat_incoherent.
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
-- 3. enregistrer_anomalie_paiement -- le serveur seul, après une incohérence
-- ---------------------------------------------------------------------------------------------

-- Appelée par webhook-paiement et abonnement-constat quand synchroniser_session_paiement a levé
-- une des quatre incohérences : la transaction de la synchronisation a été annulée (rien de
-- métier écrit, identifiant d'événement compris), celle-ci est séparée. Une ligne par session et
-- par motif : une relivraison ne la double pas. coach_ecarte n'y passe jamais (il porte le statut
-- du coach, posé par la synchronisation elle-même ; la contrainte ci-dessus le refuserait).
create or replace function public.enregistrer_anomalie_paiement(
  p_session text,
  p_intention_id uuid,
  p_motif public.anomalie_paiement_motif_enum
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.anomalies_paiement (session_prestataire, intention_id, motif)
  values (p_session, p_intention_id, p_motif)
  on conflict (session_prestataire, motif) do nothing;
end;
$$;

revoke execute on function public.enregistrer_anomalie_paiement(
  text, uuid, public.anomalie_paiement_motif_enum
) from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_anomalie_paiement(
  text, uuid, public.anomalie_paiement_motif_enum
) to service_role;
