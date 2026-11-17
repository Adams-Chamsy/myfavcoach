# Porte de sortie de L5 — passée le 17 novembre 2026

Passée par Claude, sous le mandat du 15 novembre 2026 (`docs/decisions-en-attente.md`). Le plan
du lot est `docs/prompts/L5.md` ; tout ce qui a été décidé seul est écrit dans
`docs/decisions-en-attente.md`, pour être relu en une fois.

État du dépôt à la clôture : `npm run verif` vert de bout en bout (907 tests applicatifs, 3 tests
d'accessibilité, 375 tests au banc, 99 tests des fonctions serveur, bundles web, iOS et Android,
six routes du vrai serveur) ; les deux workflows de la CI verts sur `main`, dont le rejeu de toutes
les migrations de zéro, jusqu'à 0079. Ce document fixe l'état à la clôture ; `docs/dette.md` reste
la seule source vivante des dettes.

**Ce que cette porte ne couvre pas.** Rien n'a été vu sur un téléphone (`docs/seance-iphone.md`,
section L5). Et **rien de L5 n'a rencontré Stripe Connect** : la clé du projet de dev n'a pas
accès aux comptes connectés (point 6). Tout ce qui crée un compte de versement ou vire de
l'argent à un coach est prouvé contre un double du prestataire et au banc, jamais contre Stripe.

---

## Les onze commits du lot

| Commit | Étape |
|---|---|
| `0237024` | P5.1 — le plan, le critère « opérationnel », les règles du solde et des versements |
| `454942a` | P5.2 — l'identité fiscale, l'état du compte de versement |
| `681b816` | P5.3 — pas de publication ni de nouvel abonné sans compte opérationnel ni identité complète |
| `61981bb` | P5.4a — le solde et les versements, en base |
| `37fa1b0` | P5.4b — le versement part chez Stripe, le 5 ou sur demande |
| `e5230ac` | P5.5 — HT et TVA sur les factures, facture de commission mensuelle |
| `37639a8` | P5.6 — Revenus, informations de facturation, factures client et coach |
| `a19adc8` | P5.6b, serveur — le rappel de commission |
| `0cda985` | P5.6b, écran — le rappel sur I-01 |
| `204ec13` | Porte — un coach révoqué : offres retirées, abonnements jusqu'à la fin de la période payée |
| `b736a17` | Porte — « 1er » le premier du mois dans les écrans d'abonnement |

---

## Porte de sortie de L5 (onze points)

| # | Point | Constat |
|---|---|---|
| 1 | Écarts fiches / code | Les trois écrans (13 Revenus, C-05 factures, rappel de I-01) ont leur fiche et sont clos dans le navigateur sur la base de dev, par le chemin de l'application (captures : `myfavcoach-captures/L5-ecrans/`, `L5-rappel-commission/`). La clôture a trouvé deux défauts, corrigés avant commit : Revenus ne relisait pas après l'enregistrement de la facturation (test de pile rouge puis vert) ; « 1 février » au lieu de « 1er février ». Une question reste ouverte : le formulaire de facturation n'a pas d'entrée une fois l'identité complète (décision à trancher). |
| 2 | Identité fiscale et compte de versement, dans les deux sens | Banc, famille « identité fiscale et compte de versement — L5 » : le coach lit et écrit la sienne en espace coach, jamais celle d'un autre ; aucune table n'est lisible directement ; la référence Stripe n'atteint jamais l'application. |
| 3 | Les deux règles de `docs/domaine.md` §3.3 | Publication refusée (`identite_fiscale_incomplete`, puis `compte_versement_non_operationnel`) et intention de souscription refusée (`coach_indisponible`, neutre pour le client), au banc. Le banc et les comptes de scénario sont préparés en vendeurs (décision 8). |
| 4 | La machine des versements (§4.8), transition par transition | Banc, famille « solde et versements — L5 » : 20 € au moins, un seul versement prévu ou en cours, 1 € de frais en immédiat, le mensuel le 5 seulement ; versé, échoué (le montant revient au solde), reporté si les fonds ne sont pas disponibles. Tests des fonctions : `executerVersements`, `demanderVersementImmediat`. |
| 5 | Factures complètes | Banc : l'identité fiscale copiée à l'émission ; franchise (HT = TTC, TVA nulle) et assujetti (HT arrondi, TVA = reste) ; une facture de commission par coach et par mois, émise le 1er ; une facture d'un autre ne se lit pas. |
| 6 | **Preuve contre Stripe** (inscription d'un coach, virement) | **NON TENUE.** La clé restreinte du dev répond « This key lacks access to Accounts v2 » (403). Il faut, dans le tableau de bord Stripe, l'écriture sur Accounts v2, Account Links et Transfers (`docs/decisions-en-attente.md`, « En attente du développeur »). **Reportée par décision écrite** : à faire dès que la clé a ces droits, au plus tard à la porte de sortie de L6 ; elle ne bloque aucun écran de L6, qui ne touche pas à l'argent. |
| 7 | Aucune clé secrète dans l'application ; Stripe reste un adaptateur | `secrets-interdits` et `aucun-import-supabase-direct` balaient le dépôt ; tout appel au prestataire passe par une fonction serveur (`coach-identification`, `coach-versements`, `echeances-quotidiennes`). Le relais de test a reçu son secret par `scripts/poser-secret-stripe.sh`, seule voie prévue. |
| 8 | Données de santé | L5 n'en touche aucune : seulement de l'argent et une identité fiscale. Rien de L5 n'écrit au journal un montant rattaché à un client nommé. |
| 9 | Migrations rejouables | La CI rejoue tout de zéro à chaque poussée : verte jusqu'à 0079 (`204ec13`). |
| 10 | Rien hors périmètre | Aucun achat in-app, aucun PDF (décision 6 : les factures sont des écrans), aucune séance à l'unité (retirée de la maquette 13). |
| 11 | Dettes échues à cette porte | Voir ci-dessous. |

### Les dettes échues à cette porte (point 11)

| Dette | Constat |
|---|---|
| SEPA en attente dont le coach est révoqué, et les effets d'une révocation | **Soldée** (0079) : un coach révoqué a les effets d'une suppression de compte, par le filet du matin. Quatre tests au banc, rouges avant la migration. |
| Rappel de commission de I-01 | **Soldée** (P5.6b), close dans le navigateur avec une vraie inscription par le lien et un paiement de test. |
| « 1 février » hors de L5 | **Soldée** : un seul formateur pour les dates écrites en lettres. |
| Preuve contre Stripe Connect | **Reportée** (point 6), échéance : porte de L6. |
| **Supabase Pro** | **Échéance NON TENUE, une seconde fois** : c'est une dépense, seul le développeur peut la faire. Reportée par décision écrite : avant la première séance iPhone du développeur. Tant qu'elle n'est pas faite, le banc partage le dev (les jetables et les factures orphelines y restent) et la protection des mots de passe divulgués reste coupée. |

**Porte close**, avec deux reports écrits (preuve Stripe, Supabase Pro). Reste sur appareil :
`docs/seance-iphone.md`, section L5.

---

## Ce qu'il reste à décider avant L6

Tout est dans `docs/decisions-en-attente.md` ; les plus lourds :

- **Les droits de la clé Stripe** (point 6) : sans eux, aucun coach réel ne pourra être payé.
- **Le juriste** : le mandat de facturation et les mentions de la facture ; les factures en écran
  plutôt qu'en PDF (décision 6) ; aucun remboursement au prorata quand un coach part ou est
  révoqué.
- **Le net du mois** : la maquette 13 (encaissements moins commission) a été suivie, contre
  `docs/domaine.md` §5.8 (moins les versements).
- **Une entrée permanente vers les informations de facturation** pour un coach dont l'identité est
  complète.
