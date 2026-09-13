-- Defaut de modele trouve pendant la validation de L3 (13 septembre 2026) : profils_coach.
-- discipline est un text libre depuis 0001, sans contrainte -- "Preparation physique" et
-- "preparation physique" y seraient deux valeurs distinctes, ce qui rendrait le filtre de
-- recherche de L3-02 non fiable. Decide : une table de reference, pas une enumeration SQL (le
-- catalogue de disciplines est cense grandir, une ENUM transformerait chaque ajout en migration)
-- ni une simple normalisation de forme (qui ne protegerait pas contre un synonyme, ex. "prepa
-- physique" vs "preparation physique").
--
-- Les sept memes cles que src/fixtures/demonstration.ts portait jusqu'ici (disciplinesCoach) --
-- retiree de la fixture dans le meme lot que cette migration : une regle metier n'a rien a faire
-- dans un jeu de demonstration fige (CLAUDE.md §3).

create table public.disciplines (
  cle text primary key,
  libelle text not null,
  ordre_affichage integer not null,
  -- Une discipline retiree du catalogue (plus proposee a l'inscription ni au filtre de
  -- recherche) sans invalider les profils qui la portent deja -- la cle etrangere plus bas ne
  -- verifie que l'existence de la ligne, jamais active.
  active boolean not null default true
);

insert into public.disciplines (cle, libelle, ordre_affichage) values
  ('préparation physique', 'Préparation physique', 1),
  ('yoga', 'Yoga', 2),
  ('nutrition', 'Nutrition et diététique', 3),
  ('cuisine', 'Cuisine et alimentation du quotidien', 4),
  ('cybersécurité', 'Cybersécurité', 5),
  ('RGPD', 'RGPD et protection des données', 6),
  ('développement professionnel', 'Développement professionnel', 7);

alter table public.disciplines enable row level security;

-- Lecture publique, meme statut que communes_reference (L3-02, migration suivante) : donnee non
-- sensible. Aucun GRANT d'ecriture depuis l'application -- ajouter une discipline reste une
-- operation manuelle (service_role), jamais un ecran (meme motif que l'attribution
-- d'est_examinateur, docs/backend.md §9).
revoke all on public.disciplines from anon, authenticated;
grant select on public.disciplines to anon, authenticated;

create policy disciplines_select_actives
  on public.disciplines for select
  to anon, authenticated
  using (active);

-- La contrainte elle-meme : "Preparation physique" et "preparation physique" ne peuvent plus
-- coexister comme deux valeurs distinctes -- seules les cles de la table sont acceptees. Les
-- lignes existantes (yoga, préparation physique -- verifie avant migration) satisfont deja
-- cette contrainte, aucun nettoyage requis.
alter table public.profils_coach
  add constraint profils_coach_discipline_fkey
  foreign key (discipline) references public.disciplines (cle);
