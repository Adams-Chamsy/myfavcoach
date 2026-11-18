-- C-07 / L7 : le fichier est conservé hors de la table de suivi accessible au compte.
create schema exports_prives;
revoke all on schema exports_prives from public, anon, authenticated, service_role;

create table exports_prives.fichiers_export (
  demande_id uuid primary key references public.demandes_export (id) on delete cascade,
  jeton uuid not null unique default gen_random_uuid(),
  contenu text not null
);

alter table exports_prives.fichiers_export enable row level security;
revoke all on exports_prives.fichiers_export from public, anon, authenticated, service_role;

-- Le verrou sur le compte sérialise les demandes concurrentes et le marquage de suppression.
create or replace function public.demander_export_donnees()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.comptes
    where id = auth.uid() and supprime_le is null for update;
  if not found then
    raise exception 'compte_introuvable';
  end if;
  if exists (
    select 1 from public.demandes_export
    where compte_id = auth.uid() and demande_le > now() - interval '30 days'
  ) then
    raise exception 'export_trop_recent';
  end if;
  insert into public.demandes_export (compte_id) values (auth.uid());
end;
$$;
revoke execute on function public.demander_export_donnees()
  from public, anon, authenticated, service_role;
grant execute on function public.demander_export_donnees() to authenticated;

-- Colonnes explicites : un futur champ interne n'élargit pas le fichier automatiquement.
create function public.composer_export(p_compte uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version', 1,
    'compte', jsonb_build_object(
      'email', u.email, 'telephone', c.telephone, 'date_naissance', c.date_naissance,
      'cree_le', c.cree_le, 'cgu', c.cgu_version_acceptee, 'profil_actif', c.profil_actif
    ),
    'profil_client', case when cl.id is not null then jsonb_build_object(
      'prenom', cl.prenom, 'nom', cl.nom, 'commune', cl.commune_insee,
      'objectifs', cl.objectifs, 'rythme_hebdo', cl.rythme_hebdo,
      'poids_depart_grammes', case when sante.accorde then cl.poids_depart_grammes end,
      'poids_cible_grammes', case when sante.accorde then cl.poids_cible_grammes end
    ) end,
    'profil_coach', case when co.id is not null then jsonb_build_object(
      'prenom', co.prenom, 'nom', co.nom, 'discipline', co.discipline,
      'titre', co.titre_court, 'bio', co.bio, 'commune', co.commune_base_insee,
      'statut_verification', co.statut_verification
    ) end,
    'autorisations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', a.type, 'accorde', a.accorde, 'version', a.version,
        'horodatage', a.horodatage, 'origine', a.origine
      ) order by a.horodatage, a.id)
      from public.consentements a where a.compte_id = c.id
    ), '[]'::jsonb),
    'mesures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', m.type, 'valeur', m.valeur,
        'unite', case when m.type = 'poids' then 'g' else 'mm' end,
        'mesuree_le', m.mesuree_le, 'enregistree_le', m.enregistree_le
      ) order by m.mesuree_le, m.enregistree_le, m.id)
      from public.mesures_corporelles m where m.profil_client_id = cl.id and sante.accorde
    ), '[]'::jsonb),
    'seances', coalesce((
      select jsonb_agg(jsonb_build_object(
        'titre', modele.titre, 'date_prevue', sp.date_prevue, 'statut', sp.statut,
        'demarree_le', sp.demarree_le, 'terminee_le', sp.terminee_le,
        'rattrapee', sp.rattrapee, 'commentaire', sp.commentaire,
        'ressenti_effort', case when sante.accorde then sp.ressenti_effort end,
        'series', coalesce((
          select jsonb_agg(jsonb_build_object(
            'exercice_id', ss.exercice_id, 'numero', ss.numero,
            'repetitions', ss.repetitions, 'charge_grammes', ss.charge_grammes
          ) order by ss.exercice_id, ss.numero)
          from public.series_saisies ss where ss.seance_programmee_id = sp.id
        ), '[]'::jsonb)
      ) order by sp.date_prevue, sp.id)
      from public.seances_programmees sp
      join public.seances modele on modele.id = sp.seance_id
      where sp.profil_client_id = cl.id
    ), '[]'::jsonb),
    'abonnements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ab.id, 'statut', ab.statut, 'moyen', ab.moyen,
        'prix_centimes', ab.prix_fige_centimes, 'debute_le', ab.debute_le,
        'resilie_le', ab.resilie_le, 'fin_acces_le', ab.fin_acces_le
      ) order by ab.debute_le, ab.id)
      from public.abonnements ab where ab.profil_client_id = cl.id
    ), '[]'::jsonb),
    'factures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'numero', f.numero, 'libelle', f.libelle, 'devise', f.devise,
        'abonnement_id', f.abonnement_id, 'montant_ttc_centimes', f.montant_ttc_centimes,
        'emise_le', f.emise_le, 'payee_le', f.payee_le,
        'periode_du', f.periode_du, 'periode_au', f.periode_au
      ) order by f.emise_le, f.id)
      from public.factures f where f.client_profil_id = cl.id
    ), '[]'::jsonb),
    'factures_commission', coalesce((
      select jsonb_agg(jsonb_build_object(
        'numero', f.numero, 'mois', f.mois, 'devise', f.devise,
        'montant_ttc_centimes', f.montant_ttc_centimes, 'emise_le', f.emise_le
      ) order by f.mois, f.id)
      from public.factures_commission f where f.profil_coach_id = co.id
    ), '[]'::jsonb),
    'versements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'montant_centimes', v.montant_centimes, 'frais_centimes', v.frais_centimes,
        'mode', v.mode, 'statut', v.statut, 'emis_le', v.emis_le, 'verse_le', v.verse_le
      ) order by v.emis_le, v.id)
      from public.versements v where v.profil_coach_id = co.id
    ), '[]'::jsonb),
    'coachs_suivis', coalesce((
      select jsonb_agg(cs.profil_coach_id order by cs.profil_coach_id)
      from public.coachs_suivis cs where cs.profil_client_id = cl.id
    ), '[]'::jsonb)
  )
  from public.comptes c
  join auth.users u on u.id = c.id
  left join public.profils_client cl on cl.compte_id = c.id
  left join public.profils_coach co on co.compte_id = c.id
  left join public.consentements_courants sante
    on sante.compte_id = c.id and sante.type = 'donneesSante'
  where c.id = p_compte and c.supprime_le is null;
$$;
revoke execute on function public.composer_export(uuid) from public, anon, authenticated, service_role;

create function public.preparer_exports()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_url text;
  v_demande record;
  v_contenu text;
  v_jeton uuid;
  v_pret timestamptz;
  v_total integer := 0;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'url_telechargement_export';
  if v_url is null or v_url !~ '^https://[^/?#]+/functions/v1/telecharger-export$' then
    return 0;
  end if;

  for v_demande in
    select d.id, d.compte_id
    from public.demandes_export d join public.comptes c on c.id = d.compte_id
    where d.pret_le is null and c.supprime_le is null
    order by d.demande_le, d.id limit 10 for update of d skip locked
  loop
    v_contenu := jsonb_pretty(public.composer_export(v_demande.compte_id));
    insert into exports_prives.fichiers_export (demande_id, contenu)
      values (v_demande.id, v_contenu) returning jeton into v_jeton;
    v_pret := clock_timestamp();
    update public.demandes_export
      set pret_le = v_pret, expire_le = v_pret + interval '168 hours',
          taille_octets = octet_length(v_contenu), url_signee = v_url || '?jeton=' || v_jeton
      where id = v_demande.id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;
revoke execute on function public.preparer_exports() from public, anon, authenticated, service_role;

create function public.telecharger_export(p_jeton uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select f.contenu
  from exports_prives.fichiers_export f
  join public.demandes_export d on d.id = f.demande_id
  join public.comptes c on c.id = d.compte_id
  where f.jeton = p_jeton and d.expire_le > now() and c.supprime_le is null;
$$;
revoke execute on function public.telecharger_export(uuid) from public, anon, authenticated, service_role;
grant execute on function public.telecharger_export(uuid) to service_role;

create function public.purger_exports()
returns void
language sql security definer
set search_path = public
as $$
  with a_purger as (
    update public.demandes_export d set url_signee = null, taille_octets = null
    from public.comptes c
    where c.id = d.compte_id and d.url_signee is not null
      and (d.expire_le <= now() or c.supprime_le is not null)
    returning d.id
  )
  delete from exports_prives.fichiers_export f using a_purger p where f.demande_id = p.id;
$$;
revoke execute on function public.purger_exports() from public, anon, authenticated, service_role;

create function public.retirer_export_apres_effacement_sante()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_compte uuid;
begin
  if tg_table_name = 'mesures_corporelles' then
    select compte_id into v_compte from public.profils_client where id = old.profil_client_id;
  else
    v_compte := new.compte_id;
  end if;

  -- Verrouille aussi les demandes en attente pour sérialiser un effacement
  -- avec une préparation déjà lancée.
  with retires as (
    update public.demandes_export
    set url_signee = null, taille_octets = null,
        expire_le = case when expire_le is not null then least(expire_le, clock_timestamp()) end
    where compte_id = v_compte and (pret_le is null or url_signee is not null)
    returning id
  )
  delete from exports_prives.fichiers_export f using retires r where f.demande_id = r.id;
  return null;
end;
$$;
revoke execute on function public.retirer_export_apres_effacement_sante()
  from public, anon, authenticated, service_role;

create trigger retirer_export_au_retrait_sante
after insert on public.consentements for each row
when (new.type = 'donneesSante' and not new.accorde)
execute function public.retirer_export_apres_effacement_sante();

create trigger retirer_export_a_effacement_poids
after update of poids_depart_grammes, poids_cible_grammes on public.profils_client for each row
when ((old.poids_depart_grammes is not null and new.poids_depart_grammes is null)
   or (old.poids_cible_grammes is not null and new.poids_cible_grammes is null))
execute function public.retirer_export_apres_effacement_sante();

create trigger retirer_export_a_effacement_mesure
after delete on public.mesures_corporelles for each row
execute function public.retirer_export_apres_effacement_sante();

create index demandes_export_en_attente_idx
  on public.demandes_export (demande_le, id) where pret_le is null;

select cron.schedule('preparer-exports', '* * * * *', 'select public.preparer_exports()');
select cron.schedule('purger-exports', '* * * * *', 'select public.purger_exports()');
