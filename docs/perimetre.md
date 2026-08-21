# Périmètre — jalon 1

Figé le 20 août 2026 en conversation de cadrage. Ce fichier fait autorité. Un écran ou une
fonctionnalité qui n'y figure pas en « dedans » **n'est pas à coder**, même si la maquette
existe.

---

## 1. Ce que le jalon 1 doit prouver

Un client trouve un coach, s'y abonne, paie, fait ses séances et parle à son coach. Un coach
s'inscrit, se fait vérifier, publie ses offres et son programme, suit ses clients, et touche son
argent. La plateforme prend 10 % et sait le justifier.

Tout ce qui ne sert pas cette phrase est reporté.

---

## 2. Écrans dans le périmètre

Numérotation du dossier de design. « Fiche » = fiche d'écran à rédiger dans `docs/ecrans/`.

### Socle — lot L0 (aucun écran produit, quatre écrans techniques)

| Réf | Écran | Fiche |
|---|---|---|
| L0-00 | Galerie du système (écran de développement) | ✅ |
| L0-01 | Coquille de navigation client | ✅ |
| L0-02 | Coquille de navigation coach | ✅ |
| L0-03 | États système génériques (vide / chargement / erreur) | ✅ |
| L0-04 | Démarrage : polices, thème, redirection | ✅ |

### Espace client

| # | Écran | Lot | Remarque |
|---|---|---|---|
| 01 | Accueil / découverte | L3 | |
| 02 | Recherche + filtres | L3 | filtre « Asynchrone » retiré |
| 03 | Profil coach — offres | L2 | offre « Programme seul » retirée |
| 27 | Profil coach — avis | L2 | thèmes = étiquettes figées, pas d'extraction |
| 28 | Profil coach — parcours | L2 | |
| 04a | Tunnel — choix de l'offre | L4 | une seule nature d'offre |
| 04b | Tunnel — récapitulatif et paiement | L4 | |
| 04c | Tunnel — confirmation | L4 | **à concevoir, absent du dossier** |
| 20 | Paiement refusé | L4 | |
| 05 | Séance du jour | L6 | |
| 06 | Suivi chiffré | L7 | sans photos corporelles |
| 07 | Messagerie client | L8 | texte seul |
| 14 | Recherche — aucun résultat | L3 | bouton « Me prévenir » retiré |
| 15 | Chargement | L0/L3 | motif générique posé en L0 |
| 21 | Inscription | L1 | |
| 22 | Onboarding | L1 | + demande de poids et objectif, facultative |
| 24 | Compte et réglages | L1 | lignes réellement ouvrantes |
| 17 | Bascule client → coach | L1 | |
| 18 | Notifications | L10 | |

### Espace coach

| # | Écran | Lot | Remarque |
|---|---|---|---|
| 23 | Devenir coach — étape 3 | L2 | |
| 23a | Devenir coach — étapes 1, 2, 4 | L2 | **à concevoir, absentes du dossier** |
| 19 | Premier lancement coach (état à zéro) | L2 | |
| 08 | Pilotage coach | L7 | |
| 09 | Liste clients | L7 | |
| 10 | Fiche client | L7 | |
| 11 | Studio de contenu | L6 | |
| 12 | Agenda | L9 | présentiel et visio par lien externe |
| 13 | Revenus | L5 | ligne « séances à l'unité » retirée |
| 25 | Boîte de réception coach | L8 | texte et message groupé |

### Écrans obligatoires absents du dossier de design — lot L11

| Réf | Écran |
|---|---|
| C-01 | Signalement d'un contenu ou d'un utilisateur |
| C-02 | Blocage d'un utilisateur, et liste des personnes bloquées |
| C-03 | Suppression du compte, avec conséquences énoncées |
| C-04 | Gestion des consentements (données de santé, notifications, communications) |
| C-05 | Factures et reçus, côté client et côté coach |
| C-06 | Documents contractuels : CGU, CGV, confidentialité, contrat coach |

Ces six écrans sont **bloquants pour la publication**. Ni Apple, ni Google, ni le droit européen
ne laissent passer une application de mise en relation qui n'en dispose pas.

---

## 3. Hors périmètre — reporté au jalon 2

À ne pas coder, à ne pas préparer, à ne pas « prévoir dans l'architecture ».

| Élément | Écrans concernés | Raison |
|---|---|---|
| Montre | 31 → 36 | Coûteux, synchronisation à trois nœuds non résolue |
| Tablette | 29, 30 | Deux mises en page supplémentaires à maintenir |
| Mode sombre | — | Non conçu écran par écran ; les tokens existent, l'implémentation attend |
| Visio intégrée | 26 | Flux et enregistrement = risque juridique majeur. Lien tiers en attendant |
| Photos de suivi corporelles | 06 (bloc photos) | Données sensibles, mineurs, pas de gestion de visibilité conçue |
| Messages vocaux et vidéo | 07, 25 | Pipeline média, modération |
| Fonctionnement hors-ligne | 16 | Résolution de conflits non spécifiée |
| Format « Asynchrone » | 02 (filtre) | Jamais défini ni illustré |
| Séance à l'unité | 13 (ligne) | Produit jamais dessiné |
| Alerte de recherche sauvegardée | 14 (« Me prévenir ») | Jamais spécifiée |
| Synchronisation HealthKit / Health Connect | 06 | Consentement santé natif, hors sujet au jalon 1 |
| Version web de bureau | — | Jamais conçue |
| Mode entraîneur d'équipe | — | Jamais conçu |
| Parrainage, modération des avis | — | Jamais conçu |
| Multilingue, autres devises | — | France seule |

**Règle pour Claude Code :** si un prompt te conduit vers un de ces éléments, arrête-toi et
dis-le. Ne propose pas d'« ajouter juste le socle pour plus tard ».

---

## 4. Ordre des lots

| Lot | Contenu | Dépend de |
|---|---|---|
| **L0** | Dépôt, `CLAUDE.md`, tokens, primitives, thèmes, navigation, intégration continue | — |
| **L1** | Identité, comptes, deux profils, bascule de rôle, onboarding, réglages | L0 |
| **L2** | Profil coach, offres, vérification, back-office de vérification | L1 |
| **L3** | Découverte : accueil, recherche, filtres, classement | L2 |
| **L4** | Abonnement, paiement, facturation, échecs et relances | L3 |
| **L5** | Commission, soldes, versements, écran revenus | L4 |
| **L6** | Contenu : studio, programmes, séances, séance du jour | L2 |
| **L7** | Suivi client et métriques calculées | L6 |
| **L8** | Messagerie texte | L1 |
| **L9** | Agenda et réservation | L2 |
| **L10** | Notifications | L1 |
| **L11** | Conformité : signalement, blocage, suppression, consentements, factures | L1 |
| **L12** | Durcissement, tests, fiches de store | tout |

L0 à L2 précèdent tout paiement : il faut des coachs vérifiés et des profils avant de pouvoir
vendre quoi que ce soit.

---

## 5. Critères de sortie du jalon 1

Le jalon 1 est terminé quand, sur deux appareils physiques (un iPhone, un Android) :

1. Un compte se crée, se vérifie par courriel, et se supprime depuis l'application.
2. Un coach dépose ses pièces, passe en « vérifié », publie une offre et un programme.
3. Un client trouve ce coach par la recherche, s'abonne, est prélevé, reçoit une facture.
4. Le client fait une séance et la valide ; le coach voit la progression le lendemain.
5. Les deux échangent des messages texte.
6. Le coach voit son solde, commission déduite, et déclenche un versement.
7. Un échec de prélèvement produit la relance et l'écran 20, sans coupure immédiate d'accès.
8. Un contenu se signale, un utilisateur se bloque.
9. `npm run verif` passe, et la vérification d'accessibilité ne signale aucun écart.

---

## 6. Ce qui court en parallèle, hors code

Ces délais sont externes et bloquent la publication, pas le développement :

- Création de la société et compte bancaire professionnel
- Compte développeur Apple et Google Play, au nom de l'entité
- Dossier de conformité auprès du prestataire de paiement — plusieurs semaines
- Rédaction des documents contractuels (juriste)
- Assurance responsabilité civile professionnelle
- Photographies de coachs : **le dossier de design n'en fournit aucune**, et la direction
  artistique repose dessus
