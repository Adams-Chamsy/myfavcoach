# Dette technique

Dettes créées volontairement pendant l'initialisation du projet (lot L0), à traiter au lot
indiqué.

| Dette | Raison | Lot de traitement |
|---|---|---|
| `npm test` tourne avec `--passWithNoTests` | `src/test/` est vide à l'initialisation ; sans ce drapeau, `npm run verif` échouerait tant qu'aucun test n'existe. À retirer dès les premiers tests écrits. | L0, dès la première primitive testée |
| `app.json` ne référence aucune icône ni écran de démarrage | Aucun asset de marque n'existe encore dans le dépôt ; en inventer un serait une donnée de contenu non fournie. | L0, quand les assets de marque arrivent |
| Node local (22.12.0) sous la version minimale de React Native (`^22.13.0`) | Contrainte de l'environnement de développement au moment de l'initialisation, pas du code. `.nvmrc` fixe la version cible. | Avant le premier `npm start` réel |
