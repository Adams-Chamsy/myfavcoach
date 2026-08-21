# L0-02 · Coquille de navigation coach

**Lot** L0 · **Rôle** coach · **Route** `app/(coach)/_layout.tsx`
**Référence visuelle** `maquettes/MyFavCoach-System_dc.html` (barre coach), écran 08

---

## Raison d'être

Même structure que la coquille client, **fond encre**. Le changement de fond est ce qui rend le
changement d'espace immédiatement lisible : c'est une décision de design, pas une décoration.

---

## Contenu

**Barre du bas, 5 entrées**, fond `fond.inverse`, sans bordure haute :

| Ordre | Libellé | Icône | Route | Particularité |
|---|---|---|---|---|
| 1 | Pilotage | `pilotage` | `/(coach)/pilotage` | |
| 2 | Clients | `clients` | `/(coach)/clients` | |
| 3 | Créer | `ajouter` | action | **Bouton central**, 52 pt, `marque.accentAction`, ouvre une feuille basse |
| 4 | Agenda | `agenda` | `/(coach)/agenda` | |
| 5 | Revenus | `virement` | `/(coach)/revenus` | |

- Actif : `marque.primaire` en version claire du thème sombre local, soit `#58C2A2` — la barre
  encre est **une île sombre dans un thème clair**, elle utilise les tokens `sombre` pour son
  contenu. C'est le seul endroit du jalon 1 où les tokens sombres servent.
- Inactif : `texte.surSombre` à 70 % d'opacité, sans descendre sous 4,5:1.
- « Créer » n'est pas un onglet : c'est une action. Elle ne prend jamais l'état sélectionné et
  ouvre une feuille basse listant « Nouveau programme », « Nouvelle séance », « Nouvelle offre »
  — chaque entrée renvoyant à un écran provisoire au lot L0.

**Contenu provisoire** identique à la coquille client : nom de l'écran + lot qui l'apportera.

---

## États

| État | Comportement |
|---|---|
| Normal | Cinq entrées, « Pilotage » actif au démarrage |
| Coach non vérifié | Hors périmètre L0 — sera traité en L2 |
| Chargement / erreur | Sans objet à ce lot |

---

## Règles

- Le bouton central est le **seul** élément accent de l'écran. Aucun autre accent visible en même
  temps.
- Aucune donnée : la coquille se monte sans appel réseau.
- La bascule vers l'espace client passera par l'avatar en L1, pas par la barre.
- Le fond encre s'étend derrière la zone sûre basse ; le contenu, lui, reste au-dessus.

---

## Critères d'acceptation

1. Les cinq entrées s'affichent, la navigation fonctionne, « Créer » ouvre une feuille basse.
2. « Créer » n'est jamais annoncé comme sélectionné par le lecteur d'écran ; son rôle est
   « bouton », pas « onglet ».
3. Tous les couples texte/fond de la barre atteignent 4,5:1, mesurés par `npm run test:a11y`.
4. Chaque cible tactile ≥ 44 pt, bouton central compris.
5. À 200 % de taille de police, les libellés passent sur deux lignes sans troncature.
6. Un test vérifie qu'aucune valeur de couleur n'est écrite en dur dans le fichier de la barre.
7. Basculer manuellement l'application en `(client)` puis `(coach)` change le fond de barre sans
   remontage complet de l'arbre de navigation.
8. `npm run verif` passe.
