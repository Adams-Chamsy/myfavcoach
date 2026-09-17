-- Formulaire coach de « Mes informations » (docs/ecrans/L1-09-mes-informations.md, révision
-- du 13 septembre 2026) : écrit désormais formats, commune_base_insee, parcours_texte et
-- langues -- quatre colonnes déjà réelles, déjà accordées en UPDATE à authenticated (0006,
-- 0016, 0022), jamais écrites par aucun écran jusqu'ici (docs/dette.md). Aucun GRANT nouveau
-- n'est donc nécessaire pour elles.
--
-- Deux ajouts de schéma restent nécessaires avant que l'écran ne les écrive :
--
-- 1. `langues` (text[]) était laissée en texte libre depuis 0016 -- exactement le défaut déjà
--    corrigé pour `discipline` par 0020 (table de référence, pas une énumération SQL : le
--    catalogue est destiné à grandir). Un tableau ne peut pas porter une clé étrangère standard
--    Postgres -- un déclencheur vérifie donc que chaque élément existe dans cette même table,
--    même garantie que 0020, mécanisme différent parce que la colonne est multivaluée.
--
-- 2. `commune_base_insee` (profils_coach) et `commune_insee` (profils_client) référencent
--    toutes deux `communes_reference` (0023, six communes) depuis L1-09 comme depuis L3 --
--    aucune des deux n'avait de clé étrangère : ajoutée ici, cohérence avec le reste du dépôt
--    (toute liste fermée y est appliquée en base, jamais seulement dans un composant Chip).
--    Vérifié avant migration (npx supabase db query --linked) : aucune ligne existante,
--    profils_coach comme profils_client, ne porte de commune ni de langue -- rien à corriger
--    avant d'ajouter ces contraintes.

create table public.langues (
  cle text primary key,
  libelle text not null,
  ordre_affichage integer not null,
  -- Même raison que disciplines.active (0020) : retirer une langue du catalogue proposé sans
  -- invalider les profils qui la portent déjà.
  active boolean not null default true
);

insert into public.langues (cle, libelle, ordre_affichage) values
  ('français', 'Français', 1),
  ('anglais', 'Anglais', 2),
  ('espagnol', 'Espagnol', 3),
  ('allemand', 'Allemand', 4),
  ('italien', 'Italien', 5),
  ('arabe', 'Arabe', 6),
  ('portugais', 'Portugais', 7);

alter table public.langues enable row level security;

-- Même statut que disciplines/communes_reference : donnée publique, non sensible. Aucun GRANT
-- d'écriture depuis l'application -- ajouter une langue reste une opération manuelle
-- (service_role), jamais un écran.
revoke all on public.langues from anon, authenticated;
grant select on public.langues to anon, authenticated;
-- Oubliée sur disciplines à sa création, corrigée après coup par 0021 : accordée ici directement
-- pour que le banc RLS (service_role) puisse lire ce catalogue sans repasser par une migration
-- de rattrapage.
grant select on public.langues to service_role;

create policy langues_select_actives
  on public.langues for select
  to anon, authenticated
  using (active);

-- La contrainte elle-même : chaque élément de profils_coach.langues doit exister dans
-- public.langues -- pas une clé étrangère standard (impossible sur une colonne tableau), un
-- déclencheur qui vérifie la même chose à chaque écriture.
create or replace function public.verifier_langues_profils_coach()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from unnest(new.langues) as saisie(valeur)
    where not exists (
      select 1 from public.langues where public.langues.cle = saisie.valeur
    )
  ) then
    raise exception 'Langue inconnue (absente de la table langues) dans %', new.langues
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger avant_ecriture_profils_coach_verifie_langues
  before insert or update on public.profils_coach
  for each row
  execute function public.verifier_langues_profils_coach();

-- Référentiel géographique fermé (0023) : les deux colonnes de commune le référencent
-- explicitement, jamais seulement au niveau de l'écran.
alter table public.profils_coach
  add constraint profils_coach_commune_base_insee_fkey
  foreign key (commune_base_insee) references public.communes_reference (code_insee);

alter table public.profils_client
  add constraint profils_client_commune_insee_fkey
  foreign key (commune_insee) references public.communes_reference (code_insee);
