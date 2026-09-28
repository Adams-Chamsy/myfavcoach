# L4-04c · Tunnel — confirmation d'abonnement (04c)

**Lot** L4 · **Rôle** client · **Route** `app/(client)/souscription/confirmation.tsx` (nom
inventé)
**Référence visuelle** `maquettes/MyFavCoach-L2_dc.html` (malgré le nom du fichier), bloc
« 04c · Confirmation d'abonnement », `data-screen-label="04c Confirmation abonnement"`.
`docs/perimetre.md` la disait absente du dossier, à tort (corrigé le 28 septembre 2026).
**Six corrections, lues en Règles**, et **deux variantes de texte, carte et SEPA**, que la
maquette ne distingue pas.

---

## Raison d'être

Dire au client, sans ambiguïté, ce qui vient de se passer : combien il a payé (ou va payer),
quand aura lieu le prochain prélèvement, et comment arrêter. C'est aussi l'écran qui empêche le
retour arrière vers le paiement.

---

## Contenu

Coche de succès (maquette), puis un titre, un sous-titre, un récapitulatif et une action.

**Variante carte** (paiement confirmé à la réponse 201) :

- Titre : « C'est parti avec {prénom du coach} »
- Sous-titre : l'engagement humain de l'offre, en une phrase (`Offre.engagementHumain`)
- Récapitulatif :

| Ligne | Source |
|---|---|
| Offre, coach · commune de base | offre, `ProfilCoach.communeBase` si renseignée |
| « Payé aujourd'hui » | montant de la facture de la souscription, servi par le serveur |
| « Prochain prélèvement » | `prochainePrelevementLe`, formaté Europe/Paris (« 12 octobre ») |
| « Carte » | 4 derniers chiffres, servis par le serveur depuis le prestataire — jamais stockés par l'application |

**Variante SEPA** (mandat accepté, premier prélèvement **pas encore confirmé** par la banque —
la confirmation d'un prélèvement SEPA arrive en différé, parfois plusieurs jours après) :

- Titre : « Ta demande est enregistrée »
- Sous-titre : « Ton prélèvement de {montant} € est en cours auprès de ta banque. Ton suivi
  avec {prénom} commence dès qu'elle l'a confirmé. » — aucun accord de genre, aucune promesse de
  notification (L10)
- Récapitulatif : même tableau, avec « Prélèvement en cours » au lieu de « Payé aujourd'hui »,
  et « Prélèvement SEPA · IBAN •••• {4 derniers} » au lieu de « Carte »

Dans les deux variantes : « Tu peux arrêter quand tu veux, l'arrêt prend effet à la fin du mois
payé. » (même phrase que 04a), placée **en tête du récapitulatif**, pas en bas — la maquette le
justifie elle-même : une résiliation facile à trouver produit moins d'oppositions bancaires.

Action unique : « Voir le profil de {prénom} » (retour au profil coach, `L2-12`), et la
navigation normale de l'espace client reste disponible.

---

## Règles

**Corrections de la maquette :**

1. **« Tu es suivie par Yannick » → « C'est parti avec {prénom} ».** La maquette accorde au
   féminin sans connaître le client : aucune donnée de genre n'existe dans `docs/domaine.md`
   (§3.2), et l'interface ne devine jamais un genre à partir d'un prénom.
2. **« Il a été prévenu » retiré.** Même raison pour « Il » ; et aucune notification n'existe
   avant L10 (`docs/perimetre.md` §4) — l'écran ne peut pas affirmer ce que le produit ne fait
   pas encore.
3. **« Ton premier programme arrive sous 48 h » retiré.** Aucune règle du domaine ne fixe ce
   délai ; c'est une promesse au nom du coach, qui n'a rien signé de tel. Remplacé par
   l'engagement humain de l'offre, qui, lui, est ce que le coach a réellement déclaré.
4. **« Ta facture est dans Compte · Paiements » retiré.** L'écran des factures (C-05) est L5
   (`docs/perimetre.md` §2) : à L4, il n'existe pas.
5. **Bloc « La suite » et bouton « Répondre aux questions santé » retirés à L4.** Le
   questionnaire santé (05a) est L6 : le bouton mènerait à un écran qui n'existe pas. La maquette
   a raison sur le fond (c'est le bon endroit pour l'amener) — **à réintroduire en L6**, dette à
   inscrire (voir `docs/prompts/L4.md`, P4.1 point 6).
6. **« Payé aujourd'hui 49,00 € » alors que 04b affichait 39,20 €** : incohérence interne du jeu
   de maquettes (la remise de 04b, retirée, voir `L4-04b`). Le montant affiché est celui que
   rend le serveur, jamais une valeur de maquette.

**Le reste :**

- **Pas de retour vers le paiement.** L'arrivée sur 04c remplace les écrans du tunnel dans la
  pile (04a, 04b ne sont plus derrière) : le bouton retour, le geste iOS et le retour matériel
  Android ramènent au profil coach, jamais à « Payer ». Propriété de pile, donc testée par
  `renderRouter` (`CLAUDE.md` §8), pas par un test d'écran isolé.
- **Magasins d'applications** (`docs/domaine.md` §2) : aucun terme interdit.
- **La variante vient de l'état serveur**, jamais du moyen choisi dans la page Stripe : 04c
  n'est atteint que lorsque `POST /abonnements/intention/{id}/constat` rend `abonne`
  (`docs/api.md` §7, flux Checkout décidé le 28 septembre 2026), et affiche la variante SEPA tant
  que l'abonnement est `en_attente_confirmation`. Un simple retour depuis la page Stripe ne suffit
  jamais à l'afficher.
- **Ce que 04c n'affiche jamais : le retour sans confirmation.** Un client qui a fermé le
  navigateur en plein paiement, ou dont le paiement est reçu par Stripe mais pas encore
  transformé en abonnement (`non_terminee`, `expiree`, `paiement_recu`), **reste sur 04b**, qui
  porte ces états (`docs/ecrans/L4-04b-recapitulatif-paiement.md`, « Retour sans confirmation »).
  La variante SEPA de 04c n'en est pas un substitut : elle décrit un abonnement **créé** dont la
  banque doit encore confirmer le premier prélèvement — une situation connue, durable, avec un
  abonnement consultable dans 24b. « On ne sait pas encore » et « c'est en cours à la banque »
  sont deux messages différents, et l'un ne doit jamais s'afficher à la place de l'autre.
- Aucun montant n'est calculé par l'écran.

---

## États

| État | Comportement |
|---|---|
| Carte, paiement confirmé | Variante carte |
| SEPA, prélèvement en cours (`en_attente_confirmation`) | Variante SEPA |
| SEPA, prélèvement confirmé pendant que l'écran est ouvert | À la prochaine ouverture seulement : aucun rafraîchissement en direct à L4 |
| Erreur de lecture | État d'erreur générique (`L0-03`) avec « Réessayer » ; jamais un faux succès |

---

## Ce qui a été inventé pour cette fiche

- ~~L'état de l'abonnement pendant un prélèvement SEPA non confirmé~~ — **tranché le
  28 septembre 2026** : état `en_attente_confirmation`, écrit dans `docs/domaine.md` §4.3 (suivi
  pas encore ouvert, `annule` en cas de rejet). L'écran lit cet état pour choisir la variante SEPA.
- Sous-titre de la variante SEPA : « prévenu·e » écarté pour « Ton suivi commence dès qu'elle
  l'a confirmé » — ni accord de genre, ni promesse d'une notification qui n'existe pas avant L10.
- Titres « C'est parti avec {prénom} » et « Ta demande est enregistrée ».
- Action unique « Voir le profil de {prénom} » (la maquette n'en a pas d'autre que 05a, retirée).
- Nom de route.

---

## Critères d'acceptation

1. Carte : « Payé aujourd'hui », le montant du serveur, le prochain prélèvement, les 4 derniers
   chiffres.
2. SEPA : jamais « Payé » tant que le prélèvement n'est pas confirmé côté serveur ; « Prélèvement
   en cours » à la place.
2 bis. 04c ne s'affiche jamais sans abonnement créé : `non_terminee`, `expiree` et
   `paiement_recu` restent sur 04b, et ne produisent jamais la variante SEPA.
3. Aucune formulation genrée pour le client ni pour le coach ; aucune promesse de délai du coach ;
   aucune mention d'une facture consultable ni du questionnaire santé à L4.
4. La phrase de résiliation est au-dessus du récapitulatif.
5. Après 04c, aucun geste de retour ne ramène à 04b ni à 04a — test `renderRouter`.
6. **Libellés interdits** (`docs/domaine.md` §2) : aucun terme de la liste partagée.
7. Galerie, deux thèmes, les deux variantes.
8. `npm run verif` passe.
