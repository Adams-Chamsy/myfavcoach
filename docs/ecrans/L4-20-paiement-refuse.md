# L4-20 · Paiement refusé (20)

**Lot** L4 · **Rôle** client · **Route** `app/(client)/souscription/refus.tsx` (nom inventé)
**Référence visuelle** `maquettes/MyFavCoach-Etats_dc.html`, bloc « 20 · Paiement refusé »,
`data-screen-label="20 Paiement refuse"`. **Trois corrections, lues en Règles.**

---

## Raison d'être

Dire au client que sa banque a refusé, **pourquoi** (le motif transmis, jamais un message
générique, `docs/domaine.md` §4.4), que **rien n'a été débité**, et lui donner un moyen de
réessayer. Critère de sortie du jalon (`docs/perimetre.md` §5, critère 7) : un échec produit
l'écran 20 sans coupure immédiate d'accès.

---

## Contenu

En-tête : identique à 04b (retour, « Paiement », indicateur d'étape).

- Titre : « Ta banque a refusé le paiement » (maquette, et `title` du 402 de `docs/api.md` §7).
- Motif : « Motif transmis : {libellé du motif}. » (tableau ci-dessous)
- **« Rien n'a été débité. »** — toujours affichée, quel que soit le motif (`docs/domaine.md`
  §4.4 ; `rienDebite: true` du 402).
- Rappel : offre et montant tentés ; moyen de paiement tenté (4 derniers chiffres, servis par le
  serveur) avec l'étiquette texte « REFUSÉ » — jamais la seule couleur (`CLAUDE.md` §5).
- Action principale : « Réessayer avec un autre moyen de paiement » → rouvre le composant du SDK
  (carte ou SEPA).
- Phrase d'aide : « Tu peux aussi payer par prélèvement SEPA. » (seulement si le moyen refusé
  était une carte).

**Les six motifs** (`docs/api.md` §7, liste close) :

| `motifBanque` | Libellé affiché après « Motif transmis : » |
|---|---|
| `fonds_insuffisants` | « fonds insuffisants » |
| `carte_expiree` | « carte expirée » |
| `opposition` | « carte en opposition » |
| `plafond_atteint` | « plafond de carte atteint » (texte exact de la maquette) |
| `authentification_echouee` | « l'authentification auprès de ta banque n'a pas abouti » |
| `inconnu` | « ta banque n'a pas précisé de motif » |

**Vérifié : la maquette n'introduit aucun septième motif.** Le seul motif qu'elle affiche est
« plafond de carte atteint », soit `plafond_atteint`. La traduction des codes de refus de Stripe
vers ces six valeurs est une table côté serveur (P4.5), jamais faite par l'application ; tout
code non prévu tombe sur `inconnu`, jamais sur un septième libellé.

---

## Règles

**Corrections de la maquette :**

1. **« ta place chez Yannick est gardée 30 minutes » retiré.** Aucune notion de place, de
   capacité ou de réservation temporaire n'existe dans `docs/domaine.md` : la phrase promet un
   mécanisme qui n'existe pas.
2. **« Prévenir Yannick et payer plus tard » retiré.** Aucun mécanisme de paiement différé dans le
   domaine, et prévenir le coach suppose la messagerie (L8) ou les notifications (L10).
3. **« mise en place en 2 jours, aucun plafond » retiré** de la phrase SEPA. Deux affirmations
   factuelles sur le fonctionnement bancaire que rien dans le dépôt ne vérifie ; la phrase garde
   l'option, pas les promesses.

**Deux contextes, un seul écran :**

- **À la souscription** (402 de `POST /abonnements`, depuis 04b) — le seul contexte que la
  maquette montre (« Étape 3 sur 3 »). Aucun abonnement n'existe (`docs/domaine.md` §3.4bis) ;
  réessayer repart du même récapitulatif.
- **À une échéance** (`TentativePrelevement` échouée, abonnement `impaye`, `docs/domaine.md`
  §4.3/§4.4). Même titre, même motif, même « Rien n'a été débité », plus une ligne qui dit que
  le suivi continue pendant la période de grâce et jusqu'à quand (`GET /abonnements/{id}`,
  « période de grâce restante », `docs/api.md` §7) ; l'action appelle
  `POST /abonnements/{id}/moyen-paiement`. **Point d'entrée** (tranché le 28 septembre 2026) :
  la ligne d'un abonnement `impaye` dans le bloc « Mes abonnements » de l'écran 24
  (`docs/ecrans/L4-24b-mes-abonnements.md`) — seul chemin à L4, faute de notifications avant
  L10. C'est lui qui rend démontrable le critère 7 de `docs/perimetre.md` §5.

**Le reste :**

- **Magasins d'applications** (`docs/domaine.md` §2) : aucun terme interdit. En particulier,
  jamais « ton accès sera coupé » : c'est le suivi du coach qui s'interrompt, pas un contenu qui
  se verrouille.
- Aucun détail bancaire au-delà du motif et des 4 derniers chiffres ; le motif n'est jamais
  journalisé côté application.
- Un nouvel essai après refus est un **nouveau** paiement pour le prestataire, mais le même
  abonnement pour nous : la règle d'`Idempotency-Key` (réutilisée ou renouvelée après un 402)
  est à fixer en P4.2 avec la table — cette fiche ne la présume pas.

---

## États

| État | Comportement |
|---|---|
| Refus à la souscription | Contenu ci-dessus, sans ligne de période de grâce |
| Refus à une échéance | Contenu ci-dessus, avec la période de grâce restante |
| Nouvel essai en cours | Bouton en chargement ; succès → 04c (souscription) ou retour à l'écran d'origine (échéance) ; nouveau refus → cet écran, motif mis à jour |

---

## Ce qui a été inventé pour cette fiche

- Cinq des six libellés de motif (seul « plafond de carte atteint » vient de la maquette).
- Le contexte « échéance » : la maquette ne montre que la souscription ; déduit de
  `docs/perimetre.md` §5 critère 7 et de `docs/domaine.md` §4.4.
- Le libellé « REFUSÉ » (la maquette écrit « REFUSÉE », accordé à « carte » ; le masculin couvre
  aussi le prélèvement SEPA).
- Nom de route.

---

## Critères d'acceptation

1. Chacun des six motifs affiche son libellé ; un code inconnu du serveur n'affiche jamais autre
   chose que le libellé d'`inconnu`.
2. « Rien n'a été débité. » est présent pour chacun des six motifs (test paramétré).
3. Le statut « REFUSÉ » est porté par un texte, pas seulement par une couleur.
4. Aucune promesse de place gardée, de paiement différé, ni de délai SEPA.
5. Contexte échéance : la période de grâce restante est affichée et vient du serveur.
6. **Libellés interdits** (`docs/domaine.md` §2) : aucun terme de la liste partagée.
7. Vérification manuelle en mode test Stripe : une carte de test par motif déclenchable.
8. Galerie, deux thèmes, les deux contextes.
9. `npm run verif` passe.
