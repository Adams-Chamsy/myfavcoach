# Décisions en attente, et décisions prises seul

Ouvert le 11 novembre 2026 pour l'enchaînement A2, A3 + B2, D, P4.6b, P4.7, P4.9b, P4.10, mené
sans le développeur. Règle donnée ce jour-là : Claude ne s'arrête que pour une décision produit
que la fiche ne tranche pas, un texte que des utilisateurs liront, ou un défaut dont la correction
sort du périmètre de l'étape. Chaque cas est écrit ici, et l'étape suivante continue si elle n'en
dépend pas. Tout ce que Claude décide seul est écrit ici aussi, avec sa raison.

Une ligne se retire de « En attente » quand le développeur a tranché, et la décision rejoint sa
source de vérité (fiche, `docs/domaine.md`, `docs/perimetre.md`).

**Clôture des étapes d'écran.** Chaque étape d'écran est close par le navigateur piloté (Chrome
headless, protocole de débogage, sans dépendance) contre la base de dev, d'après sa fiche, **par le
chemin de l'application** : aucune émulation de session, aucune requête fabriquée. Les captures
sont dans `/Users/chamsy/Documents/myfavcoach-captures/<étape>/`, hors du dépôt.

---

## En attente du développeur

| Étape | Question | Pourquoi Claude ne tranche pas | Ce qui est fait en attendant |
|---|---|---|---|
| Session web | **Une adresse profonde ouverte sans session ne renvoie jamais vers la connexion.** Mesuré le 11 novembre 2026 sur le web : `/moi` affiche « On a un souci de notre côté » et le menu du compte, `/pilotage` le cadre de l'espace coach vide, `/accueil` l'accueil client avec « Salut » sans prénom. Depuis la session en mémoire, c'est ce que voit tout utilisateur web qui recharge sa page. | Une garde de navigation nouvelle sur les espaces privés : un défaut de périmètre plus large que la session (L1, `docs/ecrans/L0-04-demarrage.md`). Sur mobile, aucun effet aujourd'hui ; un effet certain dès qu'un lien universel mènera à une page privée (retour de paiement par myfavcoach.fr). | Rien. `docs/dette.md`, ligne `/moi`, réécrite. |
| Session web | **Le back-office garde sa session dans le `localStorage` du navigateur.** `src/services/supabase/client-admin.ts` ne donne aucun `storage` au client Supabase, qui prend alors celui du navigateur par défaut. | Le back-office est un outil web, à part de l'application. La règle « rien sur le disque du navigateur » a été décidée pour l'application ; savoir si elle s'étend au back-office est une décision. | Rien. |
| Relais Stripe | **Le secret de signature du relais (`stripe listen`) s'est affiché une fois dans un journal d'outil de Claude** le 11 novembre 2026, jamais dans la conversation ni dans le dépôt. Renouvellement : voir le rapport du même jour (la procédure dépend d'une connexion de la CLI Stripe par le développeur). | Seul le développeur peut reconnecter la CLI Stripe à son compte. | Empreinte du secret actuel notée, pour vérifier après coup qu'il a changé. |
| A2 | **Nom du fichier et poids d'une pièce déposée.** La fiche L2-06 les demande sur la ligne « Déposée » (« Coche, nom du fichier, date de dépôt, poids »). Ni l'un ni l'autre n'est enregistré : `pieces_verification` n'a ni nom ni taille (0012), et la fiche elle-même interdit le nom de fichier dans tout journal « par prudence ». | L'enregistrer en base est une décision de confidentialité : un nom de fichier dit souvent qui est la personne (« passeport-prenom-nom.pdf »), pour une pièce d'identité. Ce n'est pas une ligne d'écran. | La ligne affiche la coche, la date et « Remplacer ». |
| A2 | **Ce qu'un coach refusé lit à l'étape 3.** Le serveur ne remet un dossier refusé en examen qu'une fois les TROIS pièces redéposées après la décision (0053, décision du 2 novembre 2026). Mais l'écran affiche ses anciennes pièces « Déposée », comme si de rien n'était : rien ne lui dit qu'il doit remplacer les trois. | Un texte que des utilisateurs liront, et une règle d'affichage que la fiche ne prévoit pas (elle ne décrit pas le retour après refus). L'écran n'a pas non plus la date de la décision pour savoir quelles pièces comptent encore. | L'impasse est levée : « Remplacer » existe sur chaque ligne, et le troisième remplacement renvoie le dossier en examen. Seule l'explication manque. |
| A2 (trouvé) | **`/admin/connexion`, ouverte seule à son adresse, plante après la connexion** (`TypeError: onConnecte is not a function`, vu dans la console du navigateur piloté le 11 novembre 2026). L'écran est fait pour être rendu DANS `/admin/verification`, qui lui passe `onConnecte` ; à sa propre adresse (posée le 2 novembre, `367d33f`), il ne le reçoit pas. `verif:serveur` ne l'a pas vu : il vérifie le texte servi, pas ce que fait le bouton. | Un défaut du back-office hors de A2 : soit `/admin/connexion` cesse d'être une adresse, soit elle redirige vers `/admin/verification` après connexion. Les deux changent le contrat d'adresses décidé le 2 novembre. | L'examinateur passe par `/admin/verification` (l'adresse donnée par `comptes-scenarios.local.md`), qui fonctionne : clôture de A2. |

---

## Décidé seul, avec la raison

| Étape | Décision | Raison |
|---|---|---|
| Avant A2 | Le travail en attente depuis le 3 novembre (relais Stripe) et `docs/perimetre.md` (séances de L5 à L12) sont commités à part, avant A2, en deux commits (`0cffc67`, `a94dd83`). | « Un commit par étape, jamais deux étapes dans le même commit » : laissés dans l'arbre, ils seraient entrés dans le commit de A2. `verif` vert avant ces deux commits. |
| Toutes | Comptes clients jetables `essai-…@mfc.test` sur le projet de dev pour les essais de paiement (créés comme les comptes de scénario : compte par l'API d'administration, puis profil et onboarding par la session de l'utilisateur), supprimés après usage. | Tous les comptes de scénario prêts à payer ont déjà un abonnement, et « un seul abonnement en cours par client et par coach » (P4.5d) interdit d'en refaire un. `scenario-client-sans-abonnement` doit le rester. |
| Toutes | L'outil de pilotage du navigateur reste hors du dépôt (dossier temporaire de la session), comme les captures. | Le verser au dépôt est un outil nouveau, à décider avec le développeur s'il doit servir aux clôtures futures (la clôture de L6 avant L7 en dépend, `docs/perimetre.md` §4). |
| Session web | Une clôture de A2 a tourné, le 11 novembre 2026 à 13:42 UTC, avec une **émulation de session** (l'outil remplaçait l'en-tête anonyme par le jeton de l'utilisateur) : interrompue par le développeur après la partie coach, elle a remplacé les trois pièces de `scenario-coach-refuse`, dont le dossier est reparti en examen. Ses captures sont supprimées ; elle est refaite par le chemin de l'application. | Une clôture qui passe par un contournement prouve le contournement (décision du développeur, même jour). L'émulation est retirée de l'outil. |
| A2 | Libellés d'accessibilité de « Remplacer » : « Remplacer la pièce d'identité », « Remplacer le diplôme ou la certification », « Remplacer l'attestation d'assurance RC pro ». | Le mot visible seul ne dit pas quelle pièce, trois fois de suite (`CLAUDE.md` §5). Assemblés depuis deux textes déjà à l'écran (l'action, le nom de la ligne), aucun mot nouveau. |
| A2 | « Remplacer » est un lien texte en encre d'alerte (`etat.erreurEncre`), pas un `Bouton` « destructeur » plein, au style `actionAccent` (16 px gras, casse normale). | La maquette (`MyFavCoach-L2_dc.html`, 23b) le dessine en texte gras rouge, 13 px, casse normale, à droite de la ligne ; la fiche demande « rouge/encre d'alerte, jamais la couleur d'action neutre ». Aucun style du thème ne fait 13 px gras : `actionAccent` est le style d'action en texte le plus proche (le premier essai, `label`, passait en capitales — vu sur la capture de clôture). Zone de tap de 44 pt portée par le padding. |
| A2 | Pendant l'envoi d'un remplacement, la ligne affiche « Envoi en cours… » à la place de sa date. | Même texte que le bouton « Choisir un fichier » pendant un premier dépôt : rien de nouveau à lire. |
| A2 | Le back-office ne montre à l'examinateur que la pièce en vigueur de chaque type (`piecesEnVigueur`, partagée avec l'étape 3). Les anciens dépôts restent en base. | Fiche L2-06, règle 6 : « l'ancienne version du fichier disparaît dès l'envoi de la nouvelle ». 0012 garde chaque dépôt comme preuve : effacer serait une décision de conservation, pas d'écran. |
| A2 | Le faux port (`src/services/donnees/faux.ts`) ajoute une ligne à chaque dépôt, comme le serveur, au lieu d'écraser la précédente. | Il écrasait, et cachait ainsi que l'étape 3 affichait le plus ANCIEN dépôt de chaque type (`find` sur une liste triée du plus ancien au plus récent). |
| A2 | Observé, non corrigé (hors de A2) : le message de soumission (A1) s'affiche en capitales, « TON DOSSIER EST COMPLET, IL PART EN EXAMEN. », parce qu'il utilise le style `label`. La fiche L2-06 l'écrit en phrase. | Rendu de A1, pas de A2 ; à trancher avec le reste des retours d'écran (capture `myfavcoach-captures/A2/08-dossier-reparti.png`). |
