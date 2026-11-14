-- La pause se demande en jours -- RÈGLE (13 novembre 2026, voir 0058).
--
-- 1. Le refus pause_deja_utilisee porte, en `detail`, le premier jour où une nouvelle pause sera
--    acceptée (ISO, AAAA-MM-JJ) : l'écran dit « à partir du {date} » au lieu d'un non sans date.
--    Même mécanisme que avis_pas_encore (0049).
-- 2. Le contrôle et la date rendue sont LA MÊME expression (dernière pause + 12 mois) : dans 0033,
--    le contrôle comparait à « aujourd'hui − 12 mois », qui n'en est pas toujours l'inverse (une
--    pause prise un 29 février : un jour d'écart). Le refus ne peut plus annoncer une date à
--    laquelle il refuserait encore.
-- 3. demander_pause(uuid, date) est retirée : c'était la porte par laquelle le téléphone
--    choisissait la date de fin. Plus rien ne l'appelle (application, banc, scripts).
create or replace function public.demander_pause_jours(p_abonnement_id uuid, p_jours integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements := public.mon_abonnement_verrouille(p_abonnement_id);
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_possible_le date;
begin
  if v_abonnement.statut <> 'actif' then
    raise exception 'transition_interdite';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 60 then
    raise exception 'duree_pause_invalide';
  end if;
  v_possible_le := (v_abonnement.derniere_pause_le + interval '12 months')::date;
  if v_possible_le is not null and v_aujourdhui < v_possible_le then
    raise exception 'pause_deja_utilisee' using detail = to_char(v_possible_le, 'YYYY-MM-DD');
  end if;
  update public.abonnements
     set statut = 'en_pause', pause_jusqu_le = v_aujourdhui + p_jours, derniere_pause_le = v_aujourdhui
   where id = p_abonnement_id;
end;
$$;

revoke execute on function public.demander_pause_jours(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.demander_pause_jours(uuid, integer) to authenticated;

drop function public.demander_pause(uuid, date);
