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
         │        │                 ├── TentativePrelevement   │
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
  à 30 jours, sauf obligation comptable (factures : 10 ans). Une troisième fenêtre, distincte
  des deux précédentes parce qu'elle n'est pas une conservation : tant que le compte existe, son
  titulaire peut exporter ses données (C-07, `docs/api.md` §14) — au-delà de la suppression, ce
  n'est plus possible. Ce n'est pas une durée de rétention de plus, c'est la dernière occasion
  de récupérer ce qui va être détruit.
- **Historique d'argent** : les entités `Facture`, `Versement` et `LigneCommission` sont
  **immuables**. Une correction crée une nouvelle ligne, jamais une modification.
- **Autorisation** : chaque requête porte le profil actif. Une donnée du profil client est
  inaccessible depuis le profil coach du même compte, et réciproquement. La lecture croisée des
  profils eux-mêmes (`ProfilClient`, `ProfilCoach`) est tolérée parce qu'ils ne portent que de
  l'identité — qui existe, quel nom, quel statut. Toute table portant du **contenu** (mesures,
  abonnements, messages, séances, agenda) applique cette règle au sens strict, lecture comprise,
  et le choix inverse doit être justifié table par table.
- **Magasins d'applications — ce qui autorise le paiement hors achat in-app** (écrit le
  28 septembre 2026, `docs/prompts/L4.md` point 11). Le client paie **un service rendu par une
  personne**, jamais l'accès à du contenu numérique. C'est `engagementHumain` (§3.3) qui le
  porte : sans lui, l'offre deviendrait du contenu, et Apple (*App Review Guidelines* 3.1.1 :
  « unlock features or functionality », « access to premium content ») comme Google imposeraient
  leur propre système de paiement. Textes sur lesquels le raisonnement s'appuie : Apple 3.1.3(d)
  (« real-time person-to-person services between two individuals [...] fitness training ») et
  3.1.3(e) (services « consumed outside of the app »), Google Play *Payments policy*
  (« physical services », « gym memberships »).
  **Ce que le raisonnement ne couvre pas d'office** : 3.1.3(d) vise le *temps réel*, alors que
  l'ajustement hebdomadaire et la messagerie sont asynchrones et que le programme (L6) est livré
  dans l'application. **Décidé le 28 septembre 2026 : sur iOS, l'offre n'est probablement pas un
  service temps réel entre deux personnes** — c'est un **point bloquant nommé** de la soumission
  iOS, avec un plan B écrit (souscription sur le web, application iOS réduite au suivi), non
  construit : `docs/perimetre.md` §6. Android et le web ne sont pas concernés au même degré, et
  le tunnel se construit pour eux. Toute offre « un coach,
  plusieurs clients à la fois » relève de « one-to-few / one-to-many », achat in-app obligatoire
  chez Apple : c'est une raison de plus, pas la seule, pour qu'elle reste hors périmètre.
  **Ce que l'interface ne fait jamais**, dans le tunnel (04a, 04b, 04c, 20) et partout où l'on
  parle de ce que le client achète : aucune formulation qui vende de l'accès à du contenu,
  aucun déverrouillage, aucun vocabulaire d'abonnement numérique. Termes interdits : « débloquer »,
  « déverrouiller », « premium », « illimité », « exclusif », « accès au contenu » / « accéder au
  contenu », « bibliothèque », « VIP », « version complète ». Ce que le client achète se nomme par
  le coach et son geste (« suivi », « accompagnement », « ton coach », l'engagement humain de
  l'offre). « Abonnement » reste permis — c'est le contrat récurrent, au sens d'un abonnement de
  salle de sport — à condition d'être rattaché au coach, jamais à du contenu. Vérifié par un test
  de libellés interdits sur les quatre écrans du tunnel (liste unique dans `src/test/`), qui
  balaie les textes rendus et les libellés d'accessibilité. Un test attrape un mot, pas une
  tournure : la relecture humaine reste due à chaque texte du tunnel.
  Conséquence de vocabulaire interne, pas d'interface : §4.3 parle d'« accès au contenu » coupé
  en `suspendu` — c'est la description d'un droit, jamais un texte à afficher tel quel.

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

`ProfilCoach` : `prenom`, `nom`, `photo?`, `discipline` (une seule, référence `Discipline` ci-
dessous), `titreCourt`, `bio`, `communeBase?`, `formats` ⊆ {visio, presentiel}, `langues`,
`statutVerification`, `delaiReponseHeures` (calculé), `note` (calculée), `nombreAvis` (calculé),
`nombreAbonnes` (calculé), `commissionOfferteJusquLe?`, et son **identité fiscale** (ci-dessous).

**Identité fiscale du coach** (déclarée le 28 septembre 2026, **collectée en L5**, où
l'identification Stripe du coach en réclame déjà l'essentiel — `docs/api.md` §8) : `siren`,
`adresseFacturation` (ligne, code postal, commune), `regimeTva` (`franchise_en_base` |
`assujetti`), et `tauxTvaPourMille` quand `regimeTva = assujetti`. C'est le coach qui vend
(§3.5) : ce sont les mentions de SA facture, que la plateforme émet en son nom. Aucune de ces
données n'est publique (même protection que `commissionOfferteJusquLe` : jamais dans les grants de
lecture de `profils_coach`, `docs/backend.md` §8). À L4, aucune n'existe encore en base : les
factures de L4, toutes de mode test, portent ces champs **vides** (§3.5).

### 3.2bis Discipline (catalogue)

**Règle métier, écrite le 13 septembre 2026** — trouvée en défaut pendant la validation de L3 :
`profils_coach.discipline` était un texte libre depuis 0001, sans contrainte. « Préparation
physique » et « préparation physique » y auraient été deux valeurs distinctes, ce qui aurait
rendu le filtre de recherche de L3 non fiable — la donnée le permettait, rien ne l'empêchait.

`Discipline` : `cle` (la valeur stockée par `ProfilCoach.discipline`, et le filtre de recherche
du lot L3), `libelle` (le texte affiché), `ordreAffichage`, `active`. Table de référence
(`disciplines`, `supabase/migrations/0020_creer_disciplines_reference.sql`), **pas une
énumération figée dans le schéma** : le catalogue est destiné à grandir — le produit se veut
« toutes disciplines » (`CLAUDE.md` §1, sport/nutrition/cuisine/cybersécurité/développement
professionnel ne sont qu'un point de départ) — une nouvelle discipline s'ajoute en insérant une
ligne, jamais en modifiant un type SQL. `active = false` retire une discipline du catalogue
proposé (inscription, filtre de recherche) sans invalider les profils qui la portent déjà : la
clé étrangère depuis `ProfilCoach.discipline` vérifie seulement que la ligne existe, jamais
`active`. `cle` et `libelle` sont volontairement séparés : renommer un libellé affiché ne touche
jamais aux profils déjà écrits.

Sept disciplines à l'ouverture du lot L3 : préparation physique, yoga, nutrition, cuisine,
cybersécurité, RGPD, développement professionnel.

### 3.3 Offre

**Nature unique au jalon 1 : abonnement.** L'arbitrage #9 (§0) a supprimé « Programme seul » ;
`docs/perimetre.md` (écran 04a) limite le tunnel à une seule nature d'offre. Une offre n'est
**jamais** autre chose qu'un abonnement mensuel à ce jalon — pas d'appel découverte, pas de
séance à l'unité, pas de pack. Ne pas préparer de champ ni de colonne pour ces natures : elles
sont hors périmètre, pas « pour plus tard » (`docs/perimetre.md` §3, règle pour Claude Code).

| Champ | Règle |
|---|---|
| `profilCoach` | L'offre **appartient** à un `ProfilCoach`. Elle peut exister en `brouillon` avant que ce coach soit `verifiee` (§4.2) ; elle ne peut être **publiée** que si son coach l'est (409 `coach_non_verifie`, `docs/api.md` §5) |
| `titre`, `description` | |
| `prixMensuelCentimes` | 1 000 à 50 000 (10 € à 500 €). Borne basse : éviter les offres d'appel qui dévalorisent le travail des coachs et attirent des abonnements jetables. Borne haute : au-delà de 500 €/mois on sort du modèle d'abonnement mensuel grand public, et le risque de litige et d'opposition bancaire change de nature. Décision, pas une mesure du marché — à revoir si le marché la contredit |
| `recurrence` | **fixe, mensuelle** — pas un champ éditable : une seule valeur possible tant qu'une seule nature d'offre existe. Un futur type d'offre ré-ouvrirait cette question, pas ce jalon |
| `benefices` | 3 à 5 lignes |
| `engagementHumain` | **obligatoire**, non nul : au moins un élément parmi {ajustement hebdomadaire, visio mensuelle, messagerie avec délai de réponse annoncé} |
| `estMiseEnAvant` | une seule par coach — étiquette « LE PLUS CHOISI » |
| `publieeLe`, `retireeLe` | dates, toutes deux nullables. `brouillon` = les deux `null` ; `publiee` = `publieeLe` posée, `retireeLe` `null` ; `retiree` = `retireeLe` posée. Pas de colonne `statut` séparée : ces trois libellés sont une lecture, pas une troisième source de vérité (même logique que `Compte` §4.1, dont la machine à états ne correspond à aucune colonne littérale) |

**Une offre sans engagement humain est refusée à la publication.** C'est la règle qui tient tout
le modèle économique : elle évite que l'offre soit qualifiée de contenu numérique, ce qui
imposerait l'achat in-app.

**Aucun fonds retenu pour un coach qui ne peut pas le recevoir** (écrit le 28 septembre 2026,
**applicable en L5**, `docs/backend.md` §13). Avec les charges séparées, l'argent d'un client
arrive sur le compte de la plateforme et n'est viré au coach que par un `Versement` (§3.10) vers
son compte Stripe Connect. Un coach dont ce compte n'est pas opérationnel (identification
incomplète, virements non autorisés par Stripe) laisserait la plateforme détenir son argent pour
une durée indéterminée — ce qu'elle ne doit jamais faire. Deux règles, qui ne font qu'une :

1. **Une offre ne peut être publiée que si le compte de versement de son coach est
   opérationnel**, en plus de `verifiee` (§4.2) et de l'engagement humain (409
   `compte_versement_non_operationnel`).
2. **Une souscription est refusée si le compte de versement du coach n'est plus opérationnel au
   moment de payer**, même pour une offre déjà publiée (même code) — la règle 1 ne suffit pas :
   un compte peut perdre ce statut après la publication (Stripe demande une pièce, un
   justificatif expire).

**Étendue le 28 septembre 2026 à l'identité fiscale** : les deux règles ci-dessus exigent aussi
que l'**identité fiscale du coach soit complète** (§3.2 : `siren`, `adresseFacturation`,
`regimeTva`, et `tauxTvaPourMille` s'il est assujetti) — 409 `identite_fiscale_incomplete`,
applicable en L5 au même moment. Raison : une vente réelle produit une facture au nom du coach
(§3.5) ; sans ces mentions, elle ne serait pas conforme. C'est cette règle, et elle seule, qui
interdit d'émettre une facture réelle incomplète : à L4, toutes les factures sont de mode test.

« Opérationnel » est lu depuis Stripe par le serveur, jamais déclaré par l'application. Son
critère exact (capacité `transfers` active, aucune exigence d'identification en retard) s'écrit
avec l'identification du coach en L5 (`docs/api.md` §8).
**D'ici L5, personne ne paie réellement** : L4 fonctionne en mode test Stripe
(`CLAUDE.md` §2), et le premier paiement réel n'est possible qu'une fois ces deux règles
appliquées. Aucune offre publiée avant L5 ne peut donc encaisser un euro réel sans être passée
par la règle 2.

**L'intention de souscription fige l'offre** (tranché le 28 septembre 2026, **appliqué en P4.5**,
`docs/api.md` §7). L'intention créée au moment où le client choisit l'offre (04a) retient son
titre et son prix. La souscription honore cette intention **même si l'offre a été retirée
entretemps, tant que l'intention a moins de 30 minutes** — la durée de validité de la page de
paiement. Le client a payé ce qu'on lui a montré : rembourser est pire que servir. **Retirer une
offre ferme la vente future, jamais une vente en cours.** Au-delà de 30 minutes, ou pour une offre
qui n'était pas publiée au moment de l'intention, la souscription est refusée
(`offre_indisponible`).

**Coach dont la vérification change entre l'intention et le paiement** (tranché le 30 septembre
2026, révisé le 1er octobre 2026, avant la migration de P4.5). L'intention n'a pu être créée que
pour un coach `verifiee` (§4.2). **Au paiement, seul `verifiee` est honoré.**

Tout autre statut veut dire que la plateforme a écarté ce coach entre-temps : depuis `verifiee`,
la machine §4.2 n'a qu'une sortie, `revoquee`. Un coach `en_examen` ou `complement_demande` au
moment du paiement a donc **forcément été révoqué** après l'intention, puis a redéposé un
dossier — ce n'est pas de la paperasse en cours. (Première rédaction du 30 septembre : honorer
`en_examen` et `complement_demande` comme une offre retirée. Abandonnée parce qu'elle aurait donné
un client à un coach révoqué qui avait simplement redéposé son dossier dans la demi-heure.)

Dans tous ces cas (`revoquee`, `refusee`, `en_examen`, `complement_demande`), **l'abonnement
n'est pas créé** : donner un client à quelqu'un qu'on vient d'écarter serait pire que rembourser.
Le paiement reçu est **accepté quand même** par le serveur (réponse 200 au prestataire : jamais
une boucle d'échecs, qui relivrerait l'événement pendant des jours sans rien changer) et le cas
est enregistré comme **anomalie de paiement** (session, intention, motif `coach_ecarte`, date),
que le rapprochement quotidien remonte (`docs/prompts/L4.md` point 12). **Le remboursement se
fait à la main**, dans le tableau de bord du prestataire, au jalon 1 : aucun code de
remboursement dans L4. Au constat, le client reçoit `souscription_impossible` (`docs/api.md` §7).

La règle ne vaut que **tant qu'aucun abonnement n'existe pour ce paiement**. Un abonnement SEPA
déjà créé en `en_attente_confirmation` suit sa propre machine (§4.3), même si le coach est révoqué
avant la confirmation de la banque : cas non tranché, inscrit dans `docs/dette.md`.

Une offre `retiree` reste facturée aux abonnés existants jusqu'à leur résiliation, mais
n'apparaît plus à la vente. Le prix d'un abonnement est **figé au moment de la souscription** :
un changement de prix ne s'applique qu'aux nouveaux abonnés.

**Pas de suppression.** Le dépôt n'a aucune politique `DELETE` et n'en gagne pas pour `Offre` :
retirer une offre pose `retireeLe`, ne supprime aucune ligne. `docs/api.md` §5 documente un
verbe `DELETE /coach/offres/{id}` — c'est un nom d'action HTTP, pas un `DELETE` SQL : le serveur
y répond par la même écriture (`retireeLe`), jamais par une suppression de ligne.

### 3.4 Abonnement

`profilClient`, `profilCoach`, `offre`, `prixFigeCentimes`, `jourPrelevement` (1–28, jour de la
souscription ; 29/30/31 ramenés à 28), `statut`, `debuteLe`, `prochainePrelevementLe`,
`pauseJusquLe?`, `dernierePauseLe?`, `resilieLe?`, `finAccesLe?`, `actifDepuisLe?`,
`moyen` (`carte` | `sepa`), `referencePaiement` (serveur seulement, jamais lisible par
l'application).

`dernierePauseLe` (ajouté le 28 septembre 2026, P4.3) : jour de début de la dernière pause. Sans
elle, « une fois par période de 12 mois » (§4.3) ne se vérifie pas.

`actifDepuisLe` (ajouté le 28 septembre 2026) : date de la **première** entrée en `actif`,
posée une seule fois, jamais recalculée — y compris après une pause, un impayé ou une
régularisation. Par carte, elle vaut la date de souscription ; par SEPA, la date de confirmation
du premier prélèvement (pas celle du mandat, qui fonde `debuteLe`). C'est l'unique base de
l'éligibilité aux avis et de la durée de suivi affichée (§3.11) : aucun historique d'états à
tenir.

### 3.4bis TentativePrelevement

**Ajoutée le 28 septembre 2026** (`docs/prompts/L4.md` point 5). La machine §4.4 décrit trois
tentatives et un motif bancaire par échec, mais aucune entité ne les portait : sans elle, la
relance ne sait pas combien de tentatives ont déjà eu lieu, et l'écran 20 n'a rien de réel à
afficher.

Une ligne par tentative de prélèvement d'une échéance — la première exécution comprise, pas
seulement les relances.

| Champ | Règle |
|---|---|
| `abonnement` | L'`Abonnement` prélevé |
| `echeanceLe` | La date d'échéance visée (la valeur de `prochainePrelevementLe` au moment de la première tentative). Regroupe les tentatives d'une même échéance : c'est elle, pas l'abonnement seul, qui borne le compte à trois |
| `tentativeNumero` | 1 à 3. 1 = l'exécution à l'échéance ; 2 et 3 = les relances. Unique par (`abonnement`, `echeanceLe`) |
| `statut` | `en_cours` \| `reussie` \| `echouee` |
| `motifBanque?` | posé à l'échec seulement, jamais deviné. Valeurs : celles de `docs/api.md` §7 (`fonds_insuffisants`, `carte_expiree`, `opposition`, `plafond_atteint`, `authentification_echouee`, `inconnu`) |
| `referencePrestataire` | L'identifiant de l'intention de paiement Stripe de cette tentative |
| `tenteeLe`, `termineeLe?` | |

**Le premier paiement, à la souscription, n'est pas une échéance.** Par carte, §4.3 ne crée
l'abonnement qu'une fois ce paiement réussi : s'il échoue, il n'y a ni `Abonnement`, ni
`TentativePrelevement`, ni relance — seulement la réponse 402 de `docs/api.md` §7 et l'écran 20,
où le client réessaie lui-même. Par prélèvement SEPA, l'abonnement existe dès le mandat, en
`en_attente_confirmation` (§4.3) ; un rejet de ce premier prélèvement le fait passer en `annule`,
toujours sans `TentativePrelevement` ni relance. Les tentatives et relances ne concernent que les échéances suivantes, d'un abonnement
qui existe déjà.

Pas immuable au sens de `Facture` : `statut` passe une fois de `en_cours` à `reussie` ou
`echouee`, puis ne bouge plus. Aucune suppression. Une tentative `reussie` a exactement une
`Facture` ; une tentative `echouee` n'en a aucune (« rien n'a été débité », §4.4).

**Nombre de tentatives et calendrier.** §4.4 écrit trois relances (J+1, J+3, J+7) mais « trois
tentatives » : lu ensemble, ce sont **quatre** prélèvements possibles (l'échéance, puis J+1, J+3,
J+7) si J+7 en est un, ou **trois** si J+7 n'est que le constat d'abandon. La machine §4.4
elle-même tranche pour la seconde : `echoue --(relance J+7)--> abandonne` va directement à
`abandonne`, sans repasser par `en_cours` — J+7 ne prélève pas. Lecture retenue, **à valider**
au point d'arrêt de P4.1 : trois tentatives au total — échéance (1), J+1 (2), J+3 (3) — et J+7
est le constat `abandonne`, qui coïncide avec `impaye --(7 jours sans succès)--> suspendu`
(§4.3). §4.4 est réécrit en conséquence, pour que le libellé « relance J+7 » ne fasse plus croire
à un quatrième prélèvement.

### 3.5 Facture

Immuable. `abonnement`, `numero` (séquence annuelle sans trou), `montantTtcCentimes`,
`montantHtCentimes`, `tva`, `commissionCentimes`, `emiseLe`, `payeeLe?`, `pdfUrl`.

Le vendeur porté sur la facture est **le coach** ; la plateforme émet une facture de commission
distincte au coach. C'est la conséquence directe du statut d'intermédiaire.

**Précisé le 28 septembre 2026 (P4.4)** — règles avant le schéma :

- **Émise au nom et pour le compte du coach.** La plateforme l'émet, le coach en est le vendeur.
  Cela suppose un **mandat de facturation** dans le contrat coach : question au juriste
  (`docs/perimetre.md` §6), pas tranchée ici.
- **Numérotation : une série par coach, par année civile (Europe/Paris), sans trou.** C'est lui
  l'émetteur, la série lui appartient. Format `AAAA-NNNNNN` (`2026-000001`), unique pour un coach.
  **Mécanisme** : un compteur par coach et par année, verrouillé et incrémenté **dans la même
  transaction** que l'insertion de la facture — si l'insertion échoue, l'incrément est annulé avec
  elle, et le numéro n'est jamais consommé. **Pas une séquence Postgres** : une séquence n'est
  jamais annulée par un rollback, elle laisserait un trou à chaque transaction échouée.
- **Elle porte sa propre copie de ce qu'elle prouve** : les parties (vendeur : prénom, nom, et son
  identité fiscale — vide à L4, §3.2 ; client : prénom, nom), le libellé (titre de l'offre au
  moment de la vente), la période facturée, les montants. **Aucun lien ne l'entraîne dans une
  suppression** : l'abonnement, le client, le coach peuvent disparaître (purge à J+30, §2), la
  facture reste, lisible sans eux, dix ans (§2). C'est ce que l'écran de suppression de compte
  annonce déjà au client (`docs/ecrans/L2-01-suppression-compte.md`).
- **Montants HT et TVA** : calculés depuis le `regimeTva` du coach **au moment de l'émission** —
  franchise en base : HT = TTC, TVA nulle, mention « TVA non applicable, art. 293 B du CGI » ;
  assujetti : HT = TTC / (1 + taux), arrondi au centime. **Régime inconnu (toutes les factures de
  L4) : HT et TVA restent vides**, jamais devinés — c'est précisément ce qui en fait des factures de
  mode test.
- **Une facture par paiement encaissé**, idempotente par la référence du paiement chez le
  prestataire (`referencePrestataire`, unique) : le webhook et le constat
  (`docs/api.md` §7) peuvent tous deux la déclencher, une seule naît.
- `pdfUrl` : vide jusqu'à L5 (factures et reçus téléchargeables, C-05).
- **La facture de commission de la plateforme au coach est reportée en L5**, avec les versements
  (`docs/prompts/L4.md`). L4 ne crée que la `LigneCommission` (§3.10).

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

`profilClient`, `profilCoach`, `note` (1–5, **seul champ obligatoire**), `texte?`
(**facultatif**, 600 caractères au plus, aucun minimum), `etiquettes[]` (0 à 3, parmi la liste
fermée ci-dessous), `statut` (`publie` | `signale` | `masque`), `reponseCoach?` (**toujours vide
au jalon 1** — voir ci-dessous).

**Révisé le 28 septembre 2026, maquette `maquettes/MyFavCoach-Avis_dc.html` (27a/27b)** :
- **La note seule suffit.** Le texte, autrefois obligatoire (30 à 1 200 caractères), devient
  facultatif : exiger une rédaction fait chuter le taux de dépôt, et une note seule vaut mieux
  qu'un avis jamais écrit. **600 caractères au plus, aucun minimum** (tranché le 28 septembre
  2026) : un minimum force à meubler, et une note avec deux étiquettes sans phrase vaut mieux
  qu'un avis jamais déposé. Un texte vide ou fait seulement d'espaces est enregistré comme absent.
- **Trois étiquettes au plus** : au-delà, elles ne distinguent plus rien et l'agrégation par
  étiquette sur le profil perd son sens. Plafond vérifié par le serveur.
- **Ce qui est public, et rien d'autre** : la note, les étiquettes, le texte s'il existe, le
  prénom et l'initiale du nom de l'auteur, et **la durée de son suivi** (« 7 mois de suivi »),
  **jamais une date** — l'ancienneté dit ce qui donne du poids à l'avis sans dater précisément un
  abonnement. Elle est calculée par le serveur, par une lecture étroite (même famille que
  `docs/backend.md` §11), jamais déduite de `debuteLe` côté application. L'écran de dépôt annonce
  tout cela **avant** la publication.
- **Réponse du coach : hors L4** (tranché le 28 septembre 2026). La colonne `reponseCoach` existe
  et reste vide ; aucun écran ne l'écrit. Elle revient avec le pilotage coach ou au jalon 2
  (`docs/jalon-2.md`, avec les quatre règles à écrire ce jour-là).

**Étiquettes d'avis — liste fermée de huit** (arbitrage #16 ; liste fixée le 28 septembre 2026) :

| `cle` | `libelle` |
|---|---|
| `ecoute` | Écoute |
| `clarte_explications` | Clarté des explications |
| `ponctualite` | Ponctualité |
| `exigence` | Exigence |
| `programme_adapte` | Programme adapté |
| `reactivite` | Réactivité |
| `encouragement` | Encouragement |
| `professionnalisme` | Professionnalisme |

Table de référence (`etiquettes_avis` : `cle`, `libelle`, `ordreAffichage`), **même mécanisme que
`Discipline` (§3.2bis) et les langues** (`0025`) : pas une énumération figée dans le schéma, pas un
texte libre. Un avis référence ses étiquettes par `cle` (clé étrangère) ; renommer un libellé ne
touche aucun avis déjà écrit. L'ordre du tableau est l'ordre d'affichage. La liste est **fermée** :
une neuvième étiquette est une décision produit, écrite ici d'abord, jamais une ligne insérée
pour un besoin d'écran. Aucune colonne `active` tant qu'aucun retrait n'est décidé.

**Conditions de dépôt** : abonnement actif depuis ≥ 30 jours, ou résilié depuis ≤ 60 jours.
Un seul avis par couple client/coach, modifiable 14 jours.

Précisées le 28 septembre 2026 — toutes calculées par le serveur, sur `actifDepuisLe` (§3.4) :

| Branche | Condition au moment du dépôt |
|---|---|
| **En cours** | statut `actif` ou `resiliation_programmee`, **et** au moins 30 jours calendaires écoulés depuis `actifDepuisLe`, pauses et impayés passés compris. En `en_pause`, `impaye`, `suspendu`, `en_attente_confirmation` : pas de dépôt |
| **Terminé** | statut `resilie`, **et** `finAccesLe` (la fin réelle du service, pas la date du clic de résiliation) il y a au plus 60 jours, **et** au moins 30 jours calendaires entre `actifDepuisLe` et `finAccesLe` |

La troisième condition de la branche « terminé » rend explicite une intention déjà exprimée :
en dessous d'un mois de suivi, l'avis n'existe pas. Sans elle, un client dont le coach part au
cinquième jour (`resilie` avec prorata, §4.3) serait éligible avec « 0 mois de suivi ». `annule`
(SEPA rejeté) n'ouvre jamais de dépôt : il n'y a jamais eu de suivi.

**Durée de suivi affichée** : même base — jours calendaires depuis `actifDepuisLe` jusqu'à
aujourd'hui (branche en cours) ou jusqu'à `finAccesLe` (branche terminée, **figée** ensuite),
convertis en mois par **arrondi au plus proche sur une base de 30 jours** (`round(jours / 30)`).
Comme toute personne éligible compte au moins 30 jours de suivi, la durée affichée vaut au moins
« 1 mois » : le cas « moins d'un mois » ne se pose pas. Une base de 30 jours plutôt que le mois
calendaire : du 1er au 31 mars, 30 jours font zéro mois calendaire complet, ce qui aurait
contredit la règle précédente.

### 3.12 Consentement

`compte`, `type` ∈ {donneesSante, notificationsPush, communicationsCommerciales},
`accorde` (bool), `version` (du texte), `horodatage`, `origine`.

Le consentement `donneesSante` conditionne l'écriture de `MesureCorporelle` et de
`ressentiEffort`. **Son retrait ne supprime pas les données** : il bloque l'écriture et déclenche
une proposition d'effacement.

**Journal d'ajout seul** : un changement de consentement crée toujours une nouvelle ligne
(`accorde` reflétant le nouvel état), jamais une modification d'une ligne existante — la preuve
d'un consentement passé doit rester reconstituable (`supabase/migrations/0001_creer_identite.sql`).

### 3.13 Signalement / Blocage

`Signalement` : `auteur`, `cible` (profil, message, avis, offre), `motif` (liste figée),
`texte?`, `statut` (`recu` | `en_examen` | `traite_action` | `traite_sans_suite`).
Accusé de réception immédiat, décision notifiée à l'auteur.
`Blocage` : symétrique dans ses effets — plus aucun message ni visibilité entre les deux profils.

### 3.14 DecisionVerification

`dossier` (le `ProfilCoach` concerné), `examinateur` (le compte d'équipe qui décide —
`docs/backend.md` §9), `decision` (`verifiee` | `complement_demande` | `refusee`), `motif`
(texte ; **nomme la pièce concernée** quand la décision porte sur un document précis d'un
dossier par ailleurs complet — §4.2), `horodatage`.

**Journal en ajout seul**, même forme que `Consentement` (§3.12) : une décision ne se modifie
jamais, elle s'ajoute. Un dossier accumule une ligne par aller-retour (dépôt →
`complement_demande` → nouveau dépôt → `verifiee`, par exemple) ; le statut courant à afficher
au coach reste `profils_coach.statut_verification` (une seule valeur, jamais recalculée depuis
ce journal) — ce journal répond à « qui a décidé quoi, quand, pourquoi », pas à « où en est le
dossier maintenant ». Même séparation que `consentements` / `consentements_courants` (§3.12).

Pas de suppression, pas de modification : une décision fausse ou à corriger ne s'efface pas,
elle est suivie d'une nouvelle décision qui la remplace en pratique — la trace complète reste
lisible, y compris l'erreur.

### 3.15 Invitation

**Règle métier, écrite le 17 septembre 2026 (lot L3bis)** : un coach porte un jeton unique et
régénérable (`docs/prompts/L3bis.md`, point 1) — pas une invitation par destinataire. Le jeton
identifie le COACH, jamais une personne précise avant qu'elle n'ait réellement créé un compte
par ce lien.

`Invitation` : `coach` (`ProfilCoach`), `compteInvite?` (`Compte`, absent tant qu'aucun compte
n'a été créé par ce lien), `statut` (`en_attente` | `compte_cree` | `abonnee`), `creeLe`,
`compteCreeLe?`, `abonneeLe?`.

**Règle de troncature d'identité** (`docs/prompts/L3bis.md`, point 2) : le coach ne lit jamais,
par cette relation, plus que le **prénom et l'initiale du nom** de `compteInvite` — à tous les
états où une identité individuelle est visible (`compte_cree`, `abonnee`). Aucune autre colonne
de `Compte` ni de `ProfilClient` n'est accessible par ce chemin, ni avant ni après un abonnement
réel. Une vue plus complète du client suppose une relation d'abonnement établie et vit ailleurs
(L7, « Fiche client » — hors périmètre du lot qui introduit `Invitation`).

`abonnee` ne se déclenche que lorsque `compteInvite` s'abonne **précisément** à l'offre du coach
qui l'a invité — câblé à L4 (`Abonnement` n'existe pas avant ce lot), jamais par le lot qui
introduit cette entité. Voir §4.11 pour la machine à états, et la règle 8 de
`docs/prompts/L3bis.md` pour ce que ça implique pour les tests écrits avant que ce câblage
n'existe.

**Conséquence assumée, écrite ici plutôt que découverte en production** : `compteInvite.prenom`
et `.nom` se lisent en réalité sur `ProfilClient`, qui ne se crée qu'à l'étape 1 de l'onboarding
(`docs/ecrans/L1-05-onboarding-client.md`) — jamais à l'inscription elle-même. Un compte créé par
un lien d'invitation mais qui n'a pas encore commencé son onboarding n'a donc **aucune identité à
montrer**, et n'apparaît PAS dans ce que le coach lit (`mes_invitations()`, `docs/backend.md`
§11) tant que `ProfilClient` n'existe pas — ni comme `compte_cree` tronqué, ni autrement. Ce
n'est pas un défaut à corriger : un compte sans `ProfilClient` n'a rien de réel à afficher, et
inventer un nom de repli (« Nouveau client », un identifiant) serait pire qu'une absence
temporaire. **Conséquence pour l'écran (I-01)** : le compteur affiché ne peut donc pas prétendre
compter les comptes créés, seulement ceux qui ont commencé leur onboarding — le libellé doit le
dire honnêtement plutôt qu'annoncer un total qu'il ne mesure pas (voir
`docs/ecrans/L3bis-I01-inviter-mes-clients.md`, Règles).

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

Le dossier porte **trois pièces** : pièce d'identité, diplôme ou certification, et **attestation
d'assurance responsabilité civile professionnelle** — les trois obligatoires, aucune facultative.
Une plateforme de mise en relation sportive qui n'exigerait pas la RC pro de ses coachs serait
exposée ; ce n'est pas une nuance d'écran, c'est une condition du dossier.

Objectif de délai annoncé : **48 h ouvrées**, pour l'ensemble du dossier.

**Un seul statut par dossier, jamais un statut par pièce.** Les six valeurs ci-dessus qualifient
le dossier entier, pas un document. Quand une seule pièce bloque un dossier par ailleurs
complet, le statut reste `complement_demande` et **le motif rédigé par l'examinateur nomme la
pièce concernée** (« Diplôme illisible : la photo est trop floue pour lire l'organisme et la
date. ») — jamais un statut individuel par document, qui serait un second modèle à côté de
celui-ci.

**Un coach non `verifiee` ne peut pas publier d'offre ni encaisser.** Il peut préparer son
profil et ses programmes — et son profil est **consultable par lien direct dès qu'il existe**,
sans le badge « vérifié » (qui n'apparaît qu'en `verifiee`) : préparer et être consultable, oui ;
publier une offre ou encaisser, non, avant `verifiee`.

### 4.3 Abonnement

```
                 (souscription + 1er paiement OK, carte)
        —————————————————————————————————————————> actif
                 (souscription + mandat SEPA accepté)
        —————————————————————————————————————————> en_attente_confirmation
en_attente_confirmation --(1er prélèvement confirmé)--> actif     [facture émise, ligne de commission]
en_attente_confirmation --(1er prélèvement rejeté)--> annule      [aucune facture, rien débité]
actif --(pause demandée)--> en_pause          [≤ 60 j, 1 fois / 12 mois]
en_pause --(reprise ou échéance)--> actif     [nouveau cycle depuis le jour de reprise]
actif --(échec de prélèvement)--> impaye
impaye --(paiement récupéré)--> actif
impaye --(7 jours sans succès)--> suspendu
suspendu --(paiement régularisé ≤ 30 j)--> actif
suspendu --(30 j)--> resilie
actif --(résiliation client)--> resiliation_programmee
resiliation_programmee --(fin de période payée)--> resilie
resiliation_programmee --(annulation de la résiliation)--> actif
en_pause|impaye|suspendu --(résiliation client)--> resilie   [effet le jour même, rien de plus facturé]
actif --(coach part / offre supprimée par la plateforme)--> resilie [prorata remboursé]
```

Règles associées :
- **`en_attente_confirmation`** (ajouté le 28 septembre 2026, `docs/ecrans/L4-04c-confirmation-abonnement.md`) :
  un premier prélèvement SEPA n'est confirmé par la banque qu'en différé, parfois plusieurs jours
  après le mandat. L'abonnement existe pendant ce délai, pour que le client puisse le consulter et
  le coach le voir arriver, mais **le suivi n'est pas encore ouvert** — même situation qu'avant la
  souscription : rien n'a été encaissé, et un rejet ne doit pas laisser au coach du travail non
  payé. Aucune pause, aucune résiliation depuis cet état (rien à résilier : il n'y a pas encore de
  période payée). `debuteLe`, `jourPrelevement` et `prochainePrelevementLe` se calculent sur la
  date du **mandat**, pas sur celle de la confirmation : le client choisit son jour de prélèvement
  en souscrivant, pas au gré du délai bancaire. `annule` est terminal, distinct de `resilie` : il
  n'y a jamais eu de période payée — aucune facture, aucune ligne de commission, et
  `commissionOfferteJusquLe` (§5.5) n'est pas posé (« premier abonnement **actif** »). Choix
  d'ouverture du suivi à réévaluer en L6, quand le suivi aura un contenu réel.
- **Aucun prorata à la souscription** : le premier prélèvement est plein, l'échéance suivante
  tombe au même jour du mois suivant.
- En `en_pause`, aucun prélèvement, aucun accès au programme, la place chez le coach est
  conservée. La messagerie reste ouverte.
- En `impaye`, **l'accès reste ouvert** (période de grâce, 7 jours). En `suspendu`, l'accès au
  contenu est coupé, la messagerie et les données personnelles restent accessibles.
- **Reprise après pause** (tranché le 28 septembre 2026) : un cycle complet repart du jour de la
  reprise — qu'elle soit demandée par le client ou atteinte à `pauseJusquLe`. `jourPrelevement`
  est **recalculé sur ce jour**, borné à 28 comme à la souscription, et `prochainePrelevementLe`
  vaut ce même jour : le nouveau cycle s'ouvre par son prélèvement (exécuté par la tâche
  planifiée, P4.8), exactement comme la souscription ouvre le premier. Aucune période non servie
  n'est facturée, et il n'y a qu'une règle à tenir.
- La résiliation est toujours **en fin de période payée**, jamais avant — jamais de
  remboursement d'une période commencée.
  - Depuis `actif`, la période payée court encore : `resiliation_programmee`, `finAccesLe` = la
    prochaine échéance, qui ne sera pas prélevée.
  - **Depuis `en_pause`, `impaye` ou `suspendu`** (ajouté le 28 septembre 2026) : aucune période
    payée n'est en cours de service — la pause l'a interrompue, ou la nouvelle n'a pas été payée.
    La « fin de période payée » est donc déjà derrière : l'abonnement passe **directement à
    `resilie`**, `finAccesLe` = le jour de la demande. Rien n'est facturé de plus : les relances
    d'un `impaye` ou d'un `suspendu` s'arrêtent, l'échéance restée impayée n'est plus due.
  - **Raison, qui n'est pas une question de juriste** : quelqu'un en pause, ou en difficulté de
    paiement, qui ne pourrait pas résilier en ligne est exactement le cas que la loi interdit
    (résiliation en ligne d'un contrat souscrit en ligne). Le reste de la question — parcours,
    confirmation, accusé de réception — reste ouvert pour le juriste (`docs/perimetre.md` §6).
  - `en_attente_confirmation` n'est pas dans la liste : aucune période n'a encore été payée ni
    servie ; un rejet de la banque la clôt (`annule`).

### 4.4 Paiement d'une échéance

```
programme --(exécution à l'échéance)--> en_cours     [TentativePrelevement n° 1]
en_cours --(succès)--> paye        [tentative reussie, facture émise, ligne de commission créée]
en_cours --(échec)--> echoue       [tentative echouee, motifBanque posé ; abonnement actif → impaye]
echoue --(relance J+1)--> en_cours                   [TentativePrelevement n° 2]
echoue --(relance J+3)--> en_cours                   [TentativePrelevement n° 3]
echoue --(J+7, aucune tentative réussie)--> abandonne  [aucun prélèvement ; abonnement → suspendu]
```

Chaque passage par `en_cours` crée une `TentativePrelevement` (§3.4bis) ; l'état de la
machine se lit sur la dernière tentative de l'échéance, il n'a pas de colonne propre (même
logique que `Offre`, §3.3). Trois tentatives au plus par échéance : à l'échéance, puis relances
à J+1 et J+3 ; J+7 constate l'abandon sans prélever (réécrit le 28 septembre 2026, voir §3.4bis —
l'ancien libellé « relance J+7 » laissait croire à un quatrième prélèvement). Une tentative
réussie à J+1 ou J+3 fait passer l'abonnement `impaye --(paiement récupéré)--> actif` (§4.3).

Chaque échec notifie le client avec **le motif transmis par la banque**, et la phrase « rien
n'a été débité ». Le coach est informé au premier échec, sans détail bancaire.

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

### 4.10 Offre

```
brouillon --(publication, coach vérifié + engagement humain requis
              + compte de versement opérationnel, à partir de L5 — §3.3)--> publiee
publiee --(retrait)--> retiree
```

Lecture, pas une colonne littérale (§3.3) : `brouillon` = `publieeLe` et `retireeLe` tous deux
`null` ; `publiee` = `publieeLe` posée ; `retiree` = `retireeLe` posée. Aucun retour en arrière
écrit ici (`retiree` → `brouillon`, ou re-publication) : ni demandé ni observé dans le dossier de
design, laissé ouvert plutôt qu'inventé.

### 4.11 Invitation

```
en_attente --(un compte se crée par le lien du coach)--> compte_cree
compte_cree --(abonnement à CE coach précisément, câblé à L4)--> abonnee
```

`en_attente` est aussi l'état de départ d'une entrée créée manuellement par le coach (« Ajouter »,
une note privée pour lui-même, `docs/prompts/L3bis.md`) — elle ne transite **jamais**
automatiquement vers `compte_cree` : rien dans ce dépôt ne devine qu'une entrée manuelle et un
compte réel créé plus tard désignent la même personne. Les deux restent des lignes distinctes,
sans rapprochement algorithmique.

---

## 5. Règles de calcul

Chaque métrique affichée dans les maquettes a une formule. Aucune n'est estimée côté
application : elles viennent toutes du serveur, déjà calculées.

### 5.1 Note d'un coach
Moyenne arithmétique des `Avis` en statut `publie`, arrondie au dixième. **Affichée à partir de
5 avis publiés seulement** — en dessous, aucune moyenne n'est calculée, jamais une moyenne sur
un échantillon trop petit pour être honnête. La distribution par étoiles reste le simple
comptage par valeur, sans seuil.

Trois affichages distincts selon le nombre d'avis publiés, jamais de badge « Nouveau » dans
aucun des trois cas :

- **0 avis** : ni note, ni compteur. La place que la note aurait occupée montre à la place la
  date de vérification du coach, sa discipline, et son parcours — de l'information réelle,
  jamais un badge qui ne dit rien.
- **1 à 4 avis** : aucune moyenne calculée (échantillon trop petit), mais les avis existent
  réellement — ils s'affichent un par un (étoiles, texte, auteur), jamais résumés en un chiffre.
  Un compteur simple (« 3 avis ») reste honnête à ce stade, à la différence d'une moyenne.
- **5 avis ou plus** : moyenne affichée, arrondie au dixième, distribution par étoiles, tri par
  note possible.

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
Précisé le 28 septembre 2026 (P4.4) : « date » est le **jour civil Europe/Paris du paiement**,
comparé au jour `commissionOfferteJusquLe` — le jour même de cette date, le taux est déjà de
10 %. Le montant est arrondi au centime le plus proche (demi-centime vers le haut). Le taux est
lu une fois, à l'émission de la `LigneCommission`, et copié dans la ligne : une date modifiée plus
tard ne change jamais une ligne déjà écrite.

### 5.6 Classement « Pertinence »
**Révisé le 12 septembre 2026 — ne trie plus sur l'avis.** La version précédente pondérait Note,
Assiduité moyenne des abonnés et Délai de réponse (65 points sur 100) : trois mesures qui
dépendent d'un historique d'usage (avis publiés, séances suivies, messages échangés) qu'**aucun**
coach n'aura au lancement — un classement qui s'appuie dessus revient à ne classer personne tant
que la plateforme est vide, l'exact problème d'amorçage qu'un marketplace biface doit éviter.
Remplacée par trois composantes qui existent dès la publication d'un profil, sans historique :

| Critère | Ordre | Détail |
|---|---|---|
| Discipline demandée | 1er (filtre puis tri) | Un coach dont l'offre publiée ne correspond pas à la discipline recherchée n'apparaît pas — ce n'est pas un simple bonus de score. Une recherche libre (texte, pas de discipline choisie) trie par correspondance textuelle sur titre/discipline/bio, comme avant |
| Proximité géographique | 2e | Inchangé (§5.7) : 1,0 à 0 km → 0 à 25 km ; « visio » = 0,6 fixe |
| Complétude du profil | 3e | Compte sur 3, **à seuil par champ, jamais un simple « renseigné / vide »** : bio ≥ 80 caractères, parcours ≥ 80 caractères, photo présente (pas de seuil de longueur pour une photo — elle existe ou non). Chaque champ qui atteint son seuil vaut 1 point, sinon 0. Sans seuil, une bio de trois mots vaudrait autant qu'une bio réelle dès que les coachs comprennent comment le critère marche — le point se vide. Seuils choisis, pas mesurés : à revoir si les coachs les contournent en pratique (même statut que les bornes de prix, §3.3) |

**Rotation** : à égalité stricte sur les trois critères ci-dessus (même discipline, même tranche
de proximité, même complétude), l'ordre n'est pas figé sur un axe secondaire arbitraire (nom,
date de création...) qui avantagerait toujours les mêmes coachs — un bruit léger, tiré à chaque
requête (`random()` côté serveur, pas un ordre mémorisé côté client), départage les ex-æquo. Sans
elle, le premier coach inscrit dans une discipline resterait indéfiniment en tête, jamais
délogé faute d'avis pour le dépasser.

Aucune composante payante. Aucun coup de pouce manuel. Déterministe sur les trois premiers
critères ; seul le rang au sein d'un groupe strictement ex-æquo varie d'une requête à l'autre —
publié dans les CGU comme la version précédente.

**Ce que ce remplacement change pour L4+** : quand les avis, l'assiduité et le délai de réponse
existeront pour de vrai, rien n'interdit de les réintroduire comme quatrième critère (après
complétude, jamais avant discipline/proximité) — mais ce sera une nouvelle décision produit à
prendre à ce moment-là, pas un retour automatique à cette table.

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
