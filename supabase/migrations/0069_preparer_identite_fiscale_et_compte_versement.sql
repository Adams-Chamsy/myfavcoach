-- Identité fiscale du coach et compte de versement -- DÉCOR (16 novembre 2026, L5, P5.2 ;
-- docs/prompts/L5.md ; docs/domaine.md §3.2, §3.3).
--
-- Cette migration pose les tables et les fonctions, SANS les règles de validation de l'identité
-- fiscale : enregistrer_identite_fiscale y accepte tout ce qu'on lui donne. 0070 écrit les
-- règles. Même découpe que 0048/0049 et 0058/0059 : le banc doit rougir sur une assertion,
-- jamais sur un objet absent.
--
-- Deux tables, hors de profils_coach : aucune de ces données n'est publique, et profils_coach
-- est lue par tout le monde (docs/domaine.md §3.2, docs/backend.md §8). Aucun droit direct pour
-- l'application sur l'une ni l'autre : tout passe par des fonctions.

create type public.regime_tva_enum as enum ('franchise_en_base', 'assujetti');

-- absent : aucun compte chez le prestataire (aucune ligne ici ne porte cet état ; c'est ce que
-- lit un coach sans ligne). Les quatre autres sont posés par le serveur, depuis le prestataire.
create type public.compte_versement_etat_enum as enum (
  'absent',
  'a_completer',
  'en_verification',
  'operationnel',
  'restreint'
);

create table public.identites_fiscales_coach (
  profil_coach_id uuid primary key references public.profils_coach (id) on delete cascade,
  siren text,
  adresse_ligne text,
  code_postal text,
  commune text,
  regime_tva public.regime_tva_enum,
  -- Seulement quand regime_tva = 'assujetti' (200 = 20 %).
  taux_tva_pour_mille integer,
  mise_a_jour_le timestamptz not null default now()
);

alter table public.identites_fiscales_coach enable row level security;
revoke all on public.identites_fiscales_coach from public, anon, authenticated, service_role;
grant select on public.identites_fiscales_coach to service_role;

create table public.comptes_versement_coach (
  profil_coach_id uuid primary key references public.profils_coach (id) on delete cascade,
  -- L'identifiant du compte chez le prestataire : jamais lisible par l'application.
  reference_compte_prestataire text not null unique,
  etat public.compte_versement_etat_enum not null default 'a_completer',
  -- La dernière fois que le serveur a relu l'état chez le prestataire.
  lu_le timestamptz not null default now(),
  cree_le timestamptz not null default now()
);

alter table public.comptes_versement_coach enable row level security;
revoke all on public.comptes_versement_coach from public, anon, authenticated, service_role;
grant select on public.comptes_versement_coach to service_role;

-- Le profil coach du compte connecté, en espace coach : sinon profil_coach_requis. Interne.
create function public.mon_profil_coach_en_espace_coach()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'coach' then
    raise exception 'profil_coach_requis';
  end if;
  select pc.id into v_id from public.profils_coach pc where pc.compte_id = auth.uid();
  if v_id is null then
    raise exception 'profil_coach_requis';
  end if;
  return v_id;
end;
$$;

revoke execute on function public.mon_profil_coach_en_espace_coach()
  from public, anon, authenticated, service_role;

-- DÉCOR : écrit ce qu'on lui donne. Les règles (SIREN, code postal, cohérence régime/taux) sont
-- écrites par 0070.
create function public.enregistrer_identite_fiscale(
  p_siren text,
  p_adresse_ligne text,
  p_code_postal text,
  p_commune text,
  p_regime_tva public.regime_tva_enum,
  p_taux_tva_pour_mille integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_coach_en_espace_coach();
begin
  insert into public.identites_fiscales_coach as i (
    profil_coach_id, siren, adresse_ligne, code_postal, commune, regime_tva, taux_tva_pour_mille
  )
  values (
    v_profil, p_siren, p_adresse_ligne, p_code_postal, p_commune, p_regime_tva,
    p_taux_tva_pour_mille
  )
  on conflict (profil_coach_id) do update
    set siren = excluded.siren,
        adresse_ligne = excluded.adresse_ligne,
        code_postal = excluded.code_postal,
        commune = excluded.commune,
        regime_tva = excluded.regime_tva,
        taux_tva_pour_mille = excluded.taux_tva_pour_mille,
        mise_a_jour_le = now();
end;
$$;

revoke execute on function public.enregistrer_identite_fiscale(
  text, text, text, text, public.regime_tva_enum, integer
) from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_identite_fiscale(
  text, text, text, text, public.regime_tva_enum, integer
) to authenticated;

-- Le coach relit SON identité fiscale, pour la corriger. Zéro ligne s'il n'a rien enregistré.
create function public.mon_identite_fiscale()
returns table (
  siren text,
  adresse_ligne text,
  code_postal text,
  commune text,
  regime_tva text,
  taux_tva_pour_mille integer
)
language sql
stable
security definer
set search_path = public
as $$
  select i.siren, i.adresse_ligne, i.code_postal, i.commune, i.regime_tva::text,
         i.taux_tva_pour_mille
    from public.identites_fiscales_coach i
   where i.profil_coach_id = public.mon_profil_coach_en_espace_coach();
$$;

revoke execute on function public.mon_identite_fiscale()
  from public, anon, authenticated, service_role;
grant execute on function public.mon_identite_fiscale() to authenticated;

-- Complète : toutes les mentions de la facture sont là (docs/domaine.md §3.3). Interne.
create function public.identite_fiscale_complete(p_profil_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.identites_fiscales_coach i
     where i.profil_coach_id = p_profil_coach_id
       and i.siren is not null
       and i.adresse_ligne is not null
       and i.code_postal is not null
       and i.commune is not null
       and i.regime_tva is not null
       and (i.regime_tva <> 'assujetti' or i.taux_tva_pour_mille is not null)
  );
$$;

revoke execute on function public.identite_fiscale_complete(uuid)
  from public, anon, authenticated, service_role;

-- Opérationnel : l'état gardé en base, posé par le serveur depuis le prestataire. Interne.
create function public.compte_versement_operationnel(p_profil_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.comptes_versement_coach c
     where c.profil_coach_id = p_profil_coach_id and c.etat = 'operationnel'
  );
$$;

revoke execute on function public.compte_versement_operationnel(uuid)
  from public, anon, authenticated, service_role;

-- GET /coach/identification (docs/api.md §8) : ce que le coach lit de sa situation. Jamais la
-- référence du compte, jamais le détail de ce que le prestataire réclame.
create function public.mon_identification()
returns table (
  profil_coach_id uuid,
  compte_versement text,
  identite_fiscale_complete boolean,
  peut_publier boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_coach_en_espace_coach();
  v_etat text;
  v_complete boolean := public.identite_fiscale_complete(v_profil);
begin
  select c.etat::text into v_etat
    from public.comptes_versement_coach c where c.profil_coach_id = v_profil;
  v_etat := coalesce(v_etat, 'absent');
  return query select v_profil, v_etat, v_complete, v_etat = 'operationnel' and v_complete;
end;
$$;

revoke execute on function public.mon_identification()
  from public, anon, authenticated, service_role;
grant execute on function public.mon_identification() to authenticated;

-- Le serveur lit le compte d'un coach (la fonction serveur l'appelle APRÈS avoir établi, sous
-- le jeton du coach, de quel profil il s'agit).
create function public.compte_versement_serveur(p_profil_coach_id uuid)
returns table (reference_compte_prestataire text, etat text)
language sql
stable
security definer
set search_path = public
as $$
  select c.reference_compte_prestataire, c.etat::text
    from public.comptes_versement_coach c
   where c.profil_coach_id = p_profil_coach_id;
$$;

revoke execute on function public.compte_versement_serveur(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.compte_versement_serveur(uuid) to service_role;

-- Le serveur pose la référence du compte créé chez le prestataire. Une seule par coach : si deux
-- appels se croisent, le premier gagne, et la fonction rend la référence GARDÉE (l'appelant
-- saura que la sienne est orpheline).
create function public.poser_compte_versement(p_profil_coach_id uuid, p_reference text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference text;
begin
  if p_reference is null or p_reference = '' then
    raise exception 'reference_requise';
  end if;
  insert into public.comptes_versement_coach (profil_coach_id, reference_compte_prestataire)
  values (p_profil_coach_id, p_reference)
  on conflict (profil_coach_id) do nothing;
  select c.reference_compte_prestataire into v_reference
    from public.comptes_versement_coach c where c.profil_coach_id = p_profil_coach_id;
  return v_reference;
end;
$$;

revoke execute on function public.poser_compte_versement(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.poser_compte_versement(uuid, text) to service_role;

-- Le serveur pose l'état relu chez le prestataire.
create function public.poser_etat_compte_versement(
  p_profil_coach_id uuid,
  p_etat public.compte_versement_etat_enum
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_etat = 'absent' then
    raise exception 'etat_invalide';
  end if;
  update public.comptes_versement_coach
     set etat = p_etat, lu_le = now()
   where profil_coach_id = p_profil_coach_id;
  if not found then
    raise exception 'compte_versement_introuvable';
  end if;
end;
$$;

revoke execute on function public.poser_etat_compte_versement(
  uuid, public.compte_versement_etat_enum
) from public, anon, authenticated, service_role;
grant execute on function public.poser_etat_compte_versement(
  uuid, public.compte_versement_etat_enum
) to service_role;
