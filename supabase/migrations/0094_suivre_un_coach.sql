create table public.coachs_suivis (
  profil_client_id uuid not null references public.profils_client(id) on delete cascade,
  profil_coach_id uuid not null references public.profils_coach(id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (profil_client_id, profil_coach_id)
);

create index coachs_suivis_coach_idx on public.coachs_suivis (profil_coach_id);
alter table public.coachs_suivis enable row level security;
revoke all on public.coachs_suivis from public, anon, authenticated, service_role;
grant select on public.coachs_suivis to service_role;

create function public.mes_coachs_suivis()
returns table (id uuid, prenom text, nom text, discipline text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client uuid := public.mon_profil_client_en_espace_client();
begin
  if not exists (select 1 from public.comptes c where c.id = auth.uid() and c.supprime_le is null) then
    raise exception 'profil_client_requis';
  end if;
  return query
  select coach.id, coach.prenom, coach.nom, coach.discipline
  from public.coachs_suivis suivi
  join public.profils_coach coach on coach.id = suivi.profil_coach_id
  join public.comptes compte on compte.id = coach.compte_id and compte.supprime_le is null
  where suivi.profil_client_id = v_client
    and coach.statut_verification = 'verifiee'
  order by suivi.cree_le desc, coach.id;
end;
$$;

create function public.definir_suivi_coach(p_coach_id uuid, p_suivre boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid := public.mon_profil_client_en_espace_client();
begin
  perform 1 from public.comptes c where c.id = auth.uid() and c.supprime_le is null for share;
  if not found then
    raise exception 'profil_client_requis';
  end if;
  if p_coach_id is null or p_suivre is null then
    raise exception 'suivi_invalide';
  end if;

  if not p_suivre then
    delete from public.coachs_suivis
    where profil_client_id = v_client and profil_coach_id = p_coach_id;
    return;
  end if;

  perform 1
    from public.profils_coach coach
    join public.comptes compte on compte.id = coach.compte_id
    where coach.id = p_coach_id
      and coach.statut_verification = 'verifiee'
      and compte.supprime_le is null
      and coach.compte_id <> auth.uid()
    for share of compte, coach;
  if not found then
    raise exception 'coach_indisponible';
  end if;

  insert into public.coachs_suivis (profil_client_id, profil_coach_id)
  values (v_client, p_coach_id)
  on conflict (profil_client_id, profil_coach_id) do nothing;
end;
$$;

create function public.supprimer_suivis_du_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.coachs_suivis suivi
  using public.profils_client client
  where suivi.profil_client_id = client.id and client.compte_id = new.id;

  delete from public.coachs_suivis suivi
  using public.profils_coach coach
  where suivi.profil_coach_id = coach.id and coach.compte_id = new.id;

  return new;
end;
$$;

create trigger comptes_supprimes_effacent_suivis
after update of supprime_le on public.comptes
for each row when (old.supprime_le is null and new.supprime_le is not null)
execute function public.supprimer_suivis_du_compte();

revoke execute on function public.supprimer_suivis_du_compte()
from public, anon, authenticated, service_role;
revoke execute on function public.mes_coachs_suivis(), public.definir_suivi_coach(uuid, boolean)
from public, anon, authenticated, service_role;
grant execute on function public.mes_coachs_suivis(), public.definir_suivi_coach(uuid, boolean)
to authenticated;
