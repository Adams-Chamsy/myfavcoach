-- L6, P6.5 — l'exécution d'une séance (décor : 0086). docs/domaine.md §4.5 ; docs/prompts/L6.md,
-- décisions 6 et 7 ; docs/ecrans/L6-05-seance-du-jour.md.
--
--   a_faire --(démarrage, le jour prévu ou après)--> en_cours
--   en_cours --(fin)--> faite
--   manquee|partielle --(démarrage, 7 jours au plus après le jour prévu)--> en_cours, « rattrapée »
--   a_faire --(tâche du matin, jour prévu passé)--> manquee
--   en_cours --(tâche du matin, démarrée depuis plus de 24 h)--> partielle
-- Le ressenti d'effort est une donnée de santé : refusé sans le consentement donneesSante.

create or replace function public.demarrer_seance(p_seance_programmee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sp public.seances_programmees := public.ma_seance_programmee_verifiee(p_seance_programmee_id);
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  perform 1 from public.seances_programmees where id = v_sp.id for update;
  if v_sp.statut = 'a_faire' then
    if v_sp.date_prevue > v_aujourdhui then
      raise exception 'seance_pas_encore';
    end if;
    update public.seances_programmees
       set statut = 'en_cours', demarree_le = now()
     where id = v_sp.id;
  elsif v_sp.statut in ('manquee', 'partielle') then
    if v_sp.date_prevue < v_aujourdhui - 7 then
      raise exception 'rattrapage_expire';
    end if;
    update public.seances_programmees
       set statut = 'en_cours', demarree_le = now(), rattrapee = true
     where id = v_sp.id;
  else
    raise exception 'transition_interdite';
  end if;
end;
$$;

create or replace function public.enregistrer_serie(
  p_seance_programmee_id uuid,
  p_exercice_id uuid,
  p_numero smallint,
  p_repetitions smallint,
  p_charge_grammes integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sp public.seances_programmees := public.ma_seance_programmee_verifiee(p_seance_programmee_id);
begin
  if v_sp.statut <> 'en_cours' then
    raise exception 'transition_interdite';
  end if;
  if not exists (
    select 1 from public.exercices where id = p_exercice_id and seance_id = v_sp.seance_id
  ) then
    raise exception 'exercice_introuvable';
  end if;
  if p_numero is null or p_numero < 1 or p_numero > 20
     or (p_repetitions is not null and (p_repetitions < 0 or p_repetitions > 500))
     or (p_charge_grammes is not null and (p_charge_grammes < 0 or p_charge_grammes > 500000)) then
    raise exception 'serie_invalide';
  end if;
  insert into public.series_saisies (
    seance_programmee_id, exercice_id, numero, repetitions, charge_grammes
  )
  values (v_sp.id, p_exercice_id, p_numero, p_repetitions, p_charge_grammes)
  on conflict (seance_programmee_id, exercice_id, numero)
  do update set repetitions = excluded.repetitions,
                charge_grammes = excluded.charge_grammes,
                saisie_le = now();
end;
$$;

create or replace function public.terminer_seance(
  p_seance_programmee_id uuid,
  p_ressenti_effort smallint,
  p_commentaire text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sp public.seances_programmees := public.ma_seance_programmee_verifiee(p_seance_programmee_id);
begin
  if v_sp.statut <> 'en_cours' then
    raise exception 'transition_interdite';
  end if;
  if p_ressenti_effort is not null then
    if not exists (
      select 1 from public.consentements_courants
       where compte_id = auth.uid() and type = 'donneesSante' and accorde
    ) then
      raise exception 'consentement_sante_absent';
    end if;
    if p_ressenti_effort < 1 or p_ressenti_effort > 10 then
      raise exception 'ressenti_invalide';
    end if;
  end if;
  if length(coalesce(p_commentaire, '')) > 500 then
    raise exception 'commentaire_invalide';
  end if;
  update public.seances_programmees
     set statut = 'faite',
         terminee_le = now(),
         ressenti_effort = p_ressenti_effort,
         commentaire = nullif(btrim(coalesce(p_commentaire, '')), '')
   where id = v_sp.id;
end;
$$;

create or replace function public.series_de_ma_seance(p_seance_programmee_id uuid)
returns table (exercice_id uuid, numero smallint, repetitions smallint, charge_grammes integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sp public.seances_programmees := public.ma_seance_programmee_verifiee(p_seance_programmee_id);
begin
  return query
  select s.exercice_id, s.numero, s.repetitions, s.charge_grammes
    from public.series_saisies s
   where s.seance_programmee_id = v_sp.id
   order by s.exercice_id, s.numero;
end;
$$;

-- Décision 6 : la tâche du matin, pour la veille et avant.
create or replace function public.marquer_seances_echues(p_jour date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manquees integer;
  v_partielles integer;
begin
  update public.seances_programmees
     set statut = 'manquee'
   where statut = 'a_faire' and date_prevue < p_jour;
  get diagnostics v_manquees = row_count;
  update public.seances_programmees
     set statut = 'partielle'
   where statut = 'en_cours' and demarree_le < now() - interval '24 hours';
  get diagnostics v_partielles = row_count;
  return v_manquees + v_partielles;
end;
$$;

-- appliquer_echeances : identique à 0068, plus les séances échues (L6), en premier : elles ne
-- touchent pas aux abonnements.
create or replace function public.appliquer_echeances(
  p_jour date default (now() at time zone 'Europe/Paris')::date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seances_echues integer;
  v_comptes_supprimes integer;
  v_reprises integer;
  v_fins_programmees integer;
  v_suspensions integer;
  v_resiliations integer;
begin
  v_seances_echues := public.marquer_seances_echues(p_jour);
  v_comptes_supprimes := public.resilier_abonnements_des_comptes_supprimes(p_jour);

  update public.abonnements
     set statut = 'actif',
         jour_prelevement = public.jour_prelevement_pour(pause_jusqu_le),
         prochain_prelevement_le = pause_jusqu_le,
         pause_jusqu_le = null
   where statut = 'en_pause' and pause_jusqu_le <= p_jour;
  get diagnostics v_reprises = row_count;

  update public.abonnements
     set statut = 'resilie'
   where statut = 'resiliation_programmee' and fin_acces_le <= p_jour;
  get diagnostics v_fins_programmees = row_count;

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

  update public.abonnements
     set statut = 'resilie', resilie_le = now(), fin_acces_le = p_jour
   where statut = 'suspendu' and prochain_prelevement_le + 37 <= p_jour;
  get diagnostics v_resiliations = row_count;

  return jsonb_build_object(
    'seances_echues', v_seances_echues,
    'comptes_supprimes', v_comptes_supprimes,
    'reprises', v_reprises,
    'fins_programmees', v_fins_programmees,
    'suspensions', v_suspensions,
    'resiliations', v_resiliations
  );
end;
$$;

revoke execute on function public.demarrer_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.demarrer_seance(uuid) to authenticated;
revoke execute on function public.enregistrer_serie(uuid, uuid, smallint, smallint, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_serie(uuid, uuid, smallint, smallint, integer)
  to authenticated;
revoke execute on function public.terminer_seance(uuid, smallint, text)
  from public, anon, authenticated, service_role;
grant execute on function public.terminer_seance(uuid, smallint, text) to authenticated;
revoke execute on function public.series_de_ma_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.series_de_ma_seance(uuid) to authenticated;
revoke execute on function public.marquer_seances_echues(date)
  from public, anon, authenticated, service_role;
revoke execute on function public.appliquer_echeances(date)
  from public, anon, authenticated, service_role;
grant execute on function public.appliquer_echeances(date) to service_role;
