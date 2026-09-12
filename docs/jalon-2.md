# Jalon 2 — ce qui vient après

Ce document décrit le **jalon 2**. Aucun élément ci-dessous ne doit être codé ni préparé au
jalon 1 — voir `docs/perimetre.md` §3 (« Hors périmètre — reporté au jalon 2 ») : plusieurs des
fonctionnalités listées ici y sont déjà nommément reportées (offre d'essai, groupe fermé par
coach, bibliothèque vidéo du coach, retour de séance client, assistance à la rédaction côté
coach). Aucun socle, aucune colonne, aucune contrainte pour l'une d'elles n'a sa place dans le
code du jalon 1.

Extrait de `docs/MyFavCoach-Modele-V1.md` (version antérieure, retirée du dépôt le 13 septembre
2026 : elle contredisait `docs/modele-offres.md` — anciennement `MyFavCoach-Modele-V1-r2.md` —
et renvoyait à une maquette, `MyFavCoach-Extensions.dc.html`, absente du dépôt). Seules les deux
sections ci-dessous en ont été conservées ; le reste de ce document (correctifs de fondation,
état applicatif étendu, modèle média, ordre de construction imposé, table des écrans) n'a pas
été repris et n'existe donc plus nulle part.

---

## Les vingt-trois fonctionnalités

### Convertir

| # | Fonctionnalité | Écrans | Dépend de |
|---|---|---|---|
| 1 | Appel de 15 min offert + séance découverte à 25 €, déduite du 1er mois | 37 | offre typée |
| 2 | Réservation d'un créneau par le client | 38, 39 | `agenda.freeSlots` (écran 12) |
| 3 | Mes rendez-vous — 2ᵉ onglet de « Séance », la barre reste à 5 | 40 | 2 |
| 4 | Extrait vidéo public de 45 s sur le profil | 52 | modèle média |
| 5 | Alerte de disponibilité sur recherche vide | 53 | — |
| 6 | Import des clients existants du coach | 54 | — |

Sur la 5 : la valeur n'est pas le client retenu, c'est la carte de la demande non servie. Prévoir
l'export de cette table dès le départ, c'est elle qui pilote le recrutement de coachs.

Sur la 2 : politique d'annulation écrite en clair avec l'heure limite calculée, pas un renvoi aux
CGU. Statut `no_show` distinct de `cancelled` — les deux ne se facturent pas pareil.

### Rendre le coach utile

| # | Fonctionnalité | Écrans | Dépend de |
|---|---|---|---|
| 7 | Ressenti après séance : difficulté, douleur, vocal 10 s | 41 | séance en blocs |
| 8 | Le retour arrive dans la fiche client, avec la tendance sur 6 séances | 42 | 7 |
| 9 | Relance en un tap, brouillon rempli du contexte réel | 55 | 8 |
| 10 | Questionnaire santé avant la première séance | 56 | portée des données de santé |

Sur la 7 : « Pas cette fois » est une vraie sortie. Forcer le remplissage produit des 7 par défaut
et détruit la valeur de la série.

Sur la 9 : le brouillon est modifiable et n'est jamais envoyé sans action du coach. Le client doit
lire une personne.

Sur la 10 : données de santé. Consentement explicite, portée `coach` verrouillée, version du
questionnaire conservée avec la réponse.

### Disciplines non sportives

| # | Fonctionnalité | Écrans | Dépend de |
|---|---|---|---|
| 11 | Séance en blocs : lire, voir, pratiquer, quiz, livrable | 43 | séance en blocs |
| 12 | Studio coach : gabarits de séance et palette de blocs | 44 | 11 |

Trois gabarits au lancement : Entraînement (`set`, `timer`), Module (`read`, `video`, `quiz`,
`deliverable`), Atelier (visio + `deliverable`). Le gabarit préfiltre la palette, il ne l'interdit
pas.

### Vidéo

| # | Fonctionnalité | Écrans | Dépend de |
|---|---|---|---|
| 13 | Clips de geste attachés aux exercices, compris dans l'abonnement | 50 | modèle média |
| 14 | Packs de séances vendus à l'unité | 51 | modèle média, offre typée, arbitrage magasins |

Les clips de geste ne se facturent jamais. Faire payer « voir comment faire le mouvement » à
quelqu'un qui paie déjà 49 €/mois est une rupture de contrat perçue.

### Cohorte

| # | Fonctionnalité | Écrans | Dépend de |
|---|---|---|---|
| 15 | Fil du groupe fermé, abonnés d'un même coach | 45 | portée des données |
| 16 | Réglage de partage, opt-in par activité | 46 | 15 |
| 17 | Modération par le coach | 47 | 15 |

Aucun classement nominatif. Un repère de cohorte anonymisé est acceptable
(« 9 personnes sur 14 ont fait leurs 3 séances »), un tableau de noms non.

Pas de groupe sans responsable identifié. Si le coach ne modère pas, le groupe se ferme.

### Argent et conformité

| # | Fonctionnalité | Écrans | Dépend de |
|---|---|---|---|
| 18 | Documents coach : attestation annuelle, factures de commission, statut | 48 | prestataire |
| 19 | Reçus client et total annuel | 49 | prestataire |
| 20 | Signaler un problème, remboursement, gel du versement | 58 | 19 |
| 21 | Changer de coach plutôt que résilier | 57 | — |

Sur la 20 : sans un montant gelé pour litige en cours, un remboursement après versement sort de
la trésorerie. Le gel doit exister avant le premier litige, pas après.

Sur la 21 : une question sur le motif, pas un tunnel de rétention. Un désabonnement pénible
devient un avis à une étoile et une opposition bancaire.

### Assistance IA côté coach

| # | Fonctionnalité | Écrans | Dépend de |
|---|---|---|---|
| 22 | Brouillon de séance assisté, à partir de la bibliothèque du coach | 59 | séance en blocs, 12 |
| 23 | Ajustement hebdomadaire proposé à partir des retours clients | 60 | 8 |

Cinq règles, à traiter comme des contraintes techniques :

1. L'IA produit un brouillon. Rien ne part au client sans action explicite du coach.
2. Aucune interface de discussion IA côté client. Jamais.
3. Aucune mention « généré » dans l'app client — et une ligne claire dans les CGU disant que les
   coachs s'appuient sur des outils d'assistance. Discret, pas malhonnête.
4. Quand le questionnaire santé ou un retour de douleur signale quelque chose, l'outil alerte le
   coach et s'arrête. Il ne propose pas de contournement d'une blessure.
5. Mesurer la part de blocs modifiés avant publication. Un coach qui valide sans lire est un
   risque de marque.

Argument de recrutement de coachs, à mettre en avant dans l'écran 19. Jamais sur le profil public.

---

## Ce qui bloque le lancement du jalon 2, hors code

| Sujet | État | Conséquence si non traité |
|---|---|---|
| Photographies | Aucune fournie, tous les visuels sont des emplacements vides | La direction artistique repose dessus. Rien ne compense. |
| Prestataire de paiement | À choisir | Bloque plusieurs fonctionnalités et le tunnel générique |
| Magasins d'applications, packs vidéo | Non tranché | Peut invalider la fonctionnalité 14, et faire requalifier l'ensemble à la revue |
| Structure juridique, CGU, données de santé | À confirmer | Bloque 10, 15, 16, et la mise en production |
