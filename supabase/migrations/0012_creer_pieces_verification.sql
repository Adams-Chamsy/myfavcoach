-- P2.5 -- Depot des pieces d'identite (docs/prompts/L2.md, docs/domaine.md §4.2).
--
-- Trois pieces obligatoires par dossier de verification (docs/domaine.md §4.2) : identite,
-- diplome ou certification, attestation d'assurance responsabilite civile professionnelle. Ce
-- sont les donnees les plus sensibles manipulees par le produit jusqu'ici -- une fuite est
-- irreversible et identifiante, contrairement a une donnee de sante qui reste au moins
-- pseudonyme sans le reste du dossier.
--
-- Deux decisions reservees a l'humain (P2.5, points 3 et 4), tranchees le 13 septembre 2026:
--
--   1. Chemin de stockage : un UUID genere par le client au moment du depot, SEUL -- aucun
--      coach_id, aucun compte_id, aucun fragment devinable. Ni offres ni profils_coach ne
--      pointent vers ce chemin : seule la ligne pieces_verification cree ci-dessous relie un
--      coach_id a un chemin_stockage, et cette table n'est jamais lisible avec sa colonne
--      chemin_stockage par aucun role cote application (voir le GRANT SELECT plus bas, colonne
--      par colonne, chemin_stockage exclu). Construire un chemin a la main depuis un coach_id
--      public (banc, point 5) ne donne donc rien : aucune politique SELECT sur storage.objects
--      n'existe pour anon ni authenticated, quel que soit le chemin essaye.
--
--   2. Affichage cote coach : le coach peut voir CE QU'IL A DEPOSE (type, date de depot, date
--      d'examen si elle existe) SANS jamais relire le fichier ni son chemin de stockage. Realise
--      par un GRANT SELECT colonne par colonne sur pieces_verification (id, coach_id, type,
--      depose_le, examinee_le, cree_le -- chemin_stockage exclu), meme famille que le GRANT
--      colonne par colonne de 0008_politiques_offres.sql sur profils_coach.
--
-- La lecture du FICHIER lui-meme (pas seulement la ligne de metadonnees) reste reservee au
-- back-office, "via un chemin qui ne passe pas par la clef anonyme" (P2.5, point 3) : ce sera le
-- role du role d'equipe examinateur (docs/backend.md §9, est_examinateur_courant()), pas encore
-- ecrit -- il arrive avec P2.6/P2.10. D'ici la, seul service_role (jamais expose a
-- l'application) peut lire une ligne complete ou le contenu du compartiment.

-- ---------------------------------------------------------------------------------------------
-- Compartiment de stockage
-- ---------------------------------------------------------------------------------------------

-- PRIVE (public = false) : aucune politique de lecture publique, aucune URL permanente. Premier
-- compartiment prive du depot -- convention retenue pour les suivants : nom en kebab-case,
-- identique au sujet qu'il stocke (meme esprit que le nommage de fichiers de CLAUDE.md §5).
insert into storage.buckets (id, name, public)
values ('pieces-verification', 'pieces-verification', false);

-- ---------------------------------------------------------------------------------------------
-- Table pieces_verification
-- ---------------------------------------------------------------------------------------------

-- Pas de colonne qui contienne la piece elle-meme (P2.5, point 2) : chemin_stockage ne fait que
-- pointer vers le compartiment prive ci-dessus. Plusieurs lignes par (coach_id, type) sont
-- attendues : un dossier refuse ou en complement peut etre redepose, et l'ancien depot reste
-- une preuve (meme esprit que le journal consentements, sans pour autant etre lui-meme un
-- journal d'ajout seul -- aucune regle de ce prompt n'interdit une lecture ligne par ligne ici).
create table public.pieces_verification (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profils_coach (id) on delete cascade,
  -- Liste fermee cote application (identite, diplome_ou_certification, assurance_rc_pro) --
  -- texte libre en base, meme choix que consentements.type (0001_creer_identite.sql) : a
  -- durcir plus tard si besoin, non demande explicitement ici.
  type text not null,
  chemin_stockage text not null unique,
  depose_le timestamptz not null default now(),
  -- Rempli par le futur mecanisme d'examen (P2.6), jamais par le coach lui-meme : voir le GRANT
  -- INSERT colonne par colonne plus bas, qui omet cette colonne.
  examinee_le timestamptz,
  cree_le timestamptz not null default now()
);

create index pieces_verification_coach_idx on public.pieces_verification (coach_id);

alter table public.pieces_verification enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------

revoke all on public.pieces_verification from anon, authenticated;

-- INSERT colonne par colonne : coach_id, type, chemin_stockage seulement. examinee_le est
-- volontairement absent -- un coach qui s'auto-declarerait examine casserait la seule garantie
-- que cette table porte. depose_le/cree_le ont leur defaut, id aussi : aucun besoin que le
-- client les fournisse.
grant insert (coach_id, type, chemin_stockage) on public.pieces_verification to authenticated;

-- SELECT colonne par colonne : chemin_stockage exclu, decision 2 ci-dessus. Un coach voit qu'il
-- a depose une piece, de quel type, quand, et si elle a ete examinee -- jamais le chemin qui
-- permettrait de relire le fichier (qu'aucune politique storage.objects n'autoriserait de toute
-- facon, voir plus bas).
grant select (id, coach_id, type, depose_le, examinee_le, cree_le)
  on public.pieces_verification to authenticated;

-- service_role : lecture complete (colonnes incluses) et insertion, pour le banc et en
-- attendant la vraie fonction d'examen de P2.6 -- meme esprit que
-- 0010_accorder_service_role_verification_banc.sql. Pas d'UPDATE : aucun besoin au banc de ce
-- prompt (P2.5 ne teste pas la transition d'examen), a ajouter avec P2.6 si necessaire.
grant select, insert on public.pieces_verification to service_role;

-- ---------------------------------------------------------------------------------------------
-- Politiques : pieces_verification
-- ---------------------------------------------------------------------------------------------

-- Le coach INSERE ses propres pieces, uniquement depuis son espace coach -- meme forme que
-- offres_insert_espace_coach (0011_corriger_politiques_offres_coach_id.sql).
create policy pieces_verification_insert_proprietaire
  on public.pieces_verification
  for insert
  to authenticated
  with check (
    coach_id = public.mon_profil_coach_id()
    and public.profil_actif_courant() = 'coach'
  );

-- Lecture des METADONNEES par le proprietaire, sans condition d'espace -- meme convention que
-- profils_coach_select_proprietaire (0002_politiques.sql) : lire son propre dossier reste
-- possible depuis l'espace client, seule l'ecriture est gardee par profil_actif_courant().
-- Combinee au GRANT SELECT colonne par colonne plus haut, cette politique ne donne jamais acces
-- a chemin_stockage : la colonne n'est simplement pas dans la liste accordee.
create policy pieces_verification_select_proprietaire
  on public.pieces_verification
  for select
  to authenticated
  using (coach_id = public.mon_profil_coach_id());

-- Aucune politique UPDATE ni DELETE : aucun GRANT ne les ouvre non plus. "Personne ne les lit
-- [le fichier] depuis l'application -- pas meme lui" (P2.5, point 3) devient ici "personne ne
-- les MODIFIE depuis l'application, pas meme lui" -- la seule ecriture possible cote coach est
-- un nouveau depot (INSERT), jamais une correction de ligne existante.

-- ---------------------------------------------------------------------------------------------
-- Politiques : storage.objects, compartiment pieces-verification
-- ---------------------------------------------------------------------------------------------

-- RLS est deja active par Supabase sur storage.objects (table systeme) : sans politique SELECT,
-- l'acces est refuse par defaut a tout role client -- exactement ce que demande P2.5, point 3
-- ("PERSONNE ne les lit depuis l'application, pas meme lui"). Une seule politique ci-dessous,
-- pour l'ecriture initiale.
create policy pieces_verification_stockage_insert_coach
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pieces-verification'
    and public.profil_actif_courant() = 'coach'
  );

-- Volontairement absentes : SELECT, UPDATE, DELETE sur storage.objects pour ce compartiment,
-- pour anon comme pour authenticated. La lecture du fichier reste reservee au back-office
-- (P2.6/P2.10, role examinateur, cle de service jamais exposee au client -- docs/backend.md
-- §9) : "un chemin qui ne passe pas par la clef anonyme" (P2.5, point 3).
