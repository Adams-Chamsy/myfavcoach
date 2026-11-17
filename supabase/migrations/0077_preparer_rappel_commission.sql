-- L5, P5.6b — le rappel de commission de l'écran I-01 (docs/ecrans/L3bis-I01-inviter-mes-clients.md,
-- contenu 4 et critère 6 ; docs/domaine.md §5.5). DÉCOR seulement : la fonction existe, avec ses
-- droits, et ne rend encore rien. Ses règles arrivent en 0078, pour que le banc rougisse sur des
-- assertions, pas sur une fonction absente (même découpe que 0069/0070, 0073/0074, 0075/0076).
--
-- mon_rappel_commission() : pour le coach connecté, en espace coach, tant que sa commission est
-- offerte, les abonnements ACTIFS amenés par ses liens d'invitation — leur nombre, ce qu'ils
-- rapportent par mois, et ce qu'ils rapporteraient avec la commission de 10 %. Aucune ligne s'il
-- n'y en a aucun : l'absence de la carte est l'état honnête (critère 6). L'écran ne calcule rien
-- (docs/api.md §15).
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
begin
  return;
end;
$$;

revoke execute on function public.mon_rappel_commission()
  from public, anon, authenticated, service_role;
grant execute on function public.mon_rappel_commission() to authenticated;
