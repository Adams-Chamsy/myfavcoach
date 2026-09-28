-- Abonnements : L4, P4.3 (docs/prompts/L4.md ; docs/domaine.md §3.4, §4.3, §5.5, §3.15/§4.11 ;
-- docs/backend.md §13).
--
-- Ce que cette migration pose : la table abonnements, la machine à états de docs/domaine.md
-- §4.3 pour les transitions qui ne dépendent PAS d'un prélèvement d'échéance (souscription,
-- confirmation ou rejet du premier prélèvement SEPA, pause, reprise, résiliation -- programmée
-- depuis actif, immédiate depuis en_pause/impaye/suspendu -- et son annulation), la date de fin de commission offerte (§5.5), et la fermeture du fil de L3bis
-- (invitations -> 'abonnee', §4.11).
--
-- Ce qu'elle ne pose PAS, et où ça vient : factures et lignes de commission (P4.4) ; impayé,
-- suspension, fin de pause à échéance, fin de période d'une résiliation (tâche planifiée, P4.8) ;
-- départ du coach avec prorata (aucun écran ni prompt de L4 ne le déclenche).
--
-- Qui appelle quoi (docs/backend.md §12) :
--   - souscrire_abonnement, confirmer_premier_prelevement, rejeter_premier_prelevement : le
--     serveur SEUL (Edge Function du webhook, sous service_role) -- jamais l'application. Un
--     client qui pourrait appeler souscrire_abonnement se créerait un abonnement sans payer.
--   - demander_pause, reprendre_abonnement, demander_resiliation, annuler_resiliation : le
--     client, avec sa propre session (authenticated), sur SES abonnements seulement, en espace
--     client -- revalidé ici par auth.uid() et profil_actif_courant(), jamais par un paramètre.
--
-- Toute transition non listée par §4.3 lève 'transition_interdite' (docs/domaine.md §4 : « toute
-- transition non listée est interdite et doit lever une erreur explicite »).

create type public.abonnement_statut_enum as enum (
  'en_attente_confirmation',
  'actif',
  'en_pause',
  'impaye',
  'suspendu',
  'resiliation_programmee',
  'resilie',
  'annule'
);

create type public.moyen_paiement_enum as enum ('carte', 'sepa');

-- ---------------------------------------------------------------------------------------------
-- Commission offerte (docs/domaine.md §5.5) : sur profils_coach, AUCUN grant.
-- ---------------------------------------------------------------------------------------------

-- docs/backend.md §8 : depuis profils_coach_select_verifiee (0008), toute colonne de
-- profils_coach accordée en SELECT devient publique. Les grants de cette table sont colonne par
-- colonne (0022) : une colonne ajoutée sans être ajoutée à ces listes n'est lisible par
-- personne d'autre que le propriétaire des fonctions -- c'est la protection voulue ici, une
-- donnée commerciale du coach n'a rien à faire dans l'annuaire public. Type date (jour civil
-- Europe/Paris), pas timestamptz : la règle compare des jours (« jour 90 », porte de sortie de
-- L4, étape 5), pas des instants.
alter table public.profils_coach add column commission_offerte_jusqu_le date;

-- ---------------------------------------------------------------------------------------------
-- Table abonnements
-- ---------------------------------------------------------------------------------------------

-- ON DELETE CASCADE depuis les profils : même choix que le reste du dépôt, pour que la
-- suppression d'un compte (purge J+30, docs/domaine.md §2) ne laisse aucune ligne orpheline.
-- Les FACTURES, elles, devront survivre 10 ans (obligation comptable, §2) : ce sera à P4.4 de
-- leur donner une copie de ce qu'elles doivent prouver, jamais une dépendance qui les
-- effacerait avec l'abonnement.
create table public.abonnements (
  id uuid primary key default gen_random_uuid(),
  profil_client_id uuid not null references public.profils_client (id) on delete cascade,
  profil_coach_id uuid not null references public.profils_coach (id) on delete cascade,
  offre_id uuid not null references public.offres (id) on delete cascade,
  moyen public.moyen_paiement_enum not null,
  -- Identifiant de la session de paiement du prestataire (docs/backend.md §13). Unique : c'est
  -- lui qui rend la souscription idempotente -- le webhook et le constat (docs/api.md §7)
  -- peuvent l'appeler tous les deux pour le même paiement, un seul abonnement en naît. Jamais
  -- accordé en lecture à l'application : c'est un identifiant de paiement (CLAUDE.md §10).
  reference_paiement text not null unique,
  -- Montant réellement payé, fourni par le serveur depuis le prestataire -- figé ici, jamais
  -- relu sur l'offre, dont le prix peut changer après (docs/domaine.md §3.3).
  prix_fige_centimes integer not null,
  jour_prelevement smallint not null,
  statut public.abonnement_statut_enum not null,
  -- Mandat (SEPA) ou paiement (carte) : fonde jour_prelevement et prochain_prelevement_le
  -- (docs/domaine.md §4.3, en_attente_confirmation).
  debute_le timestamptz not null default now(),
  -- Première entrée en 'actif', posée une seule fois (docs/domaine.md §3.4) : base unique de
  -- l'éligibilité aux avis et de la durée de suivi affichée (§3.11).
  actif_depuis_le timestamptz,
  prochain_prelevement_le date not null,
  pause_jusqu_le date,
  -- Début de la dernière pause : « une fois par période de 12 mois » (§4.3) ne se vérifie pas
  -- sans elle. Champ ajouté à docs/domaine.md §3.4 au même prompt.
  derniere_pause_le date,
  resilie_le timestamptz,
  fin_acces_le date,
  cree_le timestamptz not null default now(),

  constraint abonnements_prix_bornes check (prix_fige_centimes between 1000 and 50000),
  constraint abonnements_jour_prelevement_borne check (jour_prelevement between 1 and 28),
  -- actif_depuis_le est nulle exactement quand l'abonnement n'a jamais été actif.
  constraint abonnements_actif_depuis_coherent check (
    (statut in ('en_attente_confirmation', 'annule')) = (actif_depuis_le is null)
  ),
  constraint abonnements_pause_coherente check (
    (statut = 'en_pause') = (pause_jusqu_le is not null)
  ),
  constraint abonnements_fin_acces_coherente check (
    statut not in ('resiliation_programmee', 'resilie') or fin_acces_le is not null
  )
);

create index abonnements_profil_client_idx on public.abonnements (profil_client_id);
create index abonnements_profil_coach_idx on public.abonnements (profil_coach_id);

alter table public.abonnements enable row level security;

-- Lecture : le client, ses propres abonnements, en espace client seulement (docs/domaine.md §2 :
-- table de contenu, lecture stricte). Aucune lecture coach à L4 (pilotage, L7). Aucune
-- politique INSERT/UPDATE/DELETE : toute écriture passe par les fonctions ci-dessous.
create policy abonnements_select_client
  on public.abonnements for select to authenticated
  using (
    public.profil_actif_courant() = 'client'
    and profil_client_id in (select id from public.profils_client where compte_id = auth.uid())
  );

-- Convention 0006/0030 : revoke explicite de tous les rôles, puis grants étroits.
revoke all on public.abonnements from public, anon, authenticated, service_role;

-- reference_paiement exclue : identifiant de paiement, jamais lisible par l'application.
grant select (
  id, profil_client_id, profil_coach_id, offre_id, moyen, prix_fige_centimes, jour_prelevement,
  statut, debute_le, actif_depuis_le, prochain_prelevement_le, pause_jusqu_le,
  derniere_pause_le, resilie_le, fin_acces_le, cree_le
) on public.abonnements to authenticated;

-- service_role (règle 11 de docs/prompts/L4.md, écrite dans la migration qui crée la table) :
-- select pour vérifier au banc ; update de trois dates SEULEMENT, pour que le banc simule une
-- ancienneté sans attendre (point 9 de docs/prompts/L4.md : avis à 30/60 jours, pause une fois
-- par 12 mois). Jamais statut : un état ne se pose que par une transition de la machine, au banc
-- comme ailleurs. Aucun insert : même le banc souscrit par souscrire_abonnement.
grant select on public.abonnements to service_role;
grant update (actif_depuis_le, fin_acces_le, derniere_pause_le)
  on public.abonnements to service_role;

-- ---------------------------------------------------------------------------------------------
-- Calcul des dates (docs/domaine.md §3.4, §4.3) -- fonctions pures, testées au banc directement
-- ---------------------------------------------------------------------------------------------

-- Jour de la souscription, 29/30/31 ramenés à 28.
create or replace function public.jour_prelevement_pour(p_jour date)
returns smallint
language sql
immutable
set search_path = public
as $$
  select least(extract(day from p_jour)::integer, 28)::smallint;
$$;

-- « Aucun prorata à la souscription : le premier prélèvement est plein, l'échéance suivante
-- tombe au même jour du mois suivant » (§4.3) -- au jour_prelevement, déjà borné à 28, donc
-- toujours valide dans n'importe quel mois.
create or replace function public.echeance_suivante(p_depuis date, p_jour smallint)
returns date
language sql
immutable
set search_path = public
as $$
  select make_date(
    extract(year from m)::integer, extract(month from m)::integer, p_jour::integer
  )
  from (select (date_trunc('month', p_depuis) + interval '1 month')::date as m) mois_suivant;
$$;

revoke execute on function public.jour_prelevement_pour(date)
  from public, anon, authenticated, service_role;
grant execute on function public.jour_prelevement_pour(date) to service_role;
revoke execute on function public.echeance_suivante(date, smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.echeance_suivante(date, smallint) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Première entrée en 'actif' : trois effets posés UNE seule fois
-- ---------------------------------------------------------------------------------------------

-- Appelée seulement par les fonctions de ce fichier (security definer, même propriétaire) :
-- aucun rôle ne reçoit EXECUTE. Trois effets, chacun gardé contre un second passage :
--   1. actif_depuis_le -- jamais retouchée ensuite (§3.4) ;
--   2. commission_offerte_jusqu_le du coach -- « fixé une seule fois, jamais recalculé » (§5.5) :
--      la condition « is null » est la règle elle-même, pas une précaution ;
--   3. invitations -> 'abonnee' quand le client est arrivé par le lien de CE coach précisément
--      (§4.11, point 8 de docs/prompts/L4.md). Une invitation vers un autre coach ne bouge pas.
create or replace function public.entrer_en_actif_premiere_fois(p_abonnement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements;
  v_compte_client uuid;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into v_abonnement from public.abonnements where id = p_abonnement_id for update;

  update public.abonnements
     set actif_depuis_le = now()
   where id = p_abonnement_id and actif_depuis_le is null;

  update public.profils_coach
     set commission_offerte_jusqu_le = v_aujourdhui + 90
   where id = v_abonnement.profil_coach_id and commission_offerte_jusqu_le is null;

  select compte_id into v_compte_client
    from public.profils_client where id = v_abonnement.profil_client_id;

  update public.invitations
     set statut = 'abonnee', abonnee_le = now()
   where coach_id = v_abonnement.profil_coach_id
     and compte_invite_id = v_compte_client
     and statut = 'compte_cree';
end;
$$;

revoke execute on function public.entrer_en_actif_premiere_fois(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Souscription et premier prélèvement : serveur seulement (service_role)
-- ---------------------------------------------------------------------------------------------

-- Idempotente par p_reference_paiement : un second appel pour le même paiement rend le même
-- abonnement sans rien écrire (webhook et constat, docs/api.md §7).
-- L'intention fige l'offre (docs/domaine.md §3.3, tranché le 28 septembre 2026) : une offre
-- retirée APRÈS la création de l'intention reste souscrite tant que l'intention a moins de
-- 30 minutes -- retirer une offre ferme la vente future, jamais une vente en cours. La date
-- de l'intention vient du serveur (P4.5, table des intentions) ; la règle vit ici parce que
-- cette fonction naît ici, pas dans l'Edge Function.
-- Carte : l'abonnement naît 'actif'. SEPA : 'en_attente_confirmation' (§4.3), sans aucun des
-- trois effets de la première entrée en actif.
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

  select * into v_offre from public.offres where id = p_offre_id;
  -- En vente au moment de l'intention, et jamais un brouillon.
  if not found
     or v_offre.publiee_le is null
     or v_offre.publiee_le > p_intention_creee_le then
    raise exception 'offre_indisponible';
  end if;
  -- Retirée : acceptée seulement si le retrait suit l'intention ET que l'intention est récente.
  if v_offre.retiree_le is not null
     and (v_offre.retiree_le <= p_intention_creee_le
          or p_intention_creee_le < now() - interval '30 minutes') then
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
  end if;

  return v_id;
end;
$$;

-- en_attente_confirmation --(1er prélèvement confirmé)--> actif
create or replace function public.confirmer_premier_prelevement(p_abonnement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut public.abonnement_statut_enum;
begin
  select statut into v_statut from public.abonnements where id = p_abonnement_id for update;
  if v_statut is distinct from 'en_attente_confirmation' then
    raise exception 'transition_interdite';
  end if;
  update public.abonnements
     set statut = 'actif', actif_depuis_le = now()
   where id = p_abonnement_id;
  perform public.entrer_en_actif_premiere_fois(p_abonnement_id);
end;
$$;

-- en_attente_confirmation --(1er prélèvement rejeté)--> annule   [terminal]
create or replace function public.rejeter_premier_prelevement(p_abonnement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut public.abonnement_statut_enum;
begin
  select statut into v_statut from public.abonnements where id = p_abonnement_id for update;
  if v_statut is distinct from 'en_attente_confirmation' then
    raise exception 'transition_interdite';
  end if;
  update public.abonnements set statut = 'annule' where id = p_abonnement_id;
end;
$$;

revoke execute on function public.souscrire_abonnement(
  uuid, uuid, public.moyen_paiement_enum, text, integer, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.souscrire_abonnement(
  uuid, uuid, public.moyen_paiement_enum, text, integer, timestamptz
) to service_role;
revoke execute on function public.confirmer_premier_prelevement(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.confirmer_premier_prelevement(uuid) to service_role;
revoke execute on function public.rejeter_premier_prelevement(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.rejeter_premier_prelevement(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Transitions demandées par le client (authenticated, ses abonnements, espace client)
-- ---------------------------------------------------------------------------------------------

-- Retrouve un abonnement du compte appelant, verrouillé, ou lève 'abonnement_introuvable' --
-- le même message qu'il n'existe pas ou qu'il appartienne à un autre : rien n'est révélé sur
-- l'abonnement d'autrui. Aucun rôle ne reçoit EXECUTE : appelée par les quatre fonctions
-- ci-dessous seulement.
create or replace function public.mon_abonnement_verrouille(p_abonnement_id uuid)
returns public.abonnements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'abonnement_introuvable';
  end if;
  select a.* into v_abonnement
    from public.abonnements a
    join public.profils_client pc on pc.id = a.profil_client_id
   where a.id = p_abonnement_id and pc.compte_id = auth.uid()
   for update of a;
  if not found then
    raise exception 'abonnement_introuvable';
  end if;
  return v_abonnement;
end;
$$;

revoke execute on function public.mon_abonnement_verrouille(uuid)
  from public, anon, authenticated, service_role;

-- actif --(pause demandée)--> en_pause   [≤ 60 j, 1 fois / 12 mois]
create or replace function public.demander_pause(p_abonnement_id uuid, p_jusqu_au date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements := public.mon_abonnement_verrouille(p_abonnement_id);
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if v_abonnement.statut <> 'actif' then
    raise exception 'transition_interdite';
  end if;
  if p_jusqu_au is null or p_jusqu_au <= v_aujourdhui or p_jusqu_au > v_aujourdhui + 60 then
    raise exception 'duree_pause_invalide';
  end if;
  if v_abonnement.derniere_pause_le is not null
     and v_abonnement.derniere_pause_le > v_aujourdhui - interval '12 months' then
    raise exception 'pause_deja_utilisee';
  end if;
  update public.abonnements
     set statut = 'en_pause', pause_jusqu_le = p_jusqu_au, derniere_pause_le = v_aujourdhui
   where id = p_abonnement_id;
end;
$$;

-- en_pause --(reprise)--> actif. Un cycle complet repart du jour de reprise (docs/domaine.md
-- §4.3, tranché le 28 septembre 2026) : jour_prelevement recalculé sur ce jour, borné à 28, et
-- prochain_prelevement_le = ce jour -- le nouveau cycle s'ouvre par son prélèvement, exécuté
-- par la tâche planifiée (P4.8). La reprise « à échéance » (pause_jusqu_le atteinte) est cette
-- même tâche ; elle appliquera la même règle.
create or replace function public.reprendre_abonnement(p_abonnement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements := public.mon_abonnement_verrouille(p_abonnement_id);
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if v_abonnement.statut <> 'en_pause' then
    raise exception 'transition_interdite';
  end if;
  update public.abonnements
     set statut = 'actif',
         pause_jusqu_le = null,
         jour_prelevement = public.jour_prelevement_pour(v_aujourdhui),
         prochain_prelevement_le = v_aujourdhui
   where id = p_abonnement_id;
end;
$$;

-- Résiliation demandée par le client, toujours en fin de période payée (§4.3) :
--   actif --(résiliation client)--> resiliation_programmee : la période payée court encore, la
--     fin d'accès est la prochaine échéance, qui ne sera pas prélevée ;
--   en_pause|impaye|suspendu --(résiliation client)--> resilie : aucune période payée n'est en
--     cours de service, sa fin est déjà derrière -- effet le jour même, rien de plus facturé
--     (tranché le 28 septembre 2026 : ne pas pouvoir résilier en ligne depuis ces états est
--     exactement ce que la loi interdit).
create or replace function public.demander_resiliation(p_abonnement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements := public.mon_abonnement_verrouille(p_abonnement_id);
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if v_abonnement.statut = 'actif' then
    update public.abonnements
       set statut = 'resiliation_programmee',
           resilie_le = now(),
           fin_acces_le = v_abonnement.prochain_prelevement_le
     where id = p_abonnement_id;
  elsif v_abonnement.statut in ('en_pause', 'impaye', 'suspendu') then
    update public.abonnements
       set statut = 'resilie',
           resilie_le = now(),
           fin_acces_le = v_aujourdhui,
           pause_jusqu_le = null
     where id = p_abonnement_id;
  else
    raise exception 'transition_interdite';
  end if;
end;
$$;

-- resiliation_programmee --(annulation de la résiliation)--> actif
create or replace function public.annuler_resiliation(p_abonnement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements := public.mon_abonnement_verrouille(p_abonnement_id);
begin
  if v_abonnement.statut <> 'resiliation_programmee' then
    raise exception 'transition_interdite';
  end if;
  update public.abonnements
     set statut = 'actif', resilie_le = null, fin_acces_le = null
   where id = p_abonnement_id;
end;
$$;

revoke execute on function public.demander_pause(uuid, date)
  from public, anon, authenticated, service_role;
grant execute on function public.demander_pause(uuid, date) to authenticated;
revoke execute on function public.reprendre_abonnement(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reprendre_abonnement(uuid) to authenticated;
revoke execute on function public.demander_resiliation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.demander_resiliation(uuid) to authenticated;
revoke execute on function public.annuler_resiliation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.annuler_resiliation(uuid) to authenticated;
