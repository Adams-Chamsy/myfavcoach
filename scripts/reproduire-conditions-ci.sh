#!/usr/bin/env bash
set -euo pipefail

# Reproduit les conditions du runner CI (.github/workflows/verif.yml) à la demande, sur un
# clone jetable — plutôt qu'un worktree manuel à refaire de zéro à chaque doute.
#
# Pourquoi ce script existe : à la clôture de L2, le premier push a fait échouer la CI sans
# jamais échouer en local. Trois causes distinctes, toutes liées à un environnement froid que
# ce dépôt ne recrée jamais autrement : `npm ci` à froid (aucun `node_modules` réutilisé),
# aucun cache Jest/Metro, le `.env` de substitution de la CI (pas le vrai `.env` du poste), et
# le parallélisme Jest par défaut de la machine qui exécute la suite. Les trois n'ont été
# trouvées qu'en clonant le commit dans un worktree isolé et en y rejouant `npm ci` — jamais en
# devinant depuis les logs. CLAUDE.md §6 documente déjà l'absence de simulateur/navigateur réel
# comme angle mort structurel de cette machine ; celui-ci en était un autre, maintenant fermé
# (docs/prompts/L2.md, règle 9 : un refus — ou ici, un échec — doit venir du mécanisme qu'on
# interroge, jamais d'un environnement qu'on n'a pas vraiment reproduit).
#
# Ce que ce script REPRODUIT : `npm ci` à froid, `.env.ci-substitution` (la même source que la
# CI, jamais une copie qui pourrait diverger), et l'étape "Tests" (npm test) telle que la CI
# l'exécute — c'est cette étape précise qui a divergé.
#
# Ce que ce script NE reproduit PAS, volontairement :
#   - test:rls (npm run test:rls) : vise le vrai projet Supabase de développement avec une clef
#     secrète qui ne vit que dans .secrets-rls.local (local, ignoré par git) — un worktree
#     jetable n'y a pas accès, et ne devrait pas y avoir accès. La CI le couvre séparément,
#     dans banc-rls.yml, sur une pile Supabase éphémère montée sur le runner.
#   - verif:serveur : démarre un vrai serveur Expo et l'interroge — lent, et jamais montré de
#     divergence local/CI à ce jour. Disponible via --complet si un doute apparaît un jour.
#
# Usage :
#   scripts/reproduire-conditions-ci.sh [ref]              # tokens+lint+typecheck+test+test:a11y
#   scripts/reproduire-conditions-ci.sh [ref] --complet     # + verif:bundle + verif:serveur
#   scripts/reproduire-conditions-ci.sh [ref] -- <commande> # une commande précise à la place
#
# ref par défaut : HEAD (le dernier commit — PAS les modifications non indexées : comme la CI
# elle-même, ce script part d'un clone propre du commit, jamais du répertoire de travail).

REF="${1:-HEAD}"
if [ $# -gt 0 ]; then shift; fi

MODE="rapide"
COMMANDE_PERSONNALISEE=()
if [ "${1:-}" = "--complet" ]; then
  MODE="complet"
  shift || true
elif [ "${1:-}" = "--" ]; then
  shift
  COMMANDE_PERSONNALISEE=("$@")
fi

RACINE_DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOSSIER_TEMPORAIRE="$(mktemp -d -t myfavcoach-ci-XXXXXX)"

nettoyer() {
  echo "[reproduire-conditions-ci] nettoyage du worktree jetable…"
  git -C "$RACINE_DEPOT" worktree remove "$DOSSIER_TEMPORAIRE" --force 2>/dev/null || rm -rf "$DOSSIER_TEMPORAIRE"
}
trap nettoyer EXIT

echo "[reproduire-conditions-ci] worktree jetable pour $REF → $DOSSIER_TEMPORAIRE"
git -C "$RACINE_DEPOT" worktree add --detach "$DOSSIER_TEMPORAIRE" "$REF"

cd "$DOSSIER_TEMPORAIRE"

echo "[reproduire-conditions-ci] .env de substitution CI (.env.ci-substitution), lecture seule…"
cp .env.ci-substitution .env
chmod 444 .env

echo "[reproduire-conditions-ci] npm ci (à froid, comme la CI)…"
npm ci

if [ "${#COMMANDE_PERSONNALISEE[@]}" -gt 0 ]; then
  echo "[reproduire-conditions-ci] commande personnalisée : ${COMMANDE_PERSONNALISEE[*]}"
  "${COMMANDE_PERSONNALISEE[@]}"
  exit 0
fi

npm run tokens
npm run lint
npm run typecheck
npm test
npm run test:a11y

if [ "$MODE" = "complet" ]; then
  npm run verif:bundle
  npm run verif:serveur
fi

echo "[reproduire-conditions-ci] OK — conditions CI reproduites pour $REF, aucun écart trouvé."
