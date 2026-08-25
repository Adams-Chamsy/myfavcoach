-- Politiques RLS pour comptes, profils_client, profils_coach, consentements
-- (0001_creer_identite.sql), plus les deux fonctions qui portent le profil actif.
--
-- docs/domaine.md §2, règle d'autorisation, telle quelle — c'est la phrase qui justifie tout
-- ce fichier :
--   « Chaque requête porte le profil actif. Une donnée du profil client est inaccessible
--     depuis le profil coach du même compte, et réciproquement. »
--
-- Une politique par table ET PAR OPÉRATION (select / insert / update), jamais une politique
-- fourre-tout : chacune se lit et se relit séparément. Aucune politique de suppression nulle
-- part — rien ne s'efface au lot L1 (docs/domaine.md §2, suppression toujours soft ailleurs).

-- ---------------------------------------------------------------------------------------------
-- Fonction : profil_actif_courant()
-- ---------------------------------------------------------------------------------------------

-- Seule source du profil actif. Le client ne l'envoie JAMAIS dans une requête : au lot L0 la
-- spécification prévoyait un en-tête X-Profil, supprimé en P1.1 précisément parce qu'un
-- en-tête est une valeur fournie par le client, donc falsifiable. Cette fonction lit
-- exclusivement comptes.profil_actif pour le compte de l'appelant (auth.uid()), jamais un
-- paramètre, jamais un en-tête.
--
-- SECURITY DEFINER + search_path fixé : le résultat ne doit pas dépendre des droits ou des
-- politiques RLS de l'appelant sur comptes (qui existent, voir plus bas, mais dont dépendre
-- ici ajouterait une indirection inutile pour une simple lecture d'une colonne du compte
-- courant). STABLE : le résultat ne change pas pendant l'exécution d'une même requête, ce qui
-- permet à Postgres de ne l'évaluer qu'une fois par ligne évaluée, pas par appel textuel.
create or replace function public.profil_actif_courant()
returns public.profil_actif_enum
language sql
security definer
stable
set search_path = public
as $$
  select profil_actif from public.comptes where id = auth.uid();
$$;

revoke execute on function public.profil_actif_courant() from public;
grant execute on function public.profil_actif_courant() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Fonction : basculer_profil(profil)
-- ---------------------------------------------------------------------------------------------

-- Aucun paramètre d'identifiant de compte : la fonction agit toujours sur auth.uid(), jamais
-- sur un compte désigné par l'appelant. C'est ce qui rend "A appelle basculer_profil en
-- passant l'identifiant de compte de B" structurellement sans effet (docs/prompts/L1.md,
-- P1.5) : il n'existe aucun paramètre par lequel le tenter.
--
-- SECURITY DEFINER, et cette fois ce n'est pas une préférence : comptes.profil_actif n'a
-- délibérément aucun GRANT UPDATE pour authenticated (0001_creer_identite.sql, "seule
-- basculer_profil doit pouvoir le changer") — sans SECURITY DEFINER, l'UPDATE ci-dessous
-- échouerait en "permission denied for column profil_actif" pour tout le monde, y compris le
-- propriétaire légitime du compte.
create or replace function public.basculer_profil(profil public.profil_actif_enum)
returns public.profil_actif_enum
language plpgsql
security definer
set search_path = public
as $$
declare
  profil_existe boolean;
begin
  if profil = 'client' then
    select exists (
      select 1 from public.profils_client where compte_id = auth.uid()
    ) into profil_existe;
  else
    select exists (
      select 1 from public.profils_coach where compte_id = auth.uid()
    ) into profil_existe;
  end if;

  if not profil_existe then
    raise exception 'Aucun profil % pour ce compte : bascule refusée.', profil;
  end if;

  update public.comptes set profil_actif = profil where id = auth.uid();

  return profil;
end;
$$;

revoke execute on function public.basculer_profil(public.profil_actif_enum) from public;
grant execute on function public.basculer_profil(public.profil_actif_enum) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Politiques : comptes
-- ---------------------------------------------------------------------------------------------

-- Le compte ne voit et ne modifie que sa propre ligne. Pas de politique INSERT : la seule
-- création passe par le déclencheur SECURITY DEFINER de 0001_creer_identite.sql, qui contourne
-- RLS — une politique INSERT ici n'aurait aucune voie d'accès à couvrir, l'absence de
-- politique suffit déjà à refuser (docs/backend.md §5).
create policy comptes_select_soi
  on public.comptes
  for select
  to authenticated
  using (id = auth.uid());

create policy comptes_update_soi
  on public.comptes
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Politiques : profils_client
-- ---------------------------------------------------------------------------------------------

-- Lecture par le propriétaire dans les DEUX espaces : la feuille de bascule
-- (docs/ecrans/L1-06-bascule-espace.md) doit pouvoir lire l'état des deux profils quel que
-- soit l'espace courant. Écriture uniquement depuis l'espace client — voir la réponse jointe
-- pour pourquoi la lecture et l'écriture ne suivent pas la même règle.
create policy profils_client_select_proprietaire
  on public.profils_client
  for select
  to authenticated
  using (compte_id = auth.uid());

create policy profils_client_insert_espace_client
  on public.profils_client
  for insert
  to authenticated
  with check (compte_id = auth.uid() and public.profil_actif_courant() = 'client');

create policy profils_client_update_espace_client
  on public.profils_client
  for update
  to authenticated
  using (compte_id = auth.uid() and public.profil_actif_courant() = 'client')
  with check (compte_id = auth.uid() and public.profil_actif_courant() = 'client');

-- ---------------------------------------------------------------------------------------------
-- Politiques : profils_coach
-- ---------------------------------------------------------------------------------------------

-- Même découpage que profils_client, miroir exact. La condition d'écriture
-- "profil_actif_courant() = 'coach'" a une conséquence pour L2 : la future fonction
-- creer_profil_coach (docs/api.md §3, pas encore écrite) devra être SECURITY DEFINER, pas
-- SECURITY INVOKER — au moment où elle s'exécute, l'appelant est encore en espace client (il
-- n'existe pas encore de profil coach vers lequel basculer), donc cette politique INSERT
-- refuserait un INSERT direct fait avec les seuls droits de l'appelant. 0001_creer_identite.sql
-- laissait les deux options ouvertes ; ce fichier les referme.
create policy profils_coach_select_proprietaire
  on public.profils_coach
  for select
  to authenticated
  using (compte_id = auth.uid());

create policy profils_coach_insert_espace_coach
  on public.profils_coach
  for insert
  to authenticated
  with check (compte_id = auth.uid() and public.profil_actif_courant() = 'coach');

create policy profils_coach_update_espace_coach
  on public.profils_coach
  for update
  to authenticated
  using (compte_id = auth.uid() and public.profil_actif_courant() = 'coach')
  with check (compte_id = auth.uid() and public.profil_actif_courant() = 'coach');

-- ---------------------------------------------------------------------------------------------
-- Politiques : consentements
-- ---------------------------------------------------------------------------------------------

-- Lecture et écriture par le propriétaire, sans condition d'espace : un consentement n'est pas
-- rattaché à un profil mais au compte (docs/domaine.md §3.12). Pas de politique UPDATE : cette
-- table n'a de toute façon aucun GRANT UPDATE (0001_creer_identite.sql, "journal d'ajout
-- seul") — une politique ici n'aurait rien à autoriser. Pas de DELETE, comme partout ailleurs
-- dans ce fichier.
create policy consentements_select_proprietaire
  on public.consentements
  for select
  to authenticated
  using (compte_id = auth.uid());

create policy consentements_insert_proprietaire
  on public.consentements
  for insert
  to authenticated
  with check (compte_id = auth.uid());
