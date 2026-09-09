-- Fonction de base : creer_profil_coach — active l'espace coach en une seule transaction.
-- Sources : docs/ecrans/L1-08-activation-espace-coach.md ; docs/domaine.md §3.1 (téléphone
-- requis avant de devenir coach), §3.2 (ProfilCoach), §4.2 (statut_verification part de
-- 'absente') ; docs/api.md §3 (POST /moi/profils/coach) ; docs/backend.md §7 (fonctions de base
-- SECURITY DEFINER).
--
-- ATOMIQUE : le corps d'une fonction plpgsql s'exécute dans une seule transaction — INSERT du
-- profil coach ET passage du profil actif réussissent ensemble, ou rien. Un profil coach créé
-- sans bascule laisserait l'utilisateur devant un espace qu'il ne voit pas (fiche, Règles).
--
-- SECURITY DEFINER, et ce n'est pas une préférence (comme profil_actif_courant/basculer_profil,
-- docs/backend.md §7) :
--   - profils_coach_insert_espace_coach (0002_politiques.sql) exige
--     profil_actif_courant() = 'coach'. Au moment de cet appel, l'appelant est ENCORE en espace
--     client (il n'a pas encore de profil coach vers lequel basculer) : un INSERT direct avec
--     ses seuls droits serait refusé. Décision notée dès P1.4 (commentaire de cette politique).
--   - comptes.profil_actif n'a aucun GRANT UPDATE pour authenticated (0001_creer_identite.sql,
--     « seule basculer_profil doit pouvoir le changer ») — l'UPDATE ci-dessous échouerait
--     autrement en « permission denied for column profil_actif ».
--
-- Agit toujours sur auth.uid(), AUCUN paramètre de compte (même principe que basculer_profil) :
-- « créer un profil coach pour un autre compte » est structurellement impossible, il n'existe
-- aucun paramètre par lequel le tenter.
--
-- La discipline n'est PAS contrôlée ici contre une énumération : la liste figée vit côté
-- application (src/fixtures/demonstration.ts, disciplinesCoach), comme les clés d'objectifs et
-- de rythme de l'onboarding client — la colonne reste `text` (0001_creer_identite.sql).
--
-- prenom / nom sont fournis par l'appelant : repris du profil client s'il existe (fiche,
-- Règles), sinon saisis à l'écran. profils_coach.nom est NOT NULL (0001) — un nom absent fait
-- échouer l'INSERT, donc toute la fonction : c'est ce qui garantit « aucun profil coach à
-- moitié » (fiche, critère 3).
create or replace function public.creer_profil_coach(
  discipline text,
  telephone text,
  prenom text,
  nom text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profils_coach (compte_id, prenom, nom, discipline)
  values (auth.uid(), prenom, nom, discipline);
  -- statut_verification laissé à son DEFAULT 'absente' (0001) : le parcours de vérification
  -- (lot L2) démarre là.

  update public.comptes
  set telephone = creer_profil_coach.telephone,
      profil_actif = 'coach'
  where id = auth.uid();
end;
$$;

-- Même schéma de grant que basculer_profil / profil_actif_courant (0002_politiques.sql) :
-- retirée à public, ouverte au seul rôle authenticated.
revoke execute on function public.creer_profil_coach(text, text, text, text) from public;
grant execute on function public.creer_profil_coach(text, text, text, text) to authenticated;
