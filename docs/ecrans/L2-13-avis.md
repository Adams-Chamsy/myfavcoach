# L2-13 · Profil coach — onglet Avis (27)

**Lot** L4 (**replanifié depuis L2 le 12 septembre 2026**, `docs/perimetre.md` §2/§4 — voir
Règles) · **Rôle** client, et visiteur non connecté (`anon`) · **Route**
`app/(client)/coach/[id]/avis.tsx` (ou onglet de `L2-12`, voir Règles)
**Référence visuelle** `maquettes/MyFavCoach-Parcours_dc.html`, bloc « 27 · Profil coach —
onglet Avis », `data-screen-label="27 Avis"`.

**Ce qui est déjà livré, à L2, et le reste au jalon 1** : l'onglet existe
(`app/(client)/coach/[id].tsx`, `OngletAvis`) et affiche un état vide honnête — **pas un
placeholder en attente de L4, l'état normal de tous les profils au lancement**, tant qu'aucun
abonnement ne rend un dépôt possible (voir Règles). Le reste de cette fiche (moyenne, filtre par
étiquette, liste d'avis) décrit ce que `L4` construit par-dessus cet état vide, pas ce qui
manque à L2.

---

## Contenu

En-tête : retour, avatar + nom du coach, onglets Offres/Avis/Parcours (Avis actif).

Bloc note : moyenne (`docs/domaine.md` §5.1, arrondie au dixième, affichée à partir de 5 avis
publiés seulement), étoiles, nombre d'avis, distribution par étoile (comptage simple par
valeur). En dessous de 5 avis, jamais de moyenne ni de badge « Nouveau » — à 1-4 avis, la liste
d'avis en dessous s'affiche telle quelle sans bloc note ; à 0 avis, l'onglet entier devient un
état vide honnête (révisé le 12 septembre 2026).

Filtres par étiquette : « Tous » + les étiquettes réellement portées par au moins un avis publié
de ce coach (0 à 3 par avis, liste figée de 8, `docs/domaine.md` §3.11, arbitrage #16).

Liste d'avis publiés : auteur (prénom + initiale du nom), ancienneté d'abonnement, offre
souscrite, étoiles, texte, réponse du coach le cas échéant.

---

## Règles

- **Replanifiée depuis L2, pas un écran non livré** : la condition de dépôt d'un avis
  (`docs/domaine.md` §3.11 — abonnement actif ≥ 30 jours ou résilié ≤ 60 jours) ne peut être
  vérifiée avant que `Abonnement` existe (L4) — aucune insertion légitime n'est possible plus
  tôt. La distinction avec « pas encore construit » compte : ce n'est plus une dette de L2
  (`docs/dette.md` ne la liste plus), c'est une dépendance réelle, écrite ici et dans
  `docs/perimetre.md`.
- **Lecture inter-comptes** (`docs/backend.md` §8), même famille que `L2-12` : seuls les avis
  `statut = publie` sont lisibles ici — jamais un avis `signale` ou `masque`, pour aucun
  lecteur, propriétaire de l'avis excepté.
- Sous 5 avis publiés : jamais de badge « Nouveau », aucune moyenne ni tri par note
  (`docs/domaine.md` §5.1, révisé le 12 septembre 2026) — l'onglet reste accessible, il affiche
  simplement moins : les avis un par un entre 1 et 4, un état vide honnête à 0.
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

**Déjà vrai à L2, jalon 1** :

1. À 0 avis (tous les profils, au lancement) : état vide honnête, jamais de badge « Nouveau »,
   ni note ni compteur.
2. Accessible sans session (`anon`).
3. Galerie, deux thèmes.
4. `npm run verif` passe.

**Reste à construire à L4**, une fois `avis` réelle et un dépôt possible :

5. Un avis `signale` ou `masque` n'apparaît jamais, quel que soit le compte qui consulte —
   testé pour `anon` et pour un autre client.
6. Entre 1 et 4 avis : les avis un par un, sans moyenne calculée. À 5 avis ou plus : moyenne,
   étoiles, distribution.
7. Le filtre par étiquette ne montre que les étiquettes réellement portées par un avis publié.
