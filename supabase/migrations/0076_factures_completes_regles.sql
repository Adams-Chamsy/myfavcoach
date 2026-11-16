-- Factures complètes -- RÈGLES (16 novembre 2026, L5, P5.5 ; décor : 0075 ; docs/domaine.md §3.5).
--
--   1. emettre_facture_payee copie l'identité fiscale du coach dans la facture, et calcule HT et
--      TVA depuis son régime : franchise en base, HT = TTC et TVA nulle (la facture porte alors
--      la mention « TVA non applicable, art. 293 B du CGI », écrite par l'écran) ; assujetti,
--      HT = TTC / (1 + taux) au centime le plus proche, TVA = TTC - HT. Identité incomplète :
--      vides, comme à L4. Reprise à l'identique de 0036 pour le reste.
--   2. emettre_factures_commission n'émet que le 1er du mois (tâche du matin), pour le mois
--      précédent.

create or replace function public.emettre_facture_payee(
  p_abonnement_id uuid,
  p_reference_paiement text,
  p_montant_ttc_centimes integer,
  p_periode_du date,
  p_periode_au date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_abonnement public.abonnements;
  v_coach public.profils_coach;
  v_client public.profils_client;
  v_titre text;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_annee smallint := extract(year from v_aujourdhui)::smallint;
  v_sequence integer;
  v_taux smallint;
  v_commission integer;
  v_identite public.identites_fiscales_coach;
  v_ht integer;
  v_tva integer;
begin
  select id into v_id from public.factures where reference_prestataire = p_reference_paiement;
  if found then
    return v_id;
  end if;

  select * into v_abonnement from public.abonnements where id = p_abonnement_id;
  select * into v_coach from public.profils_coach where id = v_abonnement.profil_coach_id;
  select * into v_client from public.profils_client where id = v_abonnement.profil_client_id;
  select titre into v_titre from public.offres where id = v_abonnement.offre_id;

  -- docs/domaine.md §5.5 : jour civil Europe/Paris du paiement, comparé au jour de fin de la
  -- commission offerte -- ce jour-là, le taux est déjà de 10 %. La date est posée par la
  -- première entrée en actif, toujours avant la première facture : son absence est un défaut,
  -- jamais un cas à deviner.
  if v_coach.commission_offerte_jusqu_le is null then
    raise exception 'commission_non_initialisee';
  end if;
  v_taux := case when v_aujourdhui < v_coach.commission_offerte_jusqu_le then 0 else 10 end;
  -- Arrondi au centime le plus proche, demi-centime vers le haut (montants positifs).
  v_commission := (p_montant_ttc_centimes * v_taux + 50) / 100;

  -- 0076 (docs/domaine.md §3.5) : l'identité fiscale du coach AU MOMENT DE L'ÉMISSION, copiée
  -- dans la facture ; HT et TVA calculés depuis son régime. Identité incomplète (une échéance d'un
  -- abonnement souscrit avant L5) : HT et TVA restent vides, jamais devinés.
  select * into v_identite from public.identites_fiscales_coach
   where profil_coach_id = v_coach.id;
  if public.identite_fiscale_complete(v_coach.id) then
    if v_identite.regime_tva = 'franchise_en_base' then
      v_ht := p_montant_ttc_centimes;
      v_tva := 0;
    else
      -- HT = TTC / (1 + taux), arrondi au centime le plus proche ; la TVA est le reste, pour que
      -- HT + TVA = TTC au centime près, toujours.
      v_ht := round(p_montant_ttc_centimes * 1000.0 / (1000 + v_identite.taux_tva_pour_mille))::integer;
      v_tva := p_montant_ttc_centimes - v_ht;
    end if;
  end if;

  insert into public.compteurs_factures (profil_coach_id, annee, dernier_numero)
  values (v_coach.id, v_annee, 1)
  on conflict (profil_coach_id, annee)
  do update set dernier_numero = public.compteurs_factures.dernier_numero + 1
  returning dernier_numero into v_sequence;

  insert into public.factures (
    numero, reference_prestataire, abonnement_id,
    vendeur_profil_coach_id, vendeur_prenom, vendeur_nom,
    vendeur_siren, vendeur_adresse, vendeur_regime_tva, vendeur_taux_tva_pour_mille,
    client_profil_id, client_prenom, client_nom,
    libelle, periode_du, periode_au,
    montant_ttc_centimes, montant_ht_centimes, tva_centimes, commission_centimes, payee_le
  )
  values (
    v_annee::text || '-' || lpad(v_sequence::text, 6, '0'), p_reference_paiement, p_abonnement_id,
    v_coach.id, v_coach.prenom, v_coach.nom,
    case when v_ht is not null then v_identite.siren end,
    case when v_ht is not null then concat_ws(', ', v_identite.adresse_ligne,
      concat_ws(' ', v_identite.code_postal, v_identite.commune)) end,
    case when v_ht is not null then v_identite.regime_tva::text end,
    case when v_ht is not null then v_identite.taux_tva_pour_mille end,
    v_client.id, v_client.prenom, v_client.nom,
    v_titre, p_periode_du, p_periode_au,
    p_montant_ttc_centimes, v_ht, v_tva, v_commission, now()
  )
  returning id into v_id;

  insert into public.lignes_commission (
    facture_id, profil_coach_id, base_ttc_centimes, taux_applique, montant_centimes
  )
  values (v_id, v_coach.id, p_montant_ttc_centimes, v_taux, v_commission);

  return v_id;
end;
$$;

revoke execute on function public.emettre_facture_payee(uuid, text, integer, date, date)
  from public, anon, authenticated, service_role;

create or replace function public.emettre_factures_commission(
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
  if extract(day from p_jour) <> 1 then
    return 0;
  end if;
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
