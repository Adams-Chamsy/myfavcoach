# Marque My Fav Coach — fichiers d'intégration

**À lire avant d'utiliser.** Le symbole a été **vectorisé automatiquement** à partir de la
planche `ChatGPT_Image_17_sept_2026.png` : séparation des deux couleurs, détection des contours,
simplification, export en tracés. Ce n'est donc pas un redessin à main levée — la géométrie suit
l'original de près — mais ce n'est pas non plus le fichier source.

Deux conséquences :

1. Si le vectoriel d'origine existe (la planche annonce des fichiers SVG, AI et EPS), il fait foi
   et ces fichiers sont à jeter. La vectorisation reste une approximation à quelques dixièmes de
   pixel, surtout sur les courbes du ruban sable.
2. Le nom « My Fav Coach » et la signature sont **convertis en tracés** depuis Manrope 700 et
   500 (révision du 19 septembre). Les verrouillages ne dépendent plus d'aucune police installée :
   ils s'affichent identiques partout, fiche de store comprise.

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

**Écran de démarrage** (révision du 19 septembre — remplace `splash-clair.png` et
`splash-sombre.png`, à supprimer)

- `splash-logo-clair.png` — iOS : symbole + nom + signature, fond transparent, 1200 × 880
- `splash-android-clair.png` — Android : symbole seul, fond transparent, 1152 × 1152 (288 dp à
  ×4), contenu dans le cercle de 192 dp que l'API splash d'Android 12+ laisse visible
- `splash-logo-sombre.png` · `splash-android-sombre.png` — pour le thème sombre, non branchés

---

## Intégration Expo

Dans `app.json` :

```json
{
  "expo": {
    "icon": "./assets/marque/icone-1024.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/marque/android-foreground-432.png",
        "backgroundColor": "#EFE6D8"
      }
    }
  }
}
```

Le splash ne se configure **pas** par la clé `splash` de haut niveau : elle est inopérante sur
Expo SDK 57 (vérifié dans le code du paquet lors de la première intégration). Il passe par le
tuple du plugin `expo-splash-screen`, avec une image par plateforme :

```json
[
  "expo-splash-screen",
  {
    "backgroundColor": "#FBF8F4",
    "ios": {
      "image": "./assets/marque/splash-logo-clair.png",
      "imageWidth": 260
    },
    "android": {
      "image": "./assets/marque/splash-android-clair.png",
      "imageWidth": 288
    }
  }
]
```

Les noms exacts des clés par plateforme sont à vérifier dans le code du plugin installé, comme
la première fois — ce bloc décrit l'intention, pas une configuration éprouvée.

`expo export` ne touche ni l'icône ni le splash : ce sont des affaires de prebuild natif. Ne les
cherche pas dans `dist/`.

Quatre points à ne pas rater :

- **Deux images, pas une.** Depuis Android 12, le splash passe par l'API système : une icône
  centrée, masquée en cercle. Un verrouillage large avec le nom y serait rogné. D'où le symbole
  seul côté Android, et le verrouillage complet côté iOS.
- **Pas de barre de progression, pas de vague décorative.** Un splash natif est une image fixe
  affichée avant que le moindre code ne tourne : rien ne peut y bouger, et rien ne peut couvrir
  tout l'écran sur Android 12+. La barre de la maquette serait une progression inventée — rien
  ne mesure le chargement à ce moment-là.

- **L'icône iOS ne doit pas avoir de transparence.** `icone-1024.png` a un fond plein, c'est
  voulu. Une icône transparente est refusée à la soumission.
- **L'icône Android adaptative est recadrée** par le lanceur en cercle, en carré arrondi ou
  en goutte selon l'appareil. Le symbole occupe 60 % du calque pour survivre au recadrage le
  plus agressif.
- **Les deux splash sombres ne sont pas branchés au jalon 1.** Le thème sombre existe en tokens mais
  son implémentation est reportée (`perimetre.md` §3). Les fichiers sont fournis pour plus tard.

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
