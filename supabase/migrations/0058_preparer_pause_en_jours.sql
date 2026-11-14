-- La pause se demande en jours, la date de fin est calculée par le serveur -- DÉCOR (13 novembre
-- 2026, décision du développeur : « une date calculée par le téléphone, c'est l'erreur des 18 ans
-- de L1 qui revient par une autre porte »).
--
-- Cette migration pose la nouvelle fonction avec EXACTEMENT les règles de demander_pause (0033) :
-- seule change l'entrée, un nombre de jours au lieu d'une date. 0059 ajoute la date de reprise
-- possible au refus pause_deja_utilisee et retire l'ancienne fonction. Même découpe que
-- 0052/0053 : le banc doit rougir sur une assertion, jamais sur un objet absent.
--
-- Le domaine fixe le maximum (60 jours, docs/domaine.md §4.3) ; les 2, 4, 6 ou 8 semaines
-- proposées sont un choix d'interface, que le serveur ne restreint pas.
create or replace function public.demander_pause_jours(p_abonnement_id uuid, p_jours integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements := public.mon_abonnement_verrouille(p_abonnement_id);
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if v_abonnement.statut <> 'actif' then
    raise exception 'transition_interdite';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 60 then
    raise exception 'duree_pause_invalide';
  end if;
  if v_abonnement.derniere_pause_le is not null
     and v_abonnement.derniere_pause_le > v_aujourdhui - interval '12 months' then
    raise exception 'pause_deja_utilisee';
  end if;
  update public.abonnements
     set statut = 'en_pause', pause_jusqu_le = v_aujourdhui + p_jours, derniere_pause_le = v_aujourdhui
   where id = p_abonnement_id;
end;
$$;

revoke execute on function public.demander_pause_jours(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.demander_pause_jours(uuid, integer) to authenticated;
