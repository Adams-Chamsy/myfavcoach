-- Idempotence des appels sortants : L4, P4.3 (docs/backend.md §13, corps validé en P4.2 ;
-- docs/api.md §1, en-tête Idempotency-Key).
--
-- Protège POST /abonnements/intention contre un double appui ou un nouvel essai réseau. Les
-- événements ENTRANTS du prestataire relèvent d'un autre mécanisme (evenements_prestataire,
-- docs/backend.md §12, P4.5).
--
-- Qui appelle, avec quel jeton (docs/backend.md §12, cas 1) : l'Edge Function
-- abonnement-intention, avec le jeton de session DU CLIENT, transmis tel quel. Jamais
-- service_role : auth.uid() y serait nul, et chaque appel lèverait non_authentifie -- ce qui est
-- voulu, et prouvé au banc. authenticated est donc le seul rôle qui reçoit EXECUTE.
--
-- Péremption : une clé restée 'en_cours' plus de 5 minutes signale une fonction arrêtée en plein
-- traitement ; elle redevient réclamable ('reprise'). Sans danger : la reprise rejoue l'appel au
-- prestataire avec la MÊME clé, que le prestataire déduplique lui-même.

create table public.cles_idempotence (
  -- on delete cascade : sans lui, supprimer un compte qui a une clé échouerait (purge J+30,
  -- nettoyage du banc). Écart assumé au corps de docs/backend.md §13, corrigé là-bas aussi.
  compte_id     uuid not null references public.comptes(id) on delete cascade,
  cle           uuid not null,
  operation     text not null check (operation in ('intention_souscription')),
  empreinte     text not null,          -- sha256 du corps utile de la requête (offreId)
  statut        text not null default 'en_cours' check (statut in ('en_cours','terminee')),
  reservee_le   timestamptz not null default now(),
  code_reponse  int,
  corps_reponse jsonb,
  termine_le    timestamptz,
  primary key (compte_id, cle)
);
-- RLS activée sans aucune politique : aucune lecture ni écriture directe, pour aucun rôle
-- soumis à la RLS (docs/backend.md §5). Seules les deux fonctions ci-dessous y touchent.
alter table public.cles_idempotence enable row level security;

revoke all on table public.cles_idempotence from public, anon, authenticated, service_role;
-- service_role : banc (péremption simulée en reculant reservee_le) et purge des clés de plus de
-- 24 h (P4.8). Deux grants distincts : src/test/conventions-grants-migrations.test.ts (règle 2)
-- ne reconnaît qu'une liste de privilèges sans colonnes, sur « on public.<table> ».
grant select, delete on public.cles_idempotence to service_role;
grant update (reservee_le) on public.cles_idempotence to service_role;

create or replace function public.reserver_cle_idempotence(
  p_cle uuid, p_operation text, p_empreinte text)
returns table (etat text, code_reponse int, corps_reponse jsonb)
language plpgsql security definer set search_path = public as $$
declare v public.cles_idempotence;
begin
  if auth.uid() is null then raise exception 'non_authentifie'; end if;

  insert into cles_idempotence (compte_id, cle, operation, empreinte)
  values (auth.uid(), p_cle, p_operation, p_empreinte)
  on conflict (compte_id, cle) do nothing;
  if found then return query select 'nouvelle'::text, null::int, null::jsonb; return; end if;

  select * into v from cles_idempotence
   where compte_id = auth.uid() and cle = p_cle for update;

  if v.operation <> p_operation or v.empreinte <> p_empreinte then
    raise exception 'cle_idempotence_reutilisee';            -- 422
  end if;
  if v.statut = 'terminee' then
    return query select 'rejouee'::text, v.code_reponse, v.corps_reponse; return;
  end if;
  -- en_cours abandonné (fonction arrêtée en plein traitement) : réclamable après 5 minutes
  if v.reservee_le < now() - interval '5 minutes' then
    update cles_idempotence set reservee_le = now()
     where compte_id = auth.uid() and cle = p_cle;
    return query select 'reprise'::text, null::int, null::jsonb; return;
  end if;
  return query select 'en_cours'::text, null::int, null::jsonb;   -- 409 + Retry-After
end $$;

create or replace function public.terminer_cle_idempotence(
  p_cle uuid, p_code int, p_corps jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non_authentifie'; end if;
  update cles_idempotence
     set statut = 'terminee', code_reponse = p_code, corps_reponse = p_corps, termine_le = now()
   where compte_id = auth.uid() and cle = p_cle and statut = 'en_cours';
  if not found then raise exception 'cle_idempotence_inconnue'; end if;
end $$;

revoke execute on function public.reserver_cle_idempotence(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.reserver_cle_idempotence(uuid, text, text) to authenticated;
revoke execute on function public.terminer_cle_idempotence(uuid, int, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.terminer_cle_idempotence(uuid, int, jsonb) to authenticated;
