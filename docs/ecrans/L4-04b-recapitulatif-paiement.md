# L4-04b · Tunnel — récapitulatif et paiement (04b)

**Lot** L4 · **Rôle** client · **Route** `app/(client)/souscription/paiement.tsx` (nom inventé)
**Référence visuelle** `maquettes/MyFavCoach-Client_dc.html`, bloc « 04b · Récapitulatif &
paiement », `data-screen-label="04b Paiement"`. **Trois corrections et un manque, lus en
Règles** : code promo sans règle de domaine, moyen de paiement enregistré qui n'existe pas au
premier achat, et le droit de rétractation, absent de la maquette.

---

## Raison d'être

L'écran où le client voit exactement ce qu'il va payer, choisit carte ou prélèvement SEPA, et
paie. C'est ici que l'argent bouge : toutes les règles d'idempotence (`docs/api.md` §1) et de
non-manipulation des moyens de paiement (`docs/api.md` §15, `CLAUDE.md` §10) s'y appliquent.

---

## Contenu

En-tête : retour (vers 04a), titre « Paiement », indicateur d'étape (voir 04a, « Ce qui a été
inventé »), mention « Sécurisé » (maquette).

**Récapitulatif** — tout vient de `recapitulatif` rendu par `POST /abonnements/intention`
(`docs/api.md` §7), rien n'est calculé par l'écran :

| Ligne | Source |
|---|---|
| Titre de l'offre, coach · discipline | offre choisie en 04a |
| « Abonnement mensuel » + prix | `recapitulatif.prixCentimes` |
| « À payer aujourd'hui » | `recapitulatif.totalCentimes` |
| « Puis le {jour} de chaque mois » | `recapitulatif.jourPrelevement` ; la date du prochain prélèvement en clair (`prochainPrelevementLe`, formatée Europe/Paris) |

**Moyen de paiement** : le composant du SDK du prestataire (`docs/prompts/L4.md` point 2,
dépendance à valider en P4.2), qui propose **carte** et **prélèvement SEPA**
(`moyensAcceptes`). Aucun champ de carte ni d'IBAN n'est un composant de ce dépôt.

**Information précontractuelle** (voir Règles, « Droit de rétractation ») : un emplacement
réservé entre le moyen de paiement et le bouton, dont le texte vient du juriste.

Pied : bouton principal « Payer {total} € », puis « En continuant tu acceptes les conditions
d'abonnement » — « conditions d'abonnement » ouvre les CGV (`docs/ecrans/L2-03-documents-contractuels.md`).

---

## Règles

**Corrections de la maquette :**

1. **Code promo retiré.** La maquette montre « Bienvenue −20 % le 1er mois » et un champ
   « Code promo ». `docs/domaine.md` ne définit ni entité ni règle (qui finance la remise, sur
   quel montant porte alors la commission de 10 %, combien de mois, qui crée les codes).
   **Décidé le 28 septembre 2026** : retiré de l'écran et de `docs/api.md` §7, reporté au
   jalon 2 comme fonctionnalité sans règle (`docs/jalon-2.md`, n° 24) — pas une dette.
2. **« VISA •••• 4218 · 07/28 » et « Ajouter une carte » remplacés par le composant du SDK.**
   Au premier abonnement, aucun moyen de paiement n'existe ; l'application n'en stocke jamais
   aucun (`docs/api.md` §15). Ce que le SDK affiche est ce qui s'affiche.
3. **« Résiliable en 2 appuis » retiré.** Aucune règle ne fixe ce nombre. La résiliation vit
   dans le bloc « Mes abonnements » de l'écran 24 (`docs/ecrans/L4-24b-mes-abonnements.md`) ;
   une promesse chiffrée de sortie qu'on ne mesure pas est pire qu'aucune.

**Droit de rétractation (manque de la maquette, `docs/perimetre.md` §6).** Vente à distance
d'un service à un consommateur : le droit de rétractation de quatorze jours doit être porté à la
connaissance du client **avant** qu'il paie. La maquette n'en dit rien. Cette fiche ne tranche
**rien** du fond — c'est une question de juriste, inscrite comme telle dans
`docs/perimetre.md` §6 :

- le texte exact de l'information, et où il se lit (sur l'écran, ou par un lien vers les CGV) ;
- si le suivi commence avant la fin des quatorze jours (il commence dès le paiement, par
  construction), le recueil de la **demande expresse** du client, et sous quelle forme — une
  case à cocher est un geste d'interface que ce dépôt n'a pas le droit d'inventer ;
- ce que doit le client qui se rétracte après ce début, et comment cela s'articule avec deux
  règles déjà écrites qui semblent le contredire : « résiliation toujours en fin de période
  payée, jamais immédiate » et « aucun prorata » (`docs/domaine.md` §4.3) ;
- qui est le vendeur au sens de ce droit : le coach (`docs/domaine.md` §3.5) ou la plateforme ;
- le libellé du bouton de paiement (le droit de la consommation encadre la formulation du bouton
  qui engage à payer — « Payer {total} € » est à confirmer, pas présumé conforme).

Ce que la fiche fixe, en revanche : **un emplacement dans l'écran**, entre le moyen de paiement
et le bouton, qui ne sera rempli qu'avec le texte validé ; **aucun texte provisoire inventé**
n'y est écrit (même règle que les liens légaux de L1-01, `docs/dette.md`). Le tunnel se développe
et se teste en mode test Stripe sans ce texte ; il **ne passe pas en production** sans lui.

**Le reste :**

- **Magasins d'applications** (`docs/domaine.md` §2) : aucun terme interdit ; « Abonnement
  mensuel » est rattaché à l'offre du coach nommée juste au-dessus.
- **Idempotence** : « Payer » envoie `POST /abonnements` avec une `Idempotency-Key` générée
  **une fois à l'ouverture de l'écran** (ou à la création de l'intention), réutilisée à chaque
  nouvel essai du même paiement — jamais une clé neuve par appui, sans quoi un double appui
  pendant un mauvais réseau créerait deux abonnements (`docs/prompts/L4.md` point 4).
- **Trois réponses** (`docs/api.md` §7) :
  - 201 `actif` → 04c (variante carte ou SEPA, voir `L4-04c`) ;
  - 202 `authentification_requise` → le SDK conduit l'authentification 3-D Secure ; l'écran
    attend, puis relit l'état (`GET /abonnements/{id}`), jamais de conclusion locale ;
  - 402 `paiement_refuse` → écran 20 avec `motifBanque`.
- **Jeton du prestataire expiré** (15 minutes, `docs/api.md` §7) : l'écran redemande une
  intention plutôt que d'échouer ; le récapitulatif affiché est remplacé par le nouveau.
- **Aucune donnée de paiement dans un journal, une URL ou un stockage local** (`CLAUDE.md` §4,
  §10) — ni le jeton, ni l'identifiant du moyen de paiement.
- Le prix affiché vient du serveur ; s'il diffère de celui vu en 04a (le coach a changé son prix
  entre-temps), c'est celui de 04b qui fait foi, et il est celui qui sera figé.

---

## États

| État | Comportement |
|---|---|
| Récapitulatif chargé | Lignes ci-dessus, composant du SDK, bouton « Payer » actif une fois un moyen choisi |
| Paiement en cours | Bouton en chargement, non pressable, retour désactivé |
| Authentification 3-D Secure | Interface du SDK au premier plan ; au retour, relecture de l'état |
| Jeton expiré | Nouvelle intention demandée, récapitulatif remplacé, aucun champ perdu côté SDK si possible |
| Erreur réseau | Message, bouton réactivé ; le nouvel essai réutilise la même `Idempotency-Key` |

---

## Ce qui a été inventé pour cette fiche

- **Moment de création de l'`Idempotency-Key`** (à l'ouverture de l'écran) : `docs/api.md` §1 dit
  qu'elle est obligatoire, pas quand elle naît. À confirmer en P4.2, avec la conception de la
  table.
- ~~Aucun écran de résiliation dans le périmètre~~ — **résolu le 28 septembre 2026** : la
  maquette existait (écran 24, bloc abonnements, écarté en L1). Ajouté comme 24b
  (`docs/ecrans/L4-24b-mes-abonnements.md`) ; la question de conformité reste jointe à celle du
  juriste (`docs/perimetre.md` §6).
- Nom de route `souscription/paiement`.

---

## Critères d'acceptation

1. Aucun montant ni jour de prélèvement n'est calculé par l'écran : tout vient de
   `recapitulatif`.
2. Aucun champ de carte ni d'IBAN n'existe hors des composants du SDK.
3. Carte et SEPA sont proposés, et payables en mode test Stripe (carte de test qui réussit,
   carte de test qui exige 3-D Secure, IBAN de test).
4. Un double appui sur « Payer », ou un nouvel essai après une erreur réseau, ne crée jamais
   deux abonnements (même `Idempotency-Key`, prouvé au banc côté serveur).
5. 201 → 04c ; 202 → 3-D Secure puis relecture ; 402 → écran 20 avec le motif.
6. Aucun champ ni texte « code promo » (reporté au jalon 2) ; aucun moyen de paiement « enregistré » inventé.
7. L'emplacement de l'information sur la rétractation existe et ne contient aucun texte inventé.
8. **Libellés interdits** (`docs/domaine.md` §2) : aucun terme de la liste partagée dans les
   textes rendus ni dans les libellés d'accessibilité.
9. Aucune donnée de paiement dans un journal, une URL, un stockage local (vérifié par lecture de
   code et par le test existant d'ESLint sur les clés secrètes).
10. Galerie, deux thèmes (le composant du SDK remplacé par un bloc neutre dans la galerie).
11. `npm run verif` passe.
