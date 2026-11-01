-- Les avis, côté serveur -- L4, P4.9a (docs/prompts/L4.md ; docs/domaine.md §3.11, §4.9, §5.1 ;
-- docs/ecrans/L2-13-avis.md, docs/ecrans/L4-27a-depot-avis.md).
--
-- Cette migration pose le DÉCOR : les tables, les contraintes de forme, et les cinq fonctions
-- dans une version qui n'applique AUCUNE règle d'éligibilité. 0049 écrit les règles. Même
-- découpe que 0042/0043 : les tests du banc doivent rougir sur une assertion (règle 5 de
-- docs/prompts/L4.md), jamais sur une fonction absente.
--
-- Décisions du 1er novembre 2026 (P4.9a) :
--   - un avis garde L'ABONNEMENT qui l'a rendu possible (abonnement_id) : la durée de suivi se
--     calcule sur lui, et un client qui se réabonne un an plus tard ne réécrit pas un avis
--     portant sur une période qu'il n'a pas vécue ;
--   - 14 jours de modification depuis la PREMIÈRE publication (publie_le) : une modification ne
--     relance rien (modifie_le est une trace, jamais une base de calcul) ;
--   - le dépôt et la modification passent par l'Edge Function `avis`, qui traduit les refus par
--     _partage/refus.ts (docs/api.md §1).
--
-- Aucune lecture ni écriture directe de `avis` depuis l'application : aucun grant à anon ni à
-- authenticated. Tout passe par les fonctions, même principe que mes_invitations()
-- (docs/backend.md §11).

-- ---------------------------------------------------------------------------------------------
-- etiquettes_avis : liste fermée de huit (docs/domaine.md §3.11), même mécanisme que langues
-- (0025). Pas de colonne `active` tant qu'aucun retrait n'est décidé.
-- ---------------------------------------------------------------------------------------------

create table public.etiquettes_avis (
  cle text primary key,
  libelle text not null unique,
  ordre_affichage integer not null unique
);

insert into public.etiquettes_avis (cle, libelle, ordre_affichage) values
  ('ecoute', 'Écoute', 1),
  ('clarte_explications', 'Clarté des explications', 2),
  ('ponctualite', 'Ponctualité', 3),
  ('exigence', 'Exigence', 4),
  ('programme_adapte', 'Programme adapté', 5),
  ('reactivite', 'Réactivité', 6),
  ('encouragement', 'Encouragement', 7),
  ('professionnalisme', 'Professionnalisme', 8);

alter table public.etiquettes_avis enable row level security;

-- Donnée publique, non sensible, comme langues : lue par l'écran de dépôt. Aucune écriture
-- depuis l'application -- une neuvième étiquette est une décision produit (§3.11).
revoke all on public.etiquettes_avis from public, anon, authenticated, service_role;
grant select on public.etiquettes_avis to anon, authenticated;
grant select on public.etiquettes_avis to service_role;

create policy etiquettes_avis_select_tous
  on public.etiquettes_avis for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------------------------
-- avis (docs/domaine.md §3.11, machine §4.9)
-- ---------------------------------------------------------------------------------------------

create type public.avis_statut_enum as enum ('publie', 'signale', 'masque');

create table public.avis (
  id uuid primary key default gen_random_uuid(),
  profil_client_id uuid not null references public.profils_client (id) on delete cascade,
  profil_coach_id uuid not null references public.profils_coach (id) on delete cascade,
  -- L'abonnement qui a rendu l'avis possible (décision du 1er novembre 2026, en tête).
  abonnement_id uuid not null references public.abonnements (id) on delete cascade,
  note smallint not null,
  -- Facultatif ; vide ou fait d'espaces = absent (null), normalisé par les fonctions.
  texte text,
  -- signale / masque : aucune transition d'entrée avant L8 (C-01) ; posés au banc seulement.
  statut public.avis_statut_enum not null default 'publie',
  -- Toujours vide au jalon 1 : aucun grant, aucune fonction ne l'écrit (§3.11).
  reponse_coach text,
  publie_le timestamptz not null default now(),
  modifie_le timestamptz,

  constraint avis_note_bornee check (note between 1 and 5),
  constraint avis_texte_borne check (
    texte is null or (char_length(texte) <= 600 and btrim(texte) <> '')
  ),
  -- Un seul avis par couple client/coach, en base (§3.11) -- pas seulement en interface.
  constraint avis_un_par_couple unique (profil_client_id, profil_coach_id)
);

create index avis_profil_coach_idx on public.avis (profil_coach_id);

-- Un avis référence ses étiquettes par clé étrangère (§3.11) : renommer un libellé ne touche
-- aucun avis. Le plafond de trois est vérifié par les fonctions d'écriture (0049).
create table public.avis_etiquettes (
  avis_id uuid not null references public.avis (id) on delete cascade,
  etiquette_cle text not null references public.etiquettes_avis (cle),
  primary key (avis_id, etiquette_cle)
);

alter table public.avis enable row level security;
alter table public.avis_etiquettes enable row level security;

-- Aucune politique : ni anon ni authenticated n'ont de grant (lecture et écriture par les
-- fonctions security definer ci-dessous).
revoke all on public.avis from public, anon, authenticated, service_role;
revoke all on public.avis_etiquettes from public, anon, authenticated, service_role;

-- service_role (règle 11) : lecture pour vérifier au banc ; update de statut et publie_le
-- SEULEMENT, pour que le banc pose un avis signalé ou masqué (aucune transition avant L8,
-- docs/ecrans/L2-13-avis.md point 6) et simule le quinzième jour sans attendre (point 9 de
-- docs/prompts/L4.md). Aucun insert : même le banc dépose par deposer_avis.
grant select on public.avis to service_role;
grant update (statut, publie_le) on public.avis to service_role;
grant select on public.avis_etiquettes to service_role;

-- ---------------------------------------------------------------------------------------------
-- Durée de suivi (§3.11) : jours calendaires depuis actif_depuis_le jusqu'à aujourd'hui, ou
-- jusqu'à fin_acces_le si elle est passée (figée ensuite), en mois arrondis au plus proche sur
-- 30 jours. Jamais moins d'un mois. Interne : appelée par les lectures, jamais par l'API.
-- ---------------------------------------------------------------------------------------------

create or replace function public.duree_suivi_mois(p_abonnement_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    1,
    round(
      (least(
         (now() at time zone 'Europe/Paris')::date,
         coalesce(a.fin_acces_le, (now() at time zone 'Europe/Paris')::date)
       ) - (a.actif_depuis_le at time zone 'Europe/Paris')::date) / 30.0
    )::integer
  )
  from public.abonnements a
  where a.id = p_abonnement_id;
$$;

revoke execute on function public.duree_suivi_mois(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Les cinq fonctions, VERSION DÉCOR (0049 les remplace) : aucune règle d'éligibilité, aucun
-- délai de modification, aucun plafond d'étiquettes, aucun filtre de statut ni de coach vérifié.
-- ---------------------------------------------------------------------------------------------

create or replace function public.avis_du_coach(p_coach_id uuid)
returns table (
  id uuid,
  prenom text,
  initiale_nom text,
  duree_suivi_mois integer,
  note smallint,
  etiquettes text[],
  texte text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    av.id,
    pc.prenom,
    left(pc.nom, 1),
    public.duree_suivi_mois(av.abonnement_id),
    av.note,
    coalesce(
      (select array_agg(ae.etiquette_cle order by ea.ordre_affichage)
         from public.avis_etiquettes ae
         join public.etiquettes_avis ea on ea.cle = ae.etiquette_cle
        where ae.avis_id = av.id),
      '{}'
    ),
    av.texte
  from public.avis av
  join public.profils_client pc on pc.id = av.profil_client_id
  where av.profil_coach_id = p_coach_id
  order by av.publie_le desc;
$$;

create or replace function public.synthese_avis_du_coach(p_coach_id uuid)
returns table (
  nombre integer,
  moyenne numeric,
  distribution integer[],
  etiquettes_portees text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::integer,
    round(avg(av.note), 1),
    array[
      count(*) filter (where av.note = 1), count(*) filter (where av.note = 2),
      count(*) filter (where av.note = 3), count(*) filter (where av.note = 4),
      count(*) filter (where av.note = 5)
    ]::integer[],
    coalesce(
      (select array_agg(ea.cle order by ea.ordre_affichage)
         from public.etiquettes_avis ea
        where exists (
          select 1 from public.avis_etiquettes ae
            join public.avis a2 on a2.id = ae.avis_id
           where ae.etiquette_cle = ea.cle and a2.profil_coach_id = p_coach_id
        )),
      '{}'
    )
  from public.avis av
  where av.profil_coach_id = p_coach_id;
$$;

create or replace function public.mon_avis_possible(p_coach_id uuid)
returns table (
  etat text,
  jours_restants integer,
  note smallint,
  etiquettes text[],
  texte text,
  statut public.avis_statut_enum
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when av.id is null then 'possible' else 'modifiable' end,
    null::integer,
    av.note,
    case when av.id is null then null else coalesce(
      (select array_agg(ae.etiquette_cle order by ea.ordre_affichage)
         from public.avis_etiquettes ae
         join public.etiquettes_avis ea on ea.cle = ae.etiquette_cle
        where ae.avis_id = av.id),
      '{}'
    ) end,
    av.texte,
    av.statut
  from (select 1) as un
  left join public.avis av
    on av.profil_coach_id = p_coach_id
   and av.profil_client_id = (
     select id from public.profils_client where compte_id = auth.uid()
   );
$$;

create or replace function public.deposer_avis(
  p_coach_id uuid,
  p_note smallint,
  p_etiquettes text[],
  p_texte text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil_client uuid;
  v_abonnement uuid;
  v_avis uuid;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'profil_client_requis';
  end if;
  select id into v_profil_client from public.profils_client where compte_id = auth.uid();
  if v_profil_client is null then
    raise exception 'profil_client_requis';
  end if;
  select id into v_abonnement
    from public.abonnements
   where profil_client_id = v_profil_client and profil_coach_id = p_coach_id
     and statut <> 'annule'
   order by cree_le desc
   limit 1;
  if v_abonnement is null then
    raise exception 'avis_impossible';
  end if;
  begin
    insert into public.avis (profil_client_id, profil_coach_id, abonnement_id, note, texte)
    values (v_profil_client, p_coach_id, v_abonnement, p_note, nullif(btrim(p_texte), ''))
    returning id into v_avis;
  exception when unique_violation then
    raise exception 'avis_deja_donne';
  end;
  insert into public.avis_etiquettes (avis_id, etiquette_cle)
  select v_avis, e from unnest(coalesce(p_etiquettes, '{}')) as e;
  return v_avis;
end;
$$;

create or replace function public.modifier_avis(
  p_coach_id uuid,
  p_note smallint,
  p_etiquettes text[],
  p_texte text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avis uuid;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'profil_client_requis';
  end if;
  select av.id into v_avis
    from public.avis av
    join public.profils_client pc on pc.id = av.profil_client_id
   where pc.compte_id = auth.uid() and av.profil_coach_id = p_coach_id;
  if v_avis is null then
    raise exception 'avis_impossible';
  end if;
  update public.avis
     set note = p_note, texte = nullif(btrim(p_texte), ''), modifie_le = now()
   where id = v_avis;
  delete from public.avis_etiquettes where avis_id = v_avis;
  insert into public.avis_etiquettes (avis_id, etiquette_cle)
  select v_avis, e from unnest(coalesce(p_etiquettes, '{}')) as e;
  return v_avis;
end;
$$;

-- Lectures publiques : sans session comme avec (L2-13, critère 2). Mon état et les écritures :
-- un compte connecté seulement.
revoke execute on function public.avis_du_coach(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.avis_du_coach(uuid) to anon, authenticated, service_role;
revoke execute on function public.synthese_avis_du_coach(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.synthese_avis_du_coach(uuid) to anon, authenticated, service_role;
revoke execute on function public.mon_avis_possible(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.mon_avis_possible(uuid) to authenticated;
revoke execute on function public.deposer_avis(uuid, smallint, text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.deposer_avis(uuid, smallint, text[], text) to authenticated;
revoke execute on function public.modifier_avis(uuid, smallint, text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.modifier_avis(uuid, smallint, text[], text) to authenticated;
