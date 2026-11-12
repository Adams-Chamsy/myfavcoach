# CLAUDE.md — My Fav Coach

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
- ❌ Écraser, régénérer depuis `.env.exemple`, ou modifier `.env` de quelque façon que ce soit
  sans instruction explicite — même pour débloquer une commande qui en a besoin (`expo export`,
  `expo start`...). Un `.env` local ignoré par git ne peut pas être reconstruit s'il est perdu :
  lire son contenu pour vérifier une valeur est permis, l'écraser ne l'est pas. Si une commande
  échoue faute de `.env` rempli, le dire et demander plutôt que de le remplir soi-même. Cette
  règle vaut identiquement pour tout sous-agent dispatché — CLAUDE.md se propage à un sous-agent
  fraîchement lancé dans ce dépôt (vérifié empiriquement), donc l'interdiction aussi.
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
7. **Une porte de sortie ne se passe que si chaque dette échue est soldée, ou explicitement
   reportée par une décision écrite** (dans `docs/dette.md`, avec sa date et sa nouvelle
   échéance). Un report sans décision n'est pas un report, c'est un oubli.
8. **Un lot ne s'ouvre pas tant que la porte de sortie du précédent n'est pas close par un
   commit** qui le dit. Trouvé le 1er novembre 2026 : les portes de L1 et de L3bis n'avaient
   jamais été passées, L2 puis L4 s'étaient ouverts quand même, et ça ne s'est vu que deux mois
   plus tard, en faisant le point.
9. **Une seule main à la fois sur le dossier du projet.** Quand Claude travaille, le développeur
   ne lance rien dans le dossier (ni `npm`, ni `npx expo`, ni `git`). Quand le développeur lance
   quelque chose lui-même, il le dit avant. Trouvé le 1er novembre 2026 : deux `npm ci` lancés à
   une minute d'écart, l'un par chacun, ont laissé un `node_modules` cassé (`react-native` absent)
   alors que les deux sortaient sans erreur. Chacun commence par supprimer `node_modules`. Plus
   tôt le même jour, une montée en SDK 58 abandonnée en cours (`npx expo install`) avait déjà fait
   diverger `package.json` et le lock sans que personne le sache. Dix minutes de diagnostic, pour
   une commande qui aurait pu être annoncée.
10. **Un appel refusé n'est pas un appel sans effet.** Après un refus (le développeur rejette un
   appel d'outil, ou l'interrompt), Claude vérifie si la commande a déjà agi — base de dev,
   fichiers, processus en arrière-plan — avant de conclure quoi que ce soit, et le dit. Trouvé le
   11 novembre 2026 : une clôture web refusée tournait déjà en arrière-plan ; elle avait remplacé
   les trois pièces d'un compte de scénario et renvoyé son dossier en examen. Claude a rapporté
   « rien n'a changé en base » ; le compte était en examen depuis une heure, découvert par
   hasard à la clôture suivante.

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

**Une politique RLS se prouve dans les DEUX sens, chacun par un test nommé : l'accès légitime
qui rend la donnée, l'accès illégitime qui ne rend rien.** Une politique dont seul le refus est
prouvé peut être trop restrictive sans que personne le voie : RLS ne lève jamais d'erreur, elle
rend une liste vide ou zéro ligne modifiée, silencieusement (`docs/backend.md` §5) — l'écran
afficherait « aucune donnée » au lieu d'une erreur. C'est le piège connu depuis P1.3, et il
s'est reformé : la revue de la porte de sortie de L1 (1er novembre 2026) a trouvé quatre
politiques de 0002 dont l'accès légitime n'était prouvé que par la préparation du banc, jamais
par un test qui le nomme (`docs/dette.md`). Un `beforeAll` qui réussit n'est pas une preuve : il
n'a pas de nom, et personne ne le relira comme tel.

**Un test qui fabrique lui-même ce qu'une bibliothèque lui passerait ne prouve rien sur le
contrat réel de cette bibliothèque. Seule la vérification de types l'attrape, et seulement si
le double n'est pas converti en bloc.** Trouvé le 1er novembre 2026, à la montée du SDK 58 :
expo-router 58 ne passe plus `navigation` à une barre d'onglets personnalisée (il passe
`emitter` et `navigateToTab`). `src/fonctionnalites/navigation/barre-onglets.test.tsx`
fabriquait un `navigation` et le convertissait par `as unknown as BottomTabBarProps` : il
testait son propre faux, et passait. Sur l'iPhone, appuyer sur un onglet aurait planté. Seul
`tsc` l'a signalé, côté composant. Même famille, le même jour : `useGardeSortie` écoutait
`beforeRemove`, un événement que le SDK 58 a supprimé ; les tests d'écran stubbaient
`useNavigation` et passaient. Règles qui en découlent :
- un double d'objet de bibliothèque passe par `satisfies <TypeDeLaBibliothèque>`, jamais par
  `as unknown as` sur l'objet entier : les NOMS des propriétés restent vérifiés ; seule une forme
  interne précise peut être convertie, champ par champ ;
- `tsc` fait partie de la preuve : « aucune erreur de type » ne s'écrit qu'après l'avoir lancé.
  Le même jour, Claude l'a affirmé en lisant le code, sans lancer `tsc`, et c'était faux. C'est
  la règle « la preuve, pas l'affirmation » (règle 4 des prompts de lot), pas un oubli de lecture ;
- le contrat réel d'une bibliothèque ne se prouve que contre la vraie bibliothèque : un test
  `renderRouter`, un essai contre le vrai service (le banc, les essais Stripe réels), ou
  l'appareil. La liste des doubles du dépôt à revoir sous cet angle est dans `docs/dette.md`.
- **un test de parcours appuie sur ce qu'une personne appuierait, il ne fabrique jamais le
  geste.** Troisième défaut réel de cette famille en deux jours, le 2 novembre 2026 : le test
  `bascule-coach-vers-client` remplaçait l'écran de pilotage par un faux écran qui appelait
  `basculerProfil('client')` lui-même. Il restait vert pendant que l'avatar, seule entrée vers la
  feuille de bascule, n'existait que dans une des quatre branches du vrai pilotage : depuis le
  12 septembre, un coach non vérifié ne pouvait ni revenir à l'espace client, ni se déconnecter,
  ni supprimer son compte. Trouvé sur iPhone. Corollaire : quand un écran se découpe par état,
  chaque sortie (retour, en-tête, avatar, bascule) est rendue AU-DESSUS des branches, jamais dans
  l'une d'elles, et un test l'atteint dans chaque état.

**Un test s'écrit d'après la fiche, jamais d'après le code : sinon il est circulaire.** Un test
qui fabrique son entrée puis vérifie que l'écran la répète prouve seulement que l'écran répète,
pas qu'il fait ce que la fiche demande. Trouvé le 2 novembre 2026 : six tests d'erreur
(`1-identite`, `2-objectifs`, `3-poids`, `4-cest-parti`, `devenir-coach`, `suppression`)
injectaient eux-mêmes un texte dans le faux port (« On a un souci de notre côté. », « Erreur de
test. ») et vérifiaient que l'écran l'affichait. Leurs fiches demandaient autre chose
(« `EtatErreur` en bandeau », le repli serveur de L0-03). Ces tests ont tenu en place sept
semaines un texte dupliqué sous son propre titre ; sur deux écrans, ils restaient verts alors que
l'écran n'utilisait même pas `EtatErreur`. Le faux port le disait pourtant dans son texte par
défaut : « jamais affichée telle quelle ». À l'inverse, un septième test adapté le même jour (un
coach non vérifié pouvait appuyer sur « Publier ») suivait fidèlement sa fiche de l'époque :
c'est la décision qui avait changé, pas le test qui était faux. Avant d'écrire une assertion,
la question est donc : quelle ligne de la fiche est-ce que je prouve ? Si la réponse est « ce que
le code fait », le test est circulaire.

**Le banc emprunte le chemin de l'application, jamais un chemin équivalent.** Même famille que
la règle précédente, côté base. Trouvé le 1er novembre 2026 : l'application modifiait un profil
coach par `compte_id`, le banc par `id` ; le chemin du banc passait, celui de l'application
échouait en `42501` depuis sept semaines. Écrire par `id` quand l'application écrit par
`compte_id`, c'est tester autre chose. Pour chaque écriture de l'application, au moins un test
du banc envoie EXACTEMENT la même requête (même table, même filtre, même fonction, avec la
session d'un utilisateur, jamais `service_role`), ou appelle la même fonction serveur que
l'application. Une préparation faite par `service_role` est un décor, pas un chemin couvert.

**Un résultat de test se lit sur TOUTES ses lignes de bilan, jamais sur celle qui répond à la
question qu'on se pose.** Jest en donne deux : `Test Suites:` et `Tests:`. Un fichier de test qui
ne se charge pas du tout (import introuvable, erreur de syntaxe) n'apparaît que dans la première —
ses tests ne sont jamais comptés dans la seconde, qui peut afficher « 599 passed » au-dessus d'un
échec. Même chose pour `npm run verif` : il s'arrête à la première étape en échec, et les étapes
suivantes n'ont pas tourné du tout, ce qui n'est pas la même chose qu'avoir réussi. Trouvé deux
fois le 31 octobre 2026 (P4.5c), deux rapports faux le même soir, du même geste : les chiffres de
deux suites inversés, puis « un seul test en échec » alors que le bilan disait
`Test Suites: 3 failed` — Jest essayait de charger les tests Deno de `supabase/functions/`.
Avant d'annoncer un résultat : lire le bilan entier de chaque étape, et nommer celles qui n'ont
pas tourné.

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

**Le rafraîchissement de l'état appartient au fournisseur, pas à l'appelant. Trouvé à P1.14
puis P1.15 — trois oublis en trois prompts.** Trois écritures changent `EtatProfils` côté
serveur : `creerProfilCoach`, `basculerProfil`, `enregistrerInformations`
(`src/services/donnees/port.ts`). Une écriture qui change l'état serveur sans relire ensuite
laisse l'interface mentir jusqu'au redémarrage — la feuille de bascule montre la coche sur le
mauvais espace, l'écran compte affiche l'ancien prénom. Et le mensonge est **invisible aux
tests** : un test d'écran monte l'écran seul, `expo-router` mocké, et prouve que l'écriture a
été appelée — jamais ce qu'un consommateur monté à côté lit après (même famille d'angle mort
que la pile de navigation, plus haut). Tant que « relire ensuite » restait une politesse à se
rappeler à chaque appel, il y avait un oubli de plus, et il tombait dans un lot où personne ne
regardait l'écran. Donc `FournisseurDonnees` (`src/fonctionnalites/identite/`) **enveloppe** ces
trois écritures : `useDonnees()` n'expose plus la méthode brute du port, il expose une version
qui relit l'état en cas de succès. `useDonnees().port` est typé `PortDonneesLecture` (les trois
retirées) — un écran qui écrit `port.basculerProfil(...)` ne compile pas — et
`src/test/ecriture-etat-profils-passe-par-le-fournisseur.test.ts` balaie le contournement par
`as`. **Une quatrième écriture qui change `EtatProfils` s'enveloppe pareil** ; on n'appelle
jamais un `rafraichir()` à la main depuis un écran. C'est arrivé le 2 novembre 2026 :
`creerProfilClient` active désormais l'espace client côté serveur (option B,
`creer_profil_client`), elle est la quatrième, enveloppée de la même façon.

**Zones sûres — angle mort structurel, trouvé à P1.12, de la même famille que le rendu web (§6).**
`react-test-renderer` (donc `npm test`, `test:a11y`, tout test d'écran) ne fait aucune mise en
page : pas de flexbox résolu, pas de coordonnées. Un écran qui applique `useSafeAreaInsets()` et
un écran qui l'ignore rendent le même arbre à un nombre près dans un objet de style — le bloc
encre de `app/(client)/moi.tsx` s'affichait sous la barre d'état sans qu'aucun test ne bronche.
`METRIQUES_ZONES_SURES` (`src/test/accessibilite.test.tsx` : haut 59, bas 34) n'existe que pour
que `useSafeAreaInsets()` ne lève pas ; sa valeur n'est comparée à la position de rien. Seule
parade en place : `verifierOffsetHautZoneSure` (même fichier) vérifie que le premier contenu de
**chaque écran du corpus** est retraité d'au moins l'inset haut, sauf exceptions nommées
(`EXCEPTIONS_ZONE_SURE_HAUT`, une seule : la galerie). **Inversé le 2 novembre 2026** : c'était une
liste d'écrans tenue à la main (« tout écran qui gagne un chrome haut doit y être ajouté ») ; le
profil coach n'y a jamais été ajouté, et son nom passait sous l'heure, trouvé sur iPhone. Le corpus
lui-même est exhaustif : un test exige que chaque route de `app/` y figure, ou soit une exception
nommée (`EXCEPTIONS_CORPUS`, trois : démarrage et back-office web). **Une route nouvelle entre dans
le corpus, ou dans une exception avec sa raison : jamais un oubli silencieux.** Ce contrôle n'attrape pas la géométrie réelle (troncature,
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
