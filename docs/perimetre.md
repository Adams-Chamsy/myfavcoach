# Périmètre — jalon 1

Figé le 20 août 2026 en conversation de cadrage. Ce fichier fait autorité. Un écran ou une
fonctionnalité qui n'y figure pas en « dedans » **n'est pas à coder**, même si la maquette
existe.

Révisé le 12 septembre 2026, après la clôture de L1. Ce qui a changé, et rien d'autre :

- **Trois écrans ajoutés**, tous techniques, tous indispensables à L2 : le back-office de
  vérification, l'état d'attente du coach en examen, le dépôt de pièces d'identité.
- **Trois écrans de conformité remontés de L11 à L2** : suppression de compte, consentements,
  documents contractuels. Ils ne dépendent que de L1 et bloquent la publication. Les trois
  autres restent placés selon leur vraie dépendance.
- **Un manque comblé** : le questionnaire santé avant la première séance, absent de la version
  du 20 août.
- **Section 3 étoffée** : six reports décidés en conversation y sont désormais écrits, avec leur
  raison. Ils n'étaient nulle part.

Le reste est inchangé. En particulier, aucun des reports du 20 août n'est levé.

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
| 05a | Questionnaire santé avant la première séance | L6 | **à concevoir.** Contre-indications, blessures, traitements. Portée verrouillée au coach, consentement explicite. Dépend de C-04 |
| 06 | Suivi chiffré | L7 | sans photos corporelles |
| 07 | Messagerie client | L8 | texte seul |
| 14 | Recherche — aucun résultat | L3 | bouton « Me prévenir » retiré |
| 15 | Chargement | L0/L3 | motif générique posé en L0 |
| 21 | Inscription | L1 | ✅ livré |
| 22 | Onboarding | L1 | ✅ livré |
| 24 | Compte et réglages | L1 | ✅ livré |
| 17 | Bascule client → coach | L1 | ✅ livré |
| 18 | Notifications | L10 | |

### Espace coach

| # | Écran | Lot | Remarque |
|---|---|---|---|
| 23 | Devenir coach — étape 3 | L2 | |
| 23a | Devenir coach — étapes 2, 4 | L2 | **à concevoir, absentes du dossier.** Corrigé le 12 septembre : l'étape 1 est livrée depuis L1 (`docs/ecrans/L1-08-activation-espace-coach.md`), cette ligne la comptait à tort une seconde fois |
| 23b | Dépôt des pièces justificatives | L2 | **à concevoir.** Identité, certification, assurance. Compartiment privé, aucune relecture depuis l'application |
| 23c | En attente de vérification | L2 | **à concevoir.** Ce que voit un coach entre le dépôt et la décision. Aujourd'hui il ne voit rien |
| 03a | Créer et publier une offre (coach) | L2 | **Ajouté le 12 septembre, absent du dossier.** Marqué L2 depuis L0 par la coquille `app/(coach)/creer/[type].tsx`, jamais nommé comme écran avant cette ligne. Brouillon possible sans coach vérifié, publication refusée sinon (`docs/api.md` §5) |
| 19 | Premier lancement coach (état à zéro) | L2 | |
| 08 | Pilotage coach | L7 | |
| 09 | Liste clients | L7 | |
| 10 | Fiche client | L7 | |
| 11 | Studio de contenu | L6 | |
| 12 | Agenda | L9 | présentiel et visio par lien externe |
| 13 | Revenus | L5 | ligne « séances à l'unité » retirée |
| 25 | Boîte de réception coach | L8 | texte et message groupé |

### Hors application mobile

| Réf | Écran | Lot | Remarque |
|---|---|---|---|
| BO-01 | Back-office de vérification des coachs | L2 | File d'attente, consultation des pièces, trois décisions avec motif. N'utilise jamais la clef anonyme de l'application |

### Écrans obligatoires absents du dossier de design

Les sept sont **bloquants pour la publication**. Ni Apple, ni Google, ni le droit européen ne
laissent passer une application de mise en relation qui n'en dispose pas.

Le 20 août ils étaient tous placés en L11, en fin de projet. Trois ne dépendent que de L1 et
sont remontés. Les trois autres dépendent réellement de ce qui les précède.

| Réf | Écran | Lot | Dépend de |
|---|---|---|---|
| C-03 | Suppression du compte, avec conséquences énoncées. Inclut la purge automatisée des comptes non vérifiés à 30 jours (`docs/domaine.md` §4.1) — tâche serveur (Supabase Edge Function + cron), pas un écran | L2 | L1. `comptes.supprime_le` existe déjà, inutilisée |
| C-07 | Export de mes données (portabilité RGPD) | L2 | L1 |
| C-04 | Gestion des consentements (santé, notifications, communications) | L2 | L1. Le journal `consentements` existe déjà |
| C-06 | Documents contractuels : CGU, CGV, confidentialité, contrat coach | L2 | L1. Les liens sont des espaces réservés depuis L1-01, c'est une dette inscrite |
| C-01 | Signalement d'un contenu ou d'un utilisateur | L8 | Il faut du contenu à signaler |
| C-02 | Blocage d'un utilisateur, et liste des personnes bloquées | L8 | Il faut des échanges à bloquer |
| C-05 | Factures et reçus, côté client et côté coach | L5 | Il faut des paiements à justifier |

---

## 3. Hors périmètre — reporté au jalon 2

À ne pas coder, à ne pas préparer, à ne pas « prévoir dans l'architecture ».

### Décidé le 20 août

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

### Ajouté le 12 septembre

Ces six éléments ont été discutés et conçus en conversation. Ils sont reportés, et c'est écrit
ici pour qu'ils cessent de flotter dans un historique de discussion.

| Élément | Raison |
|---|---|
| Offre d'essai : appel découverte et séance découverte | C'est la « séance à l'unité » déjà reportée le 20 août, sous un autre nom. Le tunnel du jalon 1 ne gère qu'une nature d'offre (écran 04a) |
| Groupe fermé par coach (fil de cohorte, partage, modération) | Modération non résolue, et sans volume un groupe est vide. Recoupe « modération des avis », déjà reporté |
| Bibliothèque vidéo du coach : extrait public, clips de geste, packs vendus | Pipeline média déjà reporté pour les messages. Et l'arbitrage sur les commissions de magasin d'applications n'est pas tranché — il peut invalider les packs |
| Retour de séance du client (difficulté, douleur, note vocale) | Le vocal est déjà reporté. La version texte n'est conçue nulle part |
| Assistance à la rédaction de programmes côté coach | Jamais spécifiée. Coût d'inférence non modélisé. À ne pas confondre avec une IA face au client, qui reste exclue du produit |
| Changement de coach guidé, litige et remboursement en application | Le litige dépend du prestataire de paiement, non intégré avant L4 |

**Règle pour Claude Code :** si un prompt te conduit vers un de ces éléments, arrête-toi et
dis-le. Ne propose pas d'« ajouter juste le socle pour plus tard ».

---

## 4. Ordre des lots

| Lot | Contenu | Dépend de |
|---|---|---|
| **L0** | Dépôt, `CLAUDE.md`, tokens, primitives, thèmes, navigation, intégration continue | — |
| **L1** | Identité, comptes, deux profils, bascule de rôle, onboarding, réglages | L0 |
| **L2** | Profil coach, offres, pièces et vérification, back-office, conformité de base (C-03, C-04, C-06) | L1 |
| **L3** | Découverte : accueil, recherche, filtres, classement | L2 |
| **L4** | Abonnement, paiement, facturation, échecs et relances | L3 |
| **L5** | Commission, soldes, versements, écran revenus, factures et reçus (C-05) | L4 |
| **L6** | Contenu : studio, programmes, séances, séance du jour, questionnaire santé | L2 |
| **L7** | Suivi client et métriques calculées | L6 |
| **L8** | Messagerie texte, signalement et blocage (C-01, C-02) | L1 |
| **L9** | Agenda et réservation | L2 |
| **L10** | Notifications | L1 |
| **L12** | Durcissement, tests, fiches de store | tout |

L0 à L2 précèdent tout paiement : il faut des coachs vérifiés et des profils avant de pouvoir
vendre quoi que ce soit.

Le lot L11 disparaît : son contenu est réparti selon les dépendances réelles de chaque écran.
Un travail qui ne dépend de rien et qui bloque la publication n'a pas sa place en fin de projet.

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
10. Aucune pièce d'identité déposée n'est atteignable depuis l'application, par aucun chemin :
    lecture directe, URL construite, relation imbriquée, journal, rapport d'erreur.
11. Un client répond au questionnaire santé avant sa première séance, et ses réponses ne sont
    lisibles que par son coach.

---

## 6. Ce qui court en parallèle, hors code

Ces délais sont externes et bloquent la publication, pas le développement :

- Création de la société et compte bancaire professionnel
- Compte développeur Apple et Google Play, au nom de l'entité
- Dossier de conformité auprès du prestataire de paiement — plusieurs semaines
- Rédaction des documents contractuels (juriste)
- Assurance responsabilité civile professionnelle
- Relecture du questionnaire santé par un professionnel de santé, et des mentions qui
  l'accompagnent
- Photographies de coachs : **le dossier de design n'en fournit aucune**, et la direction
  artistique repose dessus
