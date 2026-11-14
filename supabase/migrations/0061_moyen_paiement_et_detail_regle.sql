-- Étape serveur de L4 -- RÈGLE (14 novembre 2026, voir 0060).
--
-- 1. La relance après un nouveau moyen de paiement (docs/domaine.md §4.4, précisé ce jour) : une
--    tentative de plus, due le jour posé par remplacer_moyen_paiement, hors du compte de trois,
--    depuis impaye OU suspendu. Son succès régularise (suspendu --(paiement régularisé)--> actif,
--    §4.3) ; son échec laisse l'état tel quel. relance_demandee_le est effacée à l'ouverture de
--    cette tentative : une relance, jamais une boucle.
-- 2. mon_avis_possible rend la durée de suivi (27a : « Suivi depuis {durée} »), calculée par le
--    serveur comme sous chaque avis (duree_suivi_mois, 0048).
-- 3. L'ancienne signature memoriser_moyen_paiement(text, text) est retirée : un moyen conservé
--    sans ses quatre derniers chiffres laisserait 04c sans rien à afficher.

-- ---------------------------------------------------------------------------------------------
-- 1. Le moteur d'échéances : la relance après nouveau moyen
-- ---------------------------------------------------------------------------------------------

create or replace function public.tentative_due(p_abonnement public.abonnements, p_jour date)
returns smallint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_echeance date := p_abonnement.prochain_prelevement_le;
  v_derniere public.tentatives_prelevement;
begin
  if p_abonnement.statut not in ('actif', 'impaye', 'suspendu') or v_echeance > p_jour then
    return null;
  end if;
  select * into v_derniere
    from public.tentatives_prelevement
   where abonnement_id = p_abonnement.id and echeance_le = v_echeance
   order by tentative_numero desc
   limit 1;

  -- Nouveau moyen de paiement enregistré (0060) : une tentative de plus, le jour demandé, tant
  -- que la dernière n'est ni en cours ni réussie. Numérotée à la suite, hors du compte de trois.
  if p_abonnement.relance_demandee_le is not null and p_abonnement.relance_demandee_le <= p_jour then
    if not found then
      return 1;
    end if;
    if v_derniere.statut = 'echouee' then
      return v_derniere.tentative_numero + 1;
    end if;
    return null;
  end if;

  -- Sans relance demandée, un suspendu n'est plus prélevé : J+7 a constaté l'abandon (§4.4).
  if p_abonnement.statut = 'suspendu' then
    return null;
  end if;
  if not found then
    -- Un impayé sans tentative pour son échéance n'existe pas : rien à deviner.
    return case when p_abonnement.statut = 'actif' then 1 end;
  end if;
  -- Une tentative en cours (SEPA différé) ou réussie : rien de plus à tenter.
  if v_derniere.statut <> 'echouee' then
    return null;
  end if;
  if v_derniere.tentative_numero = 1 and p_jour >= v_echeance + 1 then
    return 2;
  end if;
  if v_derniere.tentative_numero = 2 and p_jour >= v_echeance + 3 then
    return 3;
  end if;
  return null;
end;
$$;

-- Droits inchangés (create or replace les conserve) ; redits, par convention (docs/backend.md §4).
revoke execute on function public.tentative_due(public.abonnements, date)
  from public, anon, authenticated, service_role;

create or replace function public.echeances_a_prelever(
  p_jour date default (now() at time zone 'Europe/Paris')::date
)
returns table (
  abonnement_id uuid,
  echeance_le date,
  tentative_numero smallint,
  montant_centimes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.prochain_prelevement_le, d.numero, a.prix_fige_centimes
    from public.abonnements a
   cross join lateral (select public.tentative_due(a, p_jour) as numero) d
   where a.statut in ('actif', 'impaye', 'suspendu')
     and a.prochain_prelevement_le <= p_jour
     and d.numero is not null
   order by a.prochain_prelevement_le, a.id;
$$;

revoke execute on function public.echeances_a_prelever(date)
  from public, anon, authenticated, service_role;
grant execute on function public.echeances_a_prelever(date) to service_role;

-- ouvrir_tentative : identique à 0044, plus l'effacement de la relance demandée quand c'est elle
-- qui s'ouvre -- sinon un échec la rendrait due à nouveau chaque matin.
create or replace function public.ouvrir_tentative(
  p_abonnement_id uuid,
  p_echeance_le date,
  p_tentative_numero smallint,
  p_reference text,
  p_jour date default (now() at time zone 'Europe/Paris')::date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements;
  v_existante public.tentatives_prelevement;
  v_id uuid;
begin
  select * into v_existante from public.tentatives_prelevement where reference_prestataire = p_reference;
  if found then
    if v_existante.abonnement_id <> p_abonnement_id
       or v_existante.echeance_le <> p_echeance_le
       or v_existante.tentative_numero <> p_tentative_numero then
      raise exception 'reference_incoherente';
    end if;
    return v_existante.id;
  end if;

  select * into v_abonnement from public.abonnements where id = p_abonnement_id for update;
  if not found
     or v_abonnement.prochain_prelevement_le <> p_echeance_le
     or public.tentative_due(v_abonnement, p_jour) is distinct from p_tentative_numero then
    raise exception 'tentative_non_due';
  end if;

  insert into public.tentatives_prelevement
    (abonnement_id, echeance_le, tentative_numero, reference_prestataire)
  values (p_abonnement_id, p_echeance_le, p_tentative_numero, p_reference)
  returning id into v_id;

  if v_abonnement.relance_demandee_le is not null and v_abonnement.relance_demandee_le <= p_jour then
    update public.abonnements set relance_demandee_le = null where id = p_abonnement_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.ouvrir_tentative(uuid, date, smallint, text, date)
  from public, anon, authenticated, service_role;
grant execute on function public.ouvrir_tentative(uuid, date, smallint, text, date) to service_role;

-- conclure_tentative : identique à 0044, plus la régularisation d'un suspendu
-- (suspendu --(paiement régularisé ≤ 30 j)--> actif, §4.3).
create or replace function public.conclure_tentative(
  p_reference text,
  p_reussie boolean,
  p_motif public.motif_banque_enum default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tentative public.tentatives_prelevement;
  v_abonnement public.abonnements;
  v_suivante date;
begin
  if not p_reussie and p_motif is null then
    raise exception 'motif_requis';
  end if;
  select * into v_tentative
    from public.tentatives_prelevement
   where reference_prestataire = p_reference
   for update;
  if not found then
    raise exception 'tentative_inconnue';
  end if;
  if v_tentative.statut <> 'en_cours' then
    return v_tentative.statut::text;
  end if;
  select * into v_abonnement from public.abonnements where id = v_tentative.abonnement_id for update;

  if p_reussie then
    update public.tentatives_prelevement
       set statut = 'reussie', terminee_le = now()
     where id = v_tentative.id;
    if v_abonnement.statut in ('actif', 'impaye', 'suspendu')
       and v_abonnement.prochain_prelevement_le = v_tentative.echeance_le then
      v_suivante := public.echeance_suivante(v_tentative.echeance_le, v_abonnement.jour_prelevement);
      perform public.emettre_facture_payee(
        v_abonnement.id, p_reference, v_abonnement.prix_fige_centimes,
        v_tentative.echeance_le, v_suivante - 1
      );
      update public.abonnements
         set statut = 'actif', prochain_prelevement_le = v_suivante
       where id = v_abonnement.id;
    else
      insert into public.anomalies_paiement (session_prestataire, intention_id, motif)
      values (p_reference, null, 'paiement_hors_abonnement')
      on conflict (session_prestataire, motif) do nothing;
    end if;
    return 'reussie';
  end if;

  update public.tentatives_prelevement
     set statut = 'echouee', motif_banque = p_motif, terminee_le = now()
   where id = v_tentative.id;
  if v_abonnement.statut = 'actif' then
    update public.abonnements set statut = 'impaye' where id = v_abonnement.id;
  end if;
  return 'echouee';
end;
$$;

revoke execute on function public.conclure_tentative(text, boolean, public.motif_banque_enum)
  from public, anon, authenticated, service_role;
grant execute on function public.conclure_tentative(text, boolean, public.motif_banque_enum)
  to service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. mon_avis_possible rend la durée de suivi
-- ---------------------------------------------------------------------------------------------

-- Le type de retour change : drop, puis create (create or replace ne change pas les colonnes).
drop function public.mon_avis_possible(uuid);

create function public.mon_avis_possible(p_coach_id uuid)
returns table (
  etat text,
  jours_restants integer,
  note smallint,
  etiquettes text[],
  texte text,
  statut public.avis_statut_enum,
  duree_suivi_mois integer
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
      null::public.avis_statut_enum, null::integer;
    return;
  end if;
  select id into v_profil from public.profils_client where compte_id = auth.uid();

  select * into v_avis from public.avis av
   where av.profil_client_id = v_profil and av.profil_coach_id = p_coach_id;
  if found then
    return query select
      case when public.avis_fige(v_avis.statut, v_avis.publie_le) then 'fige' else 'modifiable' end,
      null::integer, v_avis.note, public.etiquettes_de_avis(v_avis.id), v_avis.texte,
      v_avis.statut, public.duree_suivi_mois(v_avis.abonnement_id);
    return;
  end if;

  return query select e.etat, e.jours_restants, null::smallint, null::text[], null::text,
    null::public.avis_statut_enum,
    case when e.abonnement_id is not null then public.duree_suivi_mois(e.abonnement_id) end
    from public.eligibilite_avis(v_profil, p_coach_id) e;
end;
$$;

revoke execute on function public.mon_avis_possible(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.mon_avis_possible(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. L'ancienne signature disparaît
-- ---------------------------------------------------------------------------------------------

drop function public.memoriser_moyen_paiement(text, text);
