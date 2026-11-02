-- File d'attente du back-office -- DÉCOR (2 novembre 2026). Règle : 0055.
--
-- Trouvé en alignant le délai du back-office sur la date de soumission (0053) : la file
-- d'attente (app/(admin)/admin/verification.tsx) lisait profils_coach directement, avec la
-- session de l'examinateur. Or profils_coach n'a AUCUNE politique de lecture pour un
-- examinateur : seulement le propriétaire et les coachs vérifiés. La file était donc TOUJOURS
-- vide (« Aucun dossier en attente »), et sa date de dépôt, lue dans pieces_verification avec la
-- même session, toujours absente. Personne ne l'a vu : le banc donne l'identifiant du coach à
-- l'examinateur au lieu de passer par la file.
--
-- file_attente_verification() : réservée aux examinateurs (est_examinateur_courant(), même garde
-- que decider_verification_coach, 0015). Rend les dossiers en examen, avec leur date de
-- soumission, le plus ancien d'abord. Ici, ne rend rien.
create or replace function public.file_attente_verification()
returns table (coach_id uuid, prenom text, nom text, discipline text, soumis_le timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  -- Décor : ne rend aucune ligne. La règle est écrite par 0055.
  select null::uuid, null::text, null::text, null::text, null::timestamptz where false;
$$;

revoke execute on function public.file_attente_verification()
  from public, anon, authenticated, service_role;
grant execute on function public.file_attente_verification() to authenticated;
