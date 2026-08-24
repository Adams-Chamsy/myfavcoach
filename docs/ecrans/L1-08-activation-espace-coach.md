# L1-08 · Activation de l'espace coach

**Lot** L1 · **Rôle** client → coach · **Route** `app/(onboarding)/devenir-coach.tsx`
**Référence visuelle** **aucune — l'écran 23 du dossier est l'étape 3/4 de la vérification, qui
appartient au lot L2**

---

## Raison d'être

Créer le **profil coach**, et rien de plus. Le dossier de design saute directement au dépôt de
pièces (écran 23) ; il manque l'écran qui ouvre l'espace. C'est celui-là.

Ce qu'il fait tenir : un compte reste un compte. Créer le profil coach n'efface pas le profil
client, ne change pas l'adresse e-mail, ne recommence pas d'inscription.

---

## Contenu

En-tête : bouton retour, fil d'étapes **1/4** — c'est bien la première étape du parcours coach,
dont les étapes 2, 3 et 4 arrivent au lot L2.

Titre `texte.titre1` : « Ouvre ton espace coach. »
Sous-titre : « Ton compte reste le même. Tu passeras de l'un à l'autre quand tu veux. »

Trois lignes de réassurance, icône + texte :

| Icône | Texte |
|---|---|
| `securite` | La vérification de ton identité viendra ensuite. Tu peux préparer ton profil avant. |
| `virement` | Pour être payé, il faudra une vérification complète. |
| `favori` | Les 3 premiers mois sont sans commission. |

Deux champs :

| Champ | Obligatoire | Détail |
|---|---|---|
| Discipline | **oui** | Sélection unique dans une liste figée (`src/fixtures/`), pas de saisie libre |
| Téléphone | **oui** | `docs/domaine.md` §3.1 : requis avant de devenir coach. Format français, indicatif fixé |

Pied fixe : bouton primaire « Ouvrir mon espace coach ».

---

## Après validation

1. Le profil coach est créé, en `statutVerification = absente`.
2. Le profil actif passe à `coach`, par la même fonction serveur que la bascule (L1-06).
3. L'application arrive sur l'écran provisoire de pilotage du lot L0.

**L'écran 19 — premier lancement coach, la mise en route 1/3, les revenus à 0 € — appartient
au lot L2.** Ne pas l'esquisser ici.

---

## États

| État | Comportement |
|---|---|
| Normal | Bouton actif quand discipline et téléphone sont renseignés |
| Chargement | Bouton en attente, champs en lecture seule |
| Erreur | `EtatErreur` en bandeau, la saisie est conservée, aucun profil créé à moitié |
| Profil déjà existant | L'écran est inatteignable : la bascule prend le relais |

---

## Règles

- **La création du profil coach est atomique** : profil créé et profil actif changé, ou rien.
  Un profil coach créé sans bascule laisserait l'utilisateur devant un espace qu'il ne voit pas.
- Le prénom, le nom et la photo sont **repris du profil client** s'il existe, sans redemander.
  S'il n'existe pas (arrivée par la porte coach de L1-01), l'écran demande d'abord prénom et
  nom, puis les deux champs ci-dessus.
- La discipline est **unique** et vient d'une liste figée : le classement et la recherche du lot
  L3 en dépendent. Aucune saisie libre, aucun « autre ».
- Rien ici ne touche à la vérification, aux pièces d'identité, aux coordonnées bancaires, aux
  offres ni au prestataire de paiement. Si un prompt t'y conduit, **arrête-toi**.
- La ligne « 3 premiers mois sans commission » est une information, pas un engagement calculé :
  le compteur des 90 jours démarre au premier abonnement actif (`docs/domaine.md` §5.5), pas ici.

---

## Critères d'acceptation

1. Depuis L1-07 sans profil coach, l'écran s'ouvre ; avec profil coach, il est inatteignable.
2. Après validation, l'application est dans l'espace coach, barre encre, et un rechargement
   complet y revient (le profil actif est bien côté serveur).
3. Une erreur serveur pendant la création ne laisse **aucun profil coach partiel** — testé
   contre la base réelle en provoquant l'échec.
4. Un test contre la base réelle prouve qu'un compte ne peut pas créer un profil coach pour un
   autre compte.
5. Un test contre la base réelle prouve qu'un deuxième profil coach sur le même compte est
   refusé par une contrainte, pas seulement par l'écran.
6. Le prénom et le nom sont repris sans nouvelle saisie quand le profil client existe.
7. Aucune importation du module de paiement, aucune lecture de `EXPO_PUBLIC_STRIPE_PK` dans
   l'arbre de cet écran — testé.
8. À 200 %, les trois lignes de réassurance s'étirent sans troncature.
9. L'écran est dans la galerie, **exercé en clair et en sombre**.
10. `npm run verif` passe.
