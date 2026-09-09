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

**Propriétés de pile de navigation — `expo-router/testing-library` (`renderRouter`), jamais un
test d'écran isolé.** Un test d'écran monte un composant seul, `expo-router` entièrement mocké :
il prouve qu'un écran affiche et appelle les bonnes choses, jamais ce qu'il y a **derrière** lui
dans la pile. Deux familles de bugs n'existent que là, invisibles à toute autre suite : un
bouton retour qui plante (« GO_BACK non géré ») parce que l'écran qui y mène a été atteint par
un `replace` (`<Redirect>`) plutôt qu'un `push`, et un retour arrière matériel qui ramène dans
un espace pourtant quitté faute d'avoir réinitialisé la bonne branche de la pile (L1-06, critère
5). Utilise `renderRouter` **seulement** pour ce genre de propriété — jamais pour remplacer un
test d'écran, jamais pour vérifier qu'un écran affiche le bon contenu (les tests d'écran isolés
restent la bonne pente pour ça, plus rapides et plus stables). Trois pièges trouvés en l'utilisant
à P1.11, à connaître avant d'en écrire un nouveau :
- `renderRouter()` force des minuteurs Jest factices sans jamais les retirer lui-même — sans un
  `afterEach(() => jest.useRealTimers())` explicite dans CHAQUE fichier qui l'utilise, ils fuient
  vers les fichiers de test suivants exécutés dans le même worker.
- Plusieurs `renderRouter()` dans le même fichier de test se sont montrés instables l'un après
  l'autre (chaque test seul dans son fichier passe de façon fiable, ensemble non, cause non
  résolue) : un test par fichier est le compromis retenu, pas un oubli de factorisation.
- `router.canGoBack()` (et tout appel impératif de `router.*` fait PENDANT le rendu, pas dans un
  gestionnaire) lève hors d'un vrai conteneur de navigation — tout autre test qui rend un écran
  utilisant ce genre d'appel (ex. `src/test/accessibilite.test.tsx`) doit mocker `useRouter()`
  pour cette méthode précise, jamais le reste du module.

Pas de test de capture d'écran (snapshot) : ils passent tout seuls et ne prouvent rien.

**Tests d'écran à état asynchrone — `await` CHAQUE `fireEvent`, `waitFor` + `queryBy` jamais
`findBy`. Trouvé à P1.13a puis P1.13c.** Sur les écrans qui montent Reanimated et/ou lisent un
port de façon asynchrone (`src/fonctionnalites/compte/ecran-compte.tsx`,
`app/(compte)/identifiants.tsx` — deux `Champ` masqués donc deux `BoutonIcone` Reanimated),
deux symptômes apparaissent quand l'auto-`act` de `@testing-library/react-native` (v14) ne
s'installe pas :
- `await screen.findByText(...)` lève « `render` function has not been called » (par le proxy
  `screen`, alors que `render()` A bien été appelé), parfois un crash dur du worker Jest
  (« trying to import a file after the Jest environment has been torn down » →
  `PanResponder` `undefined` dans `feuille-basse.tsx`) qui fait tomber tout le fichier.
- un `fireEvent.changeText`/`press` NON `await`é laisse la mise à jour d'état d'un gestionnaire
  asynchrone (`await port.xxx()` puis `setState`) sans jamais s'appliquer : le message d'erreur
  n'apparaît pas, et le rendu suivant du même fichier casse (le montage ~7 échoue au `render`).
Parade, appliquée dans tous les tests d'écran depuis :
- `await` DEVANT chaque `fireEvent` (`await fireEvent.press(...)`, `await fireEvent.changeText(...)`,
  `await fireEvent(node, 'blur')`) — c'est ce `await` qui vide la file `act`. Modèle déjà suivi
  par `app/(public)/inscription.test.tsx`.
- `await waitFor(() => expect(screen.queryByX(v)).toBeTruthy())`, jamais `await screen.findByX(v)`.
Les tests d'onboarding (P1.11), plus légers, tolèrent `findBy*` — mais la règle ci-dessus est
la bonne pente pour tout nouvel écran. **Cause non établie** : l'auto-`act` de RTL v14 sous
`jest-expo` ne couvre pas les continuations post-`await` sans un `await fireEvent`/`waitFor`
actif ; non prouvé plus finement.

**Zones sûres — angle mort structurel, trouvé à P1.12, de la même famille que le rendu web (§6).**
`react-test-renderer` (donc `npm test`, `test:a11y`, tout test d'écran) ne fait aucune mise en
page : pas de flexbox résolu, pas de coordonnées. Un écran qui applique `useSafeAreaInsets()` et
un écran qui l'ignore rendent le même arbre à un nombre près dans un objet de style — le bloc
encre de `app/(client)/moi.tsx` s'affichait sous la barre d'état sans qu'aucun test ne bronche.
`METRIQUES_ZONES_SURES` (`src/test/accessibilite.test.tsx` : haut 59, bas 34) n'existe que pour
que `useSafeAreaInsets()` ne lève pas ; sa valeur n'est comparée à la position de rien. Seule
parade en place : `verifierOffsetHautZoneSure` + la liste `ECRANS_CHROME_HAUT` du même fichier
vérifient que le premier contenu des écrans qui posent leur propre chrome haut (`accueil`,
`pilotage`, `moi`) est retraité d'au moins l'inset haut. **Tout écran qui gagne un chrome haut
doit être ajouté à cette liste.** Ce contrôle n'attrape pas la géométrie réelle (troncature,
inset bas, barre gestuelle Android), qui reste une vérification manuelle sur appareil (voir
`docs/dette.md`).

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
