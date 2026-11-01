# Montée de SDK Expo — SDK 57 → 58

Écrit le 1er novembre 2026. **Ce n'est pas un prompt de lot** : c'est une étape d'outillage,
insérée dans L4 avant P4.6b (`docs/dette.md`, ligne « Échéance — montée en SDK Expo 58 », pour
la raison : le blocage circulaire entre la porte de L4, celles de L1 et L3bis, et l'absence de
tout appareil de test). **Il resservira à la prochaine montée** : les sections « Méthode » et
« Porte de sortie » sont générales ; la section « Ce qui est propre au SDK 58 » est à réécrire
à chaque fois.

---

## Méthode, valable pour toute montée de SDK

1. **Une étape isolée.** `npm run verif` vert AVANT de toucher quoi que ce soit, sur l'arbre
   tel que le dépôt le décrit (`npm ci`). Puis la montée, et rien d'autre : **aucun code de
   fonctionnalité**, aucun texte, aucune migration. Puis `npm run verif` vert APRÈS. Un commit à
   elle seule, poussé, pour que la CI la rejoue sur une base neuve (Node lu dans `.nvmrc`,
   `npm ci`, migrations de zéro). Un rouge qui apparaît pendant l'étape vient de la montée, et de
   rien d'autre.
2. **Une seule main sur le dossier** (`CLAUDE.md` §7, règle 9). Pendant toute l'étape, le
   développeur ne lance rien dans le dossier, sauf ce qu'on lui demande nommément (Node sur sa
   machine, l'essai sur iPhone). Deux montées lancées à la main le 1er novembre 2026 ont laissé
   `package.json` et le lock en désaccord : c'est ce qu'on évite.
3. **Les versions viennent d'Expo, jamais choisies à la main** : `npx expo install expo@<version>`
   puis `npx expo install --fix`, et `npx expo-doctor` pour la liste des écarts. Une version qu'on
   voudrait autre que celle d'Expo est une décision, écrite avant d'être appliquée.
4. **Jamais `--legacy-peer-deps` ni `--force`.** Un conflit de pairs se comprend avant de se
   résoudre. Une résolution forcée accepte un arbre peut-être cassé sans le dire.
5. **Un test qui rougit n'est pas réécrit pour passer** (`CLAUDE.md` §4). S'il rougit à cause
   d'un changement d'API d'une bibliothèque, on corrige l'APPEL dans le code, et on le dit ; si
   c'est le test qui dépendait d'un détail interne, on le dit aussi, avant de le toucher.
6. **Revenir en arrière coûte une commande** : `git restore package.json package-lock.json` puis
   `npm ci`. Si la montée bloque plus d'une demi-journée sur un point, on revient, on écrit ce
   qu'on a appris dans `docs/dette.md`, et on décide.
7. **Ce que `verif` ne couvre pas** : le rendu natif réel. Jest rend des arbres sans mise en page
   (`CLAUDE.md` §8, « Zones sûres ») ; le paquet de production prouve que le code se construit,
   pas qu'il s'affiche. D'où le dernier point de la porte de sortie : l'essai sur appareil.

---

## Ce qui est propre au SDK 58

Versions cibles relevées le 1er novembre 2026 (à confirmer par `npx expo install --fix`, jamais
recopiées d'ici) : `expo` 58.0.x, `react-native` 0.88.1, `react` et `react-dom` 19.3.0,
`expo-router` 58.0.x, `react-native-reanimated` 4.7.x, `react-native-worklets` 0.13.x,
`react-native-gesture-handler` 3.x (version majeure ; aucun fichier du dépôt ne l'importe
directement), `react-native-screens` 4.30.x, `react-native-safe-area-context` 5.10.x.

| Point | Ce qu'on sait | Ce qui le prouvera |
|---|---|---|
| **Node** | `expo` 58 exige `^22.13.0` ; la machine exécute 22.12.0 (`docs/dette.md`, ligne Node). `.nvmrc` dit déjà 22.13.0, la CI le lit | `node -v` dans le shell du développeur ET dans celui de Claude : 22.13.0 |
| **datetimepicker** | ERESOLVE constaté pendant la montée abandonnée de 15 h 33 ; diagnostic corrigé dans `docs/dette.md` (la 9.1.0 déclare le même pair facultatif `react-native-windows` que la 9.2.1). Utilisé par `app/(public)/inscription.tsx` (date de naissance) et `src/fonctionnalites/identite/age.ts` | une résolution complète qui passe sans drapeau ; sinon une parade décidée par le développeur, puis écrite |
| **expo-router** | cœur de navigation retravaillé (annonce du SDK 58) | les 11 fichiers de test `renderRouter` (`CLAUDE.md` §8) |
| **Reanimated** 4.5 → 4.7 | 7 composants : `bouton`, `bouton-icone`, `modale`, `feuille-basse`, `squelette`, `progression`, `onglets` | tests d'écran et `test:a11y` ; à l'œil sur iPhone (feuille basse, bascule de profil) |
| **jest-expo** 58 | attend `@react-native/jest-preset ^0.88` ; `jest` est figé en 29 (`docs/dette.md`, première ligne sur jest) | `npm test` se charge : `Test Suites:` sans échec de chargement |
| **Paquet de production** | `scripts/verifier-bundle-production.mjs` | web, iOS et Android, clé admin absente des trois |

---

## Déroulé

**S58.0 — Node 22.13, sur la machine du développeur (c'est lui qui le fait).**
`nvm install 22.13.0` puis `nvm alias default 22.13.0`, dans un nouveau terminal. Claude vérifie
ensuite que SON shell trouve aussi 22.13.0, et met à jour la ligne Node de `docs/dette.md` (les
deux autres installations, 22.12.0 par l'installeur officiel et 25.8.1 par Homebrew, restent un
ménage à part).

**S58.1 — Vert avant.** `npm ci` puis `npm run verif` sous Node 22.13 : la base de comparaison.
Rouge ici = pas de montée ; on comprend d'abord.

**S58.2 — La montée.** `npx expo install expo@^58.0.0`, puis `npx expo install --fix`, puis
`npx expo-doctor`. Si ERESOLVE : arrêt, et diagnostic selon `docs/dette.md` (résolution complète
depuis un état propre, 9.2.2, `overrides`), une parade proposée au développeur, jamais choisie
seule.

**S58.3 — Les rouges.** `npm run verif`. Chaque rouge est nommé, sa cause dite (montée de quelle
bibliothèque, quel changement d'API), corrigé dans le code appelant. Lire TOUTES les lignes de
bilan (`CLAUDE.md` §8).

**S58.4 — Vert après, commit, push.** `npm run verif` complet vert. Un commit :
`chore(L4): monte le SDK Expo de 57 à 58`. Push, et la CI (Vérification, Banc RLS) rendue sur ce
commit, chaque ligne lue.

**S58.5 — L'essai sur iPhone (le développeur, Claude ne lance rien).** Expo Go à jour sur
l'iPhone, même réseau Wi-Fi que le Mac. Le développeur lance `npm start` et scanne le QR code.
Ce qui est regardé, et noté (fait / pas fait / défaut constaté, avec capture) :
1. L'application démarre : écran de démarrage, puis bienvenue, sans écran rouge.
2. Inscription jusqu'à la date de naissance : le sélecteur de date s'ouvre et se referme.
3. Connexion, onboarding client, espace client.
4. La feuille de bascule de profil (Reanimated) : ouverture, fermeture, bascule dans les deux
   sens, barre du haut correcte.
5. Le profil d'un coach, onglet Avis (état vide), puis « S'abonner » jusqu'à 04a.
6. Les zones sûres : rien sous l'encoche ni sous l'indicateur d'accueil.
Ce que l'essai ne peut pas couvrir en Expo Go : « Continuer avec Apple », les liens universels
(domaine absent), les notifications. Ils restent où ils sont dans `docs/dette.md`.

---

## Porte de sortie

La montée est close quand **les six points** sont vrais. Les cinq premiers ne suffisent pas.

1. `npm run verif` vert avant la montée (S58.1), bilan entier lu.
2. Le commit de montée ne contient que la montée : `package.json`, `package-lock.json`, et les
   seules corrections d'appels que la montée a rendues nécessaires, chacune nommée dans le
   rapport. Aucun code de fonctionnalité.
3. `npm run verif` vert après la montée, bilan entier lu, rouges intermédiaires nommés avec leur
   cause.
4. La CI verte sur le commit poussé (Vérification et Banc RLS), sur une base neuve.
5. Aucun `--legacy-peer-deps`, aucun `--force`, aucun test supprimé ou affaibli. Si le conflit
   datetimepicker a demandé une parade, elle est écrite dans `docs/dette.md` avec sa raison.
6. **L'essai sur iPhone (S58.5) est fait par le développeur, et son résultat est écrit** :
   chaque point fait ou non, chaque défaut constaté nommé. **La porte ne se ferme qu'après cet
   essai, jamais sur le seul vert de `verif`.** Un défaut de rendu trouvé ici est corrigé avant
   la fermeture, ou reporté par une décision écrite (`CLAUDE.md` §7, règle 7).

La fermeture est un commit qui le dit (`CLAUDE.md` §7, règle 8). Ensuite seulement : P4.6b, et
la séance sur appareil des portes de L1 et de L3bis.
