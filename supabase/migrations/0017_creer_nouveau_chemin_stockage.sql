-- L2-06 : le chemin de stockage d'une piece (0012_creer_pieces_verification.sql, decision "UUID
-- seul, genere par le client au moment du depot") doit venir d'une source aleatoire forte.
-- Aucune dependance client (expo-crypto) n'est posee dans ce lot sans decision explicite
-- (CLAUDE.md §4) -- cette fonction deporte la generation cote serveur, ou gen_random_uuid()
-- (pgcrypto, deja utilise partout dans ce schema) est deja disponible.
create or replace function public.nouveau_chemin_stockage()
returns text
language sql
volatile
as $$
  select gen_random_uuid()::text;
$$;

revoke execute on function public.nouveau_chemin_stockage() from public, anon;
grant execute on function public.nouveau_chemin_stockage() to authenticated;
