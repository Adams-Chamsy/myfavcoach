-- Invitations : L3bis (docs/prompts/L3bis.md, P3bis.3 ; docs/domaine.md §3.15/§4.11).
--
-- Aucune politique RLS SELECT ici, et c'est une décision, pas un oubli (docs/backend.md §11,
-- point 4 de docs/prompts/L3bis.md) : la lecture par le coach passe PAR mes_invitations() SEULE,
-- plus bas -- aucun grant SELECT sur cette table, pour aucun rôle. RLS est neanmoins ACTIVÉE
-- explicitement (même motif qu'ailleurs dans ce dépôt, 0001/0007) : le réglage de projet ne
-- garantit rien pour une table créée par migration SQL plutôt que depuis le tableau de bord --
-- et une table RLS activée sans aucune politique permissive refuse tout, par construction
-- (docs/backend.md §5), exactement l'état voulu ici pour la lecture directe.

create type public.invitation_statut_enum as enum ('en_attente', 'compte_cree', 'abonnee');

-- compte_invite_id : ON DELETE CASCADE, pas SET NULL -- un SET NULL laisserait une ligne
-- statut='compte_cree' avec compte_invite_id NULL, une combinaison incohérente qu'aucun code de
-- ce dépôt ne saurait interpréter (compte_invite_id NULL signifie partout ailleurs "en_attente").
-- Si le compte invité disparaît un jour (purge, docs/dette.md), la ligne d'invitation disparaît
-- avec lui plutôt que de mentir.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profils_coach (id) on delete cascade,
  compte_invite_id uuid references public.comptes (id) on delete cascade,
  statut public.invitation_statut_enum not null default 'en_attente',
  cree_le timestamptz not null default now(),
  compte_cree_le timestamptz,
  -- Jamais écrite par cette migration ni par ce lot (docs/domaine.md §3.15, règle 8) : L4 cible.
  abonnee_le timestamptz,
  -- Défensif, pas une couverture attendue en pratique : la ligne se crée une seule fois, au
  -- moment où compte_invite_id est renseigné (voir le déclencheur plus bas), jamais rejouée pour
  -- le même compte. Empêche malgré tout une double ligne pour le même couple si un futur chemin
  -- venait à réinsérer par erreur.
  constraint invitations_coach_compte_invite_unique unique (coach_id, compte_invite_id)
);

create index invitations_coach_id_idx on public.invitations (coach_id);

alter table public.invitations enable row level security;

revoke all on public.invitations from anon, authenticated;

-- service_role N'EST PAS accordé automatiquement sur ce projet -- ce dépôt l'a déjà trouvé cinq
-- fois (0009/0010/0014/0021/0023, "ce projet n'accorde jamais rien à service_role par défaut") :
-- ne pas reproduire ce trou une sixième fois. select + insert, comme decisions_verification
-- (0015) : le banc RLS prépare ses fixtures par service_role, jamais par la session dont le test
-- mesure les droits (règle 5) -- select pour vérifier l'état préparé, insert pour le poser sans
-- rejouer le déclencheur d'inscription à chaque scénario de lecture. Jamais update/delete :
-- aucun chemin, applicatif ou de banc, n'a besoin de modifier une ligne déjà écrite.
grant select, insert on public.invitations to service_role;

-- ---------------------------------------------------------------------------------------------
-- coach_par_jeton_invitation(jeton) : résout un jeton public vers un coach_id, pour I-02.
-- ---------------------------------------------------------------------------------------------

-- Même famille de décision que date_verification_coach() (0019) : une fonction SECURITY DEFINER
-- étroite, jamais un accès direct à profils_coach.jeton_invitation (qui n'a JAMAIS de grant,
-- voir 0026). Ne rend qu'un coach_id, jamais le jeton lui-même, jamais une autre colonne -- le
-- reste du profil se lit ensuite par le chemin déjà public (lireProfilCoachPublic, L2-12),
-- jamais dupliqué ici.
--
-- Un coach non vérifié ne résout à RIEN : même fermeture que profils_coach_select_verifiee
-- (0008) -- un profil en cours d'examen ne doit pas devenir atteignable par un chemin détourné
-- sous prétexte que son jeton, lui, est toujours valide.
create or replace function public.coach_par_jeton_invitation(p_jeton text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profils_coach
  where jeton_invitation = p_jeton and statut_verification = 'verifiee';
$$;

revoke execute on function public.coach_par_jeton_invitation(text) from public;
grant execute on function public.coach_par_jeton_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Liaison compte -> invitation, au moment de l'inscription
-- ---------------------------------------------------------------------------------------------

-- Étend creer_compte_depuis_auth() (0001_creer_identite.sql), PAS un nouveau déclencheur : le
-- jeton voyage dans les MÊMES métadonnées d'inscription que date_naissance/cgu_version_acceptee
-- (auth.signUp({ options: { data: { ..., jeton_invitation } } }) -- snake_case, comme
-- date_naissance/cgu_version_acceptee : src/services/auth/supabase.ts l'envoie déjà ainsi, la
-- casse camelCase/snake_case a déjà mordu une fois sur ce mécanisme précis, docs/prompts/L2.md
-- P2.10), lu dans le MÊME contexte SECURITY DEFINER, pour une raison qui n'est pas de
-- convenance -- ce dépôt exige déjà une
-- confirmation par courriel avant qu'une session existe (docs/ecrans/L1-03) : juste après
-- auth.signUp(), AUCUNE session n'est disponible, donc AUCUNE fonction qui lirait auth.uid()
-- (comme mes_invitations()) ne pourrait être appelée par le client à ce moment-là. Le
-- déclencheur, lui, s'exécute sur l'INSERT dans auth.users, indépendamment de toute session --
-- c'est le seul point qui garantit que le lien ne se perd pas entre l'inscription et la
-- confirmation d'e-mail (parfois jamais complétée).
--
-- jeton_invitation ABSENT des métadonnées (le cas normal, la grande majorité des inscriptions) :
-- aucune erreur, contrairement à date_naissance/cgu_version_acceptee -- une invitation est un
-- bonus, jamais une exigence de l'inscription elle-même.
-- jeton PRÉSENT mais invalide/régénéré depuis : aucune erreur non plus, aucune ligne créée --
-- même règle que I-02 (docs/ecrans/L3bis-I02-arrivee-par-invitation.md) : un jeton qui ne résout
-- à rien se comporte comme s'il n'existait pas, jamais une inscription bloquée pour ça.
create or replace function public.creer_compte_depuis_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  date_naissance_brute text := new.raw_user_meta_data ->> 'date_naissance';
  cgu_version_brute text := new.raw_user_meta_data ->> 'cgu_version_acceptee';
  jeton_brut text := new.raw_user_meta_data ->> 'jeton_invitation';
  v_coach_id uuid;
begin
  if date_naissance_brute is null then
    raise exception 'Inscription refusee : date_naissance absente des metadonnees auth.users (options.data.dateNaissance attendu a l''appel de auth.signUp).';
  end if;

  if cgu_version_brute is null then
    raise exception 'Inscription refusee : cgu_version_acceptee absente des metadonnees auth.users (docs/ecrans/L1-02-creation-compte.md : l''acceptation des CGU doit etre enregistree avec sa version).';
  end if;

  insert into public.comptes (id, date_naissance, cgu_version_acceptee)
  values (new.id, date_naissance_brute::date, cgu_version_brute);

  -- L3bis : lien coach -> compte invité, silencieux si absent ou invalide (voir commentaire
  -- au-dessus de cette fonction).
  if jeton_brut is not null then
    v_coach_id := public.coach_par_jeton_invitation(jeton_brut);
    if v_coach_id is not null then
      insert into public.invitations (coach_id, compte_invite_id, statut, compte_cree_le)
      values (v_coach_id, new.id, 'compte_cree', now());
    end if;
  end if;

  return new;
end;
$$;

-- Le déclencheur lui-même (apres_creation_utilisateur_auth, 0001) n'est PAS recréé : il pointe
-- déjà sur public.creer_compte_depuis_auth() par son nom, et CREATE OR REPLACE FUNCTION
-- ci-dessus change son corps sans qu'aucune référence n'ait besoin d'être retouchée.

-- ---------------------------------------------------------------------------------------------
-- mes_invitations() : lecture étroite par le coach (docs/backend.md §11).
-- ---------------------------------------------------------------------------------------------

-- Colonnes exactes, tranchées en P3bis.1/P3bis.3 (docs/ecrans/L3bis-I01-inviter-mes-clients.md,
-- "Colonnes rendues") : id, statut, prenom, initiale_nom (calculée, JAMAIS nom en entier),
-- abonnee_le. compte_cree_le n'est PAS sélectionnée : rien à l'écran ne l'affiche.
create or replace function public.mes_invitations()
returns table (
  id uuid,
  statut public.invitation_statut_enum,
  prenom text,
  initiale_nom text,
  abonnee_le timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    inv.id,
    inv.statut,
    pc_client.prenom,
    left(pc_client.nom, 1) as initiale_nom,
    inv.abonnee_le
  from public.invitations inv
  join public.profils_client pc_client on pc_client.compte_id = inv.compte_invite_id
  where inv.coach_id = (select id from public.profils_coach where compte_id = auth.uid())
    and inv.statut in ('compte_cree', 'abonnee');
$$;

revoke execute on function public.mes_invitations() from public;
grant execute on function public.mes_invitations() to authenticated;
