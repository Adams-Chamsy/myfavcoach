# L2-05 · Devenir coach — étape 2/4 : profil public (23a)

**Lot** L2 · **Rôle** coach en cours d'activation · **Route** `app/(onboarding)/devenir-coach-profil.tsx`
**Référence visuelle** **aucune — absente du dossier** (`docs/perimetre.md`, 23a, « étapes
2, 4 »).

**Corrigé le 12 septembre** : la ligne 23a de `docs/perimetre.md` comptait à tort l'étape 1,
déjà livrée en L1 (`docs/ecrans/L1-08-activation-espace-coach.md`). Cette fiche couvre l'étape
2 ; l'étape 4 a sa propre fiche (`L2-07`).

---

## Raison d'être

Compléter le profil public du coach avant la vérification (étape 3) : photo, bio, titre court —
les champs que `0001_creer_identite.sql` réserve déjà (`profils_coach.photo_url`, `titre_court`,
`bio`) mais qu'aucun écran de L1 n'écrit (le commentaire de la migration le dit explicitement :
« titre_court et bio ne sont pas collectés à l'activation [...] ils arrivent via
docs/ecrans/L1-09 »). L'écran 19 (`docs/ecrans/L2-11`) montre « Photo et bio renseignées » comme
première étape déjà cochée d'une checklist à trois items — cette fiche est l'endroit où cette
case se coche.

---

## Contenu

En-tête : fil d'étapes **2/4**.

Titre : « Présente-toi. »
Sous-titre : « C'est ce que les clients verront en premier sur ton profil. »

Champs :

| Champ | Obligatoire | Détail |
|---|---|---|
| Photo | non | Même mécanisme que le reste du profil : **aucun stockage réel n'existe** (`docs/dette.md`, « ni photo ni commune ») — ce champ reste donc **retiré**, pas grisé, tant que Supabase Storage n'est pas en place. Ne pas le construire ici. |
| Titre court | oui | Une ligne, ex. « Préparateur physique certifié » — texte libre, longueur à borner (valeur non trouvée dans le dossier, à fixer) |
| Bio | oui | Texte long, quelques lignes — pas de longueur maximale trouvée dans le dossier |

Pied fixe : « Continuer ».

---

## Règles

- **Photo retirée, pas grisée** : même raisonnement que `docs/dette.md` pour l'onboarding
  client et « Mes informations » — un champ qui ne peut rien enregistrer est pire qu'un champ
  absent.
- Titre court et bio sont les mêmes colonnes que celles éditées plus tard dans
  « Mes informations » (`docs/ecrans/L1-09-mes-informations.md`) — pas de duplication de
  logique, le même mécanisme d'écriture (`enregistrerInformations`, si le nom tient) s'applique
  ici comme là.
- Cette étape ne touche à aucune donnée de vérification, ni à discipline/téléphone (déjà
  acquis à l'étape 1) : si un prompt t'y conduit, arrête-toi.

---

## Ce qui a été inventé pour cette fiche

- L'existence et le contenu même de cette étape : perimetre.md ne décrit **aucun** contenu pour
  « étape 2 », seulement son numéro. Déduit du commentaire de migration sur `titre_court`/`bio`
  et de la checklist de l'écran 19 (« Photo et bio renseignées ») — cohérent avec deux sources
  indépendantes, mais jamais confirmé par une maquette ou une fiche.
- Les longueurs de champ (titre court, bio) : aucune valeur trouvée, à fixer avant de coder.
- Le nom de route.

---

## Critères d'acceptation

1. Accessible uniquement en suite de l'étape 1 (L1-08), jamais isolément.
2. Bouton « Continuer » actif seulement quand titre court et bio sont renseignés.
3. Après validation, `profils_coach.titre_court` et `.bio` sont écrits ; l'écran 19 affiche
   ensuite cette case cochée.
4. Aucune importation du module de paiement, aucune lecture de `EXPO_PUBLIC_STRIPE_PK`.
5. Galerie, deux thèmes.
6. `npm run verif` passe.
