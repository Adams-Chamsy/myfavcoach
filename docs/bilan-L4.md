# Portes de sortie de L1, L3bis et L4 — passées le 16 novembre 2026

Passées par Claude, sous le mandat du 15 novembre 2026 (`docs/decisions-en-attente.md` : « chaque
porte de sortie de lot, tu la passes et tu la commites, et ce qui reste à voir sur appareil va
dans une seule liste »). Les prompts de porte demandaient « ne modifie rien avant que je valide » :
le mandat remplace cette attente, et tout ce qui a été décidé seul est écrit dans
`docs/decisions-en-attente.md` pour être relu.

État du dépôt à la clôture : `npm run verif` vert de bout en bout (870 tests applicatifs, 3 tests
d'accessibilité, 331 tests au banc, 76 tests des fonctions serveur, bundles web, iOS et Android,
six routes du vrai serveur) ; les deux workflows de la CI verts sur `main`, dont le rejeu de
toutes les migrations de zéro, jusqu'à 0068, sur une pile vide. Ce document fixe l'état à la
clôture ; `docs/dette.md` reste la seule source vivante des dettes.

**Ce que ces portes ne couvrent pas** : rien n'a été vu sur un téléphone. Tout ce qui ne se voit
que là est dans `docs/seance-iphone.md`. Et une échéance n'est pas tenue : le passage en Supabase
Pro (voir la porte de L4, point 14).

---

## Porte de sortie de L1 (sept points)

Rejouée en lecture seule le 1er novembre 2026 ; elle attendait depuis un commit de clôture.

| # | Point | Constat |
|---|---|---|
| 1 | Écarts fiches / code | **Pas refait fiche par fiche le 16 novembre.** S'appuie sur la revue du 1er novembre et sur ce qui a été corrigé depuis, chaque fois clos dans le navigateur : la porte coach de la bienvenue (D), « Retour à la connexion » (B2), la garde des adresses privées, les lectures qui retombaient sur une valeur par défaut. La fiche L1-01 a été réécrite avec l'accueil visiteur (`125fed3`, le développeur). |
| 2 | Chaque politique de 0002, dans les deux sens | La revue du 1er novembre avait trouvé quatre politiques sans preuve nommée de leur accès légitime. Deux sont retirées (0051, l'écriture directe d'un profil est fermée ; `creer_profil_client` et `creer_profil_coach` ont leurs tests). Les deux autres ont leur test nommé depuis le 16 novembre (`3bf8f73`). Plus aucun trou connu. |
| 3 | Aucun écran n'importe le client Supabase ni n'écrit `profil_actif` | Tenu par deux tests qui balaient le dépôt : `aucun-import-supabase-direct` et `ecriture-etat-profils-passe-par-le-fournisseur`. |
| 4 | Rien de L1 ne touche à Stripe, aux offres, aux abonnements, à la vérification ou aux notifications | Vrai à la clôture de L1 ; sans objet depuis, les lots suivants ayant construit ces sujets dans leurs propres dossiers. |
| 5 | Migrations rejouables de zéro | La CI le fait à chaque poussée (`Banc RLS` : `supabase db reset`, puis le banc). Verte sur `4f082c0`, jusqu'à 0068. |
| 6 | Données de santé : écrites où, transitent par où | Le poids de départ (onboarding) et le consentement santé. `donnees-sante-hors-journal` prouve que le poids n'atteint ni journal, ni navigation, ni adresse (`eb99f4e`). Protégé en base par le consentement (0004), et la liste des types de consentement est fermée (0067). |
| 7 | `docs/dette.md` | Aucune ligne ouverte ne touche à l'isolation des profils ni aux données de santé (relu le 16 novembre). |

**Porte close.** Reste sur appareil : `docs/seance-iphone.md`, section L1.

---

## Porte de sortie de L3bis (dix points)

Rejouée en lecture seule le 1er novembre 2026, point 8 corrigé ce jour-là.

| # | Point | Constat |
|---|---|---|
| 1 | Écarts fiches / code | Un écart connu : **le rappel de commission de I-01 n'existe pas** (critère 6). Reporté à L5b par décision écrite du 16 novembre : il demande une date et deux montants que seul le serveur peut rendre, et que L5 construit. |
| 2 | Lecture étroite coach → invité, et création du lien | Blocs du banc « la lecture étroite par le coach, dans les deux sens » et « la liaison compte → invitation, à l'inscription ». |
| 3 | Ce qu'un compte non connecté lit par I-02 | Une ligne de profil coach par jeton, les colonnes du profil public ; garde nommée dans `garde-profil-coach-public`. |
| 4 | Jeton forgé, régénération | Bloc du banc « le jeton ». |
| 5 | Ni bruit de départage ni plafond | Une invitation se lit une ligne à la fois : rien à départager. |
| 6 | Rien du lot ne touche à Stripe, aux avis, à la messagerie, au studio, à l'agenda, à la santé | Vrai : L3bis n'a que les invitations. |
| 7 | Migrations rejouables | CI, comme L1 point 5. |
| 8 | `abonnee` : un chemin d'écriture, un seul | L'abonnement d'un invité à l'offre de son inviteur (0033) ; un abonnement à un autre coach ne la déclenche pas. Prouvé au banc dans le bloc des invitations, où le coach relit le statut par `mes_invitations`. |
| 9 | Rien hors périmètre | Rien trouvé. |
| 10 | Dettes | Le rappel de commission (point 1). Les liens universels restent provisoires tant que le domaine n'existe pas (`docs/dette.md`). |

**Porte close**, avec un report écrit (rappel de commission, L5b). Reste sur appareil :
`docs/seance-iphone.md`, section L3bis.

---

## Porte de sortie de L4 (quatorze points)

| # | Point | Constat |
|---|---|---|
| 1 | Écarts fiches / code | 04a, 04b, 04c, 20, 24b, 27a, 27b et l'onglet Avis : chacun clos dans le navigateur sur la base de dev, d'après sa fiche (captures dans `myfavcoach-captures/`). Écarts assumés, écrits dans les fiches : le libellé de `authentification_echouee` (écran 20), les états ajoutés à l'écran 20 et à 27a. **Non construit** : l'information précontractuelle de rétractation de 04b (emplacement réservé, attend le juriste) ; le bloc « La suite » de 04c (L6). **Observé, non tranché** : le pied « S'abonner » reste affiché sur le profil d'un coach auquel le client est déjà abonné. |
| 2 | Chaque transition, dans les deux sens | Voir le point 13 : la machine au complet. |
| 3 | Webhook : non signé, mauvais secret, relivraison, ordre inversé | Prouvé le 16 novembre par trois vrais appels HTTP au webhook du dev : sans signature, signée avec un mauvais secret, signature mal formée — **400 chacune**, et rien d'écrit (aucun abonnement, aucune anomalie). Relivraison et ordre inversé : banc, « synchroniser_session_paiement : webhook et constat, une seule fonction » et « SEPA : même état final dans l'ordre naturel et dans l'ordre inverse ». **Aucun test automatisé ne rejoue le refus de signature** : il repose sur cet essai et sur le code de la fonction. |
| 4 | `Idempotency-Key` | Banc, bloc `cles_idempotence (0034)` ; et par de vrais appels HTTP le 15 novembre : deux demandes simultanées sous la même clé, l'une crée, l'autre reçoit `requete_en_cours` ; la même clé pour une autre offre reçoit `cle_idempotence_reutilisee`. |
| 5 | Commission : 0 % puis 10 % au jour 90, jamais recalculée | Banc : « bascule au jour 90 : le jour même, 10 % ; la veille, 0 % ; une ligne écrite ne change plus » et « la fin de commission offerte n'est jamais recalculée ». |
| 6 | Le fil de L3bis refermé | Porte de L3bis, point 8. |
| 7 | Rien ne touche à Solde, Versement, Revenus | Aucune table de solde ni de versement dans les migrations ; `app/(coach)/(tabs)/revenus.tsx` est toujours l'écran provisoire de L0. |
| 8 | Migrations rejouables | CI verte jusqu'à 0068. |
| 9 | Rien hors périmètre | Rien trouvé. L'accueil visiteur (`125fed3`) a sa révision de périmètre datée du 15 novembre. |
| 10 | Dettes à ajouter, corriger, retirer | Appliquées au fil des étapes ; voir le point 14. |
| 11 | Rapprochement | **Retenu et construit** (`c2340d1`, `docs/backend.md` §13). Ses deux sens prouvés contre le vrai Stripe le 15 novembre ; et le 16 novembre à 6 h, la tâche planifiée a d'elle-même signalé « encaissé sans facture » le paiement de test laissé la veille par la preuve de `souscription_impossible`. |
| 12 | Libellés interdits | La liste partagée est appliquée à 04a, 04b, 04c, 20, 24b, 27a et l'onglet Avis (sept fichiers de test), et aux fixtures. Depuis `4aa106c`, elle l'est aussi aux textes des coachs, par le serveur, à la publication d'une offre. **La relecture humaine de chaque texte du tunnel reste due** : un test attrape un mot, pas une tournure ; les textes écrits ces deux jours sont listés pour cela dans `docs/decisions-en-attente.md`. |
| 13 | La machine de `docs/domaine.md` §4.3, transition par transition | Tableau ci-dessous. |
| 14 | Chaque dette échue à cette porte | Tableau plus bas. **Une échéance n'est pas tenue : Supabase Pro.** |

### La machine des abonnements (point 13)

| Transition | Déclencheur | Test du banc (les deux sens) |
|---|---|---|
| en attente → actif (premier prélèvement confirmé) | `confirmer_premier_prelevement`, appelée par le webhook et le constat | « confirmer_premier_prelevement : en_attente → actif… », « confirmer deux fois… : transition_interdite » |
| en attente → annulé (premier prélèvement rejeté) | `rejeter_premier_prelevement` | « rejeter : en_attente → annule, état terminal » |
| actif → en pause | `demander_pause_jours` (le client) | « pause : 0 et 61 jours refusés, 56 acceptés », « une seconde pause dans les 12 mois : pause_deja_utilisee » |
| en pause → actif | `reprendre_abonnement` (le client) ; `appliquer_echeances` (échéance de la pause) | « reprise : en_pause → actif… ; reprendre un abonnement actif est refusé », « pause atteinte : reprise automatique » |
| actif → impayé | `conclure_tentative` (tâche quotidienne, webhook) | « échec : impaye, motif posé ; relance n° 2 due à J+1 seulement, n° 3 à J+3 seulement » |
| impayé → actif | `conclure_tentative` sur une relance réussie | « réussite à la relance : impaye → actif, une seule facture » |
| impayé → suspendu (7 jours) | `appliquer_echeances` | « J+7 sans succès : suspendu, pas un jour avant », « J+7 avec une tentative encore en cours : pas de suspension » |
| suspendu → actif (régularisé) | nouveau moyen de paiement, puis relance réussie | « nouveau moyen sur un suspendu : la relance est due ; succès → actif », « la relance échoue : le suspendu le reste » |
| suspendu → résilié (30 jours) | `appliquer_echeances` | « suspendu 30 jours : resilie, pas un jour avant » |
| actif → résiliation programmée | `demander_resiliation` (le client) ; suppression d'un compte (0068) | « résiliation : actif → resiliation_programmee… jamais immédiate », « le client supprime son compte… », « le coach supprime son compte… » |
| résiliation programmée → résilié | `appliquer_echeances` | « résiliation programmée : jamais prélevée ; resilie à la fin de la période payée, pas avant » |
| résiliation programmée → actif | `annuler_resiliation` (le client) | « annulation de la résiliation… ; une seconde annulation est refusée », « une résiliation programmée par la suppression ne s'annule pas » |
| en pause, impayé, suspendu → résilié (résiliation du client) | `demander_resiliation` ; suppression d'un compte | « résilier pendant une pause », « résiliation pendant un impayé », « résiliation pendant une suspension » |
| **actif → résilié (offre supprimée par la plateforme, prorata remboursé)** | **Aucun.** | **Aucun.** Aucun écran ni outil ne supprime une offre au nom de la plateforme, et aucun remboursement n'existe dans l'application (`docs/perimetre.md` §3). Une ligne de la machine sans déclencheur : à retirer du domaine ou à construire, décision du développeur. |

Deux fragilités écrites, pas des trous de la machine : un abonnement SEPA en attente dont le coach
est révoqué avant la confirmation devient actif quand même (`docs/dette.md`, L5) ; rien ne
prévient le coach d'un échec de prélèvement ni l'abonné du départ de son coach (L10).

### Les dettes échues à cette porte (point 14)

| Dette | Sort |
|---|---|
| Retour au profil après connexion | Soldée (`125fed3`, le développeur). |
| `publierOffre` et la règle de `docs/api.md` §1 | Soldée (`6e15cee`). |
| Termes interdits et promesse de messagerie à la publication | Soldée (`4aa106c`). |
| Preuves HTTP réelles | Soldée (`582e89a`), sauf `auto_abonnement_interdit`, reporté sans échéance de lot. |
| Rapprochement quotidien | Soldée (`c2340d1`). |
| Abonnement impayé jamais vu par un écran | Soldée (`872ee39`) ; seul le motif `inconnu` se déclenche contre Stripe. |
| Deux politiques sans preuve nommée ; `consentements.type` en texte libre | Soldées (`3bf8f73`). |
| Deux chemins que le banc n'empruntait pas | Soldée : constaté le 16 novembre (`docs/dette.md`). |
| Bandeau « abonnement actif » de la suppression de compte | Soldée (`ac616c7`), avec le défaut serveur trouvé à cette occasion (`4f082c0`). |
| Portes de sortie de L1 et de L3bis | Closes par ce document. |
| Rappel de commission de I-01 | **Reportée à L5b**, décision écrite du 16 novembre. |
| « Premier lancement coach » détecté par un indice | **Reportée à L7** : la ligne donnait déjà le choix « L7 ou L4 », et le pilotage réel est L7. |
| Doubles de bibliothèque à trier | **Reportée à L12**, décision du 16 novembre : un tri de tous les tests du dépôt, sans défaut connu derrière ; les défauts de cette famille trouvés depuis l'ont été par les clôtures dans le navigateur, pas par un tri. |
| CLI Supabase épinglée en 2.122.0 | **Reportée à avant L12**, décision du 16 novembre : la 2.122.0 fait tout ce que les lots demandent ; passer en 3.x touche trois scripts qui écrivent en base, sans rien débloquer aujourd'hui. |
| `npm run verif` qui ne passe pas d'un seul tenant | **Reportée à la prochaine récidive.** Une récidive a eu lieu la nuit du 15 au 16 novembre, avec une cause établie cette fois : le Mac sur batterie, en veille au bout d'une minute, puis la mémoire saturée par des serveurs laissés ouverts. Pas un défaut du dépôt. |
| Retour de la page de paiement par `myfavcoach.fr` | Non prouvable tant que le domaine n'existe pas (décision du 1er novembre). |
| **Supabase Pro**, et avec lui le projet de test, les factures orphelines du banc, le banc qui partage le dev | **Échéance NON TENUE.** `docs/dette.md` dit « bloque la porte de sortie de L4 ». C'est une dépense : seul le développeur peut la faire. Claude passe la porte sans elle, sur le mandat du 15 novembre, et le dit ici plutôt que de la reporter en silence : **tant que Pro n'est pas pris, le banc écrit dans la même base que les comptes de scénario**, chaque matin le rapprochement y signale les factures du banc (purgées avant lecture), et la protection contre les mots de passe divulgués reste inactive. Nouvelle échéance proposée : avant la séance 1 du développeur (clôture de L5). |

**Porte close**, avec cette réserve. L5 peut s'ouvrir.

---

## Ce qu'il reste à décider avant L5

Repris de `docs/prompts/L4.md`, inchangé : la facture de commission de la plateforme au coach,
l'identité fiscale du coach, `Solde` et `Versement` avec l'identification Stripe Connect, les
factures et reçus téléchargeables (C-05). S'y ajoutent, depuis ces deux jours :

- **Activer Connect dans le tableau de bord Stripe** : c'est le compte du développeur
  (`docs/perimetre.md` §4 : « avant le code de L5, à la porte de sortie de L4 »). Sans lui, la
  partie serveur de L5 ne peut être prouvée que sur ses règles en base, pas contre Stripe.
- Le rappel de commission de I-01, à brancher sur les lectures de l'écran Revenus.
- La règle de suppression de compte (0068), à relire, avec la ligne de la machine restée sans
  déclencheur.
