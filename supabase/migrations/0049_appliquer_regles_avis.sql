-- Les règles des avis -- L4, P4.9a. Remplace les cinq fonctions de 0048 (version décor), mêmes
-- signatures et mêmes grants (create or replace les conserve).
--
-- docs/domaine.md §3.11 (éligibilité, forme, durée de suivi), §4.9 (modification ≤ 14 jours),
-- §5.1 (moyenne à partir de 5 avis publiés). Tout est calculé ici, jamais par l'application
-- (docs/api.md §15) ; jours calendaires de Paris partout.
--
-- Les refus sont des codes (raise exception '<code>') que l'Edge Function `avis` traduit par
-- _partage/refus.ts (docs/api.md §1) : avis_pas_encore (avec le nombre de jours restants en
-- DETAIL), avis_suivi_interrompu, avis_impossible, avis_deja_donne, avis_fige, avis_invalide,
-- profil_client_requis.

-- ---------------------------------------------------------------------------------------------
-- Éligibilité (§3.11), interne. L'abonnement considéré : celui en cours s'il y en a un (au plus
-- un, 0043), sinon le dernier résilié ; jamais un abonnement annulé (SEPA rejeté : aucun suivi).
--   aucun            -- pas d'abonnement, ou terminé hors délai (> 60 jours) ou trop court
--                       (< 30 jours de suivi)
--   pas_encore       -- actif ou résiliation programmée, moins de 30 jours ; jours_restants dit
--                       combien. En attente de confirmation (SEPA) : 30, le suivi n'a pas commencé
--   suivi_interrompu -- en pause, impayé ou suspendu, quelle que soit l'ancienneté : la fiche 27a
--                       ne prévoit un compte à rebours que pour un suivi qui avance
--   possible
-- ---------------------------------------------------------------------------------------------

create or replace function public.eligibilite_avis(p_profil_client uuid, p_profil_coach uuid)
returns table (etat text, jours_restants integer, abonnement_id uuid)
language plpgsql
stable
as $$
declare
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_abo public.abonnements;
  v_debut date;
begin
  select * into v_abo
    from public.abonnements a
   where a.profil_client_id = p_profil_client
     and a.profil_coach_id = p_profil_coach
     and a.statut <> 'annule'
   order by (a.statut <> 'resilie') desc, a.cree_le desc
   limit 1;

  if not found then
    return query select 'aucun'::text, null::integer, null::uuid;
    return;
  end if;

  if v_abo.actif_depuis_le is null then
    return query select 'pas_encore'::text, 30, v_abo.id;
    return;
  end if;
  v_debut := (v_abo.actif_depuis_le at time zone 'Europe/Paris')::date;

  if v_abo.statut in ('actif', 'resiliation_programmee') then
    if v_aujourdhui - v_debut >= 30 then
      return query select 'possible'::text, null::integer, v_abo.id;
    else
      return query select 'pas_encore'::text, 30 - (v_aujourdhui - v_debut), v_abo.id;
    end if;
    return;
  end if;

  if v_abo.statut = 'resilie' then
    if v_aujourdhui - v_abo.fin_acces_le <= 60 and v_abo.fin_acces_le - v_debut >= 30 then
      return query select 'possible'::text, null::integer, v_abo.id;
    else
      return query select 'aucun'::text, null::integer, null::uuid;
    end if;
    return;
  end if;

  return query select 'suivi_interrompu'::text, null::integer, v_abo.id;
end;
$$;

revoke execute on function public.eligibilite_avis(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Figé : signalé ou masqué (aucun avis ne l'est avant L8), ou 14 jours calendaires écoulés depuis
-- la PREMIÈRE publication -- publié le 1er, modifiable jusqu'au 14 inclus, figé le 15.
create or replace function public.avis_fige(p_statut public.avis_statut_enum, p_publie_le timestamptz)
returns boolean
language sql
stable
as $$
  select p_statut <> 'publie'
      or (now() at time zone 'Europe/Paris')::date
         >= (p_publie_le at time zone 'Europe/Paris')::date + 14;
$$;

revoke execute on function public.avis_fige(public.avis_statut_enum, timestamptz)
  from public, anon, authenticated, service_role;

-- Forme de la saisie (§3.11) : note de 1 à 5, 0 à 3 étiquettes distinctes de la liste fermée,
-- texte de 600 caractères au plus une fois les espaces retirés aux bords. Rend le texte normalisé
-- (vide ou fait d'espaces = absent).
create or replace function public.verifier_saisie_avis(
  p_note smallint,
  p_etiquettes text[],
  p_texte text
)
returns text
language plpgsql
stable
as $$
declare
  v_etiquettes text[] := coalesce(p_etiquettes, '{}');
  v_texte text := nullif(btrim(p_texte), '');
begin
  if p_note is null or p_note not between 1 and 5
     or cardinality(v_etiquettes) > 3
     or cardinality(v_etiquettes) <> (select count(distinct e) from unnest(v_etiquettes) as e)
     or exists (
       select 1 from unnest(v_etiquettes) as e
        where not exists (select 1 from public.etiquettes_avis ea where ea.cle = e)
     )
     or char_length(v_texte) > 600 then
    raise exception 'avis_invalide';
  end if;
  return v_texte;
end;
$$;

revoke execute on function public.verifier_saisie_avis(smallint, text[], text)
  from public, anon, authenticated, service_role;

-- Profil client de l'appelant, en espace client ; sinon refus.
create or replace function public.mon_profil_client_pour_avis()
returns uuid
language plpgsql
stable
as $$
declare
  v_profil uuid;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'profil_client_requis';
  end if;
  select id into v_profil from public.profils_client where compte_id = auth.uid();
  if v_profil is null then
    raise exception 'profil_client_requis';
  end if;
  return v_profil;
end;
$$;

revoke execute on function public.mon_profil_client_pour_avis()
  from public, anon, authenticated, service_role;

create or replace function public.etiquettes_de_avis(p_avis_id uuid)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(ae.etiquette_cle order by ea.ordre_affichage), '{}')
    from public.avis_etiquettes ae
    join public.etiquettes_avis ea on ea.cle = ae.etiquette_cle
   where ae.avis_id = p_avis_id;
$$;

revoke execute on function public.etiquettes_de_avis(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Les cinq fonctions de 0048, avec leurs règles.
-- ---------------------------------------------------------------------------------------------

-- Lecture publique (L2-13) : avis PUBLIÉS seulement, d'un coach VÉRIFIÉ seulement (même
-- fermeture que le profil public, 0008). Prénom, initiale, durée de suivi -- jamais une date.
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
    public.etiquettes_de_avis(av.id),
    av.texte
  from public.avis av
  join public.profils_client pc on pc.id = av.profil_client_id
  join public.profils_coach co on co.id = av.profil_coach_id
  where av.profil_coach_id = p_coach_id
    and av.statut = 'publie'
    and co.statut_verification = 'verifiee'
  order by av.publie_le desc;
$$;

-- §5.1 : moyenne seulement à partir de 5 avis publiés ; distribution et compteur sans seuil ;
-- étiquettes réellement portées par au moins un avis publié (filtre de L2-13).
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
  with publies as (
    select av.id, av.note
      from public.avis av
      join public.profils_coach co on co.id = av.profil_coach_id
     where av.profil_coach_id = p_coach_id
       and av.statut = 'publie'
       and co.statut_verification = 'verifiee'
  )
  select
    count(*)::integer,
    case when count(*) >= 5 then round(avg(p.note), 1) end,
    array[
      count(*) filter (where p.note = 1), count(*) filter (where p.note = 2),
      count(*) filter (where p.note = 3), count(*) filter (where p.note = 4),
      count(*) filter (where p.note = 5)
    ]::integer[],
    coalesce(
      (select array_agg(ea.cle order by ea.ordre_affichage)
         from public.etiquettes_avis ea
        where exists (
          select 1 from public.avis_etiquettes ae
            join publies on publies.id = ae.avis_id
           where ae.etiquette_cle = ea.cle
        )),
      '{}'
    )
  from publies p;
$$;

-- L'état de l'appelant pour ce coach (27a, 27b) : son avis s'il existe, même signalé ou masqué
-- (L2-13 : visible de son seul auteur), sinon son éligibilité. Hors espace client : aucun.
create or replace function public.mon_avis_possible(p_coach_id uuid)
returns table (
  etat text,
  jours_restants integer,
  note smallint,
  etiquettes text[],
  texte text,
  statut public.avis_statut_enum
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profil uuid;
  v_avis public.avis;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    return query select 'aucun'::text, null::integer, null::smallint, null::text[], null::text,
      null::public.avis_statut_enum;
    return;
  end if;
  select id into v_profil from public.profils_client where compte_id = auth.uid();

  select * into v_avis from public.avis av
   where av.profil_client_id = v_profil and av.profil_coach_id = p_coach_id;
  if found then
    return query select
      case when public.avis_fige(v_avis.statut, v_avis.publie_le) then 'fige' else 'modifiable' end,
      null::integer, v_avis.note, public.etiquettes_de_avis(v_avis.id), v_avis.texte,
      v_avis.statut;
    return;
  end if;

  return query select e.etat, e.jours_restants, null::smallint, null::text[], null::text,
    null::public.avis_statut_enum
    from public.eligibilite_avis(v_profil, p_coach_id) e;
end;
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
  v_profil uuid := public.mon_profil_client_pour_avis();
  v_eligibilite record;
  v_texte text;
  v_avis uuid;
begin
  if exists (
    select 1 from public.avis where profil_client_id = v_profil and profil_coach_id = p_coach_id
  ) then
    raise exception 'avis_deja_donne';
  end if;

  select * into v_eligibilite from public.eligibilite_avis(v_profil, p_coach_id);
  if v_eligibilite.etat = 'pas_encore' then
    raise exception 'avis_pas_encore' using detail = v_eligibilite.jours_restants::text;
  elsif v_eligibilite.etat = 'suivi_interrompu' then
    raise exception 'avis_suivi_interrompu';
  elsif v_eligibilite.etat <> 'possible' then
    raise exception 'avis_impossible';
  end if;

  v_texte := public.verifier_saisie_avis(p_note, p_etiquettes, p_texte);

  begin
    insert into public.avis (profil_client_id, profil_coach_id, abonnement_id, note, texte)
    values (v_profil, p_coach_id, v_eligibilite.abonnement_id, p_note, v_texte)
    returning id into v_avis;
  exception when unique_violation then
    -- Deux dépôts simultanés : la contrainte avis_un_par_couple tranche.
    raise exception 'avis_deja_donne';
  end;
  insert into public.avis_etiquettes (avis_id, etiquette_cle)
  select v_avis, e from unnest(coalesce(p_etiquettes, '{}')) as e;
  return v_avis;
end;
$$;

-- Modification (§4.9) : l'avis garde son abonnement et sa date de première publication ;
-- modifie_le est une trace, jamais une base de calcul.
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
  v_profil uuid := public.mon_profil_client_pour_avis();
  v_avis public.avis;
  v_texte text;
begin
  select * into v_avis from public.avis
   where profil_client_id = v_profil and profil_coach_id = p_coach_id
   for update;
  if not found then
    raise exception 'avis_impossible';
  end if;
  if public.avis_fige(v_avis.statut, v_avis.publie_le) then
    raise exception 'avis_fige';
  end if;

  v_texte := public.verifier_saisie_avis(p_note, p_etiquettes, p_texte);

  update public.avis set note = p_note, texte = v_texte, modifie_le = now() where id = v_avis.id;
  delete from public.avis_etiquettes where avis_id = v_avis.id;
  insert into public.avis_etiquettes (avis_id, etiquette_cle)
  select v_avis.id, e from unnest(coalesce(p_etiquettes, '{}')) as e;
  return v_avis.id;
end;
$$;

-- Mêmes grants que 0048, répétés dans le fichier qui recrée les fonctions
-- (src/test/fonctions-execute-revoque.test.ts : le revoke suit chaque création, fichier par
-- fichier).
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
