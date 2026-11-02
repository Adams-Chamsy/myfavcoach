-- Création du profil client par une fonction du serveur -- RÈGLE (2 novembre 2026, option B).
-- Décor : 0050. Règle de domaine écrite le même jour (docs/domaine.md §3.2) : un profil, client
-- ou coach, se crée par une fonction du serveur qui applique la règle, jamais par une écriture
-- directe.
--
-- Deux défauts que cette migration ferme :
--   1. un compte seulement coach était enfermé dans son espace : il ne pouvait ni créer son
--      profil client (profils_client_insert_espace_client exigeait l'espace client actif), ni
--      passer à l'espace client (basculer_profil exige un profil client). Verrou mutuel, trouvé le
--      2 novembre 2026 ; un tel compte existait sur le projet de développement ;
--   2. un compte neuf créait son profil client seulement parce que comptes.profil_actif vaut
--      'client' PAR DÉFAUT (0001) : la condition « espace client actif » était toujours vraie
--      pour lui. Une politique dont la condition est toujours vraie par défaut n'en est pas une.
--
-- creer_profil_client : symétrique de creer_profil_coach (0005). SECURITY DEFINER (l'espace
-- actif ne compte plus pour créer, et comptes.profil_actif n'a aucun grant UPDATE). Agit
-- toujours sur auth.uid(), AUCUN paramètre de compte. Reproduit à l'identique le comportement de
-- l'adaptateur qu'elle remplace (src/services/donnees/supabase.ts, creerProfilClient) : si le
-- profil existe déjà (retour à l'étape 1 de l'onboarding), il est mis à jour ; sinon il est créé
-- à l'étape 2 ; un nom vide est enregistré comme absent. Puis l'espace client devient actif, dans
-- la même transaction.
create or replace function public.creer_profil_client(prenom text, nom text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profils_client
     set prenom = creer_profil_client.prenom,
         nom = nullif(creer_profil_client.nom, ''),
         onboarding_etape = 2
   where compte_id = auth.uid();
  if not found then
    insert into public.profils_client (compte_id, prenom, nom, onboarding_etape)
    values (auth.uid(), creer_profil_client.prenom, nullif(creer_profil_client.nom, ''), 2);
  end if;
  update public.comptes set profil_actif = 'client' where id = auth.uid();
end;
$$;

revoke execute on function public.creer_profil_client(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.creer_profil_client(text, text) to authenticated;

-- La porte de derrière se ferme, des DEUX côtés : plus aucune insertion directe d'un profil par
-- l'application. Les deux fonctions (creer_profil_client, creer_profil_coach) sont les seuls
-- chemins ; les politiques d'INSERT n'avaient plus de raison d'être (celle du coach était déjà
-- inerte depuis 0005, voir docs/dette.md).
drop policy profils_client_insert_espace_client on public.profils_client;
drop policy profils_coach_insert_espace_coach on public.profils_coach;
revoke insert on public.profils_client from authenticated;
revoke insert on public.profils_coach from authenticated;
