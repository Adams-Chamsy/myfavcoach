# L0-00 · Galerie du système

**Lot** L0 · **Rôle** aucun (écran de développement) · **Route** `/_galerie`
**Référence visuelle** `maquettes/MyFavCoach-System_dc.html`, bloc `1a`

---

## Raison d'être

Un écran interne qui affiche les 14 primitives dans tous leurs états, sur le même écran. Il sert
à trois choses : voir une régression visuelle sans lancer de parcours, tester le thème d'un
appui, et donner à Claude Code une cible vérifiable à l'œil pour chaque primitive.

**Il n'est jamais accessible en production** : la route n'existe que si `__DEV__` est vrai.

---

## Contenu

Sections, dans cet ordre, séparées par un titre `texte.label` :

1. **Couleurs** — chaque token de couleur du thème actif, en pastille 44 × 44, avec son nom et
   sa valeur hexadécimale.
2. **Typographie** — les 8 styles, avec un texte d'exemple en français et leur nom de token.
3. **Espaces, rayons, ombres** — la suite 4 → 64 en barres, les 8 rayons en carrés, les
   3 ombres en cartes.
4. **Boutons** — 4 variantes × 4 états (défaut, pressé, désactivé, focus), en grille.
5. **Champs** — normal, focus, erreur avec message, désactivé.
6. **Chips, onglets, progression** — dont un chip retirable et une barre qui s'anime au tap.
7. **Badges, avatars** — les 4 statuts avec libellé, les 5 tailles d'avatar avec repli initiales.
8. **Cartes** — carte coach, carte séance, carte programme.
9. **Barres de navigation** — client et coach, côte à côte, non fonctionnelles.
10. **Feuille basse et modale** — deux boutons qui les ouvrent réellement.
11. **États** — squelette, vide, erreur.
12. **Icônes** — les 36, avec leur nom sous chacune.

En pied d'écran : un interrupteur **clair / sombre** et un interrupteur **mouvement réduit**,
qui appliquent le thème à la galerie seule.

---

## États

| État | Comportement |
|---|---|
| Normal | Tout est monté, aucune donnée distante |
| Chargement | Sans objet — la galerie n'appelle rien |
| Erreur | Sans objet |
| Vide | Sans objet |

---

## Règles

- La galerie **lit les tokens générés**, elle ne réécrit aucune valeur. Si une pastille est
  fausse, c'est le générateur qui est faux.
- Elle n'importe rien depuis `src/fonctionnalites/` : c'est le test que les primitives sont
  vraiment indépendantes du métier.
- L'interrupteur sombre existe pour vérifier les tokens, **pas** pour livrer le mode sombre :
  aucun écran produit ne propose ce réglage au jalon 1.

---

## Critères d'acceptation

1. `npm start`, l'écran s'ouvre à l'adresse `/_galerie` en développement.
2. Un build de production ne contient pas la route : `grep -r "_galerie" dist/` ne renvoie rien.
3. Les 14 primitives sont présentes, chacune avec ses 4 états quand elle en a.
4. Les 36 icônes s'affichent, aucune n'est manquante ni dupliquée.
5. Basculer sur sombre change toutes les couleurs sans qu'aucun texte ne devienne illisible
   (vérification manuelle) et sans erreur en console.
6. Basculer sur mouvement réduit supprime les translations : la feuille basse apparaît en
   fondu, pas en glissant.
7. `npm run test:a11y` passe : aucune cible tactile sous 44 pt, aucun couple texte/fond sous
   4,5:1 hors texte désactivé.
8. Aucune valeur littérale de couleur, taille ou durée dans le fichier de l'écran.
