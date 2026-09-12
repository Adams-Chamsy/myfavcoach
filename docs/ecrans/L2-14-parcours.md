# L2-14 · Profil coach — onglet Parcours (28)

**Lot** L2 · **Rôle** client, et visiteur non connecté (`anon`) · **Route**
`app/(client)/coach/[id]/parcours.tsx` (ou onglet de `L2-12`, même remarque que `L2-13`)
**Référence visuelle** `maquettes/MyFavCoach-Parcours_dc.html`, bloc « 28 · Profil coach —
onglet Parcours », `data-screen-label="28 Parcours"`. **Simplifié en texte libre au jalon 1 —
voir Règles et `docs/dette.md`.**

---

## Contenu

En-tête : retour, avatar + nom, onglets (Parcours actif).

- **Parcours** : **un seul bloc de texte libre**, écrit par le coach (diplômes, expérience,
  méthode réunis en un paragraphe continu) — pas trois blocs structurés comme la maquette les
  distingue. Aucun badge « vérifié » par diplôme individuel.
- **Langues et délai de réponse** : `docs/domaine.md` §3.2 (`langues`) et §5.4 (délai calculé,
  paliers, non affiché sous 5 échanges).

---

## Règles

- **Simplification assumée, pas un oubli.** La maquette distingue diplômes structurés (nom,
  année, badge « vérifié »), chronologie d'expérience et méthode. `docs/domaine.md` ne définit
  aucune entité pour porter cette structure — dette inscrite (`docs/dette.md`), pas comblée à ce
  lot. Le champ affiché ici est un texte libre unique, sans tri ni filtre.
- **Aucun badge « vérifié » par diplôme** : le seul statut de vérification qui existe est celui
  du dossier entier (`profils_coach.statut_verification`, `docs/domaine.md` §4.2) — pas de
  vérification pièce par pièce. Ne pas construire un badge que rien ne peut nourrir.
- Lecture inter-comptes (`docs/backend.md` §8) : ce contenu est public dès que le coach est
  consultable, sans condition d'abonnement.
- Le délai de réponse suit exactement `docs/domaine.md` §5.4 : médiane sur 30 jours, paliers,
  jamais affiché en dessous de 5 échanges, jamais de présence en temps réel.

---

## Ce qui a été inventé pour cette fiche

- La colonne qui porte ce texte libre (sur `ProfilCoach`, ou une table à une ligne par coach) :
  non tranchée, laissée à l'implémentation.

---

## Critères d'acceptation

1. Le bloc « Parcours » affiche du texte libre, sans structure imposée.
2. Aucun badge « vérifié » par diplôme n'apparaît nulle part.
3. Accessible sans session (`anon`).
4. Le délai de réponse n'est jamais affiché sous 5 échanges.
5. Galerie, deux thèmes.
6. `npm run verif` passe.
