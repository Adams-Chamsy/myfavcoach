# Dette technique

Dettes créées volontairement pendant l'initialisation du projet (lot L0), à traiter au lot
indiqué.

| Dette | Raison | Lot de traitement |
|---|---|---|
| `npm test` tourne avec `--passWithNoTests` | `src/test/` est vide à l'initialisation ; sans ce drapeau, `npm run verif` échouerait tant qu'aucun test n'existe. À retirer dès les premiers tests écrits. | L0, dès la première primitive testée |
| `app.json` ne référence aucune icône ni écran de démarrage | Aucun asset de marque n'existe encore dans le dépôt ; en inventer un serait une donnée de contenu non fournie. | L0, quand les assets de marque arrivent |
| Node local (22.12.0) sous la version minimale de React Native (`^22.13.0`) | Contrainte de l'environnement de développement au moment de l'initialisation, pas du code. `.nvmrc` fixe la version cible. | Avant le premier `npm start` réel |
| `app/index.tsx` (« Hello World ») réapparaît sur disque, ignoré par git | Écrit par le serveur Expo lui-même (`CreateFileMiddleware`, écran d'onboarding d'expo-router) dès que `app/` est vide et qu'un client ouvre l'app en dev. Inoffensif, jamais commité grâce au `.gitignore`. Disparaîtra de lui-même dès qu'une vraie route existera dans `app/`. | L1, dès la première route réelle (coquille de navigation) |
| `jest` figé en 29.x (et `@types/jest` avec) | `jest-expo` embarque des outils Jest 29.x en interne (`babel-jest`, `jest-environment-jsdom`, `@jest/globals` en `^29`) ; `jest` 30 casse au runtime (`clearMocksOnScope is not a function`). À réévaluer quand `jest-expo` supportera Jest 30. | L12 |
| `app/index.tsx` exclu du lint (`eslint.config.js`) | Nécessaire tant que ce fichier est l'artefact généré par le serveur Expo (voir ligne ci-dessus) et non du code écrit par nous. **EXCLUSION À RETIRER** dès que P0.13 fait de `app/index.tsx` la vraie redirection de démarrage selon le jeton du trousseau sécurisé. | P0.13 |
