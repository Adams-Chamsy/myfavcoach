-- L5, P5.6b — les règles du rappel de commission (décor : 0077). docs/domaine.md §5.5 et
-- docs/ecrans/L3bis-I01-inviter-mes-clients.md, critère 6.
--
-- - En espace coach seulement (mon_profil_coach_en_espace_coach, 0069 : refus profil_coach_requis).
-- - Seulement tant que la commission est offerte : le jour de commission_offerte_jusqu_le, le taux
--   est déjà de 10 % (§5.5, P4.4), donc plus de rappel ce jour-là.
-- - « Amené par ce lien » : un abonnement ACTIF chez ce coach, dont le client est un compte
--   invité par ce coach et passé à 'abonnee' (0033, entrer_en_actif_premiere_fois). Un abonnement
--   chez un autre coach, ou d'un client venu sans lien, ne compte pas.
-- - « Avec la commission » : chaque prix moins 10 %, arrondi au centime le plus proche,
--   demi-centime vers le haut — la formule exacte de emettre_facture_payee (0076).
create or replace function public.mon_rappel_commission()
returns table (
  commission_offerte_jusqu_le date,
  nombre_abonnements integer,
  total_centimes integer,
  total_apres_commission_centimes integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.mon_profil_coach_en_espace_coach();
  v_jusqu_le date;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  select pc.commission_offerte_jusqu_le into v_jusqu_le
    from public.profils_coach pc where pc.id = v_coach_id;
  if v_jusqu_le is null or v_aujourdhui >= v_jusqu_le then
    return;
  end if;

  return query
  select v_jusqu_le,
         count(*)::integer,
         sum(a.prix_fige_centimes)::integer,
         sum(a.prix_fige_centimes - (a.prix_fige_centimes * 10 + 50) / 100)::integer
    from public.abonnements a
    join public.profils_client pcl on pcl.id = a.profil_client_id
    join public.invitations i
      on i.coach_id = v_coach_id
     and i.compte_invite_id = pcl.compte_id
     and i.statut = 'abonnee'
   where a.profil_coach_id = v_coach_id
     and a.statut = 'actif'
  having count(*) > 0;
end;
$$;

-- create or replace garde les droits, mais la convention (docs/backend.md §4) les redit.
revoke execute on function public.mon_rappel_commission()
  from public, anon, authenticated, service_role;
grant execute on function public.mon_rappel_commission() to authenticated;
