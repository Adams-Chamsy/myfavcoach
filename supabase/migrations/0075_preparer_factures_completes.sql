-- Factures complètes -- DÉCOR (16 novembre 2026, L5, P5.5 ; docs/prompts/L5.md ;
-- docs/domaine.md §3.5, §5.8). 0076 écrit les règles : hors taxes et TVA calculés selon le
-- régime du coach, identité fiscale copiée sur la facture, factures de commission émises le 1er
-- du mois seulement.
--
-- Pose :
--   - la colonne du taux de TVA du vendeur sur la facture (sa copie, comme le reste) ;
--   - la facture de commission de la plateforme au coach (§3.5, reportée de L4 en L5) : une par
--     coach et par mois civil où une commission non nulle a été prélevée, numérotée dans une
--     série annuelle propre à la plateforme, sans trou, immuable ;
--   - les lectures du client et du coach : ses factures, une facture, ses revenus du mois.

alter table public.factures add column vendeur_taux_tva_pour_mille integer;

create table public.compteurs_factures_commission (
  annee smallint primary key,
  dernier_numero integer not null
);

alter table public.compteurs_factures_commission enable row level security;
revoke all on public.compteurs_factures_commission from public, anon, authenticated, service_role;
grant select on public.compteurs_factures_commission to service_role;

-- Aucune clé étrangère vers le profil, comme les factures (0036) : une pièce comptable reste
-- dix ans, lisible sans lui. Le coach y est le CLIENT : sa copie est dedans. L'identité de la
-- plateforme (raison sociale, SIREN, TVA) n'existe pas encore (la société n'est pas créée,
-- docs/perimetre.md §6) : rien n'est inventé, l'écran dit « My Fav Coach ».
create table public.factures_commission (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  profil_coach_id uuid not null,
  -- Premier jour du mois facturé.
  mois date not null,
  coach_prenom text not null,
  coach_nom text,
  coach_siren text,
  coach_adresse text,
  montant_ttc_centimes integer not null check (montant_ttc_centimes > 0),
  -- Vides tant que le régime de TVA de la plateforme n'est pas connu : jamais devinés (§3.5).
  montant_ht_centimes integer,
  tva_centimes integer,
  nombre_lignes integer not null check (nombre_lignes > 0),
  devise text not null default 'EUR' check (devise = 'EUR'),
  emise_le timestamptz not null default now(),
  constraint factures_commission_numero_format check (numero ~ '^C-[0-9]{4}-[0-9]{6}$'),
  constraint factures_commission_une_par_mois unique (profil_coach_id, mois),
  constraint factures_commission_mois_premier check (extract(day from mois) = 1)
);

create trigger factures_commission_immuables
  before update or delete on public.factures_commission
  for each row execute function public.refuser_modification_piece_comptable();

alter table public.factures_commission enable row level security;
revoke all on public.factures_commission from public, anon, authenticated, service_role;
grant select on public.factures_commission to service_role;

-- Les factures de commission du mois qui précède p_jour. p_profil_coach_id : un seul coach
-- (banc) ; null : tous. Idempotente (une par coach et par mois). Rend le nombre émises.
-- DÉCOR : émet quel que soit le jour (0076 : le 1er seulement).
create function public.emettre_factures_commission(
  p_jour date,
  p_profil_coach_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mois date := (date_trunc('month', p_jour) - interval '1 month')::date;
  v_annee smallint := extract(year from p_jour)::smallint;
  v_emises integer := 0;
  v_ligne record;
  v_sequence integer;
begin
  for v_ligne in
    select l.profil_coach_id, sum(l.montant_centimes)::integer as total, count(*)::integer as n
      from public.lignes_commission l
     where (p_profil_coach_id is null or l.profil_coach_id = p_profil_coach_id)
       and (l.emise_le at time zone 'Europe/Paris')::date >= v_mois
       and (l.emise_le at time zone 'Europe/Paris')::date < (v_mois + interval '1 month')::date
       and l.montant_centimes > 0
       and not exists (
         select 1 from public.factures_commission fc
          where fc.profil_coach_id = l.profil_coach_id and fc.mois = v_mois
       )
     group by l.profil_coach_id
     order by l.profil_coach_id
  loop
    insert into public.compteurs_factures_commission (annee, dernier_numero)
    values (v_annee, 1)
    on conflict (annee)
    do update set dernier_numero = public.compteurs_factures_commission.dernier_numero + 1
    returning dernier_numero into v_sequence;

    insert into public.factures_commission (
      numero, profil_coach_id, mois, coach_prenom, coach_nom, coach_siren, coach_adresse,
      montant_ttc_centimes, nombre_lignes
    )
    select 'C-' || v_annee::text || '-' || lpad(v_sequence::text, 6, '0'),
           pc.id, v_mois, pc.prenom, pc.nom, i.siren,
           nullif(concat_ws(', ', i.adresse_ligne, concat_ws(' ', i.code_postal, i.commune)), ''),
           v_ligne.total, v_ligne.n
      from public.profils_coach pc
      left join public.identites_fiscales_coach i on i.profil_coach_id = pc.id
     where pc.id = v_ligne.profil_coach_id;
    v_emises := v_emises + 1;
  end loop;
  return v_emises;
end;
$$;

revoke execute on function public.emettre_factures_commission(date, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.emettre_factures_commission(date, uuid) to service_role;

-- C-05 : les factures du client (espace client) ou celles émises au nom du coach (espace
-- coach), selon l'espace actif. Jamais la référence du paiement chez le prestataire.
create function public.mes_factures()
returns table (
  id uuid,
  numero text,
  libelle text,
  autre_partie text,
  periode_du date,
  periode_au date,
  montant_ttc_centimes integer,
  commission_centimes integer,
  payee_le timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'profil_requis';
  end if;
  if public.profil_actif_courant() = 'client' then
    return query
      select f.id, f.numero, f.libelle, concat_ws(' ', f.vendeur_prenom, f.vendeur_nom),
             f.periode_du, f.periode_au, f.montant_ttc_centimes, null::integer, f.payee_le
        from public.factures f
        join public.profils_client pc on pc.id = f.client_profil_id
       where pc.compte_id = auth.uid()
       order by f.payee_le desc
       limit 100;
  elsif public.profil_actif_courant() = 'coach' then
    return query
      select f.id, f.numero, f.libelle, concat_ws(' ', f.client_prenom, f.client_nom),
             f.periode_du, f.periode_au, f.montant_ttc_centimes, f.commission_centimes,
             f.payee_le
        from public.factures f
        join public.profils_coach pc on pc.id = f.vendeur_profil_coach_id
       where pc.compte_id = auth.uid()
       order by f.payee_le desc
       limit 100;
  else
    raise exception 'profil_requis';
  end if;
end;
$$;

revoke execute on function public.mes_factures() from public, anon, authenticated, service_role;
grant execute on function public.mes_factures() to authenticated;

-- Une facture, avec toutes ses mentions, pour son client ou son vendeur, dans l'espace où elle
-- les concerne. Zéro ligne sinon (même réponse qu'une facture qui n'existe pas).
create function public.ma_facture(p_facture_id uuid)
returns table (
  numero text,
  emise_le timestamptz,
  payee_le timestamptz,
  vendeur_prenom text,
  vendeur_nom text,
  vendeur_siren text,
  vendeur_adresse text,
  vendeur_regime_tva text,
  vendeur_taux_tva_pour_mille integer,
  client_prenom text,
  client_nom text,
  libelle text,
  periode_du date,
  periode_au date,
  montant_ttc_centimes integer,
  montant_ht_centimes integer,
  tva_centimes integer,
  commission_centimes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select f.numero, f.emise_le, f.payee_le, f.vendeur_prenom, f.vendeur_nom, f.vendeur_siren,
         f.vendeur_adresse, f.vendeur_regime_tva, f.vendeur_taux_tva_pour_mille,
         f.client_prenom, f.client_nom, f.libelle, f.periode_du, f.periode_au,
         f.montant_ttc_centimes, f.montant_ht_centimes, f.tva_centimes,
         -- La commission de la plateforme ne regarde que le coach.
         case when public.profil_actif_courant() = 'coach' then f.commission_centimes end
    from public.factures f
   where f.id = p_facture_id
     and auth.uid() is not null
     and (
       (public.profil_actif_courant() = 'client' and exists (
          select 1 from public.profils_client pc
           where pc.id = f.client_profil_id and pc.compte_id = auth.uid()))
       or (public.profil_actif_courant() = 'coach' and exists (
          select 1 from public.profils_coach pc
           where pc.id = f.vendeur_profil_coach_id and pc.compte_id = auth.uid()))
     );
$$;

revoke execute on function public.ma_facture(uuid) from public, anon, authenticated, service_role;
grant execute on function public.ma_facture(uuid) to authenticated;

-- Les factures de commission du coach.
create function public.mes_factures_commission()
returns table (
  id uuid,
  numero text,
  mois date,
  montant_ttc_centimes integer,
  nombre_lignes integer,
  emise_le timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select fc.id, fc.numero, fc.mois, fc.montant_ttc_centimes, fc.nombre_lignes, fc.emise_le
    from public.factures_commission fc
   where fc.profil_coach_id = public.mon_profil_coach_en_espace_coach()
   order by fc.mois desc
   limit 36;
$$;

revoke execute on function public.mes_factures_commission()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_factures_commission() to authenticated;

-- GET /coach/revenus?mois (docs/api.md §8, écran 13). Le mois de p_mois (n'importe quel jour du
-- mois) : encaissements, nombre de paiements, commission, net (encaissements moins commission :
-- ce que le coach perçoit pour ce mois, docs/prompts/L5.md), et le net des cinq mois qui
-- précèdent. Toutes les sommes, aucune n'est calculée par l'écran.
create function public.mes_revenus(p_mois date)
returns table (
  mois date,
  encaissements_centimes integer,
  nombre_paiements integer,
  commission_centimes integer,
  net_centimes integer
)
language sql
stable
security definer
set search_path = public
as $$
  with coach as (select public.mon_profil_coach_en_espace_coach() as id),
  mois as (
    select (date_trunc('month', p_mois) - (n || ' month')::interval)::date as debut
      from generate_series(0, 5) as n
  )
  select m.debut,
         coalesce(sum(f.montant_ttc_centimes), 0)::integer,
         count(f.id)::integer,
         coalesce(sum(f.commission_centimes), 0)::integer,
         coalesce(sum(f.montant_ttc_centimes - f.commission_centimes), 0)::integer
    from mois m
    cross join coach c
    left join public.factures f
      on f.vendeur_profil_coach_id = c.id
     and (f.payee_le at time zone 'Europe/Paris')::date >= m.debut
     and (f.payee_le at time zone 'Europe/Paris')::date < (m.debut + interval '1 month')::date
   group by m.debut
   order by m.debut desc;
$$;

revoke execute on function public.mes_revenus(date) from public, anon, authenticated, service_role;
grant execute on function public.mes_revenus(date) to authenticated;
