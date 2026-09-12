-- Politiques pour offres, et premiere ouverture de profils_coach au-dela du proprietaire.
-- Sources : docs/domaine.md §3.3 (Offre), §4.2 (Verification du coach) ; docs/api.md §5 (offres
-- et profil public) ; docs/backend.md §8 (lectures inter-comptes -- la regle du lot).
--
-- C'est la premiere fois que ce depot laisse un compte lire la ligne d'un autre. Les dix
-- politiques de 0002_politiques.sql disaient toutes la meme chose : le proprietaire, et
-- personne d'autre. A partir d'ici, une politique trop permissive ne produit plus une liste
-- vide -- elle produit une fuite.
--
-- Approche retenue pour ouvrir profils_coach (docs/prompts/L2.md, P2.3, point 4) : une
-- politique de plus, PAS une vue. Une vue security_invoker (docs/backend.md §4, obligatoire
-- sans exception) n'expose jamais que ce que la table sous-jacente autorise deja au role
-- appelant -- elle ne referme rien de plus qu'un grant ne referme deja. Le vrai verrou est le
-- grant colonne par colonne : compte_id n'est accorde a AUCUN role, authenticated compris,
-- parce qu'aucun grant ne peut distinguer "sa propre ligne" de "la ligne d'un autre" -- un
-- GRANT est global au role, pas conditionne par la politique qui a laisse passer la ligne.
-- L'application n'a de toute facon jamais besoin de lire profils_coach.compte_id : elle connait
-- deja son propre compte via auth.uid() / GET /moi.

-- ---------------------------------------------------------------------------------------------
-- profils_coach : ouverture aux profils verifies
-- ---------------------------------------------------------------------------------------------

-- Revoke avant de tout redonner (convention 0006) : rend cette migration auto-portante, et
-- resserre au passage le grant SELECT de authenticated pose en 0001/0006 -- il portait sur la
-- table entiere (compte_id compris). Ce n'etait pas un probleme tant que seule
-- profils_coach_select_proprietaire existait (une seule ligne, la sienne, jamais celle d'un
-- autre) ; ca en deviendrait un des qu'une deuxieme politique ouvre des lignes appartenant a
-- d'autres comptes.
revoke all on public.profils_coach from anon, authenticated;

-- Liste identique pour anon et authenticated : aucune raison de les distinguer, aucun des deux
-- ne doit voir compte_id ni les colonnes de verification qui arriveront avec P2.5 (pieces
-- d'identite -- n'existent pas encore sur cette table, la meme discipline s'appliquera alors).
--
-- statut_verification est dans la liste EN CONNAISSANCE DE CAUSE, pas par oubli. Pour un
-- lecteur qui n'est pas le coach lui-meme, cette colonne vaut toujours 'verifiee' : la
-- politique ci-dessous ne laisse jamais passer une autre valeur, donc la colonne n'apprend rien
-- de plus que le fait meme que la ligne soit visible. Pour le coach qui lit SA PROPRE ligne
-- (profils_coach_select_proprietaire, 0002_politiques.sql, non modifiee ici), c'est en revanche
-- la seule colonne qui lui dit ou en est son dossier -- et le grant etant global au role, il
-- n'existe aucun moyen de la lui accorder sans l'accorder aussi au lecteur public. Un futur
-- relecteur qui verrait "statut_verification" dans un grant public et penserait a une fuite :
-- ce commentaire est la reponse.
grant select (
  id, prenom, nom, photo_url, discipline, titre_court, bio, commune_base_insee,
  statut_verification, cree_le
) on public.profils_coach to anon, authenticated;

-- Grants deja existants en 0001/0006, redonnes tels quels apres le revoke ci-dessus.
grant insert on public.profils_coach to authenticated;
grant update (
  prenom, nom, photo_url, discipline, titre_court, bio, commune_base_insee
) on public.profils_coach to authenticated;

-- Deuxieme politique SELECT sur cette table : coexiste avec profils_coach_select_proprietaire
-- (0002_politiques.sql), deux politiques permissives combinees en OR -- un coach garde l'acces
-- a son propre profil meme non verifie, n'importe qui lit un profil verifie. Aucune des deux ne
-- change ce que authenticated peut modifier (profils_coach_update_espace_coach, inchangee).
create policy profils_coach_select_verifiee
  on public.profils_coach
  for select
  to anon, authenticated
  using (statut_verification = 'verifiee');

-- ---------------------------------------------------------------------------------------------
-- Table offres : RLS deja activee sans politique depuis 0007_creer_offres.sql
-- ---------------------------------------------------------------------------------------------

-- Lecture publique : offre publiee, non retiree, ET coach verifie. La condition de
-- verification n'est pas un detail -- un profil en cours d'examen contient des informations
-- qu'on n'a pas fini de verifier (docs/prompts/L2.md, decor technique du lot). La sous-requete
-- fonctionne pour anon comme pour authenticated des lors que profils_coach_select_verifiee
-- (ci-dessus) et le grant sur statut_verification l'autorisent tous les deux -- aucune fonction
-- SECURITY DEFINER supplementaire n'est necessaire pour ce controle precis.
create policy offres_select_publiees
  on public.offres
  for select
  to anon, authenticated
  using (
    publiee_le is not null
    and retiree_le is null
    and exists (
      select 1 from public.profils_coach
      where id = offres.coach_id and statut_verification = 'verifiee'
    )
  );

-- Le coach lit ses propres offres, y compris les brouillons et les retirees.
create policy offres_select_proprietaire
  on public.offres
  for select
  to authenticated
  using (
    coach_id in (select id from public.profils_coach where compte_id = auth.uid())
  );

create policy offres_insert_espace_coach
  on public.offres
  for insert
  to authenticated
  with check (
    coach_id in (select id from public.profils_coach where compte_id = auth.uid())
    and public.profil_actif_courant() = 'coach'
  );

create policy offres_update_espace_coach
  on public.offres
  for update
  to authenticated
  using (
    coach_id in (select id from public.profils_coach where compte_id = auth.uid())
    and public.profil_actif_courant() = 'coach'
  )
  with check (
    coach_id in (select id from public.profils_coach where compte_id = auth.uid())
    and public.profil_actif_courant() = 'coach'
  );

-- ---------------------------------------------------------------------------------------------
-- Fonctions : publier_offre, retirer_offre
-- ---------------------------------------------------------------------------------------------

-- SECURITY DEFINER, et ce n'est pas une preference (meme justification que basculer_profil /
-- creer_profil_coach, 0002_politiques.sql / 0005_creer_profil_coach.sql) : offres.publiee_le et
-- retiree_le n'ont aucun GRANT UPDATE pour authenticated (0007_creer_offres.sql), un appel
-- direct echouerait donc pour tout le monde, y compris le proprietaire legitime de l'offre.
--
-- Les deux messages d'erreur (coach_non_verifie, engagement_humain_requis) reprennent tels
-- quels les noms deja fixes par docs/api.md §5 (409 et 422 respectivement) -- la fonction et le
-- contrat d'API doivent rester d'accord.
create or replace function public.publier_offre(offre_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_verifiee boolean;
  v_engagement_non_vide boolean;
begin
  select o.coach_id,
         pc.statut_verification = 'verifiee',
         coalesce(array_length(o.engagement_humain, 1), 0) > 0
    into v_coach_id, v_verifiee, v_engagement_non_vide
  from public.offres o
  join public.profils_coach pc on pc.id = o.coach_id
  where o.id = offre_id
    and o.coach_id in (select id from public.profils_coach where compte_id = auth.uid());

  if v_coach_id is null then
    raise exception 'offre introuvable ou non possedee par ce compte';
  end if;

  if not v_engagement_non_vide then
    raise exception 'engagement_humain_requis';
  end if;

  if not v_verifiee then
    raise exception 'coach_non_verifie';
  end if;

  update public.offres set publiee_le = now(), retiree_le = null where id = offre_id;
end;
$$;

revoke execute on function public.publier_offre(uuid) from public;
grant execute on function public.publier_offre(uuid) to authenticated;

create or replace function public.retirer_offre(offre_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.offres
  set retiree_le = now()
  where id = offre_id
    and coach_id in (select id from public.profils_coach where compte_id = auth.uid());

  if not found then
    raise exception 'offre introuvable ou non possedee par ce compte';
  end if;
end;
$$;

revoke execute on function public.retirer_offre(uuid) from public;
grant execute on function public.retirer_offre(uuid) to authenticated;
