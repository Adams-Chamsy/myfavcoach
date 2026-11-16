-- Solde et versements du coach -- DÉCOR (16 novembre 2026, L5, P5.4 ; docs/prompts/L5.md ;
-- docs/domaine.md §3.10, §4.8). 0074 écrit les règles (seuil de 20 €, compte opérationnel, un
-- seul versement à la fois, le 5 du mois) : ici, demander un versement et créer les versements
-- du mois ne vérifient rien. Même découpe que les étapes serveur de L4.
--
-- Le solde n'est JAMAIS stocké (§3.10) : il se calcule à chaque lecture, depuis les factures
-- payées du coach (moins leurs commissions) et ses versements.
--
-- Comme les factures (0036), un versement ne porte aucune clé étrangère : il reste une pièce de
-- l'historique d'argent quand le profil disparaît. Son montant ne change jamais ; seul son
-- statut avance, et dans un seul sens (§4.8).

create type public.versement_mode_enum as enum ('mensuel', 'immediat');
create type public.versement_statut_enum as enum ('prevu', 'en_cours', 'verse', 'echoue');

create table public.versements (
  id uuid primary key default gen_random_uuid(),
  profil_coach_id uuid not null,
  -- Ce qui arrive sur le compte du coach.
  montant_centimes integer not null check (montant_centimes > 0),
  -- 100 pour un versement immédiat, retenus sur le solde en plus du montant ; 0 sinon.
  frais_centimes integer not null check (frais_centimes in (0, 100)),
  mode public.versement_mode_enum not null,
  statut public.versement_statut_enum not null default 'prevu',
  -- Le virement chez le prestataire, posé quand il part.
  reference_prestataire text unique,
  -- Code du refus du prestataire, jamais affiché tel quel.
  motif_echec text,
  emis_le timestamptz not null default now(),
  verse_le timestamptz,
  constraint versements_frais_selon_mode
    check ((mode = 'immediat') = (frais_centimes = 100)),
  constraint versements_verse_le_coherent check ((statut = 'verse') = (verse_le is not null))
);

create index versements_profil_coach on public.versements (profil_coach_id, emis_le desc);

alter table public.versements enable row level security;
revoke all on public.versements from public, anon, authenticated, service_role;
grant select on public.versements to service_role;

-- Le solde d'un coach, en centimes. Interne.
--   + ce que ses factures payées lui doivent (TTC moins la commission de la plateforme) ;
--   - ce qui est déjà parti ou en partance (versements prévus, en cours, versés, frais compris).
-- Un versement échoué ne compte plus : son montant revient au solde.
create function public.solde_coach(p_profil_coach_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    coalesce((
      select sum(f.montant_ttc_centimes - f.commission_centimes)
        from public.factures f
       where f.vendeur_profil_coach_id = p_profil_coach_id
    ), 0)
    - coalesce((
      select sum(v.montant_centimes + v.frais_centimes)
        from public.versements v
       where v.profil_coach_id = p_profil_coach_id
         and v.statut in ('prevu', 'en_cours', 'verse')
    ), 0)
  )::integer;
$$;

revoke execute on function public.solde_coach(uuid)
  from public, anon, authenticated, service_role;

-- Le 5 du mois qui suit p_jour (ou p_jour lui-même si c'est le 5). Interne.
create function public.prochain_cinq(p_jour date)
returns date
language sql
immutable
set search_path = public
as $$
  select case
    when extract(day from p_jour) <= 5 then date_trunc('month', p_jour)::date + 4
    else (date_trunc('month', p_jour) + interval '1 month')::date + 4
  end;
$$;

revoke execute on function public.prochain_cinq(date)
  from public, anon, authenticated, service_role;

-- GET /coach/solde (docs/api.md §8) : ce que le coach lit de son argent. Aucune date ni aucun
-- montant n'est calculé par l'application.
create function public.mon_solde()
returns table (
  solde_centimes integer,
  versement_en_cours boolean,
  prochain_versement_le date,
  compte_operationnel boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_coach_en_espace_coach();
begin
  return query select
    public.solde_coach(v_profil),
    exists (
      select 1 from public.versements v
       where v.profil_coach_id = v_profil and v.statut in ('prevu', 'en_cours')
    ),
    public.prochain_cinq((now() at time zone 'Europe/Paris')::date),
    public.compte_versement_operationnel(v_profil);
end;
$$;

revoke execute on function public.mon_solde()
  from public, anon, authenticated, service_role;
grant execute on function public.mon_solde() to authenticated;

-- GET /coach/versements : les siens, du plus récent au plus ancien.
create function public.mes_versements()
returns table (
  id uuid,
  montant_centimes integer,
  frais_centimes integer,
  mode text,
  statut text,
  emis_le timestamptz,
  verse_le timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.montant_centimes, v.frais_centimes, v.mode::text, v.statut::text, v.emis_le,
         v.verse_le
    from public.versements v
   where v.profil_coach_id = public.mon_profil_coach_en_espace_coach()
   order by v.emis_le desc
   limit 24;
$$;

revoke execute on function public.mes_versements()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_versements() to authenticated;

-- POST /coach/versements (mode immédiat). DÉCOR : aucune règle (0074).
create function public.demander_versement_immediat()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_coach_en_espace_coach();
  v_solde integer := public.solde_coach(v_profil);
  v_id uuid;
begin
  insert into public.versements (profil_coach_id, montant_centimes, frais_centimes, mode)
  values (v_profil, greatest(v_solde - 100, 1), 100, 'immediat')
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.demander_versement_immediat()
  from public, anon, authenticated, service_role;
grant execute on function public.demander_versement_immediat() to authenticated;

-- Les versements du mois, par la tâche quotidienne. p_profil_coach_id : un seul coach (banc,
-- rattrapage à la main) ; null : tous. Rend le nombre de versements créés. DÉCOR : aucune
-- règle (0074).
create function public.creer_versements_mensuels(
  p_jour date,
  p_profil_coach_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crees integer;
begin
  insert into public.versements (profil_coach_id, montant_centimes, frais_centimes, mode)
  select c.profil_coach_id, public.solde_coach(c.profil_coach_id), 0, 'mensuel'
    from public.comptes_versement_coach c
   where (p_profil_coach_id is null or c.profil_coach_id = p_profil_coach_id)
     and public.solde_coach(c.profil_coach_id) > 0;
  get diagnostics v_crees = row_count;
  return v_crees;
end;
$$;

revoke execute on function public.creer_versements_mensuels(date, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.creer_versements_mensuels(date, uuid) to service_role;

-- Les versements à faire partir, avec le compte où les virer. Le serveur seul.
create function public.versements_a_executer()
returns table (versement_id uuid, montant_centimes integer, reference_compte_prestataire text)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.montant_centimes, c.reference_compte_prestataire
    from public.versements v
    join public.comptes_versement_coach c on c.profil_coach_id = v.profil_coach_id
   where v.statut = 'prevu'
   order by v.emis_le, v.id;
$$;

revoke execute on function public.versements_a_executer()
  from public, anon, authenticated, service_role;
grant execute on function public.versements_a_executer() to service_role;

-- prevu --> en_cours, avec la référence du virement. Idempotente par la référence.
create function public.poser_versement_en_cours(p_versement_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.versements;
begin
  select * into v from public.versements where id = p_versement_id for update;
  if not found then
    raise exception 'versement_introuvable';
  end if;
  if v.statut = 'en_cours' and v.reference_prestataire = p_reference then
    return;
  end if;
  if v.statut <> 'prevu' or p_reference is null or p_reference = '' then
    raise exception 'transition_interdite';
  end if;
  update public.versements
     set statut = 'en_cours', reference_prestataire = p_reference
   where id = p_versement_id;
end;
$$;

revoke execute on function public.poser_versement_en_cours(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.poser_versement_en_cours(uuid, text) to service_role;

-- en_cours --> verse | echoue (§4.8). Le prévu qui n'a pas pu partir du tout (le prestataire a
-- refusé le virement) passe aussi à echoue. Un versement conclu ne se rouvre jamais.
create function public.conclure_versement(
  p_versement_id uuid,
  p_reussi boolean,
  p_motif text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.versements;
begin
  select * into v from public.versements where id = p_versement_id for update;
  if not found then
    raise exception 'versement_introuvable';
  end if;
  if p_reussi and v.statut = 'verse' then
    return;
  end if;
  if not p_reussi and v.statut = 'echoue' then
    return;
  end if;
  if (p_reussi and v.statut <> 'en_cours') or (not p_reussi and v.statut not in ('prevu', 'en_cours')) then
    raise exception 'transition_interdite';
  end if;
  update public.versements
     set statut = case when p_reussi then 'verse' else 'echoue' end::public.versement_statut_enum,
         verse_le = case when p_reussi then now() end,
         motif_echec = case when p_reussi then null else coalesce(p_motif, 'inconnu') end
   where id = p_versement_id;
end;
$$;

revoke execute on function public.conclure_versement(uuid, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.conclure_versement(uuid, boolean, text) to service_role;
