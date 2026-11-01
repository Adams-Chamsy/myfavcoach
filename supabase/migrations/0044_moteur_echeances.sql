-- Le moteur d'échéances, en base seule -- L4, P4.8a (docs/domaine.md §4.3, §4.4 ; découpe du
-- 1er novembre 2026, docs/prompts/L4.md). Aucun appel au prestataire ici : P4.8b branchera une
-- Edge Function qui, chaque matin, appelle appliquer_echeances, puis prélève chaque ligne de
-- echeances_a_prelever (ouvrir_tentative avant, conclure_tentative à l'issue).
--
-- Le jour de traitement est un PARAMÈTRE (défaut : aujourd'hui, Europe/Paris) : la tâche
-- planifiée passe aujourd'hui, le banc pose le jour qu'il exerce — jamais une attente réelle.
--
-- 1. echeances_a_prelever : ce qui doit être tenté ce jour-là — la tentative n° 1 à l'échéance,
--    les relances n° 2 à J+1 et n° 3 à J+3 après un échec, jamais une quatrième (§4.4).
-- 2. ouvrir_tentative : pose la tentative en cours, seulement si elle est due.
-- 3. conclure_tentative : succès -> facture de la période, échéance suivante, impaye -> actif ;
--    échec -> motif de la banque (« jamais deviné »), actif -> impaye. Une fois seulement.
-- 4. appliquer_echeances : les transitions du calendrier — reprise à pause_jusqu_le,
--    resiliation_programmee -> resilie à fin_acces_le, impaye -> suspendu à J+7, suspendu ->
--    resilie à 30 jours. Les deux dernières de cette liste manquaient au prompt P4.8 d'origine.
--
-- Le serveur enregistre l'échec et la date de relance, rien d'autre : aucun canal vers le coach
-- avant L10 (décidé le 31 octobre 2026, docs/dette.md).

-- Un paiement qui aboutit alors que l'abonnement n'attend plus rien (résilié entre l'ouverture de
-- la tentative et son issue, SEPA différé) : jamais facturé, consigné pour remboursement.
alter type public.anomalie_paiement_motif_enum add value 'paiement_hors_abonnement';

-- ---------------------------------------------------------------------------------------------
-- La tentative due (interne)
-- ---------------------------------------------------------------------------------------------

-- Le numéro de la tentative due pour cet abonnement ce jour-là, ou null. L'échéance en jeu est
-- toujours prochain_prelevement_le : elle n'avance qu'au succès (conclure_tentative).
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
  if p_abonnement.statut not in ('actif', 'impaye') or v_echeance > p_jour then
    return null;
  end if;
  select * into v_derniere
    from public.tentatives_prelevement
   where abonnement_id = p_abonnement.id and echeance_le = v_echeance
   order by tentative_numero desc
   limit 1;
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

revoke execute on function public.tentative_due(public.abonnements, date)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 1. echeances_a_prelever
-- ---------------------------------------------------------------------------------------------

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
   where a.statut in ('actif', 'impaye')
     and a.prochain_prelevement_le <= p_jour
     and d.numero is not null
   order by a.prochain_prelevement_le, a.id;
$$;

revoke execute on function public.echeances_a_prelever(date)
  from public, anon, authenticated, service_role;
grant execute on function public.echeances_a_prelever(date) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. ouvrir_tentative
-- ---------------------------------------------------------------------------------------------

-- p_reference : l'identifiant du paiement chez le prestataire (P4.8b). La même référence deux
-- fois rend la même tentative ; une tentative qui n'est pas due ce jour-là est refusée.
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
  return v_id;
end;
$$;

revoke execute on function public.ouvrir_tentative(uuid, date, smallint, text, date)
  from public, anon, authenticated, service_role;
grant execute on function public.ouvrir_tentative(uuid, date, smallint, text, date) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. conclure_tentative
-- ---------------------------------------------------------------------------------------------

-- Rend le statut final de la tentative. Une tentative déjà conclue ne change plus : la même issue
-- livrée deux fois (relivraison d'un événement) ne refait rien.
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
    if v_abonnement.statut in ('actif', 'impaye')
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
-- 4. appliquer_echeances
-- ---------------------------------------------------------------------------------------------

-- Rend le nombre d'abonnements passés par chaque transition ce jour-là.
create or replace function public.appliquer_echeances(
  p_jour date default (now() at time zone 'Europe/Paris')::date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reprises integer;
  v_fins_programmees integer;
  v_suspensions integer;
  v_resiliations integer;
begin
  -- Reprise à l'échéance de la pause (§4.3, tranché le 28 septembre 2026) : même règle que
  -- reprendre_abonnement (0033), sur le jour de fin de pause — le nouveau cycle s'ouvre par son
  -- prélèvement, ce jour-là (echeances_a_prelever le rend dû).
  update public.abonnements
     set statut = 'actif',
         jour_prelevement = public.jour_prelevement_pour(pause_jusqu_le),
         prochain_prelevement_le = pause_jusqu_le,
         pause_jusqu_le = null
   where statut = 'en_pause' and pause_jusqu_le <= p_jour;
  get diagnostics v_reprises = row_count;

  -- Fin de la période payée d'une résiliation programmée : l'échéance n'est jamais prélevée.
  update public.abonnements
     set statut = 'resilie'
   where statut = 'resiliation_programmee' and fin_acces_le <= p_jour;
  get diagnostics v_fins_programmees = row_count;

  -- J+7 sans succès (§4.4, « abandonne ») : suspendu. Jamais tant qu'une tentative est en cours
  -- (son issue, SEPA différé, peut encore être un succès).
  update public.abonnements a
     set statut = 'suspendu'
   where a.statut = 'impaye'
     and a.prochain_prelevement_le + 7 <= p_jour
     and not exists (
       select 1 from public.tentatives_prelevement t
        where t.abonnement_id = a.id
          and t.echeance_le = a.prochain_prelevement_le
          and t.statut in ('en_cours', 'reussie')
     );
  get diagnostics v_suspensions = row_count;

  -- 30 jours de suspension (§4.3) : resilie, accès fini ce jour-là. La suspension commence à
  -- J+7 de l'échéance restée impayée : 30 jours plus tard, c'est J+37.
  update public.abonnements
     set statut = 'resilie', resilie_le = now(), fin_acces_le = p_jour
   where statut = 'suspendu' and prochain_prelevement_le + 37 <= p_jour;
  get diagnostics v_resiliations = row_count;

  return jsonb_build_object(
    'reprises', v_reprises,
    'fins_programmees', v_fins_programmees,
    'suspensions', v_suspensions,
    'resiliations', v_resiliations
  );
end;
$$;

revoke execute on function public.appliquer_echeances(date)
  from public, anon, authenticated, service_role;
grant execute on function public.appliquer_echeances(date) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. Le retraitement des anomalies n'y touche pas
-- ---------------------------------------------------------------------------------------------

-- paiement_hors_abonnement se rembourse à la main, comme abonnement_existant (0043) : rien à
-- relire chez le prestataire, rien à « rattraper » en facturant.
create or replace function public.anomalies_paiement_ouvertes()
returns table (
  id uuid,
  session_prestataire text,
  motif public.anomalie_paiement_motif_enum,
  constatee_le timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.session_prestataire, a.motif, a.constatee_le
    from public.anomalies_paiement a
   where a.resolue_le is null
     -- motif comparé en texte (0043) : une valeur ajoutée à l'énumération dans la même migration
     -- ne peut pas être utilisée par une fonction SQL analysée à sa création.
     and a.motif::text not in (
       'coach_ecarte', 'intention_inconnue', 'abonnement_existant', 'paiement_hors_abonnement'
     )
   order by a.constatee_le, a.id;
$$;

revoke execute on function public.anomalies_paiement_ouvertes()
  from public, anon, authenticated, service_role;
grant execute on function public.anomalies_paiement_ouvertes() to service_role;
