# Modèle de domaine — jalon 1

Source unique des entités, des règles métier et des cycles de vie. Toute règle appliquée dans le
code vient d'ici. Si une règle manque, elle s'ajoute **ici d'abord**, puis dans le code.

Vocabulaire : les identifiants de code reprennent les noms de ce document, en français sans
accents (`ProfilCoach`, `Abonnement`, `Versement`).

---

## 0. Contradictions du dossier de design — arbitrages

Chaque ligne était une ambiguïté ou une contradiction relevée à l'audit. Elle est tranchée ici,
définitivement. La colonne « effet » dit ce que le code doit faire.

| # | Contradiction | Arbitrage | Effet |
|---|---|---|---|
| 1 | Deux fichiers de tokens divergents | `design/tokens.json` est l'unique source, superset des deux | `src/theme/` généré |
| 2 | Thème montre : encre sur noir | Le thème montre hérite du sombre puis surcharge | Hors jalon 1, tokens corrigés |
| 3 | Mode sombre déclaré mais non conçu | Tokens complétés, **rendu non livré au jalon 1** | Thème clair forcé |
| 4 | Bouton accent annoncé 3,6:1 (réel 3,32) | Le remplissage d'action passe à `#C1471F` (4,74:1) | `brand.accentAction` |
| 5 | Onglet inactif : tap 40 vs règle 44 | 44 partout, sans exception | Test d'accessibilité |
| 6 | `text.muted` = 4,24:1 sur crème | Devient `#6F695F` (5,14:1) | Token corrigé |
| 7 | « 32 icônes » annoncées, 36 nommées | **36 icônes**, liste figée dans `docs/design-system.md` | — |
| 8 | « 28 écrans » vs 36 livrés | 36 maquettes ; 28 téléphone ; périmètre = `docs/perimetre.md` | — |
| 9 | Catalogue mixte contenu / service | **Nature unique** : toute offre inclut un engagement humain | « Programme seul » supprimé |
| 10 | Objectif « 66 kg » jamais demandé | L'onboarding demande poids et objectif, **facultatifs**, sous consentement santé | Écran 22 |
| 11 | « Photos visibles par Yannick », sans réglage | Photos corporelles **supprimées du jalon 1** | Écran 06 amputé |
| 12 | Filtre « Asynchrone » jamais défini | Format ∈ {visio, présentiel}. Filtre retiré | Écran 02 |
| 13 | « Me prévenir » jamais spécifié | Retiré du jalon 1 | Écran 14 |
| 14 | Visio HD, enregistrement, résumé automatique | Lien vers un service tiers, aucun flux porté par la plateforme | Écran 26 hors périmètre |
| 15 | « Choisi par 8 abonnés sur 10 » | Allégation chiffrée non justifiable : **supprimée** | Écran 03 |
| 16 | Thèmes d'avis extraits (« Pédagogie · 61 ») | Le client coche 0 à 3 étiquettes dans une liste figée de 8 | Écran 27 |
| 17 | Note « 4,9 · 214 avis » | Moyenne arithmétique des avis publiés, affichée **à partir de 5 avis**, sinon badge « Nouveau » | §5.1 |
| 18 | « Assiduité 81 % » | Formule figée en §5.2 | Écrans 08, 10 |
| 19 | Présence « En ligne », « vu il y a 2 h » | Pas de présence temps réel. « Répond en général en X h », calculé | §5.4 |
| 20 | « 3 premiers mois sans commission » | 0 % pendant **90 jours** à compter du premier abonnement actif du coach | §5.5 |
| 21 | « Virement immédiat · 1 € » et virement mensuel | Deux modes, spécifiés en §4.8 | Écran 13 |
| 22 | « 4 séances à l'unité » | Produit jamais dessiné : hors jalon 1 | Écran 13 |
| 23 | « Ton abonnement reste actif 48 h » après échec | Période de grâce de **7 jours**, 3 tentatives. 48 h était incohérent avec les relances bancaires | §4.4 |
| 24 | « Programme gardé 60 jours » en pause | Pause = 60 jours maximum, une fois par période de 12 mois | §4.3 |
| 25 | Tri « Pertinence » non défini | Classement déterministe, formule publiée en §5.6 | Écran 02 |
| 26 | « 7 coachs · Lyon et visio » | Recherche par commune + rayon 25 km, ou « en visio » sans géo | §5.7 |
| 27 | Mineurs jamais évoqués | **18 ans minimum**, vérifié à l'inscription | Écran 21 |
| 28 | Un coach peut-il être client ? | Oui, mais **jamais de lui-même** | §3.2 |
| 29 | Fuseaux horaires pour la visio | Europe/Paris uniquement au jalon 1 | — |
| 30 | Certification affichée sans processus | Machine à états `Verification`, examen humain | §4.2 |
| 31 | Liens de navigation cassés dans les maquettes | Corrigés à l'import dans `maquettes/` | L0 |
| 32 | Jeu de données de démonstration dispersé | Figé dans `src/fixtures/`, une seule version | L0 |

---

## 1. Vue d'ensemble

```
Compte ──┬── ProfilClient ──── Abonnement ──── Offre ──── ProfilCoach
         │        │                 │                          │
         │        │                 └── Facture ── Versement ───┤
         │        │                                             │
         │        ├── MesureCorporelle                  Verification
         │        ├── ExecutionSeance ── SeanceProgrammee        │
         │        └── Avis ──────────────────────────────────────┤
         │                                                       │
         └── ProfilCoach ── Programme ── Seance                  │
                    │                                            │
                    ├── Creneau ── Reservation                   │
                    └── Solde ── Versement ──────────────────────┘

Conversation ── Message        Signalement    Blocage    Consentement
```

---

## 2. Règles transverses

- **Argent** : stocké en centimes, entier signé, jamais en flottant. Devise `EUR` explicite sur
  chaque montant. Les prix affichés sont TTC.
- **Dates** : stockées en UTC, ISO 8601. Affichées en Europe/Paris. Une « journée » métier
  commence à 00:00 Europe/Paris.
- **Identifiants** : UUID v4, portés par `auth.users` (Supabase Auth) pour les comptes, et par
  défaut Postgres (`gen_random_uuid()`, également v4) pour le reste. Jamais deux générations
  différentes dans le même schéma : mélanger v4 et v7 sans bénéfice réel coûterait plus en
  confusion qu'il ne rapporterait en tri chronologique. Jamais d'entier auto-incrémenté exposé.
- **Suppression** : aucune suppression physique immédiate. `supprimeLe` horodaté, purge réelle
  à 30 jours, sauf obligation comptable (factures : 10 ans).
- **Historique d'argent** : les entités `Facture`, `Versement` et `LigneCommission` sont
  **immuables**. Une correction crée une nouvelle ligne, jamais une modification.
- **Autorisation** : chaque requête porte le profil actif. Une donnée du profil client est
  inaccessible depuis le profil coach du même compte, et réciproquement.

---

## 3. Entités

### 3.1 Compte

| Champ | Type | Règle |
|---|---|---|
| `id` | UUID | |
| `email` | texte | unique, vérifié |
| `emailVerifieLe` | date? | |
| `dateNaissance` | date | **≥ 18 ans**, contrôlé à l'inscription |
| `telephone` | texte? | requis avant de devenir coach |
| `profilActif` | `client` \| `coach` | dernier espace utilisé |
| `creeLe`, `supprimeLe` | date | |

Pas de champ pour le mot de passe : l'identifiant et le secret vivent dans `auth.users`
(Supabase Auth), hors de ce schéma. Le hachage n'est ni notre colonne ni notre choix — Supabase
Auth hache en bcrypt, sel aléatoire (documentation Supabase). Argon2id est abandonné pour la
même raison : ce choix ne nous appartient plus. Ce n'est pas une perte réelle — bcrypt salé reste
l'une des trois fonctions de hachage de mot de passe reconnues (avec Argon2 et scrypt) — le gain
qui compte est ailleurs : la vérification des mots de passe déjà divulgués (Have I Been Pwned),
un réglage à activer, pas un algorithme à choisir (voir `docs/dette.md`).

États : `en_attente_verification` → `actif` → `suspendu` → `supprime`.

### 3.2 ProfilClient / ProfilCoach

Un compte porte **0, 1 ou 2 profils**. Un compte sans profil ne peut rien faire d'autre que
l'onboarding. La création d'un profil coach n'efface jamais le profil client.

**Règle d'auto-abonnement** : un `Abonnement` dont le `profilClient` et le `profilCoach`
appartiennent au même `Compte` est refusé (erreur `auto_abonnement_interdit`).

`ProfilClient` : `prenom`, `nom`, `photo?`, `commune?`, `objectifTexte?`, `poidsDepartGrammes?`,
`poidsCibleGrammes?`, `consentementSante` (voir 3.12).

`ProfilCoach` : `prenom`, `nom`, `photo?`, `discipline` (une seule, dans une liste figée),
`titreCourt`, `bio`, `communeBase?`, `formats` ⊆ {visio, presentiel}, `langues`,
`statutVerification`, `delaiReponseHeures` (calculé), `note` (calculée), `nombreAvis` (calculé),
`nombreAbonnes` (calculé), `commissionOfferteJusquLe?`.

### 3.3 Offre

| Champ | Règle |
|---|---|
| `titre`, `description` | |
| `prixMensuelCentimes` | 1 000 à 50 000 (10 € à 500 €) |
| `benefices` | 3 à 5 lignes |
| `engagementHumain` | **obligatoire**, non nul : au moins un élément parmi {ajustement hebdomadaire, visio mensuelle, messagerie avec délai de réponse annoncé} |
| `estMiseEnAvant` | une seule par coach — étiquette « LE PLUS CHOISI » |
| `statut` | `brouillon` \| `publiee` \| `retiree` |

**Une offre sans engagement humain est refusée à la publication.** C'est la règle qui tient tout
le modèle économique : elle évite que l'offre soit qualifiée de contenu numérique, ce qui
imposerait l'achat in-app.

Une offre `retiree` reste facturée aux abonnés existants jusqu'à leur résiliation, mais
n'apparaît plus à la vente. Le prix d'un abonnement est **figé au moment de la souscription** :
un changement de prix ne s'applique qu'aux nouveaux abonnés.

### 3.4 Abonnement

`profilClient`, `profilCoach`, `offre`, `prixFigeCentimes`, `jourPrelevement` (1–28, jour de la
souscription ; 29/30/31 ramenés à 28), `statut`, `debuteLe`, `prochainePrelevementLe`,
`pauseJusquLe?`, `resilieLe?`, `finAccesLe?`.

### 3.5 Facture

Immuable. `abonnement`, `numero` (séquence annuelle sans trou), `montantTtcCentimes`,
`montantHtCentimes`, `tva`, `commissionCentimes`, `emiseLe`, `payeeLe?`, `pdfUrl`.

Le vendeur porté sur la facture est **le coach** ; la plateforme émet une facture de commission
distincte au coach. C'est la conséquence directe du statut d'intermédiaire.

### 3.6 Programme / Seance / SeanceProgrammee / ExecutionSeance

- `Programme` : appartient à un coach, `titre`, `dureeSemaines`, `statut` (`brouillon` |
  `publie` | `archive`), liste ordonnée de `Seance`.
- `Seance` : `titre`, `dureeMinutes`, `exercices[]` (`nom`, `series?`, `repetitions?`,
  `chargeGrammes?`, `consigne`, `mediaId?`), `jourRelatif`.
- `SeanceProgrammee` : l'affectation d'une `Seance` à un client à une date donnée. C'est elle
  qui alimente « Ta séance du jour ».
- `ExecutionSeance` : ce que le client a réellement fait. `statut` (`a_faire` | `en_cours` |
  `faite` | `partielle` | `manquee`), `demarreeLe?`, `termineeLe?`, `ressentiEffort?` (1–10),
  `valeursSaisies[]`, `commentaire?`.

Une `SeanceProgrammee` non démarrée passe automatiquement à `manquee` à 23:59 Europe/Paris le
jour prévu. Une exécution démarrée mais non terminée dans les 24 h passe à `partielle`.

### 3.7 MesureCorporelle

`profilClient`, `type` ∈ {poids, tourDeTaille}, `valeur`, `mesureeLe`. **Donnée de santé** :
soumise à consentement explicite, jamais journalisée, jamais mise en cache sur l'appareil.
Pas de photo corporelle au jalon 1.

### 3.8 Conversation / Message

Une conversation est liée à un couple (`profilClient`, `profilCoach`) et existe dès qu'un
abonnement est ou a été actif, ou dès qu'un client écrit un premier message.
`Message` : `auteurProfil`, `texte`, `envoyeLe`, `luLe?`. Texte uniquement au jalon 1.

Le message groupé du coach crée **N messages distincts**, un par conversation. Il n'existe pas
de conversation de groupe.

### 3.9 Creneau / Reservation

`Creneau` : coach, `debut`, `fin`, `format`, `capacite` (1 au jalon 1), `statut`
(`ouvert` | `reserve` | `annule`).
`Reservation` : client, créneau, `statut` (`confirmee` | `annulee_client` | `annulee_coach` |
`honoree` | `non_honoree`).

**Politique d'annulation** (absente du dossier, tranchée ici) : annulation libre jusqu'à 24 h
avant. Entre 24 h et le début, le créneau est consommé et marqué `non_honoree`. Une annulation
par le coach est toujours libre et notifie le client. Aucun remboursement au créneau : l'offre
est un abonnement mensuel, pas une vente à l'unité.

### 3.10 Solde / Versement / LigneCommission

- `LigneCommission` : immuable, créée à chaque facture payée. `tauxApplique` (0 % ou 10 %),
  `montantCentimes`.
- `Solde` : agrégat calculé, jamais stocké comme vérité : somme des encaissements moins
  commissions moins versements déjà émis.
- `Versement` : `montantCentimes`, `mode` (`mensuel` | `immediat`), `fraisCentimes`
  (0 ou 100), `statut` (`prevu` | `en_cours` | `verse` | `echoue`), `emisLe`, `verseLe?`.

### 3.11 Avis

`profilClient`, `profilCoach`, `note` (1–5), `texte` (30 à 1 200 caractères),
`etiquettes[]` (0 à 3, liste figée de 8), `statut` (`publie` | `signale` | `masque`),
`reponseCoach?`.

**Conditions de dépôt** : abonnement actif depuis ≥ 30 jours, ou résilié depuis ≤ 60 jours.
Un seul avis par couple client/coach, modifiable 14 jours.

### 3.12 Consentement

`compte`, `type` ∈ {donneesSante, notificationsPush, communicationsCommerciales},
`accorde` (bool), `version` (du texte), `horodatage`, `origine`.

Le consentement `donneesSante` conditionne l'écriture de `MesureCorporelle` et de
`ressentiEffort`. **Son retrait ne supprime pas les données** : il bloque l'écriture et déclenche
une proposition d'effacement.

### 3.13 Signalement / Blocage

`Signalement` : `auteur`, `cible` (profil, message, avis, offre), `motif` (liste figée),
`texte?`, `statut` (`recu` | `en_examen` | `traite_action` | `traite_sans_suite`).
Accusé de réception immédiat, décision notifiée à l'auteur.
`Blocage` : symétrique dans ses effets — plus aucun message ni visibilité entre les deux profils.

---

## 4. Machines à états

Format : `état --(événement)--> état`. Toute transition non listée est **interdite** et doit
lever une erreur explicite. Chaque machine est testée transition par transition.

### 4.1 Compte

```
en_attente_verification --(courriel confirmé)--> actif
en_attente_verification --(30 jours sans confirmation)--> supprime
actif --(signalement grave / décision)--> suspendu
suspendu --(levée)--> actif
actif|suspendu --(demande de suppression)--> supprime   [purge à J+30]
```

### 4.2 Verification du coach

```
absente --(dossier déposé)--> en_examen
en_examen --(examen humain OK)--> verifiee
en_examen --(pièce manquante)--> complement_demande
complement_demande --(pièce fournie)--> en_examen
en_examen --(refus motivé)--> refusee
verifiee --(diplôme expiré / signalement fondé)--> revoquee
refusee|revoquee --(nouveau dossier)--> en_examen
```

Objectif de délai annoncé : 48 h ouvrées. **Un coach non `verifiee` ne peut pas publier
d'offre ni encaisser.** Il peut préparer son profil et ses programmes.
Le badge public « vérifié » n'apparaît qu'en `verifiee`.

### 4.3 Abonnement

```
                 (souscription + 1er paiement OK)
        —————————————————————————————————————————> actif
actif --(pause demandée)--> en_pause          [≤ 60 j, 1 fois / 12 mois]
en_pause --(reprise ou échéance)--> actif
actif --(échec de prélèvement)--> impaye
impaye --(paiement récupéré)--> actif
impaye --(7 jours sans succès)--> suspendu
suspendu --(paiement régularisé ≤ 30 j)--> actif
suspendu --(30 j)--> resilie
actif --(résiliation client)--> resiliation_programmee
resiliation_programmee --(fin de période payée)--> resilie
resiliation_programmee --(annulation de la résiliation)--> actif
actif --(coach part / offre supprimée par la plateforme)--> resilie [prorata remboursé]
```

Règles associées :
- **Aucun prorata à la souscription** : le premier prélèvement est plein, l'échéance suivante
  tombe au même jour du mois suivant.
- En `en_pause`, aucun prélèvement, aucun accès au programme, la place chez le coach est
  conservée. La messagerie reste ouverte.
- En `impaye`, **l'accès reste ouvert** (période de grâce, 7 jours). En `suspendu`, l'accès au
  contenu est coupé, la messagerie et les données personnelles restent accessibles.
- La résiliation est toujours **en fin de période payée**, jamais immédiate.

### 4.4 Paiement d'une échéance

```
programme --(exécution)--> en_cours
en_cours --(succès)--> paye        [facture émise, ligne de commission créée]
en_cours --(échec)--> echoue
echoue --(relance J+1)--> en_cours
echoue --(relance J+3)--> en_cours
echoue --(relance J+7)--> abandonne  [abonnement → suspendu]
```

Trois tentatives, à J+1, J+3, J+7. Chaque échec notifie le client avec **le motif transmis par
la banque**, et la phrase « rien n'a été débité ». Le coach est informé au premier échec, sans
détail bancaire.

### 4.5 SeanceProgrammee / ExecutionSeance

```
a_faire --(démarrage)--> en_cours
en_cours --(validation)--> faite
en_cours --(24 h sans fin)--> partielle
a_faire --(23:59 du jour prévu)--> manquee
manquee|partielle --(rattrapage ≤ 7 j)--> faite   [marqué "rattrapée"]
```

### 4.6 Programme

```
brouillon --(publication)--> publie      [coach vérifié requis]
publie --(archivage)--> archive          [clients en cours terminent leur cycle]
publie --(retour en édition)--> brouillon [interdit s'il a ≥ 1 client actif]
```

### 4.7 Reservation

```
confirmee --(annulation client > 24 h)--> annulee_client   [créneau rouvert]
confirmee --(annulation client ≤ 24 h)--> non_honoree
confirmee --(annulation coach)--> annulee_coach            [créneau rouvert, client notifié]
confirmee --(fin du créneau, présence)--> honoree
```

### 4.8 Versement

```
prevu --(le 5 du mois, solde ≥ 20 €)--> en_cours
prevu --(demande immédiate, solde ≥ 20 €, frais 1 €)--> en_cours
en_cours --(confirmation du prestataire)--> verse
en_cours --(rejet)--> echoue
echoue --(coordonnées corrigées)--> prevu
```

Un versement exige une identification complète du coach auprès du prestataire (KYC). Sans elle,
le solde s'accumule et une bannière persistante le signale.

### 4.9 Avis

```
brouillon --(dépôt)--> publie
publie --(signalement)--> signale
signale --(examen : sans suite)--> publie
signale --(examen : fondé)--> masque
publie --(modification ≤ 14 j)--> publie
```

---

## 5. Règles de calcul

Chaque métrique affichée dans les maquettes a une formule. Aucune n'est estimée côté
application : elles viennent toutes du serveur, déjà calculées.

### 5.1 Note d'un coach
Moyenne arithmétique des `Avis` en statut `publie`, arrondie au dixième.
**Affichée à partir de 5 avis.** En dessous : badge « Nouveau », aucune note, aucun tri par note.
La distribution par étoiles est le simple comptage par valeur.

### 5.2 Assiduité d'un client
Sur les 28 derniers jours :
`assiduite = seances_faites / seances_programmees`, arrondi à l'entier.
Une séance `partielle` compte pour 0,5. Une séance rattrapée compte pour 1.
Non affichée si moins de 4 séances programmées sur la période — affiche « — ».

### 5.3 Progression hebdomadaire (« Semaine 3 · 3/5 faites »)
Semaine = lundi 00:00 à dimanche 23:59, Europe/Paris. Numéro de semaine = rang depuis
`debuteLe` de l'abonnement.

### 5.4 Délai de réponse d'un coach
Médiane, sur 30 jours, du temps entre un message client et la première réponse du coach dans la
même conversation. Affiché par paliers : « en général sous 1 h / 3 h / 12 h / 24 h / 48 h ».
Non affiché en dessous de 5 échanges. **Pas d'indicateur de présence en temps réel.**

### 5.5 Commission
`tauxApplique = 0 %` si `date < commissionOfferteJusquLe`, sinon `10 %`.
`commissionOfferteJusquLe = date du premier abonnement actif du coach + 90 jours`, fixé une
seule fois, jamais recalculé.
La commission porte sur le montant TTC encaissé. Les frais du prestataire sont **à la charge de
la plateforme**, pas du coach : c'est ce qui rend le taux annonçable simplement.

### 5.6 Classement « Pertinence »
Déterministe, reproductible, et publié dans les CGU. Score = somme pondérée, calculée à la
requête :

| Composante | Poids | Détail |
|---|---|---|
| Correspondance textuelle | 40 | titre, discipline, bio |
| Proximité géographique | 20 | 1,0 à 0 km → 0 à 25 km ; « visio » = 0,6 fixe |
| Note | 15 | 0 si moins de 5 avis |
| Assiduité moyenne des abonnés | 10 | mesure de qualité réelle, pas de popularité |
| Délai de réponse | 10 | |
| Fraîcheur du profil | 5 | activité dans les 30 jours |

Aucune composante payante. Aucun coup de pouce manuel. À égalité, ordre alphabétique du nom.

### 5.7 Recherche géographique
Une commune (référentiel INSEE) + rayon fixe de 25 km à vol d'oiseau depuis le centroïde.
Aucune géolocalisation précise de l'utilisateur au jalon 1. Un coach « visio » ressort quelle
que soit la commune.

### 5.8 Revenus du coach (écran 13)
`net = encaissements du mois − commissions − versements déjà émis`.
Les trois lignes sont affichées séparément, la commission en rouge, avec son taux. La variation
mensuelle (« +12 % ») compare au même mois précédent, masquée si moins de 2 mois d'historique.

---

## 6. Jeu de données de démonstration figé

Repris du dossier de design, cohérent d'un écran à l'autre. À figer dans `src/fixtures/` dès le
lot L0, et à ne jamais modifier ensuite sans mettre à jour toutes les fiches d'écran.

**Clients** : Camille Dupré (abonnée à Yannick, semaine 3, 3/5 faites), Sophie L. (abonnée
3 mois, auteure de l'avis mis en avant), Karim Osei, Bruno Talbot, Léa Nguyen.
**Coachs** : Yannick Berthaud (préparation physique, Lyon et visio, 4,9 · 214 avis, 49 €/mois),
Nadia Belkacem (cybersécurité, Paris et visio, 4,9 · 87 avis, 39 €/mois), Inès Marchand (yoga,
Bordeaux, visio et présentiel, 4,8 · 62 avis, 29 €/mois), Ophélie Renard (cuisine, Nantes, visio,
3 avis — sous le seuil de 5, donc pas de note affichée, badge « Nouveau » §5.1, 34 €/mois),
Thomas Kieffer (développement professionnel, Lille, visio, 4,6 · 11 avis, 45 €/mois), Marc
Ferreira (RGPD, Toulouse, visio et présentiel, 4,7 · 41 avis, 54 €/mois).

Les offres « Programme seul » présentes dans les maquettes sont **retirées des fixtures**
(arbitrage §0.9).
