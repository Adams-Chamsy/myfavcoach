-- Factures, lignes de commission, tentatives de prélèvement : L4, P4.4 (docs/prompts/L4.md ;
-- docs/domaine.md §3.4bis, §3.5, §3.10, §4.4, §5.5, précisés le 28 septembre 2026 avant ce SQL).
--
-- Ce que pose cette migration :
--   - factures : immuables, une série de numéros par coach et par année, sans trou ; chaque
--     facture porte sa propre copie des parties, du libellé et des montants, et AUCUN lien ne
--     l'entraîne dans une suppression (conservation dix ans, docs/domaine.md §2) ;
--   - lignes_commission : immuables, une par facture payée, taux lu une seule fois ;
--   - tentatives_prelevement : la table seulement -- les fonctions qui l'écrivent sont la tâche
--     planifiée de P4.8 ;
--   - l'émission branchée sur les deux paiements qui existent déjà (souscription par carte,
--     confirmation du premier prélèvement SEPA) -- les échéances suivantes viennent en P4.8 ;
--   - etat_paiement_abonnement : la lecture étroite dont 04c et 20 ont besoin, pas plus (C-05,
--     factures et reçus, est L5) ;
--   - un droit d'écriture du rôle serveur sur commission_offerte_jusqu_le, POUR LE BANC SEUL.
--
-- Ce qu'elle ne pose PAS : la facture de commission de la plateforme au coach (reportée en L5,
-- docs/prompts/L4.md), le PDF (L5, C-05), l'identité fiscale du coach (déclarée au domaine,
-- collectée en L5 -- d'ici là, HT, TVA et mentions fiscales restent vides : factures de mode test).

-- ---------------------------------------------------------------------------------------------
-- Immuabilité : un seul déclencheur, partagé par factures et lignes_commission
-- ---------------------------------------------------------------------------------------------

-- Pourquoi un déclencheur EN PLUS de l'absence de grants : les grants ferment les rôles de
-- l'API (anon, authenticated, service_role), pas le propriétaire des fonctions security definer
-- ni une future migration écrite trop vite. Le déclencheur ferme tout le monde, au niveau de la
-- ligne. Deux exceptions, et seulement deux :
--   - la suppression d'une ligne de plus de dix ans (fin de l'obligation de conservation,
--     docs/domaine.md §2) ;
--   - sur factures seulement, la pose UNIQUE de pdf_url (vide -> valeur) en L5, sans qu'aucune
--     autre colonne ne bouge.
create or replace function public.refuser_modification_piece_comptable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.emise_le < now() - interval '10 years' then
      return old;
    end if;
    raise exception 'piece_comptable_immuable';
  end if;
  -- IF imbriqués, pas une seule condition : Postgres ne garantit pas l'ordre d'évaluation d'un
  -- AND, et old.pdf_url n'existe pas sur lignes_commission.
  if tg_table_name = 'factures' then
    if old.pdf_url is null
       and new.pdf_url is not null
       and (to_jsonb(old) - 'pdf_url') = (to_jsonb(new) - 'pdf_url') then
      return new;
    end if;
  end if;
  raise exception 'piece_comptable_immuable';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Compteurs de numérotation : une série par coach et par année (docs/domaine.md §3.5)
-- ---------------------------------------------------------------------------------------------

-- Incrémenté par un upsert DANS la transaction qui insère la facture : la ligne du compteur est
-- verrouillée jusqu'au commit, deux émissions simultanées pour le même coach s'attendent l'une
-- l'autre, et si l'insertion de la facture échoue, l'incrément est annulé avec elle. Jamais une
-- séquence Postgres : une séquence n'est pas annulée par un rollback, elle laisserait un trou.
create table public.compteurs_factures (
  profil_coach_id uuid not null references public.profils_coach (id) on delete cascade,
  annee smallint not null,
  dernier_numero integer not null check (dernier_numero >= 1),
  primary key (profil_coach_id, annee)
);

alter table public.compteurs_factures enable row level security;
revoke all on public.compteurs_factures from public, anon, authenticated, service_role;
grant select on public.compteurs_factures to service_role;

-- ---------------------------------------------------------------------------------------------
-- Factures (docs/domaine.md §3.5)
-- ---------------------------------------------------------------------------------------------

-- Aucune clé étrangère vers abonnements, profils_client ni profils_coach, et c'est la règle,
-- pas un oubli : une clé étrangère entraînerait la facture dans la suppression de l'une de ces
-- lignes (cascade), ou bloquerait cette suppression (restrict), ou devrait modifier la facture
-- (set null) -- les trois contredisent une pièce immuable conservée dix ans. Les identifiants
-- restent, comme références ; tout ce que la facture prouve est copié dedans.
create table public.factures (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  -- Référence du paiement chez le prestataire : une facture par paiement encaissé, idempotente
  -- (webhook et constat, docs/api.md §7). Jamais lisible par l'application.
  reference_prestataire text not null unique,
  abonnement_id uuid not null,
  -- Vendeur : le coach (docs/domaine.md §3.5). Identité fiscale vide à L4 (§3.2).
  vendeur_profil_coach_id uuid not null,
  vendeur_prenom text not null,
  vendeur_nom text not null,
  vendeur_siren text,
  vendeur_adresse text,
  vendeur_regime_tva text,
  client_profil_id uuid not null,
  client_prenom text not null,
  client_nom text,
  libelle text not null,
  periode_du date not null,
  periode_au date not null,
  montant_ttc_centimes integer not null,
  -- Vides tant que le régime de TVA du vendeur est inconnu (toutes les factures de L4) : jamais
  -- devinés (docs/domaine.md §3.5).
  montant_ht_centimes integer,
  tva_centimes integer,
  commission_centimes integer not null,
  devise text not null default 'EUR',
  emise_le timestamptz not null default now(),
  payee_le timestamptz not null,
  pdf_url text,

  constraint factures_numero_unique_par_coach unique (vendeur_profil_coach_id, numero),
  constraint factures_numero_format check (numero ~ '^[0-9]{4}-[0-9]{6}$'),
  constraint factures_montant_positif check (montant_ttc_centimes > 0),
  constraint factures_ht_tva_ensemble check ((montant_ht_centimes is null) = (tva_centimes is null)),
  constraint factures_devise_eur check (devise = 'EUR'),
  constraint factures_periode_ordonnee check (periode_au >= periode_du),
  constraint factures_commission_bornee
    check (commission_centimes between 0 and montant_ttc_centimes)
);

create index factures_abonnement_idx on public.factures (abonnement_id);

create trigger factures_immuables
  before update or delete on public.factures
  for each row execute function public.refuser_modification_piece_comptable();

alter table public.factures enable row level security;
revoke all on public.factures from public, anon, authenticated, service_role;
-- select seulement : vérifier au banc. Aucune écriture directe, pour aucun rôle.
grant select on public.factures to service_role;

-- ---------------------------------------------------------------------------------------------
-- Lignes de commission (docs/domaine.md §3.10, §5.5)
-- ---------------------------------------------------------------------------------------------

create table public.lignes_commission (
  id uuid primary key default gen_random_uuid(),
  -- Une ligne par facture. La clé étrangère est sûre ici : une facture n'est jamais supprimée
  -- avant dix ans, et la ligne la suit alors (même déclencheur, même délai).
  facture_id uuid not null unique references public.factures (id) on delete cascade,
  profil_coach_id uuid not null,
  base_ttc_centimes integer not null,
  taux_applique smallint not null,
  montant_centimes integer not null,
  emise_le timestamptz not null default now(),

  constraint lignes_commission_taux check (taux_applique in (0, 10)),
  constraint lignes_commission_montant check (montant_centimes between 0 and base_ttc_centimes)
);

create trigger lignes_commission_immuables
  before update or delete on public.lignes_commission
  for each row execute function public.refuser_modification_piece_comptable();

alter table public.lignes_commission enable row level security;
revoke all on public.lignes_commission from public, anon, authenticated, service_role;
grant select on public.lignes_commission to service_role;

-- ---------------------------------------------------------------------------------------------
-- Tentatives de prélèvement (docs/domaine.md §3.4bis) -- la table seulement, écrite en P4.8
-- ---------------------------------------------------------------------------------------------

create type public.tentative_statut_enum as enum ('en_cours', 'reussie', 'echouee');
create type public.motif_banque_enum as enum (
  'fonds_insuffisants', 'carte_expiree', 'opposition', 'plafond_atteint',
  'authentification_echouee', 'inconnu'
);

create table public.tentatives_prelevement (
  id uuid primary key default gen_random_uuid(),
  -- Cascade : une tentative n'est pas une pièce comptable (la facture, elle, l'est) ; elle suit
  -- son abonnement.
  abonnement_id uuid not null references public.abonnements (id) on delete cascade,
  echeance_le date not null,
  tentative_numero smallint not null,
  statut public.tentative_statut_enum not null default 'en_cours',
  motif_banque public.motif_banque_enum,
  reference_prestataire text not null unique,
  tentee_le timestamptz not null default now(),
  terminee_le timestamptz,

  constraint tentatives_numero_borne check (tentative_numero between 1 and 3),
  constraint tentatives_une_par_numero unique (abonnement_id, echeance_le, tentative_numero),
  -- « motifBanque posé à l'échec, jamais deviné » (§3.4bis) : présent exactement à l'échec.
  constraint tentatives_motif_a_l_echec check ((statut = 'echouee') = (motif_banque is not null)),
  constraint tentatives_terminee_coherente check ((statut = 'en_cours') = (terminee_le is null))
);

alter table public.tentatives_prelevement enable row level security;
revoke all on public.tentatives_prelevement from public, anon, authenticated, service_role;
grant select on public.tentatives_prelevement to service_role;

-- ---------------------------------------------------------------------------------------------
-- Émission d'une facture payée et de sa ligne de commission
-- ---------------------------------------------------------------------------------------------

-- Aucun rôle ne reçoit EXECUTE : appelée par souscrire_abonnement et
-- confirmer_premier_prelevement ci-dessous (même propriétaire), puis par la tâche planifiée de
-- P4.8. Idempotente par la référence du paiement.
create or replace function public.emettre_facture_payee(
  p_abonnement_id uuid,
  p_reference_paiement text,
  p_montant_ttc_centimes integer,
  p_periode_du date,
  p_periode_au date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_abonnement public.abonnements;
  v_coach public.profils_coach;
  v_client public.profils_client;
  v_titre text;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_annee smallint := extract(year from v_aujourdhui)::smallint;
  v_sequence integer;
  v_taux smallint;
  v_commission integer;
begin
  select id into v_id from public.factures where reference_prestataire = p_reference_paiement;
  if found then
    return v_id;
  end if;

  select * into v_abonnement from public.abonnements where id = p_abonnement_id;
  select * into v_coach from public.profils_coach where id = v_abonnement.profil_coach_id;
  select * into v_client from public.profils_client where id = v_abonnement.profil_client_id;
  select titre into v_titre from public.offres where id = v_abonnement.offre_id;

  -- docs/domaine.md §5.5 : jour civil Europe/Paris du paiement, comparé au jour de fin de la
  -- commission offerte -- ce jour-là, le taux est déjà de 10 %. La date est posée par la
  -- première entrée en actif, toujours avant la première facture : son absence est un défaut,
  -- jamais un cas à deviner.
  if v_coach.commission_offerte_jusqu_le is null then
    raise exception 'commission_non_initialisee';
  end if;
  v_taux := case when v_aujourdhui < v_coach.commission_offerte_jusqu_le then 0 else 10 end;
  -- Arrondi au centime le plus proche, demi-centime vers le haut (montants positifs).
  v_commission := (p_montant_ttc_centimes * v_taux + 50) / 100;

  insert into public.compteurs_factures (profil_coach_id, annee, dernier_numero)
  values (v_coach.id, v_annee, 1)
  on conflict (profil_coach_id, annee)
  do update set dernier_numero = public.compteurs_factures.dernier_numero + 1
  returning dernier_numero into v_sequence;

  insert into public.factures (
    numero, reference_prestataire, abonnement_id,
    vendeur_profil_coach_id, vendeur_prenom, vendeur_nom,
    client_profil_id, client_prenom, client_nom,
    libelle, periode_du, periode_au,
    montant_ttc_centimes, commission_centimes, payee_le
  )
  values (
    v_annee::text || '-' || lpad(v_sequence::text, 6, '0'), p_reference_paiement, p_abonnement_id,
    v_coach.id, v_coach.prenom, v_coach.nom,
    v_client.id, v_client.prenom, v_client.nom,
    v_titre, p_periode_du, p_periode_au,
    p_montant_ttc_centimes, v_commission, now()
  )
  returning id into v_id;

  insert into public.lignes_commission (
    facture_id, profil_coach_id, base_ttc_centimes, taux_applique, montant_centimes
  )
  values (v_id, v_coach.id, p_montant_ttc_centimes, v_taux, v_commission);

  return v_id;
end;
$$;

revoke execute on function public.emettre_facture_payee(uuid, text, integer, date, date)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Les deux paiements qui existent déjà émettent désormais leur facture
-- ---------------------------------------------------------------------------------------------

-- Corps de 0033 recopiés tels quels, UN ajout chacun (marqué « 0036 ») : même signature, même
-- grants (CREATE OR REPLACE conserve les privilèges d'une fonction existante).
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

create or replace function public.confirmer_premier_prelevement(p_abonnement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut public.abonnement_statut_enum;
  v_abonnement public.abonnements;
begin
  select statut into v_statut from public.abonnements where id = p_abonnement_id for update;
  if v_statut is distinct from 'en_attente_confirmation' then
    raise exception 'transition_interdite';
  end if;
  update public.abonnements
     set statut = 'actif', actif_depuis_le = now()
   where id = p_abonnement_id;
  perform public.entrer_en_actif_premiere_fois(p_abonnement_id);
  -- 0036 : le premier prélèvement SEPA est confirmé -> facture et ligne de commission, même
  -- transaction. Période : du mandat (debute_le, qui fonde le cycle, docs/domaine.md §4.3) à la
  -- veille de la prochaine échéance.
  select * into v_abonnement from public.abonnements where id = p_abonnement_id;
  perform public.emettre_facture_payee(
    p_abonnement_id, v_abonnement.reference_paiement, v_abonnement.prix_fige_centimes,
    (v_abonnement.debute_le at time zone 'Europe/Paris')::date,
    v_abonnement.prochain_prelevement_le - 1
  );
end;
$$;

-- Droits réaffirmés à l'identique de 0033 (src/test/fonctions-execute-revoque.test.ts exige le
-- revoke dans le fichier qui crée ou remplace la fonction ; convention 0030 : tous les rôles).
revoke execute on function public.souscrire_abonnement(
  uuid, uuid, public.moyen_paiement_enum, text, integer, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.souscrire_abonnement(
  uuid, uuid, public.moyen_paiement_enum, text, integer, timestamptz
) to service_role;
revoke execute on function public.confirmer_premier_prelevement(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.confirmer_premier_prelevement(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Lecture étroite pour 04c et 20 (P4.4, point 4) -- pas l'écran des factures (C-05, L5)
-- ---------------------------------------------------------------------------------------------

-- Le client, sur SON abonnement, en espace client : montant et date de la dernière facture
-- (« Payé aujourd'hui », 04c), motif et date du dernier échec (écran 20), prochaine échéance.
-- Rien d'autre : ni numéro, ni référence du prestataire, ni commission, ni copie des parties.
-- Même garde que les transitions client de 0033 : un abonnement d'autrui et un abonnement
-- inexistant lèvent le même message.
create or replace function public.etat_paiement_abonnement(p_abonnement_id uuid)
returns table (
  derniere_facture_montant_centimes integer,
  derniere_facture_payee_le timestamptz,
  dernier_echec_motif public.motif_banque_enum,
  dernier_echec_le timestamptz,
  prochain_prelevement_le date
)
language plpgsql
stable
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
   where a.id = p_abonnement_id and pc.compte_id = auth.uid();
  if not found then
    raise exception 'abonnement_introuvable';
  end if;

  return query
  select
    (select f.montant_ttc_centimes from public.factures f
      where f.abonnement_id = p_abonnement_id order by f.emise_le desc limit 1),
    (select f.payee_le from public.factures f
      where f.abonnement_id = p_abonnement_id order by f.emise_le desc limit 1),
    (select t.motif_banque from public.tentatives_prelevement t
      where t.abonnement_id = p_abonnement_id and t.statut = 'echouee'
      order by t.terminee_le desc limit 1),
    (select t.terminee_le from public.tentatives_prelevement t
      where t.abonnement_id = p_abonnement_id and t.statut = 'echouee'
      order by t.terminee_le desc limit 1),
    v_abonnement.prochain_prelevement_le;
end;
$$;

revoke execute on function public.etat_paiement_abonnement(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.etat_paiement_abonnement(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Banc seulement : poser commission_offerte_jusqu_le (accordé le 28 septembre 2026)
-- ---------------------------------------------------------------------------------------------

-- Prouver la bascule au jour 90 et l'absence de recalcul d'un jour à l'autre suppose de poser
-- cette date sans attendre 90 jours (point 9 de docs/prompts/L4.md). Colonne seule, rôle serveur
-- seul : aucun écran ni aucune fonction applicative n'écrit cette date autrement que par
-- entrer_en_actif_premiere_fois (0033). Même famille que 0010 (statut_verification, banc).
grant update (commission_offerte_jusqu_le) on public.profils_coach to service_role;
