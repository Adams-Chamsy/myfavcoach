# L1-05 · Onboarding client — quatre étapes

**Lot** L1 · **Rôle** client (profil en cours de création) · **Routes**
`app/(onboarding)/1-identite.tsx` → `4-cest-parti.tsx`
**Référence visuelle** `maquettes/MyFavCoach-Parcours_dc.html`,
`data-screen-label="22 Onboarding objectifs"` — **étape 2 uniquement, les trois autres sont
conçues ici**

---

## Raison d'être

L'écran 22 affiche « 2/4 ». Le dossier de design ne dit nulle part ce que sont les étapes 1, 3
et 4. Elles sont fixées ici, une fois pour toutes.

| Étape | Contenu | Origine |
|---|---|---|
| 1/4 | Qui es-tu — prénom, nom, photo, commune | conçue ici |
| 2/4 | Objectifs et rythme | **écran 22, à reprendre au pixel** |
| 3/4 | Poids et objectif de poids, facultatifs | conçue ici (`docs/domaine.md` §0.10) |
| 4/4 | C'est parti — récapitulatif et entrée | conçue ici |

L'onboarding crée le **profil client**. Il ne crée pas de profil coach : c'est L1-08.

---

## Élément commun aux quatre étapes

En-tête : bouton retour 24, fil de 4 segments de 4 pt (`marque.primaire` faits,
`bordure.discrete` à venir), et le lien « Passer » en `texte.attenue` à droite.

**« Passer » n'apparaît pas à l'étape 1** : le prénom est la seule donnée obligatoire de tout
l'onboarding, parce que le produit tutoie (« Salut Camille ») et qu'il n'a rien à dire sans lui.

Pied fixe : bouton primaire, dont le libellé porte le comptage quand il y a comptage
(« Continuer · 3 objectifs »).

---

## Étape 1/4 — Qui es-tu

Titre `texte.titre1` : « Comment on t'appelle ? »

| Champ | Obligatoire | Détail |
|---|---|---|
| Prénom | **oui** | `Champ`, 2 à 40 caractères |
| Nom | non | Utilisé côté coach uniquement, jamais affiché publiquement au client |
| Photo | non | `EmplacementImage` `portrait3x4` circulaire 76, repli initiales |
| Commune | non | Champ de complétion sur le référentiel INSEE (`docs/domaine.md` §5.7) |

La complétion de commune interroge le serveur : c'est le **premier appel réseau authentifié du
produit**. Elle attend 300 ms après la dernière frappe, et l'absence de résultat n'est pas une
erreur.

---

## Étape 2/4 — Objectifs et rythme *(écran 22)*

Titre : « Qu'est-ce que tu veux faire bouger ? »
Sous-titre : « Choisis-en autant que tu veux. »

- **Chips multi-sélection**, hauteur 44, sélectionnée en `fond.inverse` + coche.
  Liste figée, 8 valeurs, dans `src/fixtures/` : reprendre le sport · perdre du poids ·
  prendre du muscle · mieux manger · gérer le stress · progresser au travail · apprendre une
  compétence · autre.
- **Rythme**, 3 tuiles exclusives (1–2 fois, 3–4 fois, 5 fois et plus par semaine), la
  sélectionnée en `marque.primaireTeinte` avec contour 2.
- **Encart de confidentialité** `marque.secondaire` : « Tes réponses restent privées jusqu'à ce
  que tu t'abonnes à un coach. Aucune donnée de santé n'est partagée sans ton accord. »
  Ce texte est un engagement : il conditionne la règle de visibilité ci-dessous.
- Bouton : « Continuer · N objectifs », désactivé à zéro sélection.

---

## Étape 3/4 — Poids et objectif

Titre : « Un point de départ, si tu veux. »
Sous-titre : « Facultatif. Tu peux l'ajouter plus tard, ou jamais. »

- Deux champs numériques : poids actuel, poids visé, en kilogrammes avec une décimale.
- Au-dessus des champs, un **interrupteur de consentement**, décoché par défaut :
  « J'accepte que My fav Coach enregistre mes données de santé pour suivre ma progression. »
  Les champs sont inertes tant qu'il est décoché — inertes et **visiblement** inertes.
- Sous les champs, le rappel : « Tu peux retirer cet accord à tout moment dans ton compte. »
- Bouton : « Continuer », toujours actif. « Passer » disponible.

**C'est une donnée de catégorie 9.** Elle n'est jamais journalisée, jamais placée dans une URL,
jamais conservée sur l'appareil au-delà de la session (`CLAUDE.md` §10).

---

## Étape 4/4 — C'est parti

Titre `texte.display` : « Bienvenue, Camille. »
Récapitulatif en trois lignes lisibles, chacune avec un lien « Modifier » qui renvoie à son
étape : objectifs, rythme, point de départ (ou « non renseigné »).
Bouton primaire : « Découvrir des coachs » → `(client)/accueil`.

Aucune animation de célébration, aucune confettis : le produit ne félicite personne d'avoir
rempli un formulaire.

---

## États

| État | Comportement |
|---|---|
| Normal | Étape courante, progression réelle |
| Chargement | À l'enregistrement d'une étape : bouton en attente, saisie conservée |
| Erreur | `EtatErreur` en bandeau, **l'étape n'avance pas** et rien n'est perdu |
| Reprise | Réouverture de l'application en cours d'onboarding : retour à l'étape non terminée |

---

## Règles

- **La progression est enregistrée côté serveur à chaque étape**, dans le profil client
  (`onboarding_etape`). Pas sur l'appareil : le poids et les objectifs ne se mettent pas en
  cache local.
- Un profil client existe dès l'étape 1 validée. Les étapes suivantes le complètent.
- « Passer » à l'étape 2 crée un profil sans objectif ; ce n'est pas un état dégradé, la
  recherche fonctionnera quand même (les objectifs ne servent au filtrage qu'au lot L3).
- Le consentement santé est enregistré avec sa **version de texte et son horodatage**
  (`docs/domaine.md` §3.12). Un consentement sans version est un consentement inutilisable.
- Retirer le consentement plus tard **n'efface pas** les mesures : il bloque l'écriture et
  propose l'effacement (L1-09).
- L'onboarding ne peut pas être rouvert une fois terminé. Les mêmes données se modifient depuis
  le compte.
- Rien dans cet écran ne touche à un abonnement, une offre ou un paiement.

---

## Critères d'acceptation

1. Le prénom vide bloque l'étape 1 ; toutes les autres étapes se franchissent vides.
2. Quitter l'application à l'étape 3 et la rouvrir ramène à l'étape 3, avec les étapes 1 et 2
   conservées — testé contre la base réelle.
3. Interrupteur de consentement décoché : les deux champs de poids n'acceptent aucune saisie, et
   leur inertie est perceptible autrement que par la couleur.
4. Un test **contre la base réelle** prouve qu'écrire une mesure sans consentement enregistré
   est refusé côté serveur, indépendamment de l'écran.
5. Aucune valeur de poids n'apparaît dans une URL, un paramètre de requête ou une sortie de
   journalisation — testé par interception.
6. Les 8 objectifs et les 3 rythmes viennent de `src/fixtures/`, aucune chaîne écrite dans
   l'écran.
7. Le bouton de l'étape 2 affiche le nombre exact de sélections et se désactive à zéro.
8. Le fil d'étapes est annoncé au lecteur d'écran comme « étape 2 sur 4 ».
9. À 200 %, les chips passent sur plusieurs lignes sans troncature et les tuiles de rythme
   s'empilent.
10. Les quatre étapes sont dans la galerie, **exercées en clair et en sombre**.
11. `npm run verif` passe.
