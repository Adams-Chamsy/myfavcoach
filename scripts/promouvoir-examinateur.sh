#!/usr/bin/env bash
# Promeut un compte EXISTANT en examinateur (comptes.est_examinateur = true) sur le projet
# Supabase de developpement. docs/backend.md §9 : la promotion est une operation hors
# application, par le role serveur ; ce script lui donne une forme fixe et verifiee, pour ne pas la
# refaire a la main (et mal) dans trois mois.
#
# Le compte doit deja exister (cree par l'inscription de l'application, ou par le tableau de bord
# Supabase) : c'est le developpeur qui en choisit le mot de passe, jamais ce script.
#
# Refuse, sans rien modifier :
#   - un projet lie qui n'est pas celui de dev ;
#   - une adresse mal formee, ou d'un compte du banc RLS (banc-rls-...) ;
#   - un compte introuvable ;
#   - un compte qui a un profil client ou coach : un examinateur est un compte DISTINCT
#     (docs/backend.md §9), jamais un compte de l'application qui recevrait un role en plus.
# Un compte deja examinateur est signale tel quel (rien a faire).
#
# Usage : scripts/promouvoir-examinateur.sh <adresse>
#
# Le projet de production n'est pas prevu ici, comme pour les autres scripts qui ecrivent en base
# (docs/backend.md §13, « Secrets »).
set -euo pipefail

REF_DEV=imzdtntaqbtymoacsxua
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$#" -ne 1 ]; then
  echo "Usage : scripts/promouvoir-examinateur.sh <adresse>" >&2
  exit 1
fi
adresse="$1"

# `supabase db query --linked` vise le projet LIE : il doit etre le projet de dev.
lie="$(cat "$RACINE/supabase/.temp/project-ref" 2>/dev/null || true)"
if [ "$lie" != "$REF_DEV" ]; then
  echo "Refuse : le projet lie (« $lie ») n'est pas le projet de dev ($REF_DEV). Rien n'a ete modifie." >&2
  exit 1
fi

# L'adresse entre dans une requete SQL : forme stricte, sans guillemet ni espace possible.
if ! [[ "$adresse" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "Refuse : adresse mal formee. Rien n'a ete modifie." >&2
  exit 1
fi
case "$adresse" in
  banc-rls*)
    echo "Refuse : c'est un compte du banc RLS, supprime a chaque execution. Rien n'a ete modifie." >&2
    exit 1
    ;;
esac

sql=$(mktemp)
trap 'rm -f "$sql"' EXIT

# Une seule requete : l'UPDATE ne s'applique que si toutes les conditions tiennent, et la ligne
# rendue dit ce qui s'est passe. Rien n'est modifie dans les autres cas.
cat >"$sql" <<SQL
with cible as (
  select u.id from auth.users u where lower(u.email) = lower('$adresse')
),
etat as (
  select
    (select count(*) from cible) as trouves,
    exists (select 1 from public.profils_client p join cible on p.compte_id = cible.id) as a_client,
    exists (select 1 from public.profils_coach p join cible on p.compte_id = cible.id) as a_coach,
    exists (select 1 from public.comptes c join cible on c.id = cible.id where c.est_examinateur) as deja
),
promotion as (
  update public.comptes c
     set est_examinateur = true
    from cible, etat
   where c.id = cible.id
     and etat.trouves = 1 and not etat.a_client and not etat.a_coach and not etat.deja
  returning c.id
)
select case
  when etat.trouves = 0 then 'introuvable'
  when etat.a_client or etat.a_coach then 'a_un_profil'
  when etat.deja then 'deja_examinateur'
  when (select count(*) from promotion) = 1 then 'promu'
  else 'inattendu'
end as issue
from etat;
SQL

sortie=$(cd "$RACINE" && npx supabase db query --linked --file "$sql")
issue=$(printf '%s' "$sortie" | grep -oE '"issue": *"[a-z_]+"' | sed -E 's/.*"([a-z_]+)"$/\1/')

case "$issue" in
  promu)
    echo "Promu : $adresse est examinateur sur le projet de dev ($REF_DEV). Le back-office (web) lui est ouvert a sa prochaine connexion."
    ;;
  deja_examinateur)
    echo "Rien a faire : $adresse est deja examinateur."
    ;;
  introuvable)
    echo "Refuse : aucun compte pour $adresse sur le projet de dev. Cree-le d'abord (inscription, ou tableau de bord Supabase). Rien n'a ete modifie." >&2
    exit 1
    ;;
  a_un_profil)
    echo "Refuse : $adresse a un profil client ou coach. Un examinateur est un compte distinct (docs/backend.md §9). Rien n'a ete modifie." >&2
    exit 1
    ;;
  *)
    echo "Issue inattendue (« $issue ») : verifie a la main avant de relancer." >&2
    exit 1
    ;;
esac
