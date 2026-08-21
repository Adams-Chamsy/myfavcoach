# L0-03 · États système génériques

**Lot** L0 · **Rôle** les deux · **Composants** `src/composants/etats/`
**Référence visuelle** `maquettes/MyFavCoach-Etats_dc.html`, écrans 14 et 15

---

## Raison d'être

Trois composants réutilisables — vide, chargement, erreur — posés une fois pour toutes, avant
qu'un seul écran de contenu existe. Sans eux, chaque lot réinventera son propre message
d'erreur, et le produit parlera cinq langues différentes.

La règle du dossier de design, appliquée partout : **dire ce qui s'est passé, dire ce qui reste
accessible, proposer une seule action de sortie.**

---

## Contenu

### `EtatVide`

Props : `titre`, `explication`, `actionPrincipale?`, `contenuSecondaire?`.

- Titre en `texte.titre2`, explication en `texte.corps` `texte.secondaire`.
- **Une seule** action, en bouton secondaire.
- `contenuSecondaire` permet à un écran de ne jamais rester nu (« Proches de ta recherche »).
- Aucune illustration : il n'y a pas d'illustrations dans ce système.

### `EtatChargement` (squelettes)

Props : `forme` ∈ `liste | carte | detail | ligne`, `nombre`, `raison?`.

- Squelettes **aux formes finales** : un squelette de carte coach a la taille d'une carte coach.
- Pulsation d'opacité seulement, 1 200 ms, désactivée en mouvement réduit.
- `raison` affiche une phrase sous les squelettes quand l'attente est explicable, comme sur
  l'écran 15. Sinon rien : ne jamais meubler.
- **Jamais de spinner plein écran.** Le composant n'en propose aucun.
- Le bouton principal de l'écran hôte est désactivé et visiblement inerte pendant le chargement.

### `EtatErreur`

Props : `titre`, `explication`, `resteAccessible?`, `onReessayer`, `code?`.

- Registre : tutoiement, factuel. « Ta banque a refusé le paiement », pas « Une erreur est
  survenue ».
- `titre` et `explication` viennent du serveur quand il en fournit (`docs/api.md` §1), sinon des
  textes de repli listés ci-dessous.
- `resteAccessible` énonce ce qui marche encore. C'est la partie que tout le monde oublie.
- `code` s'affiche en `texte.legende` `texte.attenue`, sélectionnable, pour le support.
- Une seule action : « Réessayer ». Sur trois échecs consécutifs, l'action devient « Nous
  écrire » (adresse de support, pas de formulaire au jalon 1).

**Textes de repli** (les seuls autorisés) :

| Situation | Titre | Explication |
|---|---|---|
| Réseau absent | Pas de connexion | Vérifie ton réseau, on réessaie dès que c'est revenu. |
| Serveur (5xx) | On a un souci de notre côté | Ce n'est pas toi. On réessaie dans un instant. |
| Délai dépassé | Ça met plus de temps que prévu | La connexion est lente, ou on rame un peu. |
| Non autorisé (403) | Tu n'as pas accès à cette page | Elle appartient peut-être à ton autre espace. |
| Introuvable (404) | Cette page n'existe plus | Elle a peut-être été supprimée. |

---

## Règles

- Ces trois composants sont dans `src/composants/`, donc **sans logique métier et sans appel
  réseau**. Ils reçoivent tout par props.
- Aucun écran du produit n'écrit son propre message d'erreur : s'il en faut un nouveau, il
  s'ajoute au tableau ci-dessus.
- Une erreur ne masque jamais du contenu déjà chargé : elle s'affiche en bandeau au-dessus.
  Le remplacement plein écran est réservé au cas où il n'y a rien à montrer.
- Aucun code technique brut (« TypeError », « ECONNREFUSED ») n'atteint l'écran.

---

## Critères d'acceptation

1. Les trois composants apparaissent dans la galerie L0-00 avec chacun deux exemples.
2. `EtatChargement` ne rend jamais d'indicateur circulaire : un test échoue si un
   `ActivityIndicator` plein écran apparaît dans le rendu.
3. En mouvement réduit, la pulsation des squelettes s'arrête ; le contenu reste lisible.
4. `EtatErreur` affiche « Réessayer » aux deux premiers échecs, « Nous écrire » au troisième —
   testé.
5. Un test vérifie qu'aucun des cinq textes de repli ne contient les mots « erreur »,
   « problème technique » ou « veuillez ».
6. Le lecteur d'écran annonce l'erreur à son apparition (région active), sans voler le focus.
7. Les trois composants passent `npm run test:a11y`.
