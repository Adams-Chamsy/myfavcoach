#!/usr/bin/env bash
# Pose la cle partagee de la tache planifiee des echeances (P4.8b) sur le projet Supabase de
# developpement, sans jamais l'afficher, aux DEUX endroits qui doivent la connaitre :
#   - le secret CLE_TACHE_PLANIFIEE de l'Edge Function echeances-quotidiennes, qui la compare a
#     l'en-tete x-cle-tache avant toute action ;
#   - le coffre Vault de la base (secret « cle_tache_planifiee »), ou la lit la tache pg_cron
#     (declencher_echeances, 0047) pour appeler la fonction.
# Pose aussi, dans Vault, l'adresse de la fonction (« url_echeances_quotidiennes », pas secrete).
#
# La cle est TIREE ICI, au hasard (openssl, 32 octets), jamais saisie ni recopiee : personne n'a
# besoin de la connaitre. Relancer le script la remplace aux deux endroits a la fois.
#
# Usage : scripts/poser-cle-tache-planifiee.sh
#
# Le projet de production n'est pas prevu ici, comme pour la pose des secrets du prestataire de
# paiement (docs/backend.md §13, « Secrets »).
set -euo pipefail

REF_DEV=imzdtntaqbtymoacsxua
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# `supabase db query --linked` vise le projet LIE : il doit etre le projet de dev.
lie="$(cat "$RACINE/supabase/.temp/project-ref" 2>/dev/null || true)"
if [ "$lie" != "$REF_DEV" ]; then
  echo "Refuse : le projet lie (« $lie ») n'est pas le projet de dev ($REF_DEV). Rien n'a ete pose." >&2
  exit 1
fi

cle="$(openssl rand -hex 32)"
url="https://$REF_DEV.supabase.co/functions/v1/echeances-quotidiennes"

# Fichiers temporaires lisibles par soi seul, supprimes a la sortie, meme en cas d'echec : la cle
# ne passe jamais par la ligne de commande (visible dans la liste des processus).
secret=$(mktemp)
sql=$(mktemp)
trap 'rm -f "$secret" "$sql"' EXIT
chmod 600 "$secret" "$sql"

printf 'CLE_TACHE_PLANIFIEE=%s\n' "$cle" >"$secret"
cat >"$sql" <<SQL
do \$\$
begin
  if exists (select 1 from vault.secrets where name = 'cle_tache_planifiee') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'cle_tache_planifiee'), '$cle');
  else
    perform vault.create_secret('$cle', 'cle_tache_planifiee');
  end if;
  if exists (select 1 from vault.secrets where name = 'url_echeances_quotidiennes') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'url_echeances_quotidiennes'), '$url');
  else
    perform vault.create_secret('$url', 'url_echeances_quotidiennes');
  end if;
end
\$\$;
SQL
unset cle

npx supabase secrets set --project-ref "$REF_DEV" --env-file "$secret" >/dev/null
(cd "$RACINE" && npx supabase db query --linked --file "$sql" >/dev/null)
echo "Pose : CLE_TACHE_PLANIFIEE (Edge Function) et cle_tache_planifiee + url_echeances_quotidiennes (Vault) sur le projet de dev ($REF_DEV)."
