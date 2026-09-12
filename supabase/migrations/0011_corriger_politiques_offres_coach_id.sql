-- Corrige une supposition fausse de 0008_politiques_offres.sql, trouvee par le banc de P2.4
-- (src/test/rls.banc.ts), pas anticipee a l'ecriture -- meme esprit que 0006 corrigeant une
-- hypothese fausse de 0001/0002 sur le baseline de privileges.
--
-- Les trois politiques offres_select_proprietaire / offres_insert_espace_coach /
-- offres_update_espace_coach lisent profils_coach.compte_id dans une sous-requete
-- ("coach_id in (select id from profils_coach where compte_id = auth.uid())"). Contrairement a
-- une politique qui filtre SA PROPRE table (profils_coach_select_proprietaire, qui compare
-- compte_id a auth.uid() SANS qu'aucun grant SELECT distinct ne soit necessaire sur sa propre
-- colonne de filtre -- verifie en conditions reelles), une sous-requete vers une AUTRE table
-- est une requete ordinaire, soumise aux memes droits que n'importe quel appel authenticated.
-- Or 0008 retire volontairement tout GRANT SELECT sur profils_coach.compte_id, pour authenticated
-- comme pour anon (memes raisons que le commentaire de 0008 sur "qui en a besoin"). Consequence
-- trouvee au banc : B ne pouvait plus creer, lire ni modifier ses PROPRES offres, permission
-- denied avant meme d'atteindre la ligne visee.
--
-- Fonction SECURITY DEFINER, meme famille que profil_actif_courant() (0002_politiques.sql) :
-- elle lit profils_coach.compte_id avec les privileges de son proprietaire, jamais ceux de
-- l'appelant -- exactement ce qui manque aux trois politiques ci-dessus.
create or replace function public.mon_profil_coach_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.profils_coach where compte_id = auth.uid();
$$;

revoke execute on function public.mon_profil_coach_id() from public;
grant execute on function public.mon_profil_coach_id() to authenticated;

-- Les trois politiques, recreees avec la fonction plutot que la sous-requete directe. Meme
-- condition qu'avant, portee autrement : "coach_id appartient au compte appelant".
drop policy offres_select_proprietaire on public.offres;
create policy offres_select_proprietaire
  on public.offres
  for select
  to authenticated
  using (coach_id = public.mon_profil_coach_id());

drop policy offres_insert_espace_coach on public.offres;
create policy offres_insert_espace_coach
  on public.offres
  for insert
  to authenticated
  with check (
    coach_id = public.mon_profil_coach_id()
    and public.profil_actif_courant() = 'coach'
  );

drop policy offres_update_espace_coach on public.offres;
create policy offres_update_espace_coach
  on public.offres
  for update
  to authenticated
  using (
    coach_id = public.mon_profil_coach_id()
    and public.profil_actif_courant() = 'coach'
  )
  with check (
    coach_id = public.mon_profil_coach_id()
    and public.profil_actif_courant() = 'coach'
  );
