-- Role d'equipe examinateur (docs/backend.md §9), trouve manquant en relisant P2.5 : 0012 fermait
-- la lecture des pieces a tout le monde sauf service_role, sans jamais construire le chemin de
-- lecture reserve au back-office que son propre commentaire promettait pour "P2.6/P2.10". Ecrit
-- maintenant, avant P2.6, exactement selon la specification deja figee dans docs/backend.md §9 --
-- rien n'y est invente ici, cette migration ne fait qu'implementer ce que ce paragraphe decrit
-- depuis avant P2.1.

-- ---------------------------------------------------------------------------------------------
-- Colonne comptes.est_examinateur
-- ---------------------------------------------------------------------------------------------

-- "Le role est une colonne serveur, jamais un drapeau cote client." (docs/backend.md §9) : aucun
-- GRANT SELECT ni UPDATE sur cette colonne precise, pour aucun role client. Attribuer
-- est_examinateur = true reste une operation manuelle par service_role, jamais par l'application
-- (meme paragraphe, derniere phrase).
alter table public.comptes add column est_examinateur boolean not null default false;

-- 0001_creer_identite.sql (ligne 264) et 0006_verrouiller_grants.sql (ligne 23) accordent SELECT
-- sur TOUTE la table a authenticated -- un GRANT est table-large par defaut, une colonne ajoutee
-- ensuite en heriterait automatiquement. Meme correction que 0008_politiques_offres.sql sur
-- profils_coach.compte_id : revoquer le SELECT table-large, le regrant colonne par colonne, sans
-- est_examinateur. Le GRANT UPDATE (telephone), separe, n'est pas touche.
revoke select on public.comptes from authenticated;
grant select (
  id,
  date_naissance,
  telephone,
  profil_actif,
  cgu_version_acceptee,
  cree_le,
  supprime_le
) on public.comptes to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Fonction : est_examinateur_courant()
-- ---------------------------------------------------------------------------------------------

-- Copiee depuis docs/backend.md §9, avec un seul ecart volontaire : REVOKE EXECUTE plutot que
-- REVOKE ALL. Les deux ont un effet identique sur une fonction (EXECUTE est le seul privilege
-- qui s'y applique), mais src/test/fonctions-execute-revoque.test.ts exige le mot "execute" au
-- pied de la lettre dans le MEME fichier que le CREATE FUNCTION -- convention deja etablie par
-- 0002/0005/0011 (creation), jamais "revoke all" (reserve au durcissement a posteriori de 0006).
-- Meme famille que profil_actif_courant() (0002_politiques.sql) et mon_profil_coach_id()
-- (0011_corriger_politiques_offres_coach_id.sql) : SECURITY DEFINER, donc capable de lire
-- est_examinateur pour l'appelant sans qu'aucun GRANT SELECT ne l'expose jamais directement.
create or replace function public.est_examinateur_courant()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(est_examinateur, false) from public.comptes where id = auth.uid();
$$;

revoke execute on function public.est_examinateur_courant() from public, anon, authenticated;
grant execute on function public.est_examinateur_courant() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Lecture des pieces par l'examinateur -- fonction, pas une politique directe sur la table
-- ---------------------------------------------------------------------------------------------

-- Pourquoi une fonction et non une simple politique SELECT supplementaire sur pieces_verification :
-- un GRANT est un privilege de ROLE, jamais de ligne. Ouvrir chemin_stockage a "authenticated"
-- pour que l'examinateur le voie l'ouvrirait aussi au coach proprietaire sur SA PROPRE ligne (la
-- meme politique/le meme role couvre les deux), exactement ce que la decision de P2.5 (point 3)
-- interdit -- "pas meme lui". Une fonction SECURITY DEFINER lit la table avec les privileges de
-- son proprietaire (donc chemin_stockage inclus) et ne renvoie quoi que ce soit que si l'appelant
-- est examinateur ; sinon un ensemble vide, jamais une erreur -- meme convention que le reste du
-- schema (une ligne non autorisee se lit comme absente, pas comme une exception).
create or replace function public.pieces_verification_pour_examinateur()
returns setof public.pieces_verification
language sql
security definer
stable
set search_path = public
as $$
  select * from public.pieces_verification
  where public.est_examinateur_courant();
$$;

revoke execute on function public.pieces_verification_pour_examinateur() from public, anon;
grant execute on function public.pieces_verification_pour_examinateur() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Lecture du FICHIER par l'examinateur -- storage.objects, politique directe
-- ---------------------------------------------------------------------------------------------

-- Ici une politique directe suffit : contrairement au GRANT de table Postgres, storage.objects
-- n'accorde deja aucun acces cache par colonne a proteger -- la seule porte est la ligne
-- elle-meme (bucket_id, name), et RLS la ferme deja a tout le monde sauf ce qu'une politique
-- ouvre explicitement (voir 0012, "volontairement absentes : SELECT..."). Ajouter une politique
-- SELECT gardee par est_examinateur_courant() n'expose donc rien au coach proprietaire : sa
-- propre politique de lecture reste inexistante, celle-ci ne s'applique qu'a un examinateur.
create policy pieces_verification_stockage_select_examinateur
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pieces-verification'
    and public.est_examinateur_courant()
  );
