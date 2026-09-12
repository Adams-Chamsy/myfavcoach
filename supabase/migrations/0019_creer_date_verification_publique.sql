-- Expose publiquement la date de vérification d'un coach, sans rien exposer d'autre de
-- decisions_verification (docs/domaine.md §5.1, révisé le 12 septembre 2026 : un coach sans
-- avis affiche sa date de vérification à la place de la note).
--
-- decisions_verification (0015) reste verrouillée comme prévu à sa création : RLS activée, sans
-- politique, aucun GRANT pour anon/authenticated -- motif et examinateur ne doivent jamais
-- transiter par une lecture publique. Une fonction SECURITY DEFINER étroite est le mécanisme
-- déjà retenu ailleurs dans ce dépôt pour ce genre de trou (pieces_verification_pour_examinateur,
-- 0013 ; decider_verification_coach, 0015) -- celle-ci ne renvoie qu'une date, jamais une ligne.

create or replace function public.date_verification_coach(p_coach_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_statut_actuel public.statut_verification_enum;
  v_date timestamptz;
begin
  select statut_verification into v_statut_actuel
  from public.profils_coach
  where id = p_coach_id;

  -- Un coach qui n'est plus verifiee (revoquee, ou jamais verifie) n'affiche aucune date : une
  -- date de verification passee, montree a un visiteur, mentirait sur le statut courant.
  if v_statut_actuel is distinct from 'verifiee' then
    return null;
  end if;

  -- La decision 'verifiee' la plus recente : celle qui a produit le statut courant, pas
  -- necessairement la toute premiere (verifiee -> revoquee -> ... -> verifiee reste une
  -- trajectoire valide de la machine a etats, docs/domaine.md §4.2).
  select horodatage into v_date
  from public.decisions_verification
  where dossier = p_coach_id and decision = 'verifiee'
  order by horodatage desc
  limit 1;

  return v_date;
end;
$$;

-- Lecture publique deliberee (meme surface que profils_coach.statut_verification lui-meme,
-- deja lisible par anon via la politique de 0008) : n'importe qui consultant une fiche coach
-- doit pouvoir verifier depuis quand. Aucun parametre ne permet de recuperer autre chose qu'une
-- date pour un coach donne -- pas de motif, pas d'examinateur, pas d'historique complet.
revoke execute on function public.date_verification_coach(uuid) from public;
grant execute on function public.date_verification_coach(uuid) to anon, authenticated;
