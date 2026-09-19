-- L3bis, P3bis.3 (docs/prompts/L3bis.md) : le jeton d'invitation du coach -- un par coach,
-- jamais un par invité (docs/domaine.md §3.15, « un lien pour tout le monde »).
--
-- 22 caractères aléatoires (docs/prompts/L3bis.md, point 1) : encode(gen_random_bytes(16),
-- 'base64') rend 24 caractères pour 16 octets (128 bits) -- 2 caractères de padding '=' retirés,
-- '+'/'/' rendus sûrs pour une URL ('-'/'_') via translate(). Résultat : 22 caractères
-- exactement, 128 bits d'entropie, jamais dérivés du nom du coach ni d'aucune donnée publique --
-- la lisibilité n'est pas une contrainte, un jeton se colle, il ne se dicte pas (même fichier,
-- point 1). 128 bits rendent une collision entre deux coachs non négociable : aucune boucle de
-- nouvelle tentative n'est ajoutée, ce serait de la complexité pour un risque qui n'existe pas.
--
-- pgcrypto n'est pas garanti actif par défaut sur un projet Supabase neuf ; rendu explicite ici
-- pour que la migration reste rejouable de zéro sans dépendre d'un état ambiant.
--
-- Corrigé en poussant cette migration (premier essai, rouge) : Supabase installe les extensions
-- dans le schéma `extensions`, jamais `public`, quel que soit le search_path par défaut de la
-- session qui rejoue les migrations -- `gen_random_bytes` sans préfixe échouait donc
-- ("function gen_random_bytes(integer) does not exist"). Schéma fixé explicitement à la
-- création, et chaque appel qualifié ci-dessous (`extensions.gen_random_bytes`) plutôt que de
-- dépendre d'un search_path élargi : première utilisation de pgcrypto dans ce dépôt, aucun
-- précédent à suivre, donc la forme la plus explicite plutôt que la plus courte.
create extension if not exists pgcrypto with schema extensions;

alter table public.profils_coach
  add column jeton_invitation text;

-- Backfill pour les coachs déjà existants -- décision de P3bis.3 (docs/prompts/L3bis.md) :
-- généré à la migration pour TOUS les coachs existants, pas à la demande. Ainsi la colonne peut
-- porter NOT NULL dès la fin de cette migration : un jeton absent serait un état à gérer partout
-- ailleurs (I-01, la fonction de résolution ci-dessous), pour aucun bénéfice réel.
update public.profils_coach
set jeton_invitation = translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_')
where jeton_invitation is null;

alter table public.profils_coach
  alter column jeton_invitation set not null,
  add constraint profils_coach_jeton_invitation_unique unique (jeton_invitation);

-- ---------------------------------------------------------------------------------------------
-- IMPORTANT -- pourquoi jeton_invitation n'est JAMAIS accordée en colonne, contrairement à
-- prenom/nom/discipline/... (grant existant, 0022) : profils_coach_select_verifiee (0008) laisse
-- déjà lire N'IMPORTE QUELLE ligne vérifiée à anon/authenticated -- un GRANT SELECT sur
-- jeton_invitation, même discret, rendrait donc le jeton de TOUT coach vérifié lisible par
-- GET /rest/v1/profils_coach?select=jeton_invitation, sans exception possible : les politiques
-- RLS s'appliquent ligne par ligne, un GRANT s'applique au rôle entier, jamais "seulement pour
-- son propre coach". C'est exactement le défaut que le jeton doit éviter (point 1,
-- docs/prompts/L3bis.md) -- donc aucun grant, sur aucune colonne existante ni nouvelle, n'ajoute
-- jeton_invitation à la liste. Deux fonctions étroites, plus bas, portent tout l'accès qui reste
-- légitime : le lire (son propre coach seulement) et le régénérer (idem).
-- ---------------------------------------------------------------------------------------------

-- mon_jeton_invitation() : lit le jeton du coach appelant, jamais un paramètre -- même motif que
-- profil_actif_courant() (0002_politiques.sql) : agir sur auth.uid() rend "lire le jeton d'un
-- autre coach" structurellement impossible, aucun paramètre ne le permet.
create or replace function public.mon_jeton_invitation()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select jeton_invitation from public.profils_coach where compte_id = auth.uid();
$$;

revoke execute on function public.mon_jeton_invitation() from public;
grant execute on function public.mon_jeton_invitation() to authenticated;

-- regenerer_jeton_invitation() (point 1, docs/prompts/L3bis.md) : remplace le jeton du coach
-- appelant par un nouveau, tiré par lui-même sur son propre profil uniquement. Ne touche à
-- AUCUNE ligne de invitations (0027) -- seule la valeur du jeton change ; une invitation déjà
-- établie reste lisible comme avant, la régénération ne fait que couper la capacité de CRÉER de
-- nouvelles lignes par l'ancien jeton (coach_par_jeton_invitation, 0027, ne le résoudra plus).
create or replace function public.regenerer_jeton_invitation()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nouveau_jeton text :=
    translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_');
begin
  update public.profils_coach
  set jeton_invitation = v_nouveau_jeton
  where compte_id = auth.uid();

  if not found then
    raise exception 'Aucun profil coach pour ce compte.';
  end if;

  return v_nouveau_jeton;
end;
$$;

revoke execute on function public.regenerer_jeton_invitation() from public;
grant execute on function public.regenerer_jeton_invitation() to authenticated;
