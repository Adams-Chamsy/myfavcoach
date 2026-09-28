# L4-20 · Paiement refusé (20)

**Lot** L4 · **Rôle** client · **Route** `app/(client)/abonnement/[id]/refus.tsx` (nom inventé)
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

En-tête : « Paiement refusé », retour vers l'écran compte (voir Règles).

- Titre : « Ta banque a refusé le paiement » (maquette).
- Motif : « Motif transmis : {libellé du motif}. » (tableau ci-dessous)
- **« Rien n'a été débité. »** — toujours affichée, quel que soit le motif (`docs/domaine.md`
  §4.4 ; `dernierEchec.rienDebite`, `docs/api.md` §7).
- Rappel : offre et montant tentés ; moyen de paiement tenté (4 derniers chiffres, servis par le
  serveur) avec l'étiquette texte « REFUSÉ » — jamais la seule couleur (`CLAUDE.md` §5).
- Action principale : « Changer de moyen de paiement » → page Stripe hébergée (voir Règles).
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

**Un seul contexte : l'échec d'une échéance** (révisé le 28 septembre 2026, P4.2). La maquette
montre le refus à la souscription (« Étape 3 sur 3 ») ; avec la page de paiement hébergée par
Stripe (`docs/backend.md` §13), ce refus s'affiche **dans la page Stripe**, qui laisse réessayer —
l'application ne le reçoit jamais. L'écran 20 sert donc les échecs de prélèvement d'une échéance
(`TentativePrelevement` échouée, abonnement `impaye` ou `suspendu`, `docs/domaine.md` §4.3/§4.4) :

- même titre, même motif, même « Rien n'a été débité » ; plus une ligne qui dit que le suivi
  continue pendant la période de grâce et jusqu'à quand (`dernierEchec.graceJusquAu`,
  `docs/api.md` §7) ;
- l'action « Changer de moyen de paiement » appelle `POST /abonnements/{id}/moyen-paiement`, qui
  rend une page Stripe hébergée où enregistrer le nouveau moyen — même mécanisme que la
  souscription, même retour par `myfavcoach.fr` ;
- **point d'entrée** : la ligne d'un abonnement `impaye` ou `suspendu` dans le bloc « Mes
  abonnements » de l'écran 24 (`docs/ecrans/L4-24b-mes-abonnements.md`) — seul chemin à L4,
  faute de notifications avant L10. C'est lui qui rend démontrable le critère 7 de
  `docs/perimetre.md` §5.

L'en-tête « Paiement · Étape 3 sur 3 » de la maquette ne s'applique plus : en-tête simple
« Paiement refusé », retour vers l'écran compte.

**Le reste :**

- **Magasins d'applications** (`docs/domaine.md` §2) : aucun terme interdit. En particulier,
  jamais « ton accès sera coupé » : c'est le suivi du coach qui s'interrompt, pas un contenu qui
  se verrouille.
- Aucun détail bancaire au-delà du motif et des 4 derniers chiffres ; le motif n'est jamais
  journalisé côté application.
- Changer de moyen de paiement n'engage aucun paiement immédiat depuis l'application : la page
  Stripe enregistre le nouveau moyen, et c'est la relance planifiée suivante (J+1, J+3,
  `docs/domaine.md` §4.4) qui prélève. Pas d'`Idempotency-Key` côté application ici : le
  prélèvement porte la clé de sa `TentativePrelevement` (`docs/backend.md` §13).

---

## États

| État | Comportement |
|---|---|
| `impaye` | Contenu ci-dessus, avec la période de grâce restante |
| `suspendu` | Contenu ci-dessus, « Suivi interrompu » à la place de la période de grâce |
| Moyen de paiement changé | Retour de la page Stripe → relecture de l'abonnement ; « Nouveau moyen enregistré, le prochain essai aura lieu le {date} » (date servie par le serveur) |

---

## Ce qui a été inventé pour cette fiche

- Cinq des six libellés de motif (seul « plafond de carte atteint » vient de la maquette).
- Le contexte « échéance », seul restant : la maquette ne montre que la souscription ; déduit de
  `docs/perimetre.md` §5 critère 7 et de `docs/domaine.md` §4.4.
- Le texte après changement de moyen de paiement.
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
7. Vérification manuelle en mode test Stripe : un échec d'échéance par motif déclenchable (carte de test enregistrée puis prélevée hors session).
8. Galerie, deux thèmes, `impaye` et `suspendu`.
9. `npm run verif` passe.
