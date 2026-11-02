-- Création du profil client par une fonction du serveur -- DÉCOR (2 novembre 2026, option B,
-- docs/dette.md « règles du produit affichées comme des pannes », point 1).
--
-- Cette migration pose seulement la signature de creer_profil_client(), sans effet ; 0051 écrit
-- la règle et ferme l'écriture directe. Même découpe que 0042/0043 et 0048/0049 : les tests du
-- banc doivent rougir sur une assertion, jamais sur une fonction absente.
--
-- Pourquoi : un compte seulement coach ne pouvait ni créer son profil client (la politique
-- profils_client_insert_espace_client exige l'espace client actif) ni passer à l'espace client
-- (basculer_profil exige un profil client). Et un compte neuf ne créait le sien que parce que
-- comptes.profil_actif vaut 'client' PAR DÉFAUT (0001) : une condition toujours vraie, pas une
-- règle. Symétrique de creer_profil_coach (0005).
create or replace function public.creer_profil_client(prenom text, nom text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Décor : aucun effet. La règle est écrite par 0051.
  return;
end;
$$;

revoke execute on function public.creer_profil_client(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.creer_profil_client(text, text) to authenticated;
