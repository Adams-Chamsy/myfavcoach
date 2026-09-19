# Prompts Claude Code — lot L3bis (import des clients existants du coach)

Sept prompts, dans l'ordre. **Un prompt à la fois.** Après chacun : tu lances la commande de
vérification, tu regardes le résultat toi-même, et tu ne passes au suivant que si c'est vert.

Si un prompt produit autre chose que ce qui est annoncé, ne corrige pas à la main : redonne le
message d'erreur exact. Le code et la spécification doivent rester d'accord.

---

## Ce que L3bis ajoute au dépôt

Un coach qui rejoint la plateforme suit déjà des gens ailleurs — carnet, messagerie, tableur.
L3bis lui donne un lien unique à partager, et un client qui le reçoit arrive sur une page qui le
reconnaît sans lui demander de se connecter. Deux écrans (`maquettes/MyFavCoach-Import_dc.html`) :

- **I-01 · Inviter mes clients** (coach) : le lien, un compteur, la liste de qui a répondu et à
  quel stade, une relance.
- **I-02 · Arrivée par invitation** (client) : la page que ce lien ouvre, sans session, qui
  présente le coach et propose de créer un compte.

**Ce que L3bis ne touche pas** : aucune donnée de santé, aucune pièce d'identité, aucun
paiement réel. `docs/perimetre.md` §4 place ce lot après L3 et avant L4 — l'abonnement
(`Abonnement`) n'existe pas encore quand ce lot s'ouvre, voir le point 2 ci-dessous pour ce que
ça change concrètement dans l'écran I-01.

**Ce lot est plus simple que L2 et L3, et il faut le dire clairement plutôt que de reproduire
leur forme par habitude** : pas de deuxième catégorie de données sensibles comme les pièces
d'identité, pas de fonction qui rend des dizaines de lignes d'un coup, pas de bruit de départage
à protéger, pas de plafond dur à choisir. Ce fichier n'a donc pas de section « Ce que ce lot
change dans le modèle de sécurité » aussi lourde que celles de L2.md/L3.md — les trois points
ci-dessous suffisent à traiter ce qui est réellement en jeu, sans fabriquer une symétrie qui ne
correspond à aucun risque réel.

---

## Les trois points qui méritent une vraie attention, avant tout code

### 1. Le jeton d'invitation : imprévisible, et révocable

I-02 est une page atteinte par un lien reçu, sans session, avant même que l'application ne
sache qui la regarde. Un identifiant public accessible par construction doit être choisi comme
on choisit le chemin de stockage d'une pièce justificative en P2.5 (`docs/prompts/L2.md`) :
imprévisible, jamais reconstructible à partir de ce que l'attaquant connaît déjà.

**Décidé le 17 septembre 2026, après relecture de la maquette par son auteur** :
`maquettes/MyFavCoach-Import_dc.html` (ligne 56) montrait `myfavcoach.fr/y/berthaud-4f2a` — nom
du coach en préfixe, quatre caractères hexadécimaux en suffixe (16 bits, 65 536 possibilités,
énumérables en quelques secondes). Corrigé en conversation, avant tout code, plutôt que trouvé à
la porte de sortie : **22 caractères aléatoires, jamais le nom du coach ni aucune donnée
publique dans le jeton lui-même.**

Deux raisons, aucune des deux n'est esthétique :

- **Un lien se colle dans un message, il ne se dicte pas.** La lisibilité d'un jeton court n'a
  de valeur que si quelqu'un doit le lire à voix haute ou le retaper — jamais le cas ici : le
  coach copie-colle (bouton « Partager », maquette), l'invité tape sur un lien reçu. Rien ne
  justifie de sacrifier de l'entropie à la lisibilité.
- **Le nom dans l'URL révèle qui invite avant même le clic.** Un lien qui transite par une
  messagerie qui n'est pas la nôtre (SMS, WhatsApp, e-mail) peut être prévisualisé, indexé ou
  scanné par cette messagerie elle-même avant que le destinataire ne clique — un jeton qui porte
  le nom du coach fuit cette information à quiconque voit passer le lien, pas seulement à qui le
  suit.

**Révocation.** Un jeton permanent, sans moyen de le remplacer, est une dette de sécurité dès sa
création : si un coach le partage au mauvais endroit (un forum public, un groupe qu'il ne
contrôle plus), rien ne doit l'obliger à vivre avec ce jeton pour toujours. Le coach doit pouvoir
régénérer son lien depuis I-01 — l'ancien jeton cesse aussitôt de résoudre à quoi que ce soit.
**Ce que la régénération NE fait PAS** (à écrire explicitement dans la fiche, pas à laisser
deviner) : elle ne touche à aucune ligne `invitations` déjà créée par l'ancien jeton — un compte
déjà lié à ce coach le reste. Seule la capacité de créer de NOUVELLES lignes par l'ancien jeton
disparaît.

### 2. Une invitation crée une relation entre deux comptes — dis ce que le coach voit, à chaque état, avant la migration

C'est la seule lecture inter-comptes de ce lot, et elle est volontairement étroite — le bandeau
de la maquette (ligne 30 : « Aucune lecture inter-comptes... ») **la sous-estime**, c'est un
écart à corriger dans la fiche, pas une raison de ne rien documenter. Trois états, lus
directement sur la maquette (le bloc « Qui a répondu ») :

| État de l'invitation | Ce que le coach voit | Preuve dans la maquette |
|---|---|---|
| `en_attente` — personne n'a encore créé de compte par ce lien (ou le coach a noté l'avoir envoyée, via « Ajouter ») | Rien d'individuel. Un compte groupé (« 6 invitations envoyées, sans réponse pour l'instant ») | Ligne à 60 % d'opacité, aucun nom, aucune icône de personne |
| `compte_cree` — un compte existe, aucun abonnement | **Prénom + initiale du nom**, rien de plus (« Inès R. — Compte créé, pas encore abonnée ») + une action Relancer | Ligne « Inès R. » |
| `abonnee` — abonné(e) à CE coach précisément | **Le même format, prénom + initiale du nom** (« Camille D. — Abonnée depuis le 12 septembre ») — l'abonnement change la légende affichée, **jamais le niveau d'identité révélé** | Lignes « Camille D. », « Marc T. » |

Le point que la maquette laisse deviner sans le dire, et que la fiche doit écrire noir sur
blanc : **la troncature (prénom + initiale) est la même aux trois états** — ni la création d'un
compte, ni l'abonnement, n'ouvrent jamais le nom complet, l'e-mail, le téléphone ou une autre
colonne de `profils_client`/`comptes` à ce coach, à cet écran. Une vue plus complète du client
(nom complet, données de santé, historique) est une question de L7 (« Fiche client »), qui
suppose une relation d'abonnement réelle établie — hors périmètre de ce lot, à ne pas anticiper
ici.

**Ce que L3bis peut réellement construire, faute d'`Abonnement`.** Ce lot se ferme avant L4
(`docs/perimetre.md` §4) : l'état `abonnee` **se définit dans ce lot, sans pouvoir être atteint
dans ce lot** — l'enum SQL porte les trois valeurs dès la migration de L3bis, l'écran I-01 sait
déjà afficher les trois (testé contre le faux port, qui peut fabriquer n'importe quel état
librement), mais **rien dans L3bis n'écrit jamais la transition vers `abonnee`** : aucun
abonnement réel n'existe encore pour la déclencher. Même traitement que le bandeau client de
`app/(compte)/suppression.tsx` (L2-01, `docs/dette.md`) : le JSX existe, branché sur une donnée
qui ne peut valoir vrai à ce lot, prêt à recevoir la vraie condition plutôt que retiré puis
reconstruit. C'est la règle 8 (« un test qui deviendra faux plus tard porte son intention dans
le fichier ») appliquée à une transition entière, pas seulement à une assertion : le banc de
P3bis.4 doit contenir une assertion qui dit aujourd'hui « aucun chemin actuel n'écrit
`abonnee` » — et qui, le jour où L4 ajoute ce chemin, rougira au bon endroit si personne n'a
pensé à la retirer ou à la remplacer par le test inverse. Écrit noir sur blanc, à cet endroit
précis, ce que L4 devra faire : la fonction qui crée un abonnement réel doit aussi mettre à jour
`invitations.statut` (et `abonnee_le`) quand l'abonné et l'inviteur coïncident.

### 3. Universal Links / App Links : un prérequis du lot, pas une finition

**Si le lien ne s'ouvre pas dans l'application, I-02 n'existe pas** — un lien qui atterrit
systématiquement dans un navigateur, ou qui échoue silencieusement, n'est pas une version
dégradée de l'écran, c'est son absence. Ce n'est donc pas un point à traiter après les écrans
(ce que « Ce qui reste à décider avant L4 » aurait suggéré à tort dans une version précédente de
ce fichier) : c'est une dépendance du lot, au même rang que la migration.

**Même famille de problème que le lien profond de L1-03** (`myfavcoach://auth/rappel`,
`docs/dette.md`), **jamais un mécanisme identique.** L1-03 utilise le schéma personnalisé
`myfavcoach://` (`app.json`, `"scheme": "myfavcoach"`), qui ne fonctionne QUE si l'application
est déjà installée — suffisant pour un lien de confirmation reçu par un compte qui vient de
s'inscrire dans l'app. I-02 doit s'ouvrir depuis un lien `https://` collé dans une messagerie,
**avant même de savoir si l'application est installée** — ça exige Universal Links (iOS) et
App Links (Android), un mécanisme entièrement différent : une association vérifiée entre un vrai
nom de domaine et l'identité de l'application, publiée par le domaine lui-même, jamais par
l'application. Aucun des deux n'est configuré aujourd'hui.

**Ce que ça demande côté configuration — vérifié dans ce dépôt, pas supposé** :
`app.json` ne porte aujourd'hui ni `ios.bundleIdentifier` ni `android.package` — les deux sont un
prérequis de l'association elle-même, pas seulement du fichier hébergé côté domaine, et manquent
encore ici. Une fois posés :

- **iOS** : `ios.associatedDomains` dans `app.json` (`applinks:<domaine réel>`), et le domaine
  doit servir `/.well-known/apple-app-site-association` — JSON sans extension, `Content-Type:
  application/json`, jamais de redirection — listant l'ID d'équipe Apple + l'identifiant
  d'application, et les chemins autorisés (`/y/*`).
- **Android** : un `intentFilter` `autoVerify` dans `app.json` (`android.intentFilters`), et le
  domaine doit servir `/.well-known/assetlinks.json` — package Android + empreinte SHA-256 du
  certificat de signature réellement utilisé.
- Les deux fichiers `.well-known/*` peuvent vivre dans CE dépôt (`public/`, servi à la racine par
  l'export web d'Expo Router — déjà prouvé fonctionner par `npm run verif:bundle`) : les créer
  est un travail de ce lot, pas une tâche externe. Ce qui reste externe et déjà tracé
  (`docs/perimetre.md` §6) : l'enregistrement des comptes développeur Apple/Google dont l'ID
  d'équipe et le certificat de signature dépendent, et l'hébergement réel du domaine — sans eux,
  les fichiers peuvent être écrits mais pas remplis de vraies valeurs, ni servis pour de vrai.
- Ajouter `associatedDomains`/`intentFilters` change la configuration NATIVE du projet : ça
  demande une reconstruction (`expo prebuild` ou une nouvelle build de développement), jamais
  une simple mise à jour du bundle JavaScript.

**Ce qui ne peut être vérifié que sur un vrai téléphone, pas ici** : que taper un vrai lien
`https://` reçu dans Messages, WhatsApp ou Mail ouvre réellement l'application installée sur
I-02 avec le bon jeton, plutôt que de retomber sur un navigateur ou une erreur silencieuse. Ni
Expo Go ni ce simulateur absent (`CLAUDE.md` §6, `docs/dette.md`) ne peuvent le prouver — il faut
une vraie build de développement installée sur un appareil physique, et les comptes développeur
cités ci-dessus. Écris ce point dans les critères d'acceptation non automatisables de la fiche
I-02, pas seulement dans ce fichier.

---

## Les règles de conduite

Neuf règles, cumulatives depuis L0, plus une dixième tirée de la clôture de L3, et une
onzième tirée de ce lot lui-même (P3bis.3).

**1. Un point d'arrêt annoncé n'est pas optionnel.** Quand un plan dit « je m'arrête ici et
j'attends ta validation », il s'arrête. Pas de « j'ai continué car c'était évident ».

**2. Toute nouvelle surface va dans la galerie, exercée dans les deux thèmes.** Une surface
absente de la galerie n'est pas vue par `npm run test:a11y` : c'est un angle mort, pas une
omission bénigne.

**3. Aucun fichier de test dans `app/`.** Les tests de routage vivent dans `src/test/routage/`.

**4. La preuve, pas l'affirmation.** Avant de dire qu'un test est vert, casse volontairement ce
qu'il teste et montre la sortie rouge. Un test qui ne peut pas échouer ne teste rien.

**5. Une politique n'est réputée testée qu'après avoir montré son rouge nommé, et ce rouge doit
venir d'une assertion, pas d'une exception du décor.** Un `beforeAll` qui s'effondre prouve
qu'une préparation dépend de la politique, pas qu'un test la vise — les fixtures se créent par
`service_role`, jamais par la session dont le test mesure les droits.

**6. Le sens illégitime est aussi obligatoire que le sens légitime.** Écrire les deux dès le
premier jet coûte moins cher que de les rattraper à la porte de sortie.

**7. La machine de développement n'a pas Docker.** Le banc vise le projet de développement
distant, avec la garde de sécurité sur la référence de projet. La preuve « migrations rejouables
de zéro » vient de l'intégration continue, et elle fait foi.

**8. Un test qui deviendra faux plus tard porte son intention dans le fichier.** Quand une
assertion est destinée à échouer le jour où une dépendance arrive (ici : le jour où L4 ajoute la
transition vers `abonnee`, voir le point 2 de tête de fichier), écrire dans le fichier ce qu'il
faudra faire à ce moment-là — sinon quelqu'un supprimera l'assertion en croyant nettoyer.

**9. Un refus doit venir du mécanisme qu'on teste, jamais d'un autre qui se trouve sur le
chemin.** Un vert obtenu par le mauvais mécanisme prouve exactement autant qu'un vert obtenu par
aucun mécanisme — identifie toujours quelle couche (grant, RLS, préparation, assertion) a
produit un rouge ou un vert avant de lui faire confiance.

**10. Une revue de fin de lot ne modifie jamais rien par elle-même — elle propose, l'application
attend une validation explicite.** Corrigé à la clôture de L3 : les portes de sortie de
`docs/prompts/L2.md` et `docs/prompts/L3.md` disaient à la fois « Ne modifie rien avant que je
valide » (leur propre première ligne) et « Mets à jour docs/dette.md » (leur propre dernier
point) — les deux se contredisaient. Corrigées pour dire : rends la revue sans rien modifier,
puis applique `docs/dette.md` seulement après validation. La porte de sortie de ce lot, plus
bas, applique déjà la version corrigée.

**11. Toute nouvelle table exige son grant `service_role` explicite, écrit dans la même
migration qui la crée — jamais supposé.** Trouvée cinq fois avant ce lot (`0009`, `0010`,
`0014`, `0021`, `0023`, documentées chacune comme « ce projet n'accorde jamais rien à
`service_role` par défaut »), et notée dans ma propre mémoire plutôt que dans une règle jusqu'à
ce qu'elle me morde une sixième fois en écrivant `0027` (une première version affirmait, à tort,
que `service_role` contourne les grants comme il contourne RLS — faux, vérifié contre `0015`).
Une table sans ce grant explicite fait échouer le banc RLS sur une préparation de fixture, pas
sur l'assertion qu'on croit tester — un rouge qui nomme la mauvaise cause (règle 9). **À vérifier
à chaque `create table`, avant d'écrire le premier test qui en dépend, pas après le premier
échec.**

---

## Le décor technique du lot

| Sujet | Décision |
|---|---|
| Un lien par coach, pas un lien par invité | « Un seul lien pour tout le monde » (maquette, I-01) — le jeton vit sur le coach, pas sur chaque invitation |
| Format du jeton | 22 caractères aléatoires côté serveur, jamais dérivés du nom du coach ni d'aucune donnée publique (point 1 ci-dessus). Alphabet à trancher dans la fiche — la lisibilité n'est pas une contrainte (le jeton se colle, ne se dicte pas) |
| Révocation du jeton | Le coach peut régénérer son lien depuis I-01 ; l'ancien cesse aussitôt de résoudre. Les invitations déjà créées par l'ancien jeton ne sont jamais affectées (point 1 ci-dessus) |
| Troncature d'identité | Prénom + initiale du nom, aux trois états, jamais plus dans cet écran (point 2 ci-dessus) |
| Transition `abonnee` | Définie et affichable dès ce lot, jamais atteinte dans ce lot (point 2 ci-dessus, règle 8) |
| « Ajouter » (I-01) | Une note privée du coach pour lui-même — jamais une donnée lue sur l'invité, qui n'a par définition pas encore de compte à cet état. La fiche tranche sa forme exacte (juste un compteur, ou un libellé libre que le coach choisit) |
| Universal Links / App Links | Prérequis du lot, pas une finition (point 3 ci-dessus). `app.json` ne porte encore ni identifiant d'application ni association de domaine |
| Avis | Hors périmètre — `docs/perimetre.md` §2 écran 27, toujours replanifiés à L4. Ce lot amène des clients réels, il ne les fait pas encore écrire d'avis |
| Paiement | Toujours aucune ligne avant L4. Le rappel de commission affiché en I-01 (maquette) lit une règle déjà figée (`docs/domaine.md` §5.5) ; il reste honnêtement vide tant qu'aucun abonnement réel n'existe (voir « Ce qui reste à décider avant L4 ») — normal à ce lot, pas à corriger ici |
| CI (sans rapport avec ce lot, à noter en passant) | Les runners GitHub Actions déprécient Node 20 depuis le 19 septembre 2026 (forcés vers Node 24) — vu à la clôture de L3, aucune version n'est épinglée dans ce dépôt (`.github/workflows/*.yml`, `.nvmrc` fixe la version de développement, pas celle du runner) : rien à corriger, seulement à surveiller si un run échoue un jour pour cette raison précise |

---

## P3bis.1 — Mettre la spécification à jour avant d'écrire du code

```
Ne produis aucun code dans ce prompt. Uniquement des fichiers de docs/.

1. Lis maquettes/MyFavCoach-Import_dc.html AVANT de rédiger quoi que ce soit — c'est déjà fait
   pour les trois points de tête de ce fichier, mais relis-la toi-même : les écarts qu'elle
   contient encore (au-delà de ceux déjà trouvés) se notent DANS la fiche concernée, section
   Règles, jamais après coup dans une correction séparée (même leçon que L2, rappelée en L3).

2. docs/domaine.md : ajoute l'entité Invitation. coach (référence ProfilCoach), compteInvite?
   (référence Compte, absente tant que personne n'a créé de compte par ce lien), statut
   ('en_attente' | 'compte_cree' | 'abonnee'), creeLe, compteCreeLe?, abonneeLe?. Écris la règle
   de troncature d'identité (point 2 de tête de fichier) comme règle de domaine, pas seulement
   comme détail d'écran — c'est elle qui borne ce qu'une future fiche L7 pourra un jour élargir.
   Écris aussi, à côté, que la transition vers 'abonnee' n'est câblée qu'à L4 (règle 8).

3. docs/backend.md : ajoute une section courte (pas aussi longue que §8/§10 — la lecture est
   volontairement étroite, dis pourquoi en une phrase) qui nomme le mécanisme retenu pour que le
   coach lise prénom + initiale de ses invités sans jamais atteindre le reste de leur profil :
   une politique RLS plus un grant colonne par colonne (comme profils_coach en 0008), ou une
   fonction dédiée qui ne rend que ces deux champs. Argumente le choix avant l'écran suivant,
   je veux voir le raisonnement.

4. Rédige docs/ecrans/L3bis-I01-inviter-mes-clients.md et
   docs/ecrans/L3bis-I02-arrivee-par-invitation.md. Pour I-01, résous explicitement la forme de
   « Ajouter » (voir « Le décor technique du lot ») et l'action de régénération du jeton (point
   1 de tête de fichier : confirmation avant régénération, texte qui dit ce qui change et ce qui
   ne change pas). Pour I-02, écris ce que la page affiche du coach (nom, photo, titre, tarif) et
   confirme que rien n'excède ce que le profil public (L2-12, déjà accordé à anon) expose déjà —
   s'il fallait une colonne de plus, dis laquelle et pourquoi avant de continuer. Ajoute aux
   critères d'acceptation non automatisables de I-02 la vérification sur appareil physique du
   point 3 de tête de fichier.

5. Mets à jour docs/perimetre.md si la rédaction fait apparaître un écart avec les deux lignes
   déjà écrites pour I-01/I-02 (§2) — dis-le, ne le corrige pas silencieusement.
```

**Point d'arrêt.** Attends la validation de l'entité, de la section backend.md et des deux
fiches avant P3bis.2.

---

## P3bis.2 — Universal Links / App Links : la configuration qui rend le lien réel

```
Point 3 de tête de fichier : sans ce prompt, I-02 n'est jamais atteint par un vrai lien, ce qui
équivaut à ne pas construire I-02. Ce prompt ne dépend d'aucune migration : c'est de la
configuration du projet, indépendante du contenu de la table invitations.

1. app.json : pose ios.bundleIdentifier et android.package s'ils n'existent pas encore — dis-moi
   la valeur choisie et pourquoi (convention inversée du domaine, ex. fr.myfavcoach.app) avant
   de l'écrire, elle ne change plus facilement une fois publiée sur les stores.

2. Ajoute ios.associatedDomains (applinks:<domaine>) et l'intentFilter Android autoVerify
   correspondant, restreints au chemin /y/* — pas le domaine entier, cette application n'a besoin
   d'ouvrir que ce chemin par ce mécanisme.

3. Crée public/.well-known/apple-app-site-association et public/.well-known/assetlinks.json
   dans ce dépôt (servis à la racine par l'export web, voir « Le décor technique du lot »).
   Remplis-les des vraies valeurs si elles existent déjà (compte développeur, certificat de
   signature) ; sinon, laisse un espace de valeur clairement marqué comme provisoire et dis
   lequel — ne les invente pas.

4. Vérifie que npm run verif:bundle sert bien ces deux fichiers depuis l'export web, avec le bon
   type de contenu (application/json, sans redirection). C'est tout ce qui est vérifiable sans
   appareil physique ni domaine réel déployé.

5. Note dans docs/dette.md (proposée, pas écrite ici — voir règle 10) que la vérification de bout
   en bout (un lien tapé sur un vrai téléphone ouvre bien l'app) reste hors de portée tant que
   les comptes développeur et l'hébergement du domaine réel (docs/perimetre.md §6) ne sont pas en
   place.
```

**Vérification :** `npm run verif:bundle`, puis inspection manuelle des deux fichiers dans
l'export produit. Pas de point d'arrêt : rien ici n'engage encore de décision irréversible tant
que les valeurs restent provisoires.

---

## P3bis.3 — Migration : jeton, table invitations, politiques

```
Crée la ou les migrations qui portent ce qui a été validé en P3bis.1. Conventions du dépôt,
rappelées : français sans accent, snake_case, grants explicites précédés de revoke (0006),
aucune politique DELETE, retrait logique par colonne.

1. Le jeton du coach : colonne dédiée sur profils_coach, ou table séparée à une ligne par coach
   — dis lequel et pourquoi. 22 caractères aléatoires côté serveur (point 1 de tête de fichier),
   jamais dérivés du nom. Décide et écris ici, avant le SQL, comment un coach déjà existant
   obtient un jeton : généré à la migration pour tous les coachs existants, ou généré à la
   demande (une fonction qui crée-si-absent) au premier accès à I-01.

2. La régénération du jeton (point 1) : une fonction security definer qui remplace le jeton d'un
   coach par un nouveau, tirée par le coach lui-même sur son propre profil uniquement. Aucune
   ligne invitations n'est modifiée par cette fonction — seule la valeur du jeton change.

3. Table invitations : coach_id (référence profils_coach, cascade), compte_invite_id (référence
   comptes, nullable), statut (enum, les trois valeurs de docs/domaine.md), cree_le,
   compte_cree_le (nullable), abonnee_le (nullable, jamais écrite par cette migration — voir
   point 2 de tête de fichier, règle 8). Pas de colonne qui porterait une identité de l'invité
   au-delà de compte_invite_id lui-même (le prénom/nom se lisent depuis comptes/profils_client à
   l'usage, jamais dupliqués ici).

4. La fonction ou le déclencheur qui, à la création d'un compte par ce lien, insère la ligne
   d'invitation (statut 'compte_cree', compte_invite_id renseigné) : security definer, même
   motif que creer_profil_coach/creer_profil_client — le compte qui vient de se créer n'a par
   définition aucun privilège encore accordé sur cette table.

5. La lecture par le coach passe PAR LA FONCTION SEULE — tranché en P3bis.1 (`docs/backend.md`
   §11), pas un choix qui se rouvre ici. `mes_invitations()`, security definer, rend exactement :
   `id` (uuid de l'invitation, nécessaire pour cibler l'action Relancer — un uuid seul ne révèle
   rien), `statut`, `prenom`, une colonne calculée `initiale_nom` (`left(nom, 1)`, jamais `nom`
   en entier), `abonnee_le`. **Ne sélectionne PAS `compte_cree_le`** : rien à l'écran ne l'affiche
   (`docs/ecrans/L3bis-I01-inviter-mes-clients.md`), et « jamais plus que nécessaire » se décide
   colonne par colonne, pas par confort. Point d'arrêt : montre-moi le corps exact de la
   fonction avant de l'accorder à qui que ce soit.

6. Grants : revoke all avant chaque grant, sur la table ET sur la fonction. Exécution de
   `mes_invitations()` accordée à `authenticated` seul. **Aucun grant SELECT sur la table
   `invitations` elle-même, pour aucun rôle, et aucune politique SELECT dessus** — la fermeture
   EST cette absence (`docs/backend.md` §11) : un futur grant, même colonne par colonne, ouvrirait
   un second chemin qui contournerait la troncature. Personne d'autre ne lit cette table par
   aucun chemin, y compris l'invité lui-même (I-02 ne lit que le profil public du coach par le
   jeton, jamais la table invitations).

7. Vérifie que la migration est rejouable de zéro. La preuve vient de la CI, comme toujours sur
   cette machine.
```

**Vérification :** `npx supabase db push` sur le projet de développement, puis `npm run verif`.

---

## P3bis.4 — Le banc : jeton imprévisible et révocable, lecture étroite dans les deux sens

```
Étends src/test/rls.banc.ts. Mêmes règles qu'aux lots précédents : base réelle, garde de
sécurité, comptes préfixés, nettoyage en afterAll, fixtures créées par service_role.

Le jeton (point 1 de tête de fichier) :
   - un jeton construit à la main à partir du nom public d'un coach (même motif que le chemin
     de stockage de P2.5) ne résout à aucune invitation existante — la page I-02 doit se
     comporter comme pour un jeton totalement absent, jamais révéler qu'il « presque »
     correspond à quelqu'un.
   - deux coachs ont chacun leur propre jeton, jamais le même, jamais dérivable l'un de l'autre.
   - un coach régénère son jeton : l'ancien ne résout plus rien ; le nouveau fonctionne ; une
     invitation déjà liée à ce coach avant la régénération reste inchangée, lisible comme avant.

La lecture étroite par le coach (point 2 de tête de fichier), dans les deux sens :
   - le coach lit id + statut + prenom + initiale_nom + abonnee_le de SES invitations aux états
     compte_cree/abonnee, via mes_invitations() — colonnes exactes de docs/ecrans/L3bis-I01-
     inviter-mes-clients.md, ni plus ni moins (compte_cree_le NE doit PAS sortir).
   - **assertion sur la VALEUR, pas seulement sur l'absence d'un champ** : compare la réponse de
     mes_invitations() au vrai nom du compte invité (préparé par le banc, connu à l'avance) et
     vérifie explicitement que la chaîne renvoyée pour l'identité ne contient JAMAIS plus qu'un
     caractère au-delà du prénom — pas seulement qu'aucune colonne littéralement nommée « nom »
     n'apparaît dans le JSON. Un renommage de colonne qui déplacerait le nom complet ailleurs
     (`nom_complet`, `identite`...) doit rougir ce test, pas seulement un test qui cherche le mot
     « nom ».
   - **l'absence elle-même se prouve, pas seulement la fonction** (docs/backend.md §11) : un
     compte authenticated ordinaire fait GET /rest/v1/invitations directement (sans passer par
     la fonction) — refusé, avec le code d'erreur Postgres 42501 (insufficient_privilege) dans
     le corps de la réponse, même famille de preuve que le test sur compte_id en L2
     (`profils_coach?select=compte_id`, "permission denied"). Refait avec select=id,statut
     seuls (pas de colonne "sensible" demandée) : refusé pareil — c'est le GRANT qui ferme, pas
     une politique qui filtrerait des colonnes précises.
   - le coach ne peut PAS lire le nom complet, l'e-mail, le téléphone, ni aucune autre colonne
     de profils_client/comptes de l'invité par ce chemin — pas même en relation imbriquée
     PostgREST (même famille de trou que le `select=…(*)` de la porte de sortie de L2).
   - un AUTRE coach (compte authenticated, profil coach existant) appelle mes_invitations() :
     ne reçoit AUCUNE ligne qui ne lui appartient pas — zéro ligne, pas une ligne tronquée.
   - anon ne lit la table invitations ni n'appelle mes_invitations() par aucun chemin — refusé,
     même code d'erreur qu'authenticated pour la table ; pour la fonction, refus d'exécution
     (revoke execute from public, exécution jamais accordée à anon — même mécanisme que
     profil_actif_courant(), §7, jamais celui de date_verification_coach() qui, lui, EST
     accordée à anon parce que la date de vérification est publique : ne pas confondre les deux
     précédents).
   - une invitation en_attente ne fuit son existence individuelle nulle part, même en creux
     (compte, longueur de réponse, code d'erreur distinct d'une absence).

La transition vers abonnee (point 2, règle 8) — LE TEST LE PLUS IMPORTANT DE CE PROMPT, PARCE
QU'IL EST DESTINÉ À DEVENIR FAUX :
   - à ce lot, AUCUN chemin (fonction, déclencheur, écriture directe accordée) ne peut faire
     passer une invitation à 'abonnee'. Écris ce test comme une assertion positive de cette
     absence, avec un commentaire qui dit explicitement : « Ce test doit être retiré ou remplacé
     le jour où L4 ajoute la fonction de création d'abonnement — vérifier à ce moment-là qu'elle
     écrit bien invitations.statut = 'abonnee' quand l'abonné et l'inviteur coïncident, pas
     seulement que ce test-ci a été supprimé. »

La création du lien coach → compte invité :
   - un compte créé par le lien porte bien compte_invite_id vers ce compte précisément, jamais
     vers un autre coach que celui du jeton utilisé.
   - un compte créé SANS passer par un lien (inscription normale) ne crée aucune ligne
     d'invitation.

Puis la preuve, comme aux lots précédents : commente chaque politique et chaque fonction une
par une, relance, montre la sortie rouge nommée, remets en place. Chaque cycle passe par un vrai
db push.
```

**Vérification :** `npm run test:rls` — lis la sortie ligne par ligne.

---

## P3bis.5 — Écran I-01 (coach)

```
Applique docs/ecrans/L3bis-I01-inviter-mes-clients.md.

1. Lecture publique du profil du coach lui-même (déjà le sien) : rien de nouveau à ouvrir ici,
   l'écran vit derrière une session authentifiée, espace coach.

2. Le bouton Partager appelle le partage natif de la plateforme (déjà utilisé ailleurs dans ce
   dépôt si un précédent existe — sinon, dis quelle API tu ajoutes et son poids).

3. La régénération du jeton (point 1 de tête de fichier) : une action explicite, avec
   confirmation qui dit ce qui change (l'ancien lien cesse de fonctionner) et ce qui ne change
   pas (les invitations déjà établies restent). Jamais silencieuse, jamais automatique.

4. Les trois états de la liste « Qui a répondu » (point 2 de tête de fichier), y compris
   `abonnee`, sont codés et testés contre le faux port (`src/services/donnees/faux.ts`, qui peut
   fabriquer n'importe quel état librement) — même si, contre la vraie base, `abonnee` reste
   inatteignable jusqu'à L4 (règle 8, voir P3bis.4). Le code ne doit pas attendre L4 pour exister,
   seule l'écriture réelle du statut y est différée.

5. Les invitations en_attente restent groupées (« 6 invitations envoyées »), jamais détaillées
   une par une — la maquette le tranche explicitement (Règles de la fiche) : les développer
   transformerait l'écran en tableau de relance, un autre produit.

6. Règle 6 : le nom des colonnes envoyées et reçues se teste contre le projet de développement,
   pas contre un mock.
```

---

## P3bis.6 — Écran I-02 (client, sans session)

```
Applique docs/ecrans/L3bis-I02-arrivee-par-invitation.md.

1. Fonctionne réellement sans session — vérifie-le déconnecté, pas seulement avec un compte sans
   profil. Un jeton absent ou invalide affiche un état honnête (pas une page blanche, pas une
   erreur technique) — décide lequel dans la fiche si ce n'est pas déjà fait.

2. Rien affiché ici n'excède ce que le profil public du coach (L2-12) expose déjà — si l'écran
   a besoin d'une donnée de plus, remonte-le avant de l'ajouter au lieu de la lire directement.

3. « Créer mon compte » entre dans le parcours d'inscription existant (L1-02) en portant le
   jeton — décide comment (paramètre de route, comme viaCoach en L1-01/L1-08, docs/dette.md) et
   dis-le dans la fiche si ce n'est pas déjà tranché.

4. « Voir son profil d'abord » ouvre le même écran public que la recherche (L2-12/L3), jamais
   une variante dédiée à ce parcours.

5. Cet écran est la cible de P3bis.2 (Universal Links/App Links) : ce que npm test peut prouver
   ici s'arrête à « la route existe et lit le bon jeton depuis ses paramètres » — que le lien
   `https://` réel ouvre bien CET écran sur un téléphone reste une vérification manuelle (point 3
   de tête de fichier), à lister dans les critères non automatisables, pas à simuler.
```

---

## P3bis.7 — Accessibilité, galerie, intégration continue du lot

```
1. Toute surface ajoutée au lot est dans la galerie, exercée dans les deux thèmes. Liste celles
   qui manquaient et que tu as ajoutées.

2. npm run test:a11y sur les deux écrans du lot. I-02 est, comme la fiche coach de L2 et
   l'accueil de L3, un écran que des inconnus verront en premier.

3. Le banc RLS gagne sa quatrième famille : ouvertures étroites et nommées (L3bis), après
   fermetures (L1), ouvertures unitaires (L2), ouvertures à grande échelle (L3). Donne-moi le
   compte de tests avant/après.

Termine par la liste des critères d'acceptation des fiches L3bis qui ne sont PAS automatisables
et attendent une vérification à la main — en tête, la vérification sur appareil physique du
point 3 de tête de fichier (Universal Links/App Links), qui ne peut pas être simulée ici.
```

---

## Porte de sortie du lot L3bis

```
Revue de fin de lot L3bis. Ne modifie rien avant que je valide.

1. Écarts entre les fiches docs/ecrans/L3bis-*.md et ce qui est réellement codé.
2. Pour la lecture étroite (coach → invité) et pour la fonction de création du lien
   coach → compte, cite le test du banc qui la couvre dans les deux sens. Un chemin sans les
   deux tests est un trou : nomme-le.
3. Liste tout ce qu'un compte NON connecté peut lire par I-02, table par table, colonne par
   colonne — c'est plus court qu'en L2/L3 (une seule ligne de profil coach par jeton), mais la
   question reste la même.
4. Prouve qu'un jeton construit à la main à partir d'une donnée publique ne résout jamais à une
   invitation existante, et que la régénération invalide l'ancien jeton sans toucher aux
   invitations déjà établies.
5. Ce lot n'a ni bruit de départage ni plafond dur à prouver — dis pourquoi ce n'est pas un
   oubli : une invitation se lit une ligne à la fois, jamais un ensemble de plusieurs coachs.
6. Vérifie qu'aucune ligne du lot ne touche à Stripe, aux avis, à la messagerie, au studio, à
   l'agenda ou à une donnée de santé.
7. Vérifie que les migrations sont rejouables de zéro. La CI fait foi.
8. Vérifie que la transition vers `abonnee` n'a toujours aucun chemin d'écriture réel (règle 8) —
   si un chemin existe déjà, c'est soit une anticipation de L4 à documenter explicitement, soit
   une fuite à corriger, jamais une ambiguïté à laisser courir.
9. Vérifie qu'aucun élément hors périmètre (docs/perimetre.md §3) n'a été préparé.
10. Propose les entrées de docs/dette.md à ajouter ou corriger — NE LES ÉCRIS PAS : cette revue
    ne modifie rien (voir la première ligne, et la règle 10). Une fois ma validation reçue,
    applique-les.

Rends un tableau, puis attends mes instructions.
```

**Ce que tu dois voir avant de passer à L4 :** `npm run verif` vert avec `test:rls` dedans, un
lien d'invitation qui ouvre I-02 sans session et sans révéler rien de plus que le profil public
du coach, un compte créé par ce lien qui apparaît côté coach en prénom + initiale seulement,
aucun autre coach ni aucun compte anonyme qui ne lise cette relation, et — dès qu'un appareil
physique et les comptes développeur existent — un vrai lien collé dans une messagerie qui ouvre
réellement l'application sur I-02.

---

## Ce qui reste à décider avant L4

- **La transition `invitations.statut` vers `'abonnee'`** (point 2 de tête de fichier, règle 8) :
  la fonction qui crée un abonnement réel devra aussi mettre à jour cette ligne quand l'abonné et
  l'inviteur coïncident, et le test de P3bis.4 qui prouve aujourd'hui l'absence de tout chemin
  devra être remplacé par son inverse à ce moment précis.
- **Le rappel de commission affiché en I-01** ne devient réellement calculé qu'une fois de vrais
  abonnements existent (L4) — jusque-là, l'écran affiche honnêtement l'absence de tout
  abonnement plutôt qu'un chiffre inventé (même figure que le classement de L3 avant que des
  vrais coachs ne renseignent leur profil, `docs/dette.md`). Laissé tel quel, ce n'est pas un
  oubli.
