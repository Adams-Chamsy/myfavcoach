# L0-04 · Démarrage

**Lot** L0 · **Rôle** aucun · **Route** `app/_layout.tsx` + `app/index.tsx`

---

## Raison d'être

Le premier écran est celui qu'on remarque seulement quand il est mauvais : polices qui arrivent
en retard et font sauter la mise en page, écran blanc, ou pire, écran figé sans explication.
Il est posé au lot L0, une fois, et plus personne n'y touche.

---

## Contenu

Fond `fond.canevas` (`#FBF8F4`). Le splash natif (icône seule) reste affiché tel quel jusqu'à ce
que cet écran ait rendu sa première image ; cet écran prend ensuite le relais et reproduit la
maquette de la planche de marque (splash clair) :

- verrouillage logo (`assets/marque/splash-logo-clair.png`), centré, à la position **exacte** où
  le splash natif iOS le place (vérifié dans le `SplashScreen.storyboard` généré par
  `expo prebuild` : 260 pt de large, centré horizontalement et verticalement) — aucun saut visible
  au retrait du splash natif ;
- vague sable en bas d'écran, deux tracés superposés (`marque.secondaire`, `marque.ruban`),
  purement décorative, jamais exposée au lecteur d'écran — géométrie dessinée à la main, aucune
  maquette HTML n'existant pour cet écran (voir « Ce qui a été inventé ») ;
- barre de progression (`marque.primaire` sur `gris.200`) au-dessus de la vague, qui avance par
  **étapes réelles** — polices, session, profil — jamais sur une minuterie : si tout est prêt
  vite, elle se remplit vite. Mouvement réduit respecté (`Progression`, `variante="barre"`) : sans
  animation, elle saute d'étape en étape au lieu de glisser.

Si le démarrage dépasse **3 secondes** : sous la barre, en `texte.petit` `texte.secondaire`,
« On prépare ton espace ». À **10 secondes**, bascule sur `EtatErreur` avec « Réessayer ».

Le splash sombre (`assets/marque/splash-*-sombre.png`) n'est pas branché : mode sombre reporté
(`docs/perimetre.md` §3).

### Ce qui a été inventé

- **La géométrie de la vague sable** : aucune maquette HTML n'existe pour cet écran, contrairement
  aux écrans qui en ont une. Les deux tracés (`app/index.tsx`, `VagueSable`) sont dessinés à la
  main pour rester dans l'esprit de la planche de marque, pas tracés depuis une source exacte.
- **« Polices » comme étape toujours acquise au montage** : `app/_layout.tsx` ne rend cet écran
  qu'une fois `useFonts()` résolu (chargé ou en échec) — un fait garanti par la structure du
  fournisseur racine, jamais une supposition posée dans `app/index.tsx`. L'étape « polices » de la
  barre est donc comptée acquise dès le premier rendu, jamais observée en tant que telle par cet
  écran.
- **Android 12+ (API 31+)** : l'API de démarrage native d'Android (`SplashScreen.installSplashScreen`,
  utilisée par `expo-splash-screen`) contraint tout splash à une petite icône dans un cercle de
  192 dp, un mécanisme structurellement différent du storyboard libre d'iOS. Un raccord parfaitement
  sans saut entre les deux écrans n'est donc pas garanti par la seule config `app.json` sur
  Android — non vérifié sur appareil physique (voir `docs/dette.md`).

---

## Séquence

1. Écran natif de lancement (`expo-splash-screen`) maintenu, pas d'écran blanc entre les deux.
2. Chargement des polices embarquées Instrument Serif et Manrope (400/600/700/800).
3. Lecture du thème : **clair forcé au jalon 1**, quelle que soit la préférence système.
4. Lecture du réglage de mouvement réduit, une fois, dans le fournisseur de thème.
5. Lecture du jeton d'authentification dans le trousseau sécurisé.
6. Redirection :
   - aucun jeton → `/(public)/accueil` (écran provisoire, remplacé en L1) ;
   - jeton + `profilActif = client` → `/(client)/accueil` ;
   - jeton + `profilActif = coach` → `/(coach)/pilotage`.
7. L'écran natif se retire **après** que la destination a rendu sa première image.

---

## Règles

- **Aucun appel réseau au démarrage** au lot L0. La redirection se décide sur le contenu local
  du trousseau ; la validation du jeton se fera au premier appel réel, en L1.
- Les polices sont embarquées dans le paquet, jamais téléchargées.
- Si une police échoue à charger, l'application **démarre quand même** avec la police système :
  une typographie de repli vaut mieux qu'un écran bloqué. L'incident est journalisé.
- Le thème sombre système est ignoré, sans exception (`docs/perimetre.md` §3). Un commentaire
  dans le code le rappelle, sinon quelqu'un « corrigera » ça dans six mois.

---

## Critères d'acceptation

1. Démarrage à froid sur iOS et Android : aucun écran blanc, aucun saut de mise en page au
   moment où les polices arrivent, ni au retrait du splash natif — le verrouillage logo de cet
   écran reprend exactement la position/taille du splash natif iOS (`LARGEUR_LOGO_DEMARRAGE`,
   `app/index.tsx`, synchronisée à la main avec `ios.imageWidth` de `app.json`). Sur Android
   12+, voir « Ce qui a été inventé » : le raccord reste à vérifier sur appareil.
2. Sans jeton, l'application arrive sur l'écran public ; avec un jeton `client`, sur l'accueil
   client ; avec un jeton `coach`, sur le pilotage coach — trois tests.
3. Appareil réglé en mode sombre système : l'application reste en clair.
4. Chargement des polices simulé en échec : l'application démarre, l'écran s'affiche.
5. Chargement simulé à 4 secondes : la phrase « On prépare ton espace » apparaît. À 11 secondes :
   `EtatErreur`.
6. Aucun jeton n'est écrit ailleurs que dans le trousseau sécurisé — vérifié par une règle de
   lint interdisant `AsyncStorage` sur les clés d'authentification.
7. La vague sable n'est jamais exposée au lecteur d'écran (`accessibilityElementsHidden`,
   `importantForAccessibility="no"`).
8. La barre de progression reflète des étapes réelles (polices, session, profil), jamais une
   minuterie : sa valeur change avec l'état de chargement, pas avec le temps écoulé.
9. `npm run verif` passe.
