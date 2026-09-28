# L4-24b · Compte — bloc « Mes abonnements » (24)

**Lot** L4 · **Rôle** client (espace client seulement) · **Route** aucune nouvelle : le bloc
s'insère dans l'écran compte déjà livré (`app/(client)/(tabs)/moi.tsx`,
`src/fonctionnalites/compte/`, fiche `docs/ecrans/L1-07-compte-reglages.md`)
**Référence visuelle** `maquettes/MyFavCoach-Parcours_dc.html`, bloc « 24 · Mon compte &
abonnements », `data-screen-label="24 Mon compte"` — la partie « Mes abonnements » que L1-07 a
volontairement écartée (« Les deux cartes d'abonnement, la pause, la résiliation — L4 »).
**Deux corrections, lues en Règles.**

---

## Raison d'être

Deux obligations qu'aucun autre écran de L4 ne remplit :

1. **La résiliation en ligne** qu'impose le droit de la consommation pour un contrat souscrit en
   ligne. Elle est ici, à deux gestes de l'onglet « Moi », pas cachée dans un réglage. Sa
   conformité exacte reste une question jointe au juriste (`docs/perimetre.md` §6).
2. **Le point d'entrée de l'écran 20 pour un échec d'échéance** (`docs/ecrans/L4-20-paiement-refuse.md`,
   contexte « échéance ») : sans notifications avant L10, c'est le seul endroit où un client
   apprend qu'un prélèvement a échoué et peut remplacer son moyen de paiement. C'est lui qui rend
   démontrable le critère 7 de `docs/perimetre.md` §5.

---

## Contenu

Titre de section : « Mes abonnements · {nombre} » (maquette), entre l'en-tête et la liste de
réglages de L1-07.

**Une carte par abonnement**, dans les états listés ci-dessous (les autres n'apparaissent pas) :

| Élément | Source |
|---|---|
| Nom du coach, titre de l'offre · prix | `Abonnement.profilCoach`, `Offre.titre`, `prixFigeCentimes` (« 49 €/mois ») — le prix **figé**, pas le prix actuel de l'offre |
| Étiquette d'état | libellé texte, jamais la seule couleur (`CLAUDE.md` §5) — tableau ci-dessous |
| Actions | selon l'état — tableau ci-dessous |
| Ligne d'information | selon l'état ; pour `actif` : « Prochain prélèvement le {date}. Résiliation effective en fin de période, sans frais. » (maquette) |

| `statut` (`docs/domaine.md` §4.3) | Étiquette | Ligne d'information | Actions |
|---|---|---|---|
| `actif` | ACTIF | prochain prélèvement, rappel de résiliation | « Mettre en pause », « Résilier » |
| `en_attente_confirmation` | EN ATTENTE | « Ta banque n'a pas encore confirmé le premier prélèvement. » | aucune |
| `en_pause` | EN PAUSE | « En pause jusqu'au {pauseJusquLe}. » | « Reprendre » |
| `impaye` | PAIEMENT REFUSÉ | « Ton suivi continue jusqu'au {fin de la période de grâce}. » | « Régler » → écran 20, contexte échéance |
| `suspendu` | SUSPENDU | « Suivi interrompu. Règle le paiement avant le {date} pour le reprendre. » | « Régler » → écran 20, contexte échéance |
| `resiliation_programmee` | RÉSILIATION PROGRAMMÉE | « Ton suivi s'arrête le {finAccesLe}. » | « Annuler la résiliation » |

`resilie` et `annule` n'apparaissent pas : l'historique relève des factures et reçus (C-05, L5).
Toutes les dates viennent du serveur (`GET /abonnements`, `GET /abonnements/{id}` — « période de
grâce restante », `docs/api.md` §7), aucune n'est calculée par l'écran (`docs/api.md` §15).

**Mettre en pause** : feuille basse (`FeuilleBasse`) — durée à choisir parmi des valeurs bornées
à 60 jours (voir « Ce qui a été inventé »), rappel « Une seule pause par période de 12 mois », puis
confirmation. Appelle `POST /abonnements/{id}/pause`.

**Résilier** : confirmation (`Modale`) qui dit **la date d'effet** avant le geste : « Ton suivi
avec {prénom} s'arrête le {fin de période payée}. Aucun autre prélèvement. » Actions « Garder mon
abonnement » et « Résilier » (destructrice). Appelle `POST /abonnements/{id}/resiliation`, puis
affiche l'état `resiliation_programmee` et un accusé : « Résiliation enregistrée. » Aucun
questionnaire de motif, aucun écran de rétention.

**Annuler la résiliation** : `DELETE /abonnements/{id}/resiliation`, sans confirmation (le geste
ne coûte rien et se refait).

---

## Règles

**Corrections de la maquette :**

1. **« Membre depuis mars 2026 »** n'est pas repris : absent de l'en-tête livré par L1-07, et sans
   rapport avec ce bloc.
2. **La ligne « Paiements et factures »** de la liste de réglages reste absente : elle mène à C-05
   (L5). Règle de L1-07 : une ligne qui n'ouvre rien ne s'affiche pas.

**Le reste :**

- **Chaque action est une demande, le serveur tranche** (`docs/api.md` §15) : l'écran n'affiche
  une action que pour l'état qui l'autorise (tableau ci-dessus), mais c'est le serveur qui refuse
  une transition non listée (`docs/domaine.md` §4). Les refus s'affichent avec le `title`/`detail`
  rendus, tels quels — dont `pause_deja_utilisee` (409).
- **Après chaque action, l'écran relit l'abonnement** : l'état affiché vient toujours de la
  réponse du serveur, jamais d'une mise à jour optimiste. Même famille que la règle du fournisseur
  (`CLAUDE.md` §8, « le rafraîchissement de l'état appartient au fournisseur ») : si la lecture des
  abonnements passe par `FournisseurDonnees`, les quatre écritures (pause, reprise, résiliation,
  annulation) s'y enveloppent de la même façon — à décider au prompt qui le construit, pas
  contourné écran par écran.
- **Résiliation toujours en fin de période payée** (`docs/domaine.md` §4.3) : jamais « Résilier
  maintenant ». L'articulation avec le droit de rétractation est une question du juriste
  (`docs/perimetre.md` §6), pas tranchée ici.
- **Magasins d'applications** (`docs/domaine.md` §2) : les libellés parlent du suivi et du coach
  (« Ton suivi continue », « Suivi interrompu »), jamais d'un accès ou d'un contenu verrouillé.
  Même test de libellés interdits que le tunnel.
- **Le test existant qui interdit « abonnement » sur l'écran compte devient faux à ce lot**
  (`src/fonctionnalites/compte/ecran-compte.test.tsx`, critère 9 de L1-07 : « aucune chaîne des
  lots L4 ou L10 »). Il est **inversé** au prompt qui construit ce bloc — « abonnement » doit
  apparaître quand un abonnement existe, « notification » (L10) reste interdit —, jamais retiré
  (règle 8 de `docs/prompts/L4.md` ; même traitement que « Supprimer mon compte » à P2.12).
- Aucun abonnement : le bloc entier est absent (pas de carte vide « Aucun abonnement ») — même
  règle que L1-07 sur les lignes qui n'ouvrent rien.
- Espace coach : bloc absent. Les abonnés d'un coach sont une autre lecture (pilotage, L7).

---

## États

| État | Comportement |
|---|---|
| Chargement | Squelette d'une carte à la forme finale |
| Aucun abonnement | Bloc absent |
| Un ou plusieurs | Une carte par abonnement, états du tableau |
| Action en cours | Bouton de la carte en chargement ; les autres cartes restent utilisables |
| Refus du serveur | Message rendu, carte relue |
| Erreur de lecture | Bandeau d'erreur au-dessus du bloc ; le reste de l'écran compte (et la déconnexion) reste utilisable, comme L1-07 |

---

## Ce qui a été inventé pour cette fiche

- **Durées de pause proposées** : `docs/domaine.md` §4.3 borne la pause (≤ 60 jours) sans dire
  comment on la choisit. Proposition : 2, 4, 6 ou 8 semaines (8 semaines = 56 jours ≤ 60), en
  jetons — **pas de sélecteur de date** : `@react-native-community/datetimepicker` ne rend rien
  sur web (`CLAUDE.md` §6). À valider, ou à remplacer par la maquette si elle précise.
- Libellés des états autres que ACTIF et EN PAUSE (seuls montrés par la maquette), et les lignes
  d'information correspondantes.
- « Reprendre », « Régler », « Annuler la résiliation », « Garder mon abonnement » : aucun n'est
  dans la maquette.
- L'absence de `resilie`/`annule` dans la liste.

---

## Critères d'acceptation

1. Chaque état du tableau affiche son étiquette **texte**, sa ligne d'information et seulement ses
   actions.
2. Résilier : la date d'effet est affichée avant la confirmation ; après, l'état est
   `resiliation_programmee`, relu du serveur ; aucun prélèvement n'est annoncé au-delà.
3. Pause : une seconde pause dans les 12 mois affiche le message de `pause_deja_utilisee`.
4. `impaye` et `suspendu` ouvrent l'écran 20 en contexte échéance.
5. Aucune date ni montant calculé par l'écran ; le prix affiché est `prixFigeCentimes`.
6. Le test de L1-07 critère 9 est inversé pour « abonnement » (présent quand un abonnement existe,
   absent sinon) ; « notification » reste interdit.
7. **Libellés interdits** (`docs/domaine.md` §2) : aucun terme de la liste partagée.
8. Zones tactiles ≥ 44 pt ; « Résilier » annoncé comme destructeur au lecteur d'écran.
9. À 200 %, rien n'est tronqué dans les cartes.
10. Galerie, deux thèmes, chaque état.
11. `npm run verif` passe.
