-- P2.6 -- Passage en statut_verification, cote serveur (docs/prompts/L2.md).
--
-- Table de transitions validee au point d'arret de P2.6 (13 septembre 2026), derivee du
-- diagramme deja fige dans docs/domaine.md §4.2 -- rien invente ici. Quatre transitions
-- DECIDEES PAR UN EXAMINATEUR, les seules que cette fonction accepte :
--
--   en_examen        -> verifiee            (examen humain OK)
--   en_examen        -> complement_demande  (piece manquante -- motif nomme la piece)
--   en_examen        -> refusee             (refus motive)
--   verifiee         -> revoquee            (diplome expire / signalement fonde)
--
-- Explicitement REFUSEES par cette fonction, et par le diagramme lui-meme (aucune arete) :
-- absente -> verifiee (il faut passer par en_examen), revoquee -> verifiee (idem), et toute
-- paire non listee ci-dessus.
--
-- Quatre AUTRES transitions du meme diagramme existent (absente -> en_examen,
-- complement_demande -> en_examen, refusee|revoquee -> en_examen) mais ne sont PAS couvertes
-- ici : ce sont des reactions automatiques au depot d'une piece par le COACH lui-meme
-- (docs/prompts/L2.md P2.5), jamais une decision humaine -- il n'y a personne qui "decide et
-- journalise quand" dans ce cas. Elles resteront a traiter par un mecanisme separe (probablement
-- un declencheur sur pieces_verification), non construit et non demande par ce prompt.

-- ---------------------------------------------------------------------------------------------
-- Table decisions_verification (DecisionVerification, docs/domaine.md §3.14)
-- ---------------------------------------------------------------------------------------------

-- En ajout seul, meme famille que consentements (0001_creer_identite.sql) : la preuve d'une
-- decision doit pouvoir se reconstituer plus tard, une mise a jour l'effacerait. "Un seul statut
-- par dossier, jamais un statut par piece" (docs/domaine.md §4.2) : dossier designe le coach
-- entier (coach_id), pas une piece individuelle -- un motif texte nomme la piece concernee
-- quand la decision en depend (complement_demande), sans colonne dediee.
create table public.decisions_verification (
  id uuid primary key default gen_random_uuid(),
  dossier uuid not null references public.profils_coach (id) on delete cascade,
  examinateur uuid not null references public.comptes (id),
  decision public.statut_verification_enum not null,
  -- NOT NULL : une decision sans motif est une decision inutilisable, meme principe que
  -- consentements.version (0001_creer_identite.sql). Vrai pour verifiee/revoquee autant que pour
  -- complement_demande/refusee -- un dossier accepte merite aussi une trace de pourquoi.
  motif text not null,
  horodatage timestamptz not null default now()
);

create index decisions_verification_dossier_horodatage_idx
  on public.decisions_verification (dossier, horodatage desc);

alter table public.decisions_verification enable row level security;

-- Aucune politique de lecture depuis l'application (P2.6, point 3) -- donc aucune politique du
-- tout : RLS active sans politique ferme la table a tout le monde, y compris service_role s'il
-- n'avait pas bypassrls (il l'a, comme documente ailleurs dans ce depot). Aucun GRANT non plus
-- pour anon/authenticated : la seule ecriture possible passe par la fonction plus bas, jamais un
-- INSERT direct.
revoke all on public.decisions_verification from anon, authenticated;
-- SELECT seul pour service_role : verifier au banc qu'une decision a bien ete journalisee,
-- jamais pour ecrire (l'ecriture directe contournerait la validation de transition ci-dessous).
grant select on public.decisions_verification to service_role;

-- ---------------------------------------------------------------------------------------------
-- Fonction : decider_verification_coach(coach_id, decision, motif)
-- ---------------------------------------------------------------------------------------------

-- SECURITY DEFINER : ecrit profils_coach.statut_verification (colonne protegee, sans GRANT
-- UPDATE pour personne -- verifie au banc depuis L1) et decisions_verification (aucun GRANT
-- INSERT pour personne) avec les privileges de son proprietaire, jamais ceux de l'appelant.
--
-- "Elle n'est PAS appelable par authenticated" (P2.6, point 2) decrit l'EFFET, pas le GRANT : il
-- n'existe pas de role Postgres distinct pour "le back-office" -- un examinateur EST un compte
-- authenticated ordinaire, seule sa colonne comptes.est_examinateur le distingue (docs/backend.md
-- §9). Un GRANT est un privilege de role, jamais de ligne ou de compte individuel : il ne peut
-- pas cibler "seulement les examinateurs" parmi les authenticated. Meme mecanique deja retenue
-- pour pieces_verification_pour_examinateur() (0013_creer_role_examinateur.sql) : GRANT EXECUTE
-- a authenticated (seul moyen qu'un vrai examinateur puisse jamais l'appeler via PostgREST), et
-- le corps de la fonction refuse -- par une exception, pas un silence -- tout appelant qui n'est
-- pas examinateur.
create or replace function public.decider_verification_coach(
  p_coach_id uuid,
  p_decision public.statut_verification_enum,
  p_motif text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut_actuel public.statut_verification_enum;
begin
  if not public.est_examinateur_courant() then
    raise exception 'examinateur_requis';
  end if;

  if p_motif is null or btrim(p_motif) = '' then
    raise exception 'motif_requis';
  end if;

  select statut_verification into v_statut_actuel
  from public.profils_coach
  where id = p_coach_id;

  if v_statut_actuel is null then
    raise exception 'dossier introuvable pour ce coach_id';
  end if;

  -- Les quatre seules transitions decidees par un examinateur (voir le commentaire d'en-tete) --
  -- toute autre paire, y compris absente->verifiee et revoquee->verifiee explicitement exclues
  -- au point d'arret de P2.6, tombe dans le else et est refusee.
  if not (
    (v_statut_actuel = 'en_examen' and p_decision in ('verifiee', 'complement_demande', 'refusee'))
    or (v_statut_actuel = 'verifiee' and p_decision = 'revoquee')
  ) then
    raise exception 'transition_invalide : % vers % non autorisee pour une decision d''examinateur',
      v_statut_actuel, p_decision;
  end if;

  insert into public.decisions_verification (dossier, examinateur, decision, motif)
  values (p_coach_id, auth.uid(), p_decision, p_motif);

  update public.profils_coach set statut_verification = p_decision where id = p_coach_id;
end;
$$;

revoke execute on function public.decider_verification_coach(uuid, public.statut_verification_enum, text)
  from public, anon, authenticated;
grant execute on function public.decider_verification_coach(uuid, public.statut_verification_enum, text)
  to authenticated;
