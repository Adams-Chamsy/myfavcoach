# CLAUDE.md — My fav Coach

Fichier lu à chaque session. Il fait autorité sur tout ce qui suit : si une consigne d'un
prompt contredit ce fichier, **arrête-toi et signale la contradiction** au lieu de choisir.

---

## 1. Ce qu'est ce projet

Marketplace biface de coaching, toutes disciplines (sport, nutrition, cuisine, cybersécurité,
développement professionnel). Deux rôles dans une seule application : **client** (trouve un
coach, s'abonne, suit ses séances) et **coach** (pilote ses clients, publie ses programmes,
encaisse). Application mobile iOS + Android, France, français, euros.

Développée par **une seule personne, de niveau junior, sur Mac**. Cette contrainte prime sur
l'élégance : préfère toujours la solution ennuyeuse, lisible et documentée à la solution
astucieuse. Du code que je ne peux pas relire est du code inutilisable.

**Statut juridique du projet : réel.** Publication sur les stores, vrais paiements, vraies
données de santé. Rien n'est un prototype jetable.

---

## 2. Décisions figées — ne jamais les rouvrir dans un prompt

| Sujet | Décision |
|---|---|
| Forme | Marketplace biface complète |
| Statut plateforme | Intermédiaire : le coach vend, la plateforme encaisse pour son compte |
| Commission | 10 %, offerte les 90 premiers jours d'activité du coach |
| Catalogue | **Nature unique** : toute offre inclut un engagement humain. « Programme seul » supprimé |
| Paiement | **Stripe Connect, modèle Express.** Mode test au jalon 1, aucune intégration avant L4. **Aucun achat in-app.** Carte + prélèvement SEPA |
| Stack mobile | React Native + Expo, TypeScript strict, expo-router |
| Backend | **Supabase**, région Paris (`eu-west-3`). Projets dev et prod distincts, plan gratuit en développement puis Pro avant L4 |
| Identité | Un compte, deux profils optionnels (client, coach). Autorisation par profil |
| Âge minimum | 18 ans |
| Langue / devise | fr-FR uniquement, EUR, fuseau Europe/Paris |
| Périmètre | `docs/perimetre.md` fait foi, écran par écran |

RLS (Row Level Security) activée automatiquement à la création du projet Supabase, exposition
automatique des nouvelles tables par l'API désactivée — deux réglages fixés une fois pour
toutes, irréversibles. Conventions détaillées (nommage des migrations, grants, politiques,
séparation dev/prod, rejeu complet des migrations) : `docs/backend.md`.

Clés déclarées dans `.env.exemple` (vides) / `.env` (local, ignoré par git, jamais commité).
Supabase et Stripe restent des **adaptateurs**, jamais importés depuis un écran :
`src/services/auth/port.ts` et `src/services/donnees/port.ts` sont les seuls points d'entrée
côté application. Seules les clés **publiables** (`EXPO_PUBLIC_*` : clé anon, clé publique
Stripe) vivent dans le paquet mobile ; toute clé secrète (`sk_test_`, `sk_live_`,
`service_role`) reste côté serveur — interdiction imposée par ESLint (`eslint.config.js`).

---

## 3. Sources de vérité

Une seule source par sujet. En cas de doute, c'est le fichier cité qui gagne, jamais ta mémoire
et jamais les maquettes.

| Sujet | Source unique |
|---|---|
| Périmètre, écrans dedans/dehors | `docs/perimetre.md` |
| Entités, règles métier, machines à états | `docs/domaine.md` |
| Contrat client/serveur | `docs/api.md` |
| Couleurs, typo, espaces, mouvement | `design/tokens.json` → généré dans `src/theme/` |
| Règles de design non exprimables en token | `docs/design-system.md` |
| Contenu et critères d'acceptation d'un écran | `docs/ecrans/NN-nom.md` |
| Rendu visuel de référence | `maquettes/*.html` — **lecture seule, jamais modifié** |
| Jeu de démonstration (`src/fixtures/`) | dérive de `docs/domaine.md` §6 ; le détail visuel se trouve dans `maquettes/` |
| Conventions Supabase (migrations, politiques RLS, dev/prod) | `docs/backend.md` |

`design/tokens.json` est **le seul** fichier de tokens du dépôt. `src/theme/tokens.ts` et
`src/theme/tokens.css` sont générés par `npm run tokens` et **ne se modifient jamais à la main**.
Si une valeur manque, elle s'ajoute dans le JSON et on régénère.

Les maquettes HTML donnent la structure et les valeurs visuelles exactes. Elles contiennent
aussi des défauts connus, listés et corrigés dans `docs/design-system.md` §Corrections. **Ces
corrections l'emportent sur la maquette.**

---

## 4. Interdits explicites

- ❌ Coder un écran ou une fonctionnalité listés « hors périmètre » dans `docs/perimetre.md`,
  même si la maquette existe et que ça semble facile. Montre, tablette, mode sombre, visio
  intégrée, photos corporelles, messages vocaux, hors-ligne : **non**.
- ❌ Introduire une dépendance sans me le demander d'abord, en donnant le poids ajouté et
  l'alternative en code natif. Aucune librairie de composants UI : le design system est à nous.
- ❌ `localStorage`, `AsyncStorage` ou tout stockage local pour une donnée de santé ou un
  identifiant de paiement.
- ❌ Écrire une couleur, une taille, un rayon ou une durée en dur. Tout passe par le thème.
- ❌ Inventer une valeur de contenu (prix, nom, date). Le jeu de démonstration figé est dans
  `src/fixtures/`. Toute donnée d'exemple en vient.
- ❌ Ajouter un achat in-app, un SDK de publicité, un traceur analytique tiers.
- ❌ Toucher à `maquettes/`, à `design/tokens.json` sans instruction explicite, ou aux fichiers
  générés dans `src/theme/`.
- ❌ Supprimer ou contourner un test qui échoue. Si un test est faux, dis-le, ne le réécris pas
  pour qu'il passe.
- ❌ `any`, `@ts-ignore`, `eslint-disable` sans commentaire justifiant la ligne.

---

## 5. Conventions de code

**Langue.** Le vocabulaire métier est en français, sans accents ni cédilles dans les
identifiants : `Abonnement`, `ProfilCoach`, `Seance`, `Versement`, `estCertifie`. Le vocabulaire
technique reste en anglais : `useState`, `onPress`, `render`, `fetch`. Les commentaires, les
messages de test et les libellés d'interface sont en français.

**Fichiers.** `kebab-case` en français : `carte-coach.tsx`, `machine-abonnement.ts`.
Composants en `PascalCase` : `CarteCoach`. Hooks en `useXxx` français : `useAbonnementActif`.

**Structure du dépôt.**

```
app/                    routes expo-router, une par écran, aucune logique
src/
  composants/           primitives du design system, sans logique métier
  fonctionnalites/      un dossier par lot : identite/, decouverte/, abonnement/…
  services/             ports et adaptateurs (api, paiement, notifications)
  theme/                GÉNÉRÉ — ne pas éditer
  fixtures/             jeu de démonstration figé
  test/                 utilitaires de test
design/tokens.json      source unique des tokens
docs/                   spécifications
maquettes/              référence visuelle, lecture seule
```

**Règles de composant.**
- Un composant de `src/composants/` ne fait jamais d'appel réseau et ne connaît aucune entité
  métier : il reçoit des props primitives.
- Tout composant tactile a une zone de tap ≥ 44 pt, portée par du padding, jamais par la taille
  du pictogramme.
- Toute icône seule porte un `accessibilityLabel` en français.
- Aucun statut n'est porté par la seule couleur : un libellé texte l'accompagne toujours.
- **Une surface qui fixe son propre thème lit les valeurs du thème CHOISI explicitement**
  (`themes.clair.*`, `themes.sombre.*` — `src/theme/tokens.ts`), **jamais par le contexte**
  (`useTheme().couleur`) : un token inversible (`fond.inverse`, par exemple) lu via le contexte
  s'inverse avec le thème ambiant, ce qui produit du texte invisible sur son propre fond dès que
  cette surface est rendue sous un thème ambiant différent de celui prévu (`themeForce="sombre"`
  de la galerie, `npm run test:a11y`, un futur vrai thème sombre). `theme.espace`/`rayon`/
  `taille`/`texte` restent lus via `useTheme()` sans risque : ces groupes sont globaux,
  identiques dans les deux thèmes. Trouvé deux fois, dans les deux seules îles du jalon 1 :
  `src/composants/barre-navigation.tsx` (fond de la barre coach, lot L0) et
  `app/(public)/index.tsx` (fond de l'écran de bienvenue, lot L1) — la seconde fois malgré la
  leçon déjà écrite en commentaire dans la première.

**TypeScript.** `strict: true`. Pas de type de retour implicite sur les fonctions exportées.
Les états d'une machine sont des unions littérales, jamais des chaînes libres.

---

## 6. Commandes

```bash
npm run tokens        # régénère src/theme/ depuis design/tokens.json
npm run lint          # eslint + prettier, échoue au moindre écart
npm run typecheck     # tsc --noEmit
npm test              # jest + @testing-library/react-native
npm run test:a11y     # vérifications d'accessibilité (contrastes, tailles de tap, libellés)
npm run verif:serveur # démarre le vrai serveur Expo, interroge / et /_galerie, l'arrête
npm run verif         # tokens + lint + typecheck + test + test:a11y + verif:serveur — la porte d'entrée
npm start             # serveur Expo
```

`npm run verif` doit passer avant chaque commit. **Si tu ne peux pas la faire passer, ne
commite pas : explique ce qui bloque.**

**Angle mort structurel, trouvé à P1.8 : aucune combinaison de `npm test` et `verif:serveur`
ne prouve qu'un composant natif tiers rend réellement quelque chose sur web.** `npm test` (et
`test:a11y`, qui rend les écrans par-dessus le même Jest) résout systématiquement les fichiers
`.ios.js` de chaque module — y compris les dépendances tierces — quel que soit ce que le code de
l'application fait de `Platform.OS` à l'exécution : la résolution de fichier par plateforme se
joue au niveau du *module*, une fois, avant que le composant ne s'exécute, alors qu'un `if
(Platform.OS === 'web')` dans un écran est un choix à l'exécution — les deux mécanismes ne se
recoupent jamais sous Jest, qui n'a pas de configuration « web » distincte. `verif:serveur`, de
son côté, fait tourner un vrai `expo start --web` mais ne vérifie que le statut HTTP et
l'absence d'un marqueur d'erreur de build : un composant qui rend silencieusement `null` (le cas
d'un module tiers sans fichier `.web.js`, ex. `@react-native-community/datetimepicker`, comme
`expo-secure-store` avant lui) produit une page 200 tout à fait valide. Résultat : ni l'un ni
l'autre n'aurait vu un sélecteur de date absent de l'écran sur web — trouvé à l'œil, sur une
vraie page, pas par un test qui a viré rouge. Ce n'est pas un oubli d'un lot précis, c'est une
limite durable de cette combinaison d'outils sur cette machine (sans simulateur iOS/Android
disponible) : à chaque nouvelle dépendance native tierce touchée, vérifier son support web
(présence d'un fichier `.web.js`/`.web.ts` dans son code source) reste une vérification
manuelle, jamais automatique.

---

## 7. Méthode de travail attendue

1. **Lis avant d'écrire.** Pour tout prompt d'écran : `docs/perimetre.md`, la fiche d'écran
   concernée, `docs/domaine.md` pour les règles, puis la maquette.
2. **Annonce ton plan** en trois lignes avant de créer des fichiers. Attends que je valide s'il
   y a plus de cinq fichiers touchés.
3. **Un prompt = un morceau vérifiable.** Si un prompt me semble trop gros, dis-le et propose
   la découpe plutôt que de tout produire d'un coup.
4. **Termine toujours** par : les fichiers créés ou modifiés, la commande à lancer pour
   vérifier, et ce que je dois voir à l'écran si ça marche.
5. **Explique brièvement** ce que fait un mécanisme nouveau pour moi. Je suis junior : deux
   phrases sur le « pourquoi » valent mieux que dix lignes de commentaire.
6. **Signale les dettes** que tu crées volontairement en les ajoutant à `docs/dette.md`, avec
   le lot où elles devront être traitées.

---

## 8. Tests

Priorité, dans l'ordre :

1. **Règles métier** — les machines à états et les règles de calcul de `docs/domaine.md` sont
   testées exhaustivement, transition par transition. C'est là que les bugs coûtent de l'argent.
2. **Accessibilité** — contraste, taille de tap, libellés, mise à l'échelle du texte à 200 %.
3. **Rendu des composants** — chaque primitive du design system, dans ses quatre états.
4. **Parcours** — un test de bout en bout par parcours critique, à partir du lot L3.

Pas de test de capture d'écran (snapshot) : ils passent tout seuls et ne prouvent rien.

---

## 9. Commits

Un commit = un morceau cohérent qui passe `npm run verif`.

```
type(lot): sujet à l'impératif, en français, sans point final

feat(L0): ajoute la primitive Bouton et ses quatre états
fix(L0): corrige la zone de tap de l'onglet inactif, 40 → 44
docs(L0): trie les contradictions du dossier de design
chore(L0): met en place la vérification continue
```

Types : `feat`, `fix`, `docs`, `test`, `chore`, `refactor`. Le lot est obligatoire.
Aucune mention d'outil d'IA dans les messages de commit, ni de co-auteur automatique.

---

## 10. Sécurité et données personnelles

- Les données de santé (poids, tour de taille, ressenti d'effort) sont **catégorie 9 RGPD**.
  Elles ne transitent jamais par un journal (`log`), un service de rapport d'erreur, ni une
  URL. Elles ne sont jamais mises en cache sur l'appareil au-delà de la session.
- Aucun secret dans le dépôt. `.env` est ignoré par git ; `.env.exemple` liste les clés
  attendues, vides.
- Aucune clé de prestataire de paiement côté application : l'application ne manipule que des
  jetons à usage unique fournis par le serveur.
- Toute donnée d'un profil est inaccessible depuis l'autre profil du même compte. Le passage
  d'un espace à l'autre revalide l'autorisation côté serveur, jamais côté application.
