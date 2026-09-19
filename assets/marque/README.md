# Marque My Fav Coach — fichiers d'intégration

**À lire avant d'utiliser.** Le symbole a été **vectorisé automatiquement** à partir de la
planche `ChatGPT_Image_17_sept_2026.png` : séparation des deux couleurs, détection des contours,
simplification, export en tracés. Ce n'est donc pas un redessin à main levée — la géométrie suit
l'original de près — mais ce n'est pas non plus le fichier source.

Deux conséquences :

1. Si le vectoriel d'origine existe (la planche annonce des fichiers SVG, AI et EPS), il fait foi
   et ces fichiers sont à jeter. La vectorisation reste une approximation à quelques dixièmes de
   pixel, surtout sur les courbes du ruban sable.
2. Le nom « My Fav Coach » est du texte vivant dans le SVG, pas des courbes. Il s'affiche
   correctement là où Manrope est installée et bascule sur une police de substitution ailleurs.
   Pour un logo définitif, il faut le convertir en tracés.

Le ruban sable sort du cadre en haut à droite : c'est fidèle à la planche, où il est coupé de la
même façon. Si ce n'était pas voulu à l'origine, il faut le redessiner, pas le recadrer.

---

## Couleurs

Identiques aux tokens du projet, aucune valeur inventée.

| Rôle           | Hex       | Token                                 |
| -------------- | --------- | ------------------------------------- |
| Vert sapin     | `#0F5140` | `brand.primary`                       |
| Sable du ruban | `#D9C9B0` | entre `brand.secondary` et `grey.300` |
| Fond clair     | `#FBF8F4` | `bg.canvas`                           |
| Fond sombre    | `#14120F` | `bg.canvas` (sombre)                  |
| Nom, mot 1     | `#17211E` | `text.primary`                        |
| Nom, mot 2     | `#B49B77` | dérivé du sable                       |

L'orange `#E2603C` n'apparaît nulle part dans la marque, et c'est volontaire : il est réservé
à une action unique par écran. Un logo qui le contient dilue ce signal.

---

## Fichiers

**Symbole seul**

- `mfc-symbole.svg` — vectoriel, couleurs de marque
- `icone-sable.svg` · `icone-verte.svg` · `icone-blanche.svg` · `icone-encre.svg` — symbole
  sur fond plein, marge de sécurité incluse

**Verrouillage complet**

- `mfc-logo-clair.svg` — pour fonds clairs
- `mfc-logo-sombre.svg` — pour fonds verts ou sombres

**Icône d'application**

- `icone-1024.png` · `icone-512.png` · `icone-256.png` · `icone-128.png` — fond sable
- `icone-verte-1024.png` — variante fond vert
- `android-foreground-432.png` — calque avant pour icône adaptative Android, fond transparent,
  symbole dans la zone sûre de 66 %

**Écran de démarrage**

- `splash-clair.png` · `splash-sombre.png` — 1242 × 2688, symbole centré

---

## Intégration Expo

Dans `app.json` :

```json
{
  "expo": {
    "icon": "./assets/marque/icone-1024.png",
    "splash": {
      "image": "./assets/marque/splash-clair.png",
      "resizeMode": "contain",
      "backgroundColor": "#FBF8F4"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/marque/android-foreground-432.png",
        "backgroundColor": "#EFE6D8"
      }
    }
  }
}
```

Trois points à ne pas rater :

- **L'icône iOS ne doit pas avoir de transparence.** `icone-1024.png` a un fond plein, c'est
  voulu. Une icône transparente est refusée à la soumission.
- **L'icône Android adaptative est recadrée** par le lanceur en cercle, en carré arrondi ou
  en goutte selon l'appareil. Le symbole occupe 60 % du calque pour survivre au recadrage le
  plus agressif.
- **Le splash sombre n'est pas branché au jalon 1.** Le thème sombre existe en tokens mais
  son implémentation est reportée (`perimetre.md` §3). Le fichier est fourni pour plus tard.

---

## Écran 21 · Bienvenue

Le symbole y remplace le bloc de titre actuel, au-dessus de l'accroche. Deux règles :

- Taille : environ 88 px de côté sur mobile. Au-delà, il écrase l'accroche ; en dessous,
  le ruban sable devient illisible.
- Le verrouillage complet — symbole plus nom — n'a pas sa place ici. Le nom de l'application
  est déjà affiché par le système au lancement et sur l'icône. Le répéter à l'écran de
  bienvenue prend la place de l'accroche, qui est ce qui doit se lire.

Cet écran est livré depuis L1 : l'ajout touche du code déjà en place, et la vérification
d'accessibilité doit repasser (le symbole porte un `aria-label`, il n'est pas décoratif).

---

## Deux points à trancher

**La signature est en anglais.** « Progress to a brighter you » sur une application France
seule, francophone, où le multilingue est hors périmètre. Beaucoup de marques françaises le
font, mais c'est une décision à prendre, pas à hériter.

**La planche d'origine montre un écran d'accueil avec une photo de sommet.** C'est du sport,
et le périmètre a retenu une identité multi-disciplines — préparation physique, yoga,
nutrition, cuisine, cybersécurité, RGPD, développement professionnel. Cette maquette-là est à
écarter, les images d'ambiance retenues la remplacent.
