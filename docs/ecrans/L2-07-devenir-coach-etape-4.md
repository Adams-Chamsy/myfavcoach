# L2-07 · Devenir coach — étape 4/4 : c'est parti (23a)

**Lot** L2 · **Rôle** coach en cours d'activation · **Route**
`app/(onboarding)/devenir-coach-recapitulatif.tsx`
**Référence visuelle** **aucune** — voir `docs/perimetre.md`, 23a (corrigé le 12 septembre,
« étapes 2, 4 »), et la correction n°2 de `L2-06` (cette étape n'est **pas** un écran bancaire,
contrairement à ce que suggère le bouton « Passer aux coordonnées bancaires » de la maquette de
l'étape 3).

---

## Raison d'être

Clore le parcours des quatre étapes, dans l'esprit de l'écran 4 de l'onboarding client
(`app/(onboarding)/4-cest-parti.tsx`) : un point d'arrivée qui confirme ce qui vient de se
passer et dirige vers la suite, plutôt qu'un simple renvoi silencieux vers l'accueil.

---

## Contenu

Titre serif : « C'est parti. »
Sous-titre : « Ton profil est en préparation. Termine-le pendant que ton dossier est examiné. »

Récapitulatif court, trois lignes (miroir de la checklist de l'écran 19, `L2-11`) :

| Ligne | État |
|---|---|
| Photo et bio | fait (étape 2) |
| Pièce d'identité déposée | fait ou en cours, selon l'étape 3 |
| Première offre créée | pas encore fait |

Bouton unique : « Aller à mon espace coach » → mène à l'écran 19 (`L2-11`).

---

## Règles

- Aucun paiement, aucune donnée bancaire ici — voir la correction n°2 de `L2-06`. Si le
  parcours doit un jour collecter des coordonnées de versement, ce sera via l'onboarding
  Stripe Connect Express hébergé (`CLAUDE.md` §2), au lot L4, jamais un formulaire IBAN maison
  à cet endroit.
- Cette étape ne bloque rien : elle informe, elle ne conditionne aucun accès. Le bouton mène
  toujours à l'écran 19, que le dossier soit encore `en_examen` ou déjà `verifiee`.

---

## Ce qui a été inventé pour cette fiche

- L'écran entier : aucune maquette, aucune fiche ne décrit cette étape. Conçu par analogie avec
  la quatrième étape de l'onboarding client (même position dans un parcours à quatre étapes,
  même fonction de clôture) et avec la checklist de l'écran 19 qu'il annonce.
- Le contenu exact du récapitulatif (les trois lignes) : reprend la checklist de l'écran 19
  plutôt que d'inventer un contenu distinct — à confirmer que les deux doivent effectivement
  être identiques.

---

## Critères d'acceptation

1. Accessible uniquement en suite de l'étape 3 (`L2-06`).
2. Le bouton mène à l'écran 19, quel que soit le statut de vérification.
3. Aucune mention de Stripe, d'IBAN ou de coordonnées bancaires dans le rendu — testé.
4. Galerie, deux thèmes.
5. `npm run verif` passe.
