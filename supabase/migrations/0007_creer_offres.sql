-- Offres : une seule table, une seule nature (abonnement mensuel).
-- Sources : docs/domaine.md §3.3 (entite Offre) et §4.10 (machine a etats) ; docs/modele-offres.md
-- §2.2 (DDL revu contre le schema reel) ; docs/backend.md §8 (lectures inter-comptes, premiere
-- politique qui s'ouvrira au-dela du proprietaire -- pas dans cette migration, voir plus bas).
--
-- Ecart assume avec une premiere proposition (docs/prompts/L2.md, P2.2, texte fige avant relecture) :
-- cette premiere version portait "devise text default 'EUR'" et "recurrence text". Les deux sont
-- retirees ici, pas oubliees :
--   - devise : CLAUDE.md §2 fixe l'euro seul, decision figee ; docs/perimetre.md §3 liste
--     "Multilingue, autres devises" hors perimetre. Une colonne pour une variabilite qui
--     n'existera pas est le meme socle que celui que docs/perimetre.md §3 interdit de preparer
--     "pour plus tard".
--   - recurrence : une seule nature d'offre au jalon 1 (docs/perimetre.md, ecran 04a) => un seul
--     rythme, mensuel, jamais une colonne editable. Meme raisonnement que devise.
-- A l'inverse, trois colonnes absentes de cette premiere proposition sont ajoutees ici parce que
-- docs/domaine.md §3.3 les exige deja et que les ignorer aurait ete une regression, pas une
-- simplification : benefices, engagement_humain, est_mise_en_avant.
--
-- Aucune politique RLS ici : elles arrivent dans la migration suivante (docs/prompts/L2.md, P2.3).
-- RLS est neanmoins ACTIVEE explicitement ci-dessous, meme raison qu'en 0001_creer_identite.sql :
-- le reglage de projet "RLS activee a la creation" n'est pas garanti fiable pour une table creee
-- par migration SQL plutot que depuis le tableau de bord.

-- ---------------------------------------------------------------------------------------------
-- Table offres
-- ---------------------------------------------------------------------------------------------

-- coach_id reference profils_coach (id), pas comptes (id) : une offre appartient au profil
-- commercant, pas au compte. "on delete cascade" : meme raisonnement que profils_client/
-- profils_coach dans 0001 -- si la ligne profils_coach disparaissait un jour (aucun chemin
-- applicatif ne le fait aujourd'hui, aucune politique DELETE nulle part dans ce depot), les
-- offres qui lui appartiennent ne doivent pas rester orphelines.
create table public.offres (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profils_coach (id) on delete cascade,
  titre text not null,
  description text,
  -- Borne reprise telle quelle de docs/domaine.md §3.3 : "1 000 a 50 000 (10 EUR a 500 EUR)".
  prix_centimes integer not null,
  -- 3 a 5 lignes exigees par docs/domaine.md §3.3, mais seulement AU MOMENT DE LA PUBLICATION
  -- (verifie par la fonction publier_offre, docs/modele-offres.md §2.4, pas encore ecrite a ce
  -- lot -- P2.10). Un brouillon peut donc exister sans lignes : default '{}', jamais null.
  benefices text[] not null default '{}',
  -- Meme logique que benefices : au moins un element exige a la publication, pas a l'insertion.
  -- "Une offre sans engagement humain est refusee a la publication. C'est la regle qui tient
  -- tout le modele economique : elle evite que l'offre soit qualifiee de contenu numerique, ce
  -- qui imposerait l'achat in-app." (docs/domaine.md §3.3)
  engagement_humain text[] not null default '{}',
  -- "Une seule par coach" (docs/domaine.md §3.3) : contrainte d'unicite non posee ici par choix
  -- -- l'appliquer en SQL demanderait un index partiel ou un trigger, et la fonction de
  -- publication (P2.10) est l'endroit naturel pour desactiver l'ancienne mise en avant du meme
  -- coach avant d'activer la nouvelle. Une deuxieme offre "mise en avant" simultanee serait un
  -- defaut d'affichage, jamais une faille : reporte, pas oublie.
  est_mise_en_avant boolean not null default false,
  -- Pas de colonne "statut" : docs/domaine.md §3.3 et §4.10 lisent l'etat depuis ces deux dates,
  -- jamais une troisieme source de verite. brouillon = les deux nulles ; publiee = publiee_le
  -- posee, retiree_le nulle ; retiree = retiree_le posee. Meme logique que la machine a etats de
  -- Compte (§4.1), qui ne correspond a aucune colonne litterale de la table comptes.
  publiee_le timestamptz,
  retiree_le timestamptz,
  cree_le timestamptz not null default now(),

  constraint offres_prix_bornes
    check (prix_centimes between 1000 and 50000),

  -- Une offre ne se retire jamais avant d'avoir ete publiee, et jamais a un instant anterieur ou
  -- egal a sa propre publication -- retiree_le nulle est le seul autre cas valide (offre encore
  -- en vente, ou jamais publiee).
  constraint offres_retrait_apres_publication
    check (retiree_le is null or (publiee_le is not null and retiree_le > publiee_le))
);

-- Sert la lecture publique (une offre par coach, la plus recente d'abord parmi celles en vente)
-- et la lecture du coach sur son propre profil. Filtre partiel : n'indexe que les lignes
-- effectivement en vente, jamais les brouillons ni les offres retirees.
create index offres_coach_publiee_idx
  on public.offres (coach_id, publiee_le desc)
  where retiree_le is null;

-- ---------------------------------------------------------------------------------------------
-- RLS : activee, sans politique -- voir 0001_creer_identite.sql pour le meme choix et sa raison.
-- ---------------------------------------------------------------------------------------------

alter table public.offres enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------

-- Convention 0006 : revoke avant chaque grant etroit, jamais un grant seul -- rend cette
-- migration auto-portante face a un baseline de privileges different de celui d'un projet
-- Supabase heberge neuf (voir 0006_verrouiller_grants.sql).
revoke all on public.offres from anon, authenticated;

-- anon lit -- la politique RLS de P2.3 bornera ce que "lire" veut vraiment dire (les offres
-- publiees seulement) ; ce grant ne fait qu'ouvrir la table a PostgREST, RLS fait le reste.
grant select on public.offres to anon;

-- authenticated : lecture, creation, et modification colonne par colonne -- jamais table
-- entiere. publiee_le et retiree_le sont delibarement ABSENTES de la liste UPDATE : seules les
-- fonctions publier_offre/retirer_offre (SECURITY DEFINER, docs/modele-offres.md §2.4, P2.10)
-- doivent pouvoir les ecrire, exactement comme comptes.profil_actif ou
-- profils_coach.statut_verification dans 0001_creer_identite.sql. Aucun GRANT DELETE : ce depot
-- n'a et ne gagne aucune politique DELETE, le retrait d'une offre pose retiree_le, il ne supprime
-- aucune ligne.
grant select, insert on public.offres to authenticated;
grant update (
  titre, description, prix_centimes, benefices, engagement_humain, est_mise_en_avant
) on public.offres to authenticated;
