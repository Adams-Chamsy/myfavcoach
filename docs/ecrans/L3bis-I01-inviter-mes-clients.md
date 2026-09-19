# L3bis-I01 · Inviter mes clients

**Lot** L3bis · **Rôle** coach · **Route** `app/(coach)/invitations.tsx` — écran FRÈRE du groupe
`(tabs)`, jamais dedans (même motif que `coach/[id]`/`creer/[type]`, `CLAUDE.md` §8, corrigé le
13 septembre 2026). **Référence visuelle** `maquettes/MyFavCoach-Import_dc.html`, bloc I-01,
`data-screen-label="I-01 Inviter mes clients"`. **Un écart corrigé le 17 septembre 2026, avant
tout code, lu en Règles.**

---

## Raison d'être

Un coach qui rejoint la plateforme suit déjà des gens ailleurs — carnet, messagerie, tableur.
Cet écran lui donne un lien unique à partager là où il leur parle déjà, et lui montre qui a
répondu, à quel stade, sans jamais lui montrer plus que ce point 2 de `docs/prompts/L3bis.md`
n'autorise.

---

## Contenu

1. **En-tête** : chevron retour, « Mes invitations ».
2. **Ton lien d'invitation** (carte sombre, maquette) :
   - le jeton (22 caractères aléatoires, jamais le nom du coach — voir Règles), affiché tronqué
     dans une capsule avec une icône de copie ;
   - un compteur « ***X* ont commencé sur *Y*** » — *X* = invitations aux états `compte_cree`
     ou `abonnee` ; *Y* = *X* + invitations `en_attente` (voir Règles : pourquoi « ont
     commencé », pas « inscrits », `docs/domaine.md` §3.15) ;
   - un bouton **Partager** (partage natif de la plateforme) ;
   - un bouton discret **Régénérer mon lien**, avec confirmation (voir Règles) — absent de la
     maquette d'origine, ajouté par cette fiche (point 1 de `docs/prompts/L3bis.md`).
3. **Qui a répondu** : une ligne par invitation aux états `compte_cree`/`abonnee` (prénom +
   initiale du nom, légende selon l'état, action **Relancer** sur `compte_cree` seulement), plus
   une ligne unique groupée pour toutes les invitations `en_attente` (« *N* invitations
   envoyées, sans réponse pour l'instant »), et un lien **Ajouter** (voir Règles).
4. **Rappel de commission** : reprend `docs/domaine.md` §5.5, visible seulement s'il existe au
   moins un abonnement réel amené par ce lien — donc absent tant qu'aucun n'existe (ce lot ne
   peut en produire aucun, voir `docs/prompts/L3bis.md` point 2). Ne pas construire de texte de
   repli inventé pour cette absence : l'absence de la carte EST l'état honnête.

---

## Colonnes rendues par `mes_invitations()` (`docs/backend.md` §11)

Liste exacte, arrêtée le 17 septembre 2026 — tranchée colonne par colonne, pas par confort :

| Colonne | Type | Utilisée pour |
|---|---|---|
| `id` | uuid de l'invitation | Cibler l'action **Relancer** (`compte_cree` seulement). Un uuid seul ne révèle rien |
| `statut` | `en_attente` \| `compte_cree` \| `abonnee` | Choisir la légende affichée |
| `prenom` | texte | Affichage (« Camille », « Inès »...) |
| `initiale_nom` | un caractère, calculé (`left(nom, 1)`), jamais `nom` en entier | Affichage (« D. », « R. »...) |
| `abonnee_le` | date, nullable | Légende « Abonnée depuis le ... », état `abonnee` seulement |

**`compte_cree_le` n'est PAS sélectionnée.** Rien à cet écran ne l'affiche (« Compte créé, pas
encore abonnée » est un texte fixe, sans date) — une colonne que rien ne consomme ne se
sélectionne pas au cas où. Si un futur écran en a besoin, il l'ajoute lui-même, avec sa propre
justification.

**`mes_invitations()` joint `ProfilClient` (pas seulement `Compte`) pour lire prénom/nom** —
implique une jointure INTERNE, pas seulement un filtre : une invitation `compte_cree` dont
l'invité n'a pas encore de `ProfilClient` (onboarding non commencé) n'est renvoyée par AUCUNE
ligne, pas avec des champs vides. Assumé (`docs/domaine.md` §3.15) : voir la règle sur le
compteur, ci-dessous.

Les invitations `en_attente` ne remontent aucune des colonnes ci-dessus individuellement — le
compteur affiché à l'écran (« *N* invitations envoyées ») est un compte agrégé, jamais une
liste de lignes `en_attente` retournée à l'écran pour être comptée côté client.

---

## Règles

- **Écart corrigé le 17 septembre 2026, avant le code** : la maquette montrait
  `myfavcoach.fr/y/berthaud-4f2a` (nom du coach + 4 caractères hexadécimaux, 65 536
  possibilités). Corrigé par son auteur après relecture de cette fiche : **22 caractères
  aléatoires, jamais dérivés du nom du coach ni d'aucune donnée publique** — un lien se colle
  dans un message, il ne se dicte pas ; la lisibilité ne vaut pas le risque
  (`docs/prompts/L3bis.md`, point 1).
- **Écart corrigé le 17 septembre 2026** : la maquette annonce « Aucune lecture inter-comptes »
  — faux au sens strict. Le coach lit prénom + initiale de ses invités aux états
  `compte_cree`/`abonnee`, par la fonction `mes_invitations()` SEULE — aucune politique SELECT ni
  aucun grant SELECT n'existe par ailleurs sur `invitations` (`docs/backend.md` §11 ; liste exacte
  des colonnes rendues ci-dessus). Cette lecture existe, elle est simplement volontairement
  étroite — la fiche le dit, elle ne le cache pas.
- **Troncature d'identité, aux trois états, sans exception** (`docs/domaine.md` §3.15) : prénom
  + initiale du nom, jamais plus, qu'il y ait abonnement ou non. Une vue plus complète (nom
  complet, historique) est une question de L7 (« Fiche client »), hors périmètre ici.
- **Le compteur sous-compte, et le verbe le dit plutôt que de le cacher** (`docs/domaine.md`
  §3.15, corrigé le 18 septembre 2026) : `mes_invitations()` lit `ProfilClient` pour prénom/nom,
  qui ne se crée qu'à l'étape 1 de l'onboarding — un compte créé par le lien mais dont
  l'onboarding n'a pas commencé n'a encore rien à montrer, et n'apparaît nulle part dans *X*.
  « *X* inscrits sur *Y* » (maquette d'origine) prétendrait que *X* compte des comptes réels,
  ce qu'il ne fait pas. **« *X* ont commencé sur *Y* »** garde le dénominateur (*Y*, la
  comptabilité du coach lui-même — invitations envoyées, jamais un total vérifié côté serveur)
  mais change le verbe : « ont commencé » décrit exactement ce que *X* mesure — une progression
  réelle, jamais une simple création de compte qu'on ne peut pas entièrement voir.
- **Les invitations `en_attente` restent groupées, jamais détaillées une par une.** Les
  détailler transformerait l'écran en tableau de relance — un autre produit (maquette,
  légende sous I-01).
- **« Ajouter » : un compteur, jamais un champ de nom.** Décidé ici, pas dans la maquette (qui
  ne le précise pas) : l'action ouvre une confirmation (« Tu as prévenu quelqu'un d'autre par ce
  lien ? ») et incrémente le compte `en_attente` de un. Aucun champ de saisie n'accompagne cette
  action : le groupement des `en_attente` reste toujours anonyme (règle ci-dessus) — un nom
  qu'aucun autre endroit de l'écran n'affiche jamais individuellement n'a aucun consommateur, et
  une saisie sans rien qui la lise ensuite est de la complexité pour elle-même, pas une donnée
  de contenu inventée (`CLAUDE.md` §4 vise autre chose : ne pas fabriquer un exemple à la place
  d'une vraie valeur — sans rapport direct ici, la raison de ne pas ajouter ce champ est
  purement fonctionnelle).
- **Régénération du jeton** (point 1 de `docs/prompts/L3bis.md`) : action explicite, avec une
  `Modale` de confirmation qui dit les deux conséquences — « L'ancien lien ne fonctionnera
  plus. » et « Les invitations déjà répondues restent inchangées. » Jamais automatique, jamais
  silencieuse (même forme que le retrait de consentement santé, `docs/ecrans/L1-09-mes-
  informations.md`).
- **Route et point d'entrée, décidés ici faute d'alternative construite** : l'écran 09 (Clients,
  `app/(coach)/(tabs)/clients.tsx`) est réservé à L7 (`docs/perimetre.md`) et reste
  `EcranProvisoire` à ce lot — cette fiche ne le réutilise pas, ce serait mélanger les lots.
  I-01 vit dans sa propre route, poussée depuis une carte sur `app/(coach)/(tabs)/pilotage.tsx`
  (« Importer mes clients »), retirée le jour où L7 donne un meilleur point d'entrée. À
  confirmer au prompt d'écran (P3bis.5) si un point d'entrée plus naturel apparaît à l'exécution.
- **Lecture publique du profil du coach lui-même** : rien de nouveau à ouvrir, c'est déjà le
  sien (session authentifiée, espace coach).
- **Écart corrigé le 18 septembre 2026, après le code** : la maquette assombrit la ligne
  groupée des invitations `en_attente` par une opacité à 60 % sur `texte.attenue`. Implémentée
  telle quelle, cette opacité fait passer le contraste sous le seuil mesuré par
  `npm run test:a11y`. **`npm run test:a11y` fait foi contre la maquette sur tout ce qui touche
  au contraste** (`docs/design-system.md` §8) : l'opacité est retirée, la couleur
  `texte.attenue` reste seule à porter l'atténuation visuelle voulue. La maquette avait tort,
  pas le code — ce n'est pas un arbitrage propre à cette ligne, c'est la règle générale que
  `docs/design-system.md` §8 fixe pour tout le dépôt.

---

## États

| État | Comportement |
|---|---|
| Chargement | Squelettes aux formes finales (carte lien, liste de réponses) |
| Normal | Lien, compteur et liste à jour |
| Régénération en cours | Bouton en attente, ancien jeton encore valide jusqu'à confirmation serveur |
| Échec (régénération, ajout, relance) | Message d'erreur en bandeau, aucune valeur affichée écrasée |
| Aucune invitation encore | Carte du lien seule, section « Qui a répondu » absente plutôt qu'un tableau vide — une section qui n'a rien à montrer ne s'affiche pas (même règle que L1-07) |

---

## Critères d'acceptation

1. Le jeton affiché fait 22 caractères, ne contient ni le nom ni aucune donnée publique du
   coach — testé contre le projet de développement, pas contre un mock.
2. Régénérer le lien invalide l'ancien immédiatement (testé au banc) et ne modifie aucune
   invitation déjà établie.
3. Aucune ligne de la liste « Qui a répondu » n'affiche jamais plus que prénom + initiale du
   nom, aux deux états où un nom apparaît.
4. Les invitations `en_attente` n'apparaissent jamais individuellement, seulement groupées.
5. « Ajouter » incrémente le compte sans capturer aucun champ de nom.
6. Le rappel de commission n'apparaît que s'il existe un abonnement réel amené par ce lien —
   absent à ce lot, par construction.
7. Galerie, deux thèmes.
8. `npm run verif` passe.
