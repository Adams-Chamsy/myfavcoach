-- Intentions de souscription, événements du prestataire, synchronisation d'une session de
-- paiement : L4, P4.5a (docs/api.md §7 ; docs/backend.md §12, §13 ; docs/domaine.md §3.3, §4.3).
-- Aucun appel au prestataire ici : les Edge Functions qui appellent ces fonctions sont P4.5b.
--
-- Trois appelants, jamais mélangés (docs/backend.md §12) :
--   - l'application, par l'Edge Function abonnement-intention ou abonnement-constat, AVEC LE
--     JETON DU CLIENT : creer_intention_souscription, mon_intention ;
--   - le serveur seul (Edge Functions, client service_role) : attacher_session_intention,
--     synchroniser_session_paiement ;
--   - personne d'autre.
--
-- Le lien intention <-> session de paiement ne vient JAMAIS du client : l'identifiant de
-- l'intention est posé par le serveur dans les metadata de la session, avec la clé secrète du
-- prestataire, et relu depuis le prestataire. Une fonction qui laisserait le client attacher
-- une session à SON intention lui permettrait d'y attacher la session payée par quelqu'un
-- d'autre -- et de recevoir l'abonnement à sa place (docs/backend.md §13, règle durable « un
-- lien entre deux objets ne se déclare jamais par le client quand le serveur peut le poser »).

-- ---------------------------------------------------------------------------------------------
-- Intentions (docs/domaine.md §3.3 : l'intention fige l'offre, titre et prix, 30 minutes)
-- ---------------------------------------------------------------------------------------------

create table public.intentions_souscription (
  id uuid primary key default gen_random_uuid(),
  profil_client_id uuid not null references public.profils_client (id) on delete cascade,
  offre_id uuid not null references public.offres (id) on delete cascade,
  titre_fige text not null,
  prix_fige_centimes integer not null check (prix_fige_centimes between 1000 and 50000),
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '30 minutes',
  -- Identifiant de la session de paiement du prestataire, posé une seule fois par le serveur.
  session_prestataire text unique
);

alter table public.intentions_souscription enable row level security;
revoke all on public.intentions_souscription from public, anon, authenticated, service_role;
grant select on public.intentions_souscription to service_role;

-- Client du prestataire (Customer Stripe) qui porte le moyen de paiement enregistré, pour les
-- prélèvements d'échéance (P4.8, docs/backend.md §13). Aucun grant : absent de la liste de
-- colonnes accordée à authenticated par 0033, donc illisible par l'application.
alter table public.abonnements add column reference_client_prestataire text;

-- ---------------------------------------------------------------------------------------------
-- Événements du prestataire déjà traités (docs/backend.md §12, règle 1)
-- ---------------------------------------------------------------------------------------------

create table public.evenements_prestataire (
  id text primary key,
  type text not null,
  traite_le timestamptz not null default now()
);

alter table public.evenements_prestataire enable row level security;
revoke all on public.evenements_prestataire from public, anon, authenticated, service_role;
grant select on public.evenements_prestataire to service_role;

-- ---------------------------------------------------------------------------------------------
-- Anomalies de paiement (docs/domaine.md §3.3, coach écarté entre l'intention et le paiement)
-- ---------------------------------------------------------------------------------------------

-- Un paiement reçu qu'on a ACCEPTÉ (200 au prestataire, jamais une boucle d'échecs) sans créer
-- d'abonnement. Remonté par le rapprochement quotidien (docs/prompts/L4.md point 12) ;
-- remboursement à la main dans le tableau de bord du prestataire au jalon 1.
-- Une ligne par session et par motif : un second événement pour la même session (SEPA :
-- finalisation, puis succès du prélèvement) ne crée pas une seconde anomalie.
create type public.anomalie_paiement_motif_enum as enum ('coach_ecarte');

create table public.anomalies_paiement (
  id uuid primary key default gen_random_uuid(),
  session_prestataire text not null,
  -- set null, pas cascade : l'anomalie reste à traiter (un remboursement) même si le compte
  -- du client est supprimé entre-temps ; l'identifiant de session suffit au remboursement.
  intention_id uuid references public.intentions_souscription (id) on delete set null,
  motif public.anomalie_paiement_motif_enum not null,
  -- Le statut de vérification constaté au traitement : dit au rapprochement POURQUOI.
  statut_coach_constate public.statut_verification_enum not null,
  constatee_le timestamptz not null default now(),
  unique (session_prestataire, motif)
);

alter table public.anomalies_paiement enable row level security;
revoke all on public.anomalies_paiement from public, anon, authenticated, service_role;
grant select on public.anomalies_paiement to service_role;

-- ---------------------------------------------------------------------------------------------
-- 1. creer_intention_souscription -- le client, avec son jeton (04a, « Continuer »)
-- ---------------------------------------------------------------------------------------------

-- Mêmes refus que souscrire_abonnement (0033), vérifiés AVANT tout appel au prestataire : on ne
-- crée jamais une page de paiement pour une vente qui serait refusée ensuite. Le récapitulatif
-- est calculé ici (docs/api.md §15 : l'application ne calcule rien).
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
-- 2. mon_intention -- le client, avec son jeton (constat au retour, docs/api.md §7)
-- ---------------------------------------------------------------------------------------------

-- Rend la session de paiement d'une intention DU COMPTE APPELANT, pour que l'Edge Function la
-- relise chez le prestataire. Une intention d'autrui et une intention inexistante lèvent le même
-- message. Ne rend ni prix ni profil : seulement de quoi interroger le prestataire.
create or replace function public.mon_intention(p_intention_id uuid)
returns table (session_prestataire text, expire_le timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'intention_introuvable';
  end if;
  return query
  select i.session_prestataire, i.expire_le
    from public.intentions_souscription i
    join public.profils_client pc on pc.id = i.profil_client_id
   where i.id = p_intention_id and pc.compte_id = auth.uid();
  if not found then
    raise exception 'intention_introuvable';
  end if;
end;
$$;

revoke execute on function public.mon_intention(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.mon_intention(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. attacher_session_intention -- le serveur seul, juste après avoir créé la session
-- ---------------------------------------------------------------------------------------------

-- Posée une seule fois. Une seconde pose, même identique, ne change rien ; une pose différente
-- lève : une intention n'a jamais deux sessions.
create or replace function public.attacher_session_intention(p_intention_id uuid, p_session text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actuelle text;
begin
  select session_prestataire into v_actuelle
    from public.intentions_souscription where id = p_intention_id for update;
  if not found then
    raise exception 'intention_inconnue';
  end if;
  if v_actuelle is null then
    update public.intentions_souscription set session_prestataire = p_session where id = p_intention_id;
  elsif v_actuelle <> p_session then
    raise exception 'session_incoherente';
  end if;
end;
$$;

revoke execute on function public.attacher_session_intention(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.attacher_session_intention(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. synchroniser_session_paiement -- le serveur seul : webhook ET constat
-- ---------------------------------------------------------------------------------------------

-- UNE fonction pour les deux chemins (docs/api.md §7 : le premier des deux crée l'abonnement,
-- le second ne fait rien). Elle reçoit l'état COURANT de la session, relu chez le prestataire par
-- l'Edge Function au moment du traitement -- jamais l'état porté par l'événement reçu, qui peut
-- être ancien : c'est ce qui rend l'ordre d'arrivée indifférent (docs/backend.md §12, règle 2).
-- Chaque transition ne part que de l'état où elle est permise ; rien ne fait jamais reculer un
-- abonnement.
--
-- p_evenement_id : identifiant de l'événement du prestataire (webhook), NULL pour le constat.
-- Inséré en premier, DANS la même transaction que tout le reste (règle 1) : un second envoi du
-- même événement rend 'deja_traite' sans rien écrire ; un traitement qui échoue annule aussi
-- l'insertion, et la relivraison suivante retraite l'événement.
--
-- Rend : 'deja_traite' | 'non_terminee' | 'expiree' | 'abonne' | 'coach_ecarte'.
-- 'coach_ecarte' (docs/domaine.md §3.3, révisé le 1er octobre 2026) : payé, mais le coach n'est
-- plus 'verifiee' et aucun abonnement n'existe encore pour cette session -> anomalie enregistrée,
-- AUCUNE exception (l'événement est accepté, jamais relivré en boucle), aucun abonnement.
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
    -- Lève -> le webhook répond 500 -> le prestataire relivrera. Jamais 200 en l'ignorant.
    raise exception 'intention_inconnue';
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
