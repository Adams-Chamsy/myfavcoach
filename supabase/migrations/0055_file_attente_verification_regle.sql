-- File d'attente du back-office -- RÈGLE (2 novembre 2026). Décor : 0054, qui dit pourquoi.
--
-- SECURITY DEFINER : un examinateur n'a, à dessein, aucune politique de lecture sur
-- profils_coach (il ne lit pas un profil, il examine un dossier). La fonction lui rend les seuls
-- champs utiles à la file, jamais la ligne entière. Le délai affiché part de dossier_soumis_le,
-- la même date que l'écran d'attente du coach : deux écrans qui afficheraient des délais
-- différents pour le même dossier, ce serait pire qu'un délai faux.
create or replace function public.file_attente_verification()
returns table (coach_id uuid, prenom text, nom text, discipline text, soumis_le timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_examinateur_courant() then
    raise exception 'examinateur_requis';
  end if;
  return query
    select pc.id, pc.prenom, pc.nom, pc.discipline, pc.dossier_soumis_le
    from public.profils_coach pc
    where pc.statut_verification = 'en_examen'
    order by pc.dossier_soumis_le asc nulls last;
end;
$$;

revoke execute on function public.file_attente_verification()
  from public, anon, authenticated, service_role;
grant execute on function public.file_attente_verification() to authenticated;
