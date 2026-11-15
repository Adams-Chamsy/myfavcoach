-- detail_abonnement rend aussi les identifiants du coach et de l'offre (14 novembre 2026, P4.7,
-- écran 04c : « Voir le profil de {prénom} » a besoin de l'identifiant du coach ; l'écran 20 et
-- 24b en auront le même usage). Deux colonnes déjà lisibles par le client sur la table
-- (profil_coach_id, offre_id : grants de 0033) : rien de nouveau n'est exposé.
--
-- Le type de retour change : drop, puis create (create or replace ne change pas les colonnes).
-- Lecture seule, aucune règle ne bouge : une seule migration, sans découpe décor/règle.
drop function public.detail_abonnement(uuid);

create function public.detail_abonnement(p_abonnement_id uuid)
returns table (
  id uuid,
  statut text,
  moyen text,
  moyen_derniers_chiffres text,
  prix_fige_centimes integer,
  prochain_prelevement_le date,
  pause_jusqu_le date,
  fin_acces_le date,
  coach_id uuid,
  offre_id uuid,
  offre_titre text,
  offre_engagement_humain text[],
  coach_prenom text,
  coach_nom text,
  coach_commune_base text,
  derniere_facture_montant_centimes integer,
  derniere_facture_payee_le timestamptz,
  dernier_echec_motif text,
  dernier_echec_echeance_le date,
  grace_jusqu_au date,
  regularisation_avant_le date,
  prochaine_tentative_le date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements;
  v_derniere public.tentatives_prelevement;
  v_prochaine date;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'abonnement_introuvable';
  end if;
  select a.* into v_abonnement
    from public.abonnements a
    join public.profils_client pc on pc.id = a.profil_client_id
   where a.id = p_abonnement_id and pc.compte_id = auth.uid();
  if not found then
    raise exception 'abonnement_introuvable';
  end if;

  select t.* into v_derniere
    from public.tentatives_prelevement t
   where t.abonnement_id = v_abonnement.id
     and t.echeance_le = v_abonnement.prochain_prelevement_le
   order by t.tentative_numero desc
   limit 1;

  if v_abonnement.statut in ('impaye', 'suspendu') then
    if v_abonnement.relance_demandee_le is not null then
      v_prochaine := v_abonnement.relance_demandee_le;
    elsif found and v_derniere.statut = 'echouee' and v_abonnement.statut = 'impaye' then
      v_prochaine := case v_derniere.tentative_numero
        when 1 then v_abonnement.prochain_prelevement_le + 1
        when 2 then v_abonnement.prochain_prelevement_le + 3
      end;
    end if;
  end if;

  return query
  select
    v_abonnement.id,
    v_abonnement.statut::text,
    v_abonnement.moyen::text,
    v_abonnement.moyen_derniers_chiffres,
    v_abonnement.prix_fige_centimes,
    v_abonnement.prochain_prelevement_le,
    v_abonnement.pause_jusqu_le,
    v_abonnement.fin_acces_le,
    v_abonnement.profil_coach_id,
    v_abonnement.offre_id,
    o.titre,
    o.engagement_humain,
    pc.prenom,
    pc.nom,
    cr.nom,
    (select f.montant_ttc_centimes from public.factures f
      where f.abonnement_id = v_abonnement.id order by f.emise_le desc limit 1),
    (select f.payee_le from public.factures f
      where f.abonnement_id = v_abonnement.id order by f.emise_le desc limit 1),
    (select t.motif_banque::text from public.tentatives_prelevement t
      where t.abonnement_id = v_abonnement.id and t.statut = 'echouee'
      order by t.terminee_le desc limit 1),
    (select t.echeance_le from public.tentatives_prelevement t
      where t.abonnement_id = v_abonnement.id and t.statut = 'echouee'
      order by t.terminee_le desc limit 1),
    case when v_abonnement.statut = 'impaye' then v_abonnement.prochain_prelevement_le + 6 end,
    case when v_abonnement.statut = 'suspendu' then v_abonnement.prochain_prelevement_le + 37 end,
    v_prochaine
  from public.offres o
  join public.profils_coach pc on pc.id = v_abonnement.profil_coach_id
  left join public.communes_reference cr on cr.code_insee = pc.commune_base_insee
  where o.id = v_abonnement.offre_id;
end;
$$;

revoke execute on function public.detail_abonnement(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.detail_abonnement(uuid) to authenticated;
