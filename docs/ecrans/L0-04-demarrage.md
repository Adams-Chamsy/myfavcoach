# L0-04 · Démarrage

**Lot** L0 · **Rôle** aucun · **Route** `app/_layout.tsx` + `app/index.tsx`

---

## Raison d'être

Le premier écran est celui qu'on remarque seulement quand il est mauvais : polices qui arrivent
en retard et font sauter la mise en page, écran blanc, ou pire, écran figé sans explication.
Il est posé au lot L0, une fois, et plus personne n'y touche.

---

## Contenu

Fond `fond.canevas`. Au centre, le logo : la lettre **M** en Instrument Serif, 64 pt,
`marque.primaire`. Rien d'autre. Aucun texte, aucun indicateur.

Si le démarrage dépasse **3 secondes** : sous le logo, en `texte.petit` `texte.secondaire`,
« On prépare ton espace ». À **10 secondes**, bascule sur `EtatErreur` avec « Réessayer ».

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
   moment où les polices arrivent.
2. Sans jeton, l'application arrive sur l'écran public ; avec un jeton `client`, sur l'accueil
   client ; avec un jeton `coach`, sur le pilotage coach — trois tests.
3. Appareil réglé en mode sombre système : l'application reste en clair.
4. Chargement des polices simulé en échec : l'application démarre, l'écran s'affiche.
5. Chargement simulé à 4 secondes : la phrase « On prépare ton espace » apparaît. À 11 secondes :
   `EtatErreur`.
6. Aucun jeton n'est écrit ailleurs que dans le trousseau sécurisé — vérifié par une règle de
   lint interdisant `AsyncStorage` sur les clés d'authentification.
7. `npm run verif` passe.
