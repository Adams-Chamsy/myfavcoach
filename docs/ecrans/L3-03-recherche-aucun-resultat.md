# L3-03 · Recherche — aucun résultat (14)

**Lot** L3 · **Rôle** client, et visiteur non connecté (`anon`) · **Route** état de
`app/(client)/explorer.tsx` (`L3-02`), pas une route séparée — voir Règles.
**Référence visuelle** `maquettes/MyFavCoach-Etats_dc.html`, bloc « 14 · Recherche vide »,
`data-screen-label="14 Recherche vide"`. **Deux corrections et une construction validée le
13 septembre 2026, lues en Règles.**

---

## Raison d'être

Ce que `L3-02` affiche quand la fonction de recherche rend un ensemble vide. Ne doit jamais
laisser l'écran nu : c'est exactement le cas que `contenuSecondaire` de `EtatVide`
(`src/composants/etats/etat-vide.tsx`) a été conçu pour couvrir depuis L0 (« Proches de ta
recherche »).

---

## Contenu

`EtatVide` : titre (« Personne en {discipline} près de {commune} »), explication, une action
principale optionnelle (voir Règles), et en `contenuSecondaire` une courte liste de coachs
proches de la recherche mais hors filtre strict — même fonction de recherche que `L3-02`, appelée
une seconde fois avec un filtre relâché (voir Règles).

---

## Règles

- **Correction 1/2 — pas de bouton « Me prévenir ».** Retiré du périmètre
  (`docs/perimetre.md` §3, « Alerte de recherche sauvegardée ») : aucune action de ce type,
  même désactivée, même comme un état visuel sans mécanisme derrière (`docs/perimetre.md` §3,
  « Règle pour Claude Code »).
- **Correction 2/2 — pas de filtre « note ≥ 4,5 ».** La puce de filtre actif montrée sur la
  maquette (« 4,5 ★+ ») suppose une donnée de note qui n'existe pour aucun coach au lancement
  (`docs/domaine.md` §5.1) — un tel filtre viderait systématiquement tout résultat, ce qui rend
  cet écran presque impossible à quitter. Ce filtre n'existe pas dans `L3-02`, donc il ne peut
  pas apparaître ici comme puce active.
- **« Ouvrir aux coachs en visio · N résultats » : construit, validé le 13 septembre 2026.** Un
  second appel réel à la fonction de recherche de `L3-02`, avec le filtre de format relâché à
  « visio ou présentiel » (c'est le seul relâchement illustré par la maquette — les autres
  filtres restent inchangés). Le nombre affiché est le total exact rendu par ce second appel,
  jamais un chiffre approché, mis en cache au-delà de la session d'affichage, ou improvisé : un
  bouton qui annonce un nombre faux est pire qu'un bouton absent. N'apparaît pas du tout si le
  format « présentiel » n'est pas le filtre actif (rien à relâcher), ou si le second appel rend
  lui aussi un ensemble vide.
- **Pas une route séparée.** Contrairement à `L2-13`/`L2-14` (routes distinctes pour une même
  fiche visuelle), cet écran est un état de `L3-02` — la fonction de recherche a déjà été
  appelée, il n'y a rien à réinterroger au montage d'une route dédiée.
- **Lecture publique**, comme `L3-02` : fonctionne pour `anon`.

---

## Décision validée le 13 septembre 2026

Le relâchement du filtre de format (présentiel → visio ou présentiel) est le seul relâchement
construit à ce lot — c'est le seul cas illustré par la maquette. Un relâchement de budget ou de
discipline n'est pas construit ici, faute de cas de référence ; à ajouter si un besoin réel
apparaît, pas à deviner maintenant.

---

## Critères d'acceptation

1. Jamais de bouton « Me prévenir », sous aucune forme.
2. Jamais de puce de filtre « note » active (le filtre n'existe pas dans `L3-02`).
3. Le bouton « Ouvrir aux coachs en visio » affiche un nombre venu d'un appel réel à la fonction
   de recherche (filtre de format relâché), jamais approché ni improvisé — et n'apparaît pas
   quand ce relâchement n'a rien à offrir (présentiel non filtré, ou second appel vide aussi).
4. Accessible sans session (`anon`).
5. Galerie, deux thèmes.
6. `npm run verif` passe.
