# L0-01 · Coquille de navigation client

**Lot** L0 · **Rôle** client · **Route** `app/(client)/_layout.tsx`
**Référence visuelle** `maquettes/MyFavCoach-System_dc.html` (barre client) et écran 01

---

## Raison d'être

La structure de navigation de l'espace client, sans aucun contenu. Les cinq onglets existent,
sont tactiles, changent d'état, et affichent chacun un écran provisoire portant son nom. Tout
ce qui viendra ensuite s'y branche sans toucher à la navigation.

---

## Contenu

**Barre du bas, 5 entrées**, fond `fond.canevas`, bordure haute `bordure.discrete` :

| Ordre | Libellé | Icône | Route |
|---|---|---|---|
| 1 | Accueil | `accueil` | `/(client)/accueil` |
| 2 | Explorer | `recherche` | `/(client)/explorer` |
| 3 | Séance | `seance` | `/(client)/seance` |
| 4 | Messages | `message` | `/(client)/messages` |
| 5 | Moi | `profil` | `/(client)/moi` |

- Onglet actif : icône trait 2,2 + libellé en `marque.primaire`, poids 700.
- Onglet inactif : trait 1,75, libellé en `texte.secondaire` (correction §1.3 du design system).
- Pastille de non-lus sur « Messages » : point 8 pt `marque.accent`, **plus le nombre en
  libellé accessible** (« Messages, 3 non lus »).
- Marge basse : `taille.safeBottomIOS` sur iOS, `taille.safeBottomAndroid` sur Android, lues
  depuis les zones sûres du système, jamais codées en dur par plateforme.

**Contenu provisoire de chaque onglet** : le nom de l'écran en `texte.titre1` et la mention
« Lot LX » qui l'apportera. C'est délibérément laid : ça évite de confondre un écran provisoire
avec un écran fini.

---

## États

| État | Comportement |
|---|---|
| Normal | Cinq onglets, le premier actif au démarrage |
| Chargement | La coquille se monte immédiatement, sans attendre de donnée |
| Erreur | Sans objet à ce lot |
| Hors-ligne | Hors périmètre |

---

## Règles

- La barre reste visible pendant les transitions d'onglet ; elle disparaît sur les écrans
  poussés en pile (profil coach, tunnel), **jamais par un réglage d'écran individuel** mais par
  la configuration de la pile.
- L'appui sur l'onglet déjà actif remonte la vue en haut ; le deuxième appui la réinitialise.
- Aucune entrée de la barre ne dépend d'une donnée : la coquille se monte hors ligne comme en
  ligne.
- La bascule vers l'espace coach n'est **pas** dans la barre : elle passera par l'avatar de
  l'onglet « Moi » au lot L1. Ne pas la préparer ici.

---

## Critères d'acceptation

1. Les cinq onglets s'affichent, la navigation fonctionne dans les deux sens.
2. Chaque cible tactile mesure au moins 44 pt de haut et de large — vérifié par test.
3. L'onglet actif est identifiable **sans la couleur** (épaisseur de trait + graisse du libellé).
4. Chaque onglet expose un rôle et un état sélectionné au lecteur d'écran ; VoiceOver annonce
   « Accueil, onglet, sélectionné, 1 sur 5 ».
5. Avec la police système à 200 %, aucun libellé n'est tronqué : la barre grandit en hauteur.
6. Sur un iPhone à encoche et un Android à barre gestuelle, aucun élément ne passe sous la zone
   système.
7. Un test vérifie que la pastille de non-lus rend un libellé accessible contenant le nombre.
8. `npm run verif` passe.
