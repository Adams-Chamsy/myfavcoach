-- P2.12 -- L2-01 (suppression de compte, C-03) et L2-04 (export de donnees, C-07).
-- docs/prompts/L2.md, docs/domaine.md §2/§4.1, docs/api.md §14.

-- ---------------------------------------------------------------------------------------------
-- L2-01 : suppression de compte
-- ---------------------------------------------------------------------------------------------

-- Motif facultatif (docs/ecrans/L2-01, "Dis-nous pourquoi") -- aucun champ de ce type n'existe
-- dans docs/domaine.md §3.1 (verifie : "motif" n'y apparait nulle part sur Compte), mais la
-- fiche exige explicitement ce champ dans le corps de la requete. Colonne etroite, jamais lue
-- par l'application (aucun GRANT SELECT), ecrite une seule fois par la fonction ci-dessous.
alter table public.comptes add column motif_suppression text;

-- SECURITY DEFINER : comptes.supprime_le n'a aucun GRANT UPDATE pour authenticated (0001/0006),
-- meme motif que profil_actif/statut_verification -- une transition sensible passe par une
-- fonction, jamais par un UPDATE direct.
create or replace function public.supprimer_mon_compte(p_motif text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comptes
  set supprime_le = now(),
      motif_suppression = nullif(btrim(coalesce(p_motif, '')), '')
  where id = auth.uid()
    and supprime_le is null;

  if not found then
    raise exception 'compte introuvable ou deja marque supprime';
  end if;
end;
$$;

revoke execute on function public.supprimer_mon_compte(text) from public, anon, authenticated;
grant execute on function public.supprimer_mon_compte(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- L2-04 : export de donnees (C-07)
-- ---------------------------------------------------------------------------------------------

-- "Fonction distante" (docs/api.md §14) : ce depot n'a pas de generateur de fichier reel
-- (rassembler plusieurs tables, l'envoyer par courriel avec un lien signe) -- non construit a ce
-- lot, voir docs/dette.md. Cette table et la fonction ci-dessous portent honnetement ce qui EST
-- construit : la demande elle-meme, sa date, et la regle "un export par mois maximum" -- jamais
-- une fausse transition vers "pret" qu'aucun mecanisme ne produirait reellement.
create table public.demandes_export (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  demande_le timestamptz not null default now(),
  pret_le timestamptz,
  url_signee text,
  expire_le timestamptz,
  taille_octets bigint
);

create index demandes_export_compte_demande_idx
  on public.demandes_export (compte_id, demande_le desc);

alter table public.demandes_export enable row level security;

revoke all on public.demandes_export from anon, authenticated;
-- SELECT direct pour lire son propre historique (l'etat affiche = la ligne la plus recente) --
-- aucun GRANT INSERT : la seule ecriture passe par la fonction ci-dessous, qui applique la regle
-- du delai d'un mois AVANT d'inserer, jamais apres.
grant select on public.demandes_export to authenticated;

create policy demandes_export_select_proprietaire
  on public.demandes_export
  for select
  to authenticated
  using (compte_id = auth.uid());

create or replace function public.demander_export_donnees()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_derniere timestamptz;
begin
  select demande_le into v_derniere
  from public.demandes_export
  where compte_id = auth.uid()
  order by demande_le desc
  limit 1;

  if v_derniere is not null and v_derniere > now() - interval '30 days' then
    raise exception 'export_trop_recent';
  end if;

  insert into public.demandes_export (compte_id) values (auth.uid());
end;
$$;

revoke execute on function public.demander_export_donnees() from public, anon, authenticated;
grant execute on function public.demander_export_donnees() to authenticated;
