-- Identite : comptes, profils client/coach, consentements.
-- Sources : docs/domaine.md §2 (regles transverses), §3.1 (Compte), §3.2 (ProfilClient /
-- ProfilCoach), §3.12 (Consentement), §4.1 (machine Compte), §4.2 (machine Verification du
-- coach) ; docs/backend.md (conventions de schema, grants, RLS).
--
-- Aucune politique RLS ici : elles arrivent en P1.4. RLS est neanmoins ACTIVEE sur chaque table
-- ci-dessous, explicitement — voir la note en bas de fichier sur pourquoi ce n'est pas
-- redondant avec le reglage de projet.

-- ---------------------------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------------------------

-- docs/domaine.md §3.1 : "profilActif | client | coach | dernier espace utilise".
create type public.profil_actif_enum as enum ('client', 'coach');

-- docs/domaine.md §4.2, les six statuts de la machine a etats, dans l'ordre du schema.
create type public.statut_verification_enum as enum (
  'absente',
  'en_examen',
  'complement_demande',
  'verifiee',
  'refusee',
  'revoquee'
);

-- ---------------------------------------------------------------------------------------------
-- Table comptes
-- ---------------------------------------------------------------------------------------------

-- id = auth.users.id : pas d'identifiant separe, l'identite et le secret restent dans le
-- schema auth (Supabase Auth), docs/domaine.md §3.1. ON DELETE CASCADE : si la ligne auth.users
-- disparait un jour (purge reelle a J+30, docs/domaine.md §2), la ligne comptes ne doit pas
-- rester orpheline.
create table public.comptes (
  id uuid primary key references auth.users (id) on delete cascade,
  date_naissance date not null,
  telephone text,
  profil_actif public.profil_actif_enum not null default 'client',
  -- docs/ecrans/L1-02-creation-compte.md : "Pas de case a cocher : l'acceptation est portee par
  -- le geste de creation, et enregistree avec sa version." Donc NOT NULL : un compte cree sans
  -- version de CGU enregistree ne devrait jamais exister.
  cgu_version_acceptee text not null,
  cree_le timestamptz not null default now(),
  supprime_le timestamptz
);

-- ---------------------------------------------------------------------------------------------
-- Table profils_client
-- ---------------------------------------------------------------------------------------------

create table public.profils_client (
  id uuid primary key default gen_random_uuid(),
  -- unique : un compte ne peut pas avoir deux profils client (docs/domaine.md §3.2, "0, 1 ou 2
  -- profils" — un de chaque type au maximum, jamais deux du meme type).
  compte_id uuid not null unique references public.comptes (id) on delete cascade,
  -- docs/ecrans/L1-05-onboarding-client.md, etape 1/4 : prenom seul obligatoire.
  prenom text not null,
  nom text,
  photo_url text,
  commune_insee text,
  -- docs/ecrans/L1-05, etape 2/4 : chips multi-selection, 0 a 8 valeurs figees. "Passer" cree un
  -- profil sans objectif : tableau vide, jamais NULL, pour ne pas avoir a distinguer les deux.
  objectifs text[] not null default '{}',
  rythme_hebdo text,
  -- Donnee de sante (CLAUDE.md §10) : aucune valeur par defaut, aucune logique ici — l'ecriture
  -- sous consentement est une regle d'application/RLS, pas de cette migration.
  poids_depart_grammes integer,
  poids_cible_grammes integer,
  -- docs/ecrans/L1-05 : "Un profil client existe des l'etape 1 validee." — la ligne n'existe
  -- qu'a partir de la, donc l'etape par defaut a la creation est 1.
  onboarding_etape smallint not null default 1,
  cree_le timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Table profils_coach
-- ---------------------------------------------------------------------------------------------

create table public.profils_coach (
  id uuid primary key default gen_random_uuid(),
  -- unique : meme regle que profils_client ci-dessus.
  compte_id uuid not null unique references public.comptes (id) on delete cascade,
  prenom text not null,
  -- docs/domaine.md §3.2 : contrairement a ProfilClient (nom facultatif, jamais public), le nom
  -- du coach est toujours requis — c'est une donnee publique du profil marchand.
  nom text not null,
  photo_url text,
  discipline text not null,
  -- titre_court et bio ne sont PAS collectes a l'activation (docs/ecrans/L1-08, etape 1/4 :
  -- seuls discipline et telephone) : ils arrivent via docs/ecrans/L1-09 ("edites mais non
  -- publies avant le lot L2"). Nullable ici, pas par choix de confort mais parce que rien ne
  -- les remplit encore au moment de la creation.
  titre_court text,
  bio text,
  commune_base_insee text,
  statut_verification public.statut_verification_enum not null default 'absente',
  cree_le timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Table consentements
-- ---------------------------------------------------------------------------------------------

-- Journal d'ajout seul, jamais mis a jour : la preuve d'un consentement doit pouvoir se
-- reconstituer plus tard (quel texte, quelle version, a quelle date, retire quand). Une mise a
-- jour ecraserait exactement ce qu'il faut pouvoir montrer. Un retrait de consentement crée une
-- NOUVELLE ligne avec accorde = false, jamais une modification de la precedente — donc pas de
-- contrainte d'unicite sur (compte_id, type) : plusieurs lignes par couple sont attendues.
-- Voir docs/domaine.md §3.12 et la vue consentements_courants plus bas, qui rend l'etat actuel
-- sans exposer le journal brut aux ecrans.
create table public.consentements (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  -- Pas d'enumeration ici : liste fermee dans docs/domaine.md §3.12 (donneesSante,
  -- notificationsPush, communicationsCommerciales), mais non demandee explicitement pour cette
  -- migration — texte libre pour l'instant, a durcir plus tard si besoin.
  type text not null,
  accorde boolean not null,
  -- Un consentement sans version est inutilisable (demande explicite).
  version text not null,
  horodatage timestamptz not null default now(),
  origine text not null
);

-- Sert la vue consentements_courants ci-dessous, et toute lecture "dernier consentement de ce
-- type pour ce compte".
create index consentements_compte_type_horodatage_idx
  on public.consentements (compte_id, type, horodatage desc);

-- ---------------------------------------------------------------------------------------------
-- Declencheur : 18 ans minimum, a l'insertion ET a la mise a jour
-- ---------------------------------------------------------------------------------------------

-- Pas une contrainte CHECK : Postgres refuse une fonction non IMMUTABLE (age()/now() en
-- dependent) dans un CHECK. D'ou un declencheur, seul mecanisme qui peut comparer une colonne a
-- la date du jour a chaque ecriture.
create or replace function public.verifier_age_majeur()
returns trigger
language plpgsql
as $$
begin
  if age(new.date_naissance) < interval '18 years' then
    raise exception 'My fav Coach est reserve aux majeurs : % indique moins de 18 ans.', new.date_naissance
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger avant_ecriture_compte_verifie_age
  before insert or update on public.comptes
  for each row
  execute function public.verifier_age_majeur();

-- ---------------------------------------------------------------------------------------------
-- Declencheur : creation automatique de la ligne comptes a la creation d'un auth.users
-- ---------------------------------------------------------------------------------------------

-- SECURITY DEFINER : ce declencheur s'execute dans le contexte de l'inscription (role interne
-- de Supabase Auth sur le schema auth), qui n'a et ne doit pas avoir de droit d'ecriture sur
-- public.comptes. En executant avec les privileges du proprietaire de la fonction (le role de
-- migration), l'insertion reussit sans qu'aucun GRANT supplementaire n'ait a etre ouvert pour
-- ce chemin — l'application, elle, n'insere jamais directement dans comptes (voir grants).
--
-- date_naissance et cgu_version_acceptee voyagent en metadonnee utilisateur
-- (auth.signUp({ email, password, options: { data: { dateNaissance, cguVersionAcceptee } } }),
-- docs/api.md §2). Leur absence est une erreur explicite, pas un NULL silencieux qui laisserait
-- la contrainte NOT NULL de comptes echouer avec un message generique.
create or replace function public.creer_compte_depuis_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  date_naissance_brute text := new.raw_user_meta_data ->> 'date_naissance';
  cgu_version_brute text := new.raw_user_meta_data ->> 'cgu_version_acceptee';
begin
  if date_naissance_brute is null then
    raise exception 'Inscription refusee : date_naissance absente des metadonnees auth.users (options.data.dateNaissance attendu a l''appel de auth.signUp).';
  end if;

  if cgu_version_brute is null then
    raise exception 'Inscription refusee : cgu_version_acceptee absente des metadonnees auth.users (docs/ecrans/L1-02-creation-compte.md : l''acceptation des CGU doit etre enregistree avec sa version).';
  end if;

  insert into public.comptes (id, date_naissance, cgu_version_acceptee)
  values (new.id, date_naissance_brute::date, cgu_version_brute);

  return new;
end;
$$;

create trigger apres_creation_utilisateur_auth
  after insert on auth.users
  for each row
  execute function public.creer_compte_depuis_auth();

-- ---------------------------------------------------------------------------------------------
-- RLS : activee, sans politique
-- ---------------------------------------------------------------------------------------------

-- Le reglage de projet "RLS activee a la creation" (CLAUDE.md §2) s'applique de facon fiable
-- aux tables creees depuis le Table Editor du tableau de bord — pas garanti, selon la
-- documentation Supabase elle-meme, pour des tables creees par migration SQL. Plutot que de
-- compter sur un reglage qu'on ne peut pas verifier ligne par ligne depuis ce fichier, chaque
-- table l'active explicitement ici. Ce que ca donne, operation par operation, sans aucune
-- politique : docs/backend.md §5.
alter table public.comptes enable row level security;
alter table public.profils_client enable row level security;
alter table public.profils_coach enable row level security;
alter table public.consentements enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Vue : etat courant des consentements
-- ---------------------------------------------------------------------------------------------

-- consentements est un journal d'ajout (voir plus haut) : ceci en tire la derniere ligne par
-- couple (compte_id, type), pour que les ecrans lisent "l'etat maintenant" sans jamais
-- interroger le journal brut eux-memes.
--
-- security_invoker = true (Postgres 15+) est deliberement pose : sans cette option, une vue
-- s'execute par defaut avec les privileges de son PROPRIETAIRE (le role de migration), ce qui
-- contournerait entierement RLS des que des politiques existeront sur consentements (P1.4) —
-- la vue montrerait alors TOUTES les lignes de TOUS les comptes a n'importe quel utilisateur
-- authentifie. Avec security_invoker, la vue applique RLS comme si l'utilisateur interrogeait
-- la table directement.
create view public.consentements_courants
  with (security_invoker = true)
as
select distinct on (compte_id, type) *
from public.consentements
order by compte_id, type, horodatage desc;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------

-- Exposition automatique des nouvelles tables desactivee sur ce projet (CLAUDE.md §2) : sans
-- les GRANT ci-dessous, PostgREST renvoie "introuvable" pour ces relations meme apres une
-- migration reussie. Chaque grant est justifie a cote de sa ligne ; aucun GRANT ALL, aucun
-- grant a "anon" (tout ici porte des donnees de compte authentifie, jamais de contenu public).
--
-- UPDATE est accorde colonne par colonne, jamais table entiere : un GRANT UPDATE au niveau
-- table sur une colonne comme profil_actif ou statut_verification laisserait l'application
-- l'ecrire directement, court-circuitant la fonction serveur qui doit seule en decider
-- (basculer_profil pour profil_actif, l'examen humain pour statut_verification, P1.4/L2). Une
-- colonne absente de la liste UPDATE n'est pas oubliee : elle est protegee.

-- comptes : ne se cree jamais depuis l'application (seule creation : le declencheur SECURITY
-- DEFINER a l'inscription). Jamais de DELETE : pas de suppression physique (docs/domaine.md
-- §2), toujours un supprime_le horodate — mais meme supprime_le n'est PAS dans la liste
-- UPDATE : la purge est une tache serveur (docs/dette.md), pas un geste applicatif.
-- Seul telephone est modifiable par l'application :
--   - profil_actif protege : seule basculer_profil (P1.4) doit pouvoir le changer, apres avoir
--     verifie que le profil demande existe et appartient au compte.
--   - date_naissance protege : "non modifiable depuis l'application" (docs/ecrans/L1-09) —
--     c'est la colonne qui porte la regle des 18 ans, la rendre modifiable ouvrirait le
--     contournement que le declencheur ferme par ailleurs.
--   - cgu_version_acceptee protege : une acceptation de CGU ne se corrige pas, elle se
--     re-enregistre a la prochaine version — l'ecrire a la main casserait la trace.
--   - supprime_le protege : voir ci-dessus, tache serveur uniquement.
grant select on public.comptes to authenticated;
grant update (telephone) on public.comptes to authenticated;

-- profils_client : cree directement par l'application a l'etape 1 de l'onboarding
-- (docs/ecrans/L1-05, docs/api.md §3 : servi par PostgREST direct, pas une fonction). Jamais de
-- DELETE : aucune regle du domaine ne supprime un profil.
-- Toutes les colonnes editables par le client sont accordees en UPDATE, sauf :
--   - compte_id protege : un profil ne change jamais de proprietaire.
--   - id protege : cle primaire, la reassigner casserait toute reference future vers ce profil.
--   - cree_le protege : horodatage de creation, jamais reecrit.
grant select, insert on public.profils_client to authenticated;
grant update (
  prenom, nom, photo_url, commune_insee, objectifs, rythme_hebdo,
  poids_depart_grammes, poids_cible_grammes, onboarding_etape
) on public.profils_client to authenticated;

-- profils_coach : meme raisonnement que profils_client. La creation reelle passera par la
-- fonction de base "creer_profil_coach" (docs/api.md §3, pas encore ecrite a ce lot) plutot que
-- par un INSERT direct de l'ecran, mais le grant baseline reste necessaire des maintenant :
-- soit la fonction future est SECURITY INVOKER (elle s'executera alors avec les privileges de
-- l'utilisateur connecte, donc a besoin de ce grant), soit elle est SECURITY DEFINER (le grant
-- ne sert alors qu'a la lecture/mise a jour ulterieures depuis docs/ecrans/L1-09) — dans les
-- deux cas, le grant est correct a poser des cette migration.
-- Toutes les colonnes editables par le coach sont accordees en UPDATE, sauf :
--   - compte_id protege : meme raison que profils_client.
--   - id protege : meme raison que profils_client.
--   - cree_le protege : meme raison que profils_client.
--   - statut_verification protege : seul l'examen humain (lot L2) fait progresser ce statut —
--     l'ecrire depuis l'application reviendrait a s'auto-certifier.
grant select, insert on public.profils_coach to authenticated;
grant update (
  prenom, nom, photo_url, discipline, titre_court, bio, commune_base_insee
) on public.profils_coach to authenticated;

-- consentements : journal d'ajout seul (voir la table plus haut). SELECT et INSERT
-- uniquement — aucun UPDATE, aucun DELETE : la preuve d'un consentement passe doit rester
-- intacte, un retrait crée une nouvelle ligne (accorde = false), il n'en modifie jamais une
-- existante.
grant select, insert on public.consentements to authenticated;

-- consentements_courants : la vue que les ecrans interrogent (jamais le journal brut). Lecture
-- seule par nature — une vue construite sur DISTINCT ON n'est de toute facon pas modifiable par
-- Postgres, mais le grant reste explicite comme pour toute autre relation exposee.
grant select on public.consentements_courants to authenticated;

-- service_role n'a besoin d'aucun grant explicite : il contourne RLS et a deja acces a tout le
-- schema public par defaut sur un projet Supabase (docs/backend.md §6).
