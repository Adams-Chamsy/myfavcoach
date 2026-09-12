# L2-13 · Profil coach — onglet Avis (27)

**Lot** L2 · **Rôle** client, et visiteur non connecté (`anon`) · **Route**
`app/(client)/coach/[id]/avis.tsx` (ou onglet de `L2-12`, voir Règles)
**Référence visuelle** `maquettes/MyFavCoach-Parcours_dc.html`, bloc « 27 · Profil coach —
onglet Avis », `data-screen-label="27 Avis"`.

---

## Contenu

En-tête : retour, avatar + nom du coach, onglets Offres/Avis/Parcours (Avis actif).

Bloc note : moyenne (`docs/domaine.md` §5.1, arrondie au dixième, affichée à partir de 5 avis),
étoiles, nombre d'avis, distribution par étoile (comptage simple par valeur).

Filtres par étiquette : « Tous » + les étiquettes réellement portées par au moins un avis publié
de ce coach (0 à 3 par avis, liste figée de 8, `docs/domaine.md` §3.11, arbitrage #16).

Liste d'avis publiés : auteur (prénom + initiale du nom), ancienneté d'abonnement, offre
souscrite, étoiles, texte, réponse du coach le cas échéant.

---

## Règles

- **Lecture inter-comptes** (`docs/backend.md` §8), même famille que `L2-12` : seuls les avis
  `statut = publie` sont lisibles ici — jamais un avis `signale` ou `masque`, pour aucun
  lecteur, propriétaire de l'avis excepté.
- Sous 5 avis publiés : badge « Nouveau », aucune moyenne ni tri par note (`docs/domaine.md`
  §5.1) — l'onglet reste accessible, il affiche simplement moins.
- Aucune extraction automatique de thème : les étiquettes sont celles que l'auteur a lui-même
  cochées au dépôt, jamais recalculées ou devinées côté serveur (arbitrage #16).

---

## Ce qui a été inventé pour cette fiche

- Le découpage en route séparée vs. onglet d'un même écran que `L2-12` : les deux fiches
  partagent une seule en-tête et les mêmes onglets dans la maquette ; cette fiche les traite
  comme des routes distinctes par cohérence avec le reste du dépôt (une route par écran
  numéroté), à réconcilier si l'implémentation choisit un seul écran à onglets internes.

---

## Critères d'acceptation

1. Un avis `signale` ou `masque` n'apparaît jamais, quel que soit le compte qui consulte —
   testé pour `anon` et pour un autre client.
2. Sous 5 avis, badge « Nouveau », aucune moyenne affichée.
3. Le filtre par étiquette ne montre que les étiquettes réellement portées par un avis publié.
4. Accessible sans session (`anon`).
5. Galerie, deux thèmes.
6. `npm run verif` passe.
