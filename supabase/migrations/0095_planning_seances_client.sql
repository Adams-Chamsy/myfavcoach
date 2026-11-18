-- Planning de l'onglet Séance. Les dates se déterminent dans le fuseau métier.
create function public.mon_planning_seances()
returns table (
  id uuid,
  titre text,
  duree_minutes smallint,
  date_prevue date,
  coach_prenom text,
  coach_nom text,
  a_rattraper_avant date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client uuid := public.mon_profil_client_en_espace_client();
  v_jour date := (now() at time zone 'Europe/Paris')::date;
begin
  return query
  select sp.id, s.titre, s.duree_minutes, sp.date_prevue, c.prenom, c.nom,
         case when sp.date_prevue < v_jour then sp.date_prevue + 7 end
    from public.seances_programmees sp
    join public.seances s on s.id = sp.seance_id
    join public.profils_coach c on c.id = sp.profil_coach_id
   where sp.profil_client_id = v_client
     and public.acces_contenu(sp.profil_client_id, sp.profil_coach_id)
     and (
       (sp.date_prevue between v_jour + 1 and v_jour + 14 and sp.statut = 'a_faire')
       or (
         sp.date_prevue between v_jour - 7 and v_jour - 1
         and sp.statut in ('manquee', 'partielle')
         and not public.jour_sans_acces(sp.profil_client_id, sp.profil_coach_id, sp.date_prevue)
       )
     )
   order by sp.date_prevue, s.titre, sp.id;
end;
$$;

revoke execute on function public.mon_planning_seances() from public, anon, authenticated, service_role;
grant execute on function public.mon_planning_seances() to authenticated;
