-- Soumission du dossier de vérification -- DÉCOR (2 novembre 2026, A1, docs/dette.md « Un
-- dossier de vérification n'est jamais soumis à l'examen »).
--
-- Cette migration pose les formes sans effet ; 0053 écrit la règle. Même découpe que 0050/0051 :
-- les tests du banc doivent rougir sur une assertion, jamais sur un objet absent.
--
-- Trois formes :
--   1. profils_coach.dossier_soumis_le : la date de soumission du dossier, d'où part le délai de
--      48 h ouvrées (docs/domaine.md §4.2). Jusqu'ici l'application prenait la date de la plus
--      ancienne pièce jamais déposée, fausse après un refus. Aucun grant à authenticated : seul
--      le serveur l'écrit, et le coach la lit par mon_dossier_verification() ci-dessous.
--   2. soumettre_dossier_si_complet() et son déclencheur sur pieces_verification : la transition
--      automatique vers en_examen. Ici, il ne fait rien.
--   3. mon_dossier_verification() : le dossier de l'appelant, désigné par auth.uid()
--      (docs/backend.md §7). L'application le lisait par profils_coach ... limit(1), qui peut
--      rendre la ligne d'un AUTRE coach (tout coach vérifié est lisible). Ici, il ne rend rien.
alter table public.profils_coach add column dossier_soumis_le timestamptz;

create or replace function public.soumettre_dossier_si_complet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Décor : aucun effet. La règle est écrite par 0053.
  return new;
end;
$$;

revoke execute on function public.soumettre_dossier_si_complet()
  from public, anon, authenticated, service_role;

create trigger apres_depot_piece_soumettre_dossier
  after insert on public.pieces_verification
  for each row execute function public.soumettre_dossier_si_complet();

create or replace function public.mon_dossier_verification()
returns table (statut public.statut_verification_enum, soumis_le timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  -- Décor : ne rend aucune ligne. La lecture est écrite par 0053.
  select null::public.statut_verification_enum, null::timestamptz where false;
$$;

revoke execute on function public.mon_dossier_verification()
  from public, anon, authenticated, service_role;
grant execute on function public.mon_dossier_verification() to authenticated;
