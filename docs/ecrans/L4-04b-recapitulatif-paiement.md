# L4-04b · Tunnel — récapitulatif et paiement (04b)

**Lot** L4 · **Rôle** client · **Route** `app/(client)/souscription/paiement.tsx` (nom inventé)
**Référence visuelle** `maquettes/MyFavCoach-Client_dc.html`, bloc « 04b · Récapitulatif &
paiement », `data-screen-label="04b Paiement"`. **Trois corrections et un manque, lus en
Règles** : code promo sans règle de domaine, bloc « moyen de paiement » remplacé par la page
Stripe hébergée, et le droit de rétractation, absent de la maquette.
**Révisée le 28 septembre 2026 (P4.2)** : la collecte passe par Stripe Checkout
(`docs/backend.md` §13), plus par un module natif.

---

## Raison d'être

L'écran où le client voit exactement ce qu'il va payer, avant de quitter l'application pour la
page de paiement Stripe. Il ne collecte rien lui-même : ni carte, ni IBAN, ni choix du moyen —
tout cela se fait dans la page Stripe (`docs/api.md` §7).

---

## Contenu

En-tête : retour (vers 04a), titre « Paiement », indicateur d'étape (voir 04a, « Ce qui a été
inventé »), mention « Sécurisé » (maquette).

**Récapitulatif** — tout vient de `recapitulatif` rendu par `POST /abonnements/intention`
(appelé depuis 04a, `docs/api.md` §7), rien n'est calculé par l'écran :

| Ligne | Source |
|---|---|
| Titre de l'offre, coach · discipline | offre choisie en 04a |
| « Abonnement mensuel » + prix | `recapitulatif.prixCentimes` |
| « À payer aujourd'hui » | `recapitulatif.totalCentimes` |
| « Puis le {jour} de chaque mois » | `recapitulatif.jourPrelevement` ; la date du prochain prélèvement en clair (`prochainPrelevementLe`, formatée Europe/Paris) |

**Moyens acceptés** : une ligne « Carte bancaire ou prélèvement SEPA » (`moyensAcceptes`), et
« Tu choisiras sur la page de paiement sécurisée de notre prestataire. » — le client doit savoir,
avant d'appuyer, qu'il va quitter l'application.

**Information précontractuelle** (voir Règles, « Droit de rétractation ») : un emplacement
réservé entre le récapitulatif et le bouton, dont le texte vient du juriste.

Pied : bouton principal « Payer {total} € », puis « En continuant tu acceptes les conditions
d'abonnement » — « conditions d'abonnement » ouvre les CGV (`docs/ecrans/L2-03-documents-contractuels.md`).
« Payer » ouvre `urlPaiement` (`expo-web-browser` sur iOS/Android, redirection sur web).

---

## Règles

**Corrections de la maquette :**

1. **Code promo retiré.** La maquette montre « Bienvenue −20 % le 1er mois » et un champ
   « Code promo ». `docs/domaine.md` ne définit ni entité ni règle (qui finance la remise, sur
   quel montant porte alors la commission de 10 %, combien de mois, qui crée les codes).
   **Décidé le 28 septembre 2026** : retiré de l'écran et de `docs/api.md` §7, reporté au
   jalon 2 comme fonctionnalité sans règle (`docs/jalon-2.md`, n° 24) — pas une dette.
2. **« VISA •••• 4218 · 07/28 » et « Ajouter une carte » retirés.** Au premier abonnement,
   aucun moyen de paiement n'existe, l'application n'en stocke jamais aucun (`docs/api.md` §15),
   et le choix du moyen se fait désormais dans la page Stripe.
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

Ce que la fiche fixe, en revanche : **un emplacement dans l'écran**, entre le récapitulatif et
le bouton, qui ne sera rempli qu'avec le texte validé ; **aucun texte provisoire inventé**
n'y est écrit (même règle que les liens légaux de L1-01, `docs/dette.md`). Le tunnel se développe
et se teste en mode test Stripe sans ce texte ; il **ne passe pas en production** sans lui.

**Le reste :**

- **Magasins d'applications** (`docs/domaine.md` §2) : aucun terme interdit ; « Abonnement
  mensuel » est rattaché à l'offre du coach nommée juste au-dessus.
- **Idempotence** (`docs/backend.md` §13) : l'`Idempotency-Key` naît en 04a, à l'appui sur
  « Continuer » qui demande l'intention, et resert à chaque nouvel essai réseau de cette même
  demande. 04b n'envoie rien qui engage de l'argent : il ouvre une URL déjà créée. Un double
  appui sur « Payer » rouvre la même page Stripe, jamais une seconde session.
- **Page expirée** (30 minutes, `docs/api.md` §7) : « Payer » redemande une intention depuis
  l'écran (nouvelle clé), récapitulatif remplacé — jamais une page Stripe périmée ouverte.
- **Au retour — avec ou sans retour propre.** Trois signaux déclenchent le même constat, le
  premier arrivé gagne : l'adresse de retour de `myfavcoach.fr` qui rouvre l'application
  (`docs/backend.md` §13), la fermeture du navigateur par le client, ou l'application qui revient
  au premier plan alors que 04b attendait un paiement. Dans les trois cas, l'écran appelle
  `POST /abonnements/intention/{intentionId}/constat` (`docs/api.md` §7), jamais une conclusion
  locale — un navigateur fermé ne dit **rien** de ce qui s'est passé : le paiement a pu aboutir
  une seconde avant, être en cours d'authentification, ou n'avoir jamais commencé. Voir
  « Retour sans confirmation » ci-dessous.
- **Retour sans confirmation — navigateur fermé en plein paiement.** Ce n'est **pas** l'état SEPA
  `en_attente_confirmation` : ici, aucun abonnement n'existe. L'écran affiche selon le constat :

  | Constat | Ce que l'écran affiche | Ce qu'il propose |
  |---|---|---|
  | (appel en cours) | « On vérifie ton paiement auprès de notre prestataire… » ; « Payer » désactivé | rien — l'écran ne laisse pas repayer tant qu'il ne sait pas |
  | `abonne` | → 04c, variante carte ou SEPA selon le statut de l'abonnement | — |
  | `non_terminee` | bandeau « Paiement non terminé. Rien n'a été débité. » au-dessus du récapitulatif | « Reprendre le paiement » (rouvre **la même** page Stripe, jamais une nouvelle) ; retour arrière possible |
  | `expiree` | même bandeau | « Payer » demande une nouvelle intention (nouvelle clé) |
  | `paiement_recu` | « Ton paiement est bien arrivé chez notre prestataire. On finalise ton abonnement… » | rien pendant l'attente (ci-dessous) |
  | erreur réseau | « Impossible de vérifier pour l'instant. » | « Vérifier à nouveau » — **jamais** « Payer » |

  **Attente bornée à 20 secondes**, pour `paiement_recu` et pour les erreurs réseau : nouveau
  constat toutes les 2 secondes, au plus dix fois. Vingt secondes, parce que Stripe renvoie vers
  l'application au plus tard dix secondes après le paiement et que le serveur n'attend pas le
  webhook pour traiter (il lit Stripe) : au-delà, ce n'est plus un délai, c'est une panne.
  **Passé ce délai**, l'écran cesse d'attendre et affiche : « Ton paiement est bien arrivé, mais
  la confirmation prend plus de temps que prévu. **Tu n'as rien à refaire** : ton abonnement
  apparaîtra dans ton compte, rubrique Mes abonnements. » Actions : « Voir mes abonnements »
  (24b) et « Revenir au profil de {prénom} ». **Jamais « Payer » ni « Réessayer le paiement »
  quand Stripe a constaté un paiement** : proposer de payer à nouveau, c'est fabriquer un double
  prélèvement. Pour une erreur réseau persistante (on ne sait rien), le même message sans « ton
  paiement est bien arrivé » : « On n'arrive pas à vérifier ton paiement pour l'instant. Si tu as
  payé, ton abonnement apparaîtra dans ton compte. » et « Vérifier à nouveau ».
- **Aucun refus de carte n'arrive ici** : la page Stripe l'affiche elle-même et laisse réessayer
  un autre moyen. L'écran 20 ne sert plus la souscription (`L4-20`).
- **Aucune donnée de paiement dans un journal, une URL ou un stockage local** (`CLAUDE.md` §4,
  §10) — l'URL de paiement comprise : elle n'est ni journalisée, ni conservée au-delà de l'écran.
- Le prix affiché vient du serveur ; s'il diffère de celui vu en 04a (le coach a changé son prix
  entre-temps), c'est celui de 04b qui fait foi, et il est celui qui sera figé.

---

## États

| État | Comportement |
|---|---|
| Récapitulatif chargé | Lignes ci-dessus, « Payer » actif |
| Page Stripe ouverte | Écran en attente derrière le navigateur |
| Retour (lien, navigateur fermé, retour au premier plan) | Constat en cours, « Payer » désactivé |
| Retour, abonné | 04c |
| Retour, `non_terminee` | Bandeau « Paiement non terminé. Rien n'a été débité. », « Reprendre le paiement » |
| Retour, `expiree` / page expirée | Bandeau, nouvelle intention au prochain « Payer » |
| Retour, `paiement_recu` | Attente bornée à 20 s, puis « Tu n'as rien à refaire » et lien vers 24b |
| Constat impossible (réseau) | Attente bornée à 20 s, puis « Vérifier à nouveau », jamais « Payer » |
| Erreur réseau à la demande d'intention (page expirée) | Message, bouton réactivé |

---

## Ce qui a été inventé pour cette fiche

- **Attente après retour** : 2 secondes entre deux constats, 20 secondes au plus (raisons
  ci-dessus). Et les textes des états de retour.
- **Application tuée en plein paiement — décidé, pas un manque** (28 septembre 2026).
  L'`intentionId` n'est gardé qu'en mémoire (jamais dans un stockage local, `CLAUDE.md` §4) ; au
  redémarrage, 04b n'existe plus et aucun constat n'a lieu. **C'est voulu** : le webhook crée
  l'abonnement que l'application soit ouverte ou non ; la personne ne le voit simplement pas tout
  de suite, et le voit dans 24b à la prochaine ouverture. Si le webhook lui-même échoue, le
  rapprochement quotidien (`docs/prompts/L4.md` point 12) est le filet. **Aucun balayage serveur
  rapide des sessions payées sans abonnement n'est construit** : un troisième mécanisme pour
  couvrir les quelques secondes entre le webhook et la prochaine ouverture ne vaut pas sa
  complexité. Ne pas le redécouvrir comme un oubli.
- **Phrase « Tu choisiras sur la page de paiement sécurisée de notre prestataire »**, et le texte
  d'attente.
- ~~Aucun écran de résiliation dans le périmètre~~ — **résolu le 28 septembre 2026** : la
  maquette existait (écran 24, bloc abonnements, écarté en L1). Ajouté comme 24b
  (`docs/ecrans/L4-24b-mes-abonnements.md`) ; la question de conformité reste jointe à celle du
  juriste (`docs/perimetre.md` §6).
- Nom de route `souscription/paiement`.

---

## Critères d'acceptation

1. Aucun montant ni jour de prélèvement n'est calculé par l'écran : tout vient de
   `recapitulatif`.
2. Aucun champ de carte ni d'IBAN, aucune clé Stripe, aucun module Stripe dans ce dépôt côté
   application (`src/test/secrets-interdits.test.ts`).
3. Carte et SEPA sont payables en mode test Stripe, **dans un navigateur sur web** comme depuis
   l'application : carte de test qui réussit, carte qui exige 3-D Secure, carte refusée (le refus
   s'affiche dans la page Stripe), IBAN de test.
4. Un double appui sur « Payer » n'ouvre jamais une seconde session ; un double appui sur
   « Continuer » (04a) n'en crée jamais une seconde (même `Idempotency-Key`, prouvé au banc).
5. Au retour — lien, navigateur fermé ou retour au premier plan —, l'écran ne conclut qu'à partir
   de `POST /abonnements/intention/{id}/constat` ; un navigateur fermé sans constat n'affiche
   jamais un succès ni un échec.
6. Navigateur fermé en plein paiement (vérification manuelle en mode test : fermer la page Stripe
   avant, puis juste après avoir validé une carte de test) : `non_terminee` propose de reprendre
   la même page ; `paiement_recu` ne propose **jamais** de payer à nouveau ; après 20 secondes
   sans confirmation, l'écran cesse d'attendre et renvoie vers 24b.
7. Aucun champ ni texte « code promo » (reporté au jalon 2) ; aucun moyen de paiement
   « enregistré » inventé.
8. L'emplacement de l'information sur la rétractation existe et ne contient aucun texte inventé.
9. **Libellés interdits** (`docs/domaine.md` §2) : aucun terme de la liste partagée dans les
   textes rendus ni dans les libellés d'accessibilité.
10. L'URL de paiement n'apparaît dans aucun journal ni stockage local.
11. Galerie, deux thèmes.
12. `npm run verif` passe.
