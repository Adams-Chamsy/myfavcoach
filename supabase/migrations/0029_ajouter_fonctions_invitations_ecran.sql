-- Complète 0027 pour que l'écran I-01 (P3bis.5, docs/ecrans/L3bis-I01-inviter-mes-clients.md)
-- ait tout ce qu'il lui faut côté serveur -- deux morceaux manquaient : le compte agrégé des
-- invitations en_attente (le compteur « X ont commencé sur Y », Y en a besoin) et l'action
-- « Ajouter » elle-même (jusqu'ici, seul service_role pouvait insérer une ligne en_attente,
-- utilisé par le banc, jamais par un coach réel).

-- nombre_invitations_en_attente() : même famille que mes_invitations() (0027) -- un agrégat,
-- jamais les lignes elles-mêmes. Une invitation en_attente ne fuit jamais individuellement
-- (docs/prompts/L3bis.md, "la lecture étroite... en_attente n'apparaît individuellement nulle
-- part") ; un COMPTE n'est pas une fuite individuelle, c'est exactement ce que la maquette
-- montre groupé ("6 invitations envoyées").
create or replace function public.nombre_invitations_en_attente()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.invitations
  where coach_id = (select id from public.profils_coach where compte_id = auth.uid())
    and statut = 'en_attente';
$$;

revoke execute on function public.nombre_invitations_en_attente() from public;
grant execute on function public.nombre_invitations_en_attente() to authenticated;

-- ajouter_invitation_en_attente() : docs/ecrans/L3bis-I01-inviter-mes-clients.md, Règles,
-- "Ajouter : un compteur, jamais un champ de nom" -- aucun paramètre, aucune identité capturée.
-- security definer, même motif que les autres écritures de ce lot : authenticated n'a aucun
-- grant direct sur invitations (0027), l'écriture ne peut passer que par une fonction étroite.
create or replace function public.ajouter_invitation_en_attente()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := (select id from public.profils_coach where compte_id = auth.uid());
begin
  if v_coach_id is null then
    raise exception 'Aucun profil coach pour ce compte.';
  end if;

  insert into public.invitations (coach_id, statut)
  values (v_coach_id, 'en_attente');
end;
$$;

revoke execute on function public.ajouter_invitation_en_attente() from public;
grant execute on function public.ajouter_invitation_en_attente() to authenticated;
