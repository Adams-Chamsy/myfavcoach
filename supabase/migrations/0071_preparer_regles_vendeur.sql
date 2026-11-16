-- Les deux règles de docs/domaine.md §3.3 -- DÉCOR (16 novembre 2026, L5, P5.3 ;
-- docs/prompts/L5.md). 0072 écrit les règles : une offre ne se publie pas, et une souscription
-- est refusée, si le compte de versement du coach n'est pas opérationnel ou si son identité
-- fiscale est incomplète.
--
-- Ces règles s'appliquent à TOUS les coachs, donc à ceux du banc : sans préparation, plus aucun
-- de ses abonnements ne se créerait. Cette migration ne pose que l'outil qui les prépare, pour
-- que le banc rougisse sur les seules assertions nouvelles, jamais sur ses anciennes.
--
-- preparer_vendeur_banc : rend « vendeur » un coach DU BANC (identité fiscale de test, compte de
-- versement opérationnel sous une référence que le prestataire n'a pas pu émettre). Même famille
-- que clore_abonnements_banc (0042) et les purges du banc : le serveur seul, et seulement pour un
-- compte dont l'adresse est celle d'un compte du banc -- sur tout autre, elle refuse.
create function public.preparer_vendeur_banc(p_profil_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.profils_coach pc
      join auth.users u on u.id = pc.compte_id
     where pc.id = p_profil_coach_id
       and u.email like 'banc-rls-%@banc-rls.test'
  ) then
    raise exception 'compte_hors_banc';
  end if;

  insert into public.identites_fiscales_coach (
    profil_coach_id, siren, adresse_ligne, code_postal, commune, regime_tva
  )
  values (p_profil_coach_id, '732829320', '1 rue du Banc', '69003', 'Lyon', 'franchise_en_base')
  on conflict (profil_coach_id) do nothing;

  insert into public.comptes_versement_coach (profil_coach_id, reference_compte_prestataire, etat)
  values (p_profil_coach_id, 'acct_banc_' || replace(p_profil_coach_id::text, '-', ''), 'operationnel')
  on conflict (profil_coach_id) do update set etat = 'operationnel', lu_le = now();
end;
$$;

revoke execute on function public.preparer_vendeur_banc(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.preparer_vendeur_banc(uuid) to service_role;
