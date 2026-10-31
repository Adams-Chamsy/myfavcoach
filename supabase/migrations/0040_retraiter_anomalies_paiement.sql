-- Retraitement des anomalies de paiement -- L4, P4.5c (docs/dette.md, « Aucune alerte sur les
-- anomalies de paiement » et « moyenUtilise rend null sur un prélèvement SEPA rejeté »).
--
-- Une anomalie répond 200 au prestataire : il ne relivre pas (docs/backend.md §12). Si elle venait
-- d'un défaut de NOTRE code, il faut pouvoir la rattraper une fois le défaut corrigé, en relisant
-- la session chez Stripe -- l'information n'est jamais dans l'événement, toujours dans la session.
-- L'Edge Function anomalies-retraitement le fait ; cette migration lui donne de quoi lister les
-- anomalies ouvertes et marquer celles qu'elle a rattrapées.
--
-- 1. anomalies_paiement : resolue_le et resolution, posés ensemble ou pas du tout.
-- 2. enregistrer_anomalie_paiement : une anomalie résolue qui se reproduit est ROUVERTE. Sans ça,
--    l'unicité (session, motif) de 0037 avalerait la récidive en silence.
-- 3. anomalies_paiement_ouvertes : la liste à retraiter, le serveur seul.
-- 4. resoudre_anomalie_paiement : marque une anomalie résolue, une seule fois, le serveur seul.

-- ---------------------------------------------------------------------------------------------
-- 1. Résolution
-- ---------------------------------------------------------------------------------------------

alter table public.anomalies_paiement
  add column resolue_le timestamptz,
  add column resolution text,
  add constraint anomalies_paiement_resolution_complete
    check ((resolue_le is null) = (resolution is null));

-- ---------------------------------------------------------------------------------------------
-- 2. enregistrer_anomalie_paiement -- inchangée (0038) sauf la récidive
-- ---------------------------------------------------------------------------------------------

-- Une relivraison d'une anomalie encore ouverte ne change rien (0038). Une anomalie déjà résolue
-- qui se reproduit rouvre la ligne, avec la date de la récidive.
create or replace function public.enregistrer_anomalie_paiement(
  p_session text,
  p_intention_id uuid,
  p_motif public.anomalie_paiement_motif_enum
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.anomalies_paiement (session_prestataire, intention_id, motif)
  values (p_session, p_intention_id, p_motif)
  on conflict (session_prestataire, motif) do update
    set resolue_le = null, resolution = null, constatee_le = now()
    where anomalies_paiement.resolue_le is not null;
end;
$$;

-- create or replace garde les droits ; reposés quand même, comme 0038, pour qu'ils se lisent ici.
revoke execute on function public.enregistrer_anomalie_paiement(
  text, uuid, public.anomalie_paiement_motif_enum
) from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_anomalie_paiement(
  text, uuid, public.anomalie_paiement_motif_enum
) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. anomalies_paiement_ouvertes -- la liste à retraiter
-- ---------------------------------------------------------------------------------------------

-- Exclues : coach_ecarte et intention_inconnue. Ce ne sont pas des erreurs de lecture, ce sont
-- des issues décidées par synchroniser_session_paiement elle-même ; les relire rendrait la même
-- chose. Elles se traitent à la main (remboursement), pas par un retraitement.
--
-- L'Edge Function l'appelle AVEC LE JETON DE L'APPELANT : réservée à service_role, elle est ce
-- qui refuse tout autre appelant (docs/backend.md §12, Postgres décide des droits).
create or replace function public.anomalies_paiement_ouvertes()
returns table (
  id uuid,
  session_prestataire text,
  motif public.anomalie_paiement_motif_enum,
  constatee_le timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.session_prestataire, a.motif, a.constatee_le
    from public.anomalies_paiement a
   where a.resolue_le is null
     and a.motif not in ('coach_ecarte', 'intention_inconnue')
   order by a.constatee_le, a.id;
$$;

revoke execute on function public.anomalies_paiement_ouvertes()
  from public, anon, authenticated, service_role;
grant execute on function public.anomalies_paiement_ouvertes() to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. resoudre_anomalie_paiement -- une seule fois
-- ---------------------------------------------------------------------------------------------

-- Rend vrai si CET appel a résolu l'anomalie, faux si elle l'était déjà (deux retraitements
-- simultanés : un seul la marque) ou n'existe pas.
create or replace function public.resoudre_anomalie_paiement(
  p_id uuid,
  p_resolution text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_resolution is null or p_resolution = '' then
    raise exception 'resolution_requise';
  end if;
  update public.anomalies_paiement
     set resolue_le = now(), resolution = p_resolution
   where id = p_id and resolue_le is null;
  return found;
end;
$$;

revoke execute on function public.resoudre_anomalie_paiement(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.resoudre_anomalie_paiement(uuid, text) to service_role;
