#!/usr/bin/env bash
# Cycle casser / tester / restaurer une politique RLS sur le projet Supabase de developpement,
# sans jamais passer par un fichier de migration. Ecrit suite a P2.4 (docs/prompts/L2.md, regle 5) :
# les migrations jetables 0012 et 0022-0025, reparees a la main via
# `supabase migration repair --status reverted`, laissaient un residu dans l'historique distant
# a chaque cycle et exigeaient un nettoyage manuel apres coup.
#
# `supabase db query --linked --file <chemin>` execute du SQL contre le projet distant lie, via
# l'API de gestion, SANS jamais ecrire dans supabase_migrations.schema_migrations : contrairement
# a `db push`, il n'y a rien a reparer, reussite ou echec, parce qu'il n'y a rien d'ecrit.
#
# Ce que ce script garantit, que db query seul ne garantit pas : la restauration s'execute
# TOUJOURS, meme si le test echoue ou si le script est interrompu (Ctrl+C) -- via un trap sur
# EXIT, pose seulement une fois la casse reussie. La fenetre ou le schema vivant est modifie
# existe toujours (db query ne protege que l'historique, pas le schema en cours), mais elle ne
# depend plus de la discipline manuelle a chaque cycle.
#
# Usage :
#   scripts/cycle-casser-restaurer.sh <casse.sql> <restauration.sql> -- <commande de test...>
#
# Exemple :
#   scripts/cycle-casser-restaurer.sh \
#     /tmp/casse-offres-select-proprietaire.sql \
#     /tmp/restaure-offres-select-proprietaire.sql \
#     -- npm run test:rls -- -t "proprietaire"
#
# <restauration.sql> doit contenir le SQL EXACT deja commite dans la migration source (0008,
# 0011, ...) -- jamais reconstruit depuis pg_policies apres coup. C'est ce qui rend la
# restauration fiable : le texte a rejouer est connu et relu AVANT la casse, pas devine ensuite.

set -u

REFERENCE_PROJET_AUTORISEE="imzdtntaqbtymoacsxua"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$#" -lt 4 ] || [ "$3" != "--" ]; then
  echo "Usage : scripts/cycle-casser-restaurer.sh <casse.sql> <restauration.sql> -- <commande de test...>" >&2
  exit 1
fi

CASSE="$1"
RESTAURATION="$2"
shift 3
COMMANDE_TEST=("$@")

if [ ! -f "$CASSE" ]; then
  echo "GARDE : fichier de casse introuvable : $CASSE" >&2
  exit 1
fi
if [ ! -f "$RESTAURATION" ]; then
  echo "GARDE : fichier de restauration introuvable : $RESTAURATION" >&2
  exit 1
fi

REFERENCE_LIEE_FICHIER="$RACINE/supabase/.temp/project-ref"
if [ ! -f "$REFERENCE_LIEE_FICHIER" ]; then
  echo "GARDE DE SECURITE : aucun projet Supabase lie (supabase/.temp/project-ref absent)." >&2
  exit 1
fi
REFERENCE_LIEE="$(cat "$REFERENCE_LIEE_FICHIER")"
if [ "$REFERENCE_LIEE" != "$REFERENCE_PROJET_AUTORISEE" ]; then
  echo "GARDE DE SECURITE : le projet lie ($REFERENCE_LIEE) n'est pas le projet de developpement ($REFERENCE_PROJET_AUTORISEE). Arret." >&2
  exit 1
fi

echo "--- Casse : $CASSE"
if ! npx supabase db query --linked --file "$CASSE"; then
  echo "ECHEC de la casse -- rien n'a ete modifie avec certitude, restauration NON tentee (rien a restaurer)." >&2
  exit 1
fi

STATUT_TEST=0
restaurer() {
  echo "--- Restauration : $RESTAURATION"
  if ! npx supabase db query --linked --file "$RESTAURATION"; then
    echo "ALERTE : la restauration a echoue. Le schema du projet de developpement reste dans l'etat casse." >&2
    echo "Rejoue a la main : npx supabase db query --linked --file $RESTAURATION" >&2
    exit 1
  fi
  echo "--- Verification (pg_policies), pas une affirmation :"
  NOMS_POLITIQUES="$(grep -ohiE 'create policy[[:space:]]+"?[a-zA-Z_][a-zA-Z0-9_]*"?' "$RESTAURATION" \
    | sed -E 's/create policy[[:space:]]+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/\1/i' | sort -u)"
  if [ -z "$NOMS_POLITIQUES" ]; then
    echo "Aucun \"create policy\" trouve dans $RESTAURATION, verification automatique impossible -- relis le manuellement." >&2
  else
    for NOM in $NOMS_POLITIQUES; do
      npx supabase db query --linked \
        "select schemaname, tablename, policyname, cmd from pg_policies where policyname = '$NOM';"
    done
  fi
}
trap restaurer EXIT

echo "--- Test : ${COMMANDE_TEST[*]}"
"${COMMANDE_TEST[@]}"
STATUT_TEST=$?

exit "$STATUT_TEST"
