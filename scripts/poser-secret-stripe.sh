#!/usr/bin/env bash
# Pose un secret Stripe sur le projet Supabase de developpement, sans jamais l'afficher, APRES
# avoir verifie son prefixe. Seule facon prevue de poser STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET
# (docs/backend.md §13, « Secrets »).
#
# Pourquoi : le 31 octobre 2026, une cle notee comme cle de test commencait par rk_live_ -- une
# cle de PRODUCTION, prete a etre posee sur le projet de dev. Une cle live sur le projet de dev
# ferait des mouvements d'argent reels a chaque essai. La verification du prefixe l'a arretee ;
# elle ne doit plus dependre de la vigilance de celui qui colle la cle.
#
# Usage :
#   scripts/poser-secret-stripe.sh STRIPE_SECRET_KEY        # demande la valeur, masquee
#   stripe listen --print-secret | scripts/poser-secret-stripe.sh STRIPE_WEBHOOK_SECRET
#
# Le projet de production n'est pas prevu ici : sa pose se decidera avec la mise en production,
# avec ses propres prefixes attendus. Le script refuse toute autre reference de projet.
set -euo pipefail

REF_DEV=imzdtntaqbtymoacsxua
# Bac a sable « My Fav Coach » (acct_1U84ZSJxe9krNStw) : une cle Stripe porte l'identifiant de
# son compte juste apres « _51 ». Ce prefixe n'est pas secret, il nomme le compte.
PREFIXE_CLE_TEST=rk_test_51U84ZSJxe9krNStw

nom=${1:-}
case "$nom" in
  STRIPE_SECRET_KEY) attendu=$PREFIXE_CLE_TEST ;;
  STRIPE_WEBHOOK_SECRET) attendu=whsec_ ;;
  *)
    echo "Usage : $0 STRIPE_SECRET_KEY | STRIPE_WEBHOOK_SECRET" >&2
    exit 2
    ;;
esac

if [ -t 0 ]; then
  read -r -s -p "Valeur de $nom (masquee) : " valeur
  echo
else
  read -r valeur
fi

# Le cas grave d'abord, avec son propre message : une cle de production, d'ou qu'elle vienne.
case "$valeur" in
  *_live_*)
    echo "Refuse : cle de PRODUCTION (_live_). Rien n'a ete pose sur le projet de dev." >&2
    exit 1
    ;;
esac
case "$valeur" in
  "$attendu"*) ;;
  *)
    echo "Refuse : $nom doit commencer par $attendu (bac a sable My Fav Coach). Rien n'a ete pose." >&2
    exit 1
    ;;
esac

# La valeur passe par un fichier temporaire lisible par soi seul, jamais par la ligne de commande
# (visible dans la liste des processus) ; supprime a la sortie, meme en cas d'echec.
fichier=$(mktemp)
trap 'rm -f "$fichier"' EXIT
chmod 600 "$fichier"
printf '%s=%s\n' "$nom" "$valeur" >"$fichier"
unset valeur

npx supabase secrets set --project-ref "$REF_DEV" --env-file "$fichier" >/dev/null
echo "Pose : $nom sur le projet de dev ($REF_DEV)."
