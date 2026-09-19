# Conventions Supabase

Source unique pour tout ce qui touche à l'infrastructure Supabase : migrations, schéma,
sécurité au niveau ligne (RLS), séparation des environnements. `CLAUDE.md` §2 renvoie ici pour
le détail ; ce fichier ne redéfinit pas les décisions figées, il les met en œuvre.

---

## 1. Deux projets, jamais un seul

Un projet Supabase de développement, un projet Supabase de production. Deux URLs, deux clés
anon, deux fichiers `.env` locaux (jamais commités — voir `.env.exemple`).

**Une migration ne se teste jamais d'abord sur prod.** Ordre systématique : écrite et rejouée en
local, appliquée au projet dev, vérifiée à l'écran, puis seulement appliquée au projet prod.
Aucune exception, y compris pour une migration « triviale ».

Plan gratuit en développement. Passage au plan Pro pour le projet de production, au plus tard au
lot L4 (paiement réel qui s'ouvre) — voir aussi §3 ci-dessous pour ce que ce passage débloque
côté authentification.

---

## 2. Migrations

- **Nommage** : `NNNN_verbe_sujet.sql`, numéro à 4 chiffres, séquentiel, jamais réutilisé même si
  une migration est annulée. Exemple : `0001_creer_comptes.sql`, `0002_ajouter_colonne_note.sql`.
- Une migration = un changement cohérent, jamais un fourre-tout. Une migration qui ajoute une
  table et sa première politique RLS est acceptable ; une migration qui touche cinq tables sans
  rapport ne l'est pas.
- Aucune migration n'est modifiée après avoir été appliquée en dev. Une correction s'écrit dans
  une **nouvelle** migration, jamais en éditant l'ancienne — même règle que pour les factures
  immuables de `docs/domaine.md` §3.5, pour la même raison : l'historique fait foi.

### Procédure de rejeu complet

Doit pouvoir se faire à tout moment, sur une base vide, sans intervention manuelle autre que la
commande elle-même :

1. Base de développement réinitialisée (vide, schéma `public` neuf).
2. Toutes les migrations rejouées dans l'ordre de leur numéro, une par une.
3. `npm run verif` (ou l'équivalent côté base, quand il existera) confirme que le schéma
   résultant correspond à ce que le code attend.

Si le rejeu complet échoue, aucune nouvelle migration ne s'ajoute avant d'avoir corrigé celle qui
casse la chaîne.

---

## 3. Authentification — réglages de session

Réglages du tableau de bord Supabase Auth, **à fixer identiquement sur les deux projets** (dev
et prod) :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Expiration du jeton d'accès | **3 600 s (1 h)**, valeur par défaut | On ne descend pas : chaque rafraîchissement est un aller-retour réseau sur mobile. |
| Rotation des jetons de rafraîchissement | **Activée** | Valeur par défaut, on ne la touche pas. |
| Intervalle de réemploi (rotation) | **10 s**, valeur par défaut | Idem. |

**Conséquence à ne pas oublier, parce qu'elle contredit ce qu'un dossier d'API maison laisserait
croire** : un jeton d'accès déjà émis reste valable jusqu'à son expiration naturelle, **même
après déconnexion ou révocation**. La déconnexion invalide le jeton de rafraîchissement (plus de
nouveau jeton d'accès possible), mais le dernier jeton d'accès émis continue de fonctionner
jusqu'à sa propre expiration. Avec 3 600 s, la fenêtre d'incident est **d'une heure, pas de
zéro**.

Source unique de ce mécanisme : `docs/ecrans/L1-04-connexion.md` ("Nouveau mot de passe") et
`docs/ecrans/L1-09-mes-informations.md` ("Adresse e-mail et mot de passe") y renvoient plutôt que
de le redécrire — vérifié en direct contre la base réelle à P1.9 (`src/test/rls.banc.ts`), après
qu'une première rédaction des deux fiches ait promis à tort une coupure immédiate. Si la valeur
de `jwt_expiry` change un jour, ce paragraphe est le seul à corriger.

Le jeton de rafraîchissement, lui, **n'expire pas de lui-même** chez Supabase (contrairement à un
« 30 jours » qui aurait été une invention maison). Deux réglages permettent de le borner dans le
temps :

- **Session bornée dans le temps** (« time-box user sessions ») — **indisponible sur le plan
  gratuit, réservé au plan Pro et au-delà**. Dette : voir `docs/dette.md`, échéance L4, en même
  temps que le passage en Pro du projet de production. Valeur cible une fois disponible :
  30 jours.
- Délai d'inactivité et session unique par utilisateur : non retenus au jalon 1, à réévaluer si
  un besoin réel apparaît.

---

## 4. Schéma

- **Tables en français, sans accent** : `abonnements`, `profils_coach`, `mesures_corporelles` —
  même vocabulaire que `docs/domaine.md`, en `snake_case` (convention SQL), jamais en anglais.
- **Grants explicites obligatoires.** Aucune table ne s'expose par défaut aux rôles `anon` /
  `authenticated` : chaque table reçoit ses `GRANT` un par un, pour l'opération réellement
  nécessaire (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), jamais un `GRANT ALL` par confort.
- **Une politique RLS par table et par opération.** Pas de politique unique couvrant
  `SELECT`/`INSERT`/`UPDATE`/`DELETE` à la fois : chacune s'écrit et se relit séparément, pour
  qu'une revue puisse juger une seule opération à la fois. Une table sans politique pour une
  opération donnée refuse cette opération par défaut (RLS activée à la création, voir
  `CLAUDE.md` §2) — c'est le comportement voulu, jamais une politique « autoriser tout » posée
  pour faire disparaître un blocage.
- **Toute vue du schéma public est déclarée `WITH (security_invoker = true)`, sans exception.**
  Sans cette option, une vue s'exécute avec les droits de son propriétaire et contourne les
  politiques RLS, silencieusement. Vérifié par balayage (`src/test/vues-security-invoker.test.ts`,
  branché dans `npm run verif`), pas seulement à l'œil : c'est la troisième vue, dans huit mois,
  qui posera le problème si la règle ne repose que sur la mémoire de qui l'a écrite la première fois.
- **Toute fonction du schéma public appelable directement est suivie d'un
  `REVOKE EXECUTE ... FROM PUBLIC`, puis d'un `GRANT EXECUTE` explicite aux seuls rôles qui en
  ont besoin.** Postgres accorde `EXECUTE` à `PUBLIC` à la création d'une fonction — une
  fonction sans ce `REVOKE` est donc appelable par `anon`, c'est-à-dire par quiconque possède la
  clé publique de l'application (`.env.exemple`). Exception structurelle, pas de confort : une
  fonction déclencheur (`RETURNS TRIGGER`) n'a pas besoin de ce `REVOKE`, Postgres refuse déjà
  de l'exécuter hors d'un déclencheur, quel que soit le rôle appelant. Vérifié par balayage
  (`src/test/fonctions-execute-revoque.test.ts`, branché dans `npm run verif`), même raison que
  pour `security_invoker` ci-dessus.

---

## 5. RLS activée sans politique : ce que chaque opération rend

Une table avec RLS activée et zéro politique ne se comporte pas pareil selon l'opération —
en particulier, "pas de politique" ne veut pas dire "tout échoue de la même façon" :

| Opération | Sans politique |
|---|---|
| `SELECT` | Liste vide, **silencieusement** — jamais une erreur |
| `INSERT` | **Rejet explicite** (`new row violates row-level security policy`) |
| `UPDATE` | Zéro ligne affectée, **silencieusement** — jamais une erreur |
| `DELETE` | Zéro ligne affectée, **silencieusement** — jamais une erreur |

Seul `INSERT` prévient. La lecture et les deux autres écritures échouent en silence : un test
qui vérifie "cette opération est refusée" doit donc vérifier des résultats différents selon le
verbe (liste/nombre de lignes affectées à zéro pour `SELECT`/`UPDATE`/`DELETE`, une erreur levée
pour `INSERT`) — pas la même assertion partout. Vérifié en conditions réelles (Postgres local)
avant `0001_creer_identite.sql` ; `service_role` contourne RLS entièrement et n'est concerné par
aucune ligne de ce tableau.

---

## 6. Ce qui ne quitte jamais le serveur

- **La clé `service_role` n'entre jamais dans l'application mobile**, ni en dur, ni via une
  variable d'environnement `EXPO_PUBLIC_*`, ni dans un journal. Elle contourne RLS entièrement :
  une fuite équivaut à un accès total à la base. Règle imposée par ESLint
  (`eslint.config.js`), voir `CLAUDE.md` §2.
- Toute logique qui a besoin de cette clé (tâche planifiée, appel à un prestataire externe,
  opération inter-tables qui doit ignorer RLS) s'écrit dans une fonction distante (Supabase Edge
  Function), jamais dans le code de l'application.

---

## 7. Fonctions SECURITY DEFINER : la politique ne protège que le chemin direct

Une fonction `SECURITY DEFINER` s'exécute avec les privilèges de son propriétaire (le rôle de
migration), pas avec ceux de l'appelant — elle **contourne RLS** pour l'écriture qu'elle
effectue, exactement comme `service_role` le fait pour toute la base. `basculer_profil` le fait
déjà pour `comptes.profil_actif` (colonne sans aucun `GRANT UPDATE` pour `authenticated`) ;
`creer_profil_coach` (lot L2) le fera pour `profils_coach` — au moment de son appel, l'appelant
est encore en espace client, donc `profils_coach_insert_espace_coach` refuserait l'insertion
s'il agissait avec ses seuls droits (voir `supabase/migrations/0002_politiques.sql`).

Conséquence trouvée en marchant, pas anticipée (`docs/prompts/L1.md`, cycle rouge/vert de
P1.5 ; détail dans `docs/dette.md`) : **dès qu'une écriture légitime passe par une fonction
`SECURITY DEFINER`, la politique RLS de la table correspondante ne ferme plus que les chemins
DIRECTS** — un `INSERT`/`UPDATE` PostgREST fait avec les seuls droits de l'appelant. Elle ne dit
plus rien du chemin normal, qui passe par la fonction et la contourne. Les deux mécanismes
restent nécessaires (la politique ferme la porte de derrière, la fonction ouvre celle de devant
selon ses propres règles), mais c'est la **fonction** qui porte la règle métier réelle — et
c'est donc elle qu'il faut tester, pas seulement la politique qu'elle traverse.

**Un test de politique RLS ne prouve jamais le comportement d'une fonction `SECURITY DEFINER`
qui la contourne.** Chaque fonction `SECURITY DEFINER` a besoin de ses propres tests de refus
(mauvais appelant, condition métier non remplie...) : ils ne se déduisent pas des tests de
politique de la table qu'elle écrit. Conséquence concrète pour le lot L2 : `creer_profil_coach`
devra avoir ses propres tests de refus (par exemple : refus si un profil coach existe déjà pour
ce compte), indépendants du banc RLS de `profils_client`/`profils_coach`.

---

## 8. Lectures inter-comptes

Les dix politiques posées jusqu'ici (`0002_politiques.sql`) disent toutes la même chose : le
propriétaire, et personne d'autre — y compris la lecture croisée `profils_client`/`profils_coach`,
qui reste bornée au compte appelant (`compte_id = auth.uid()`), jamais ouverte à un tiers.
`Offre` (lot L2, `docs/domaine.md` §3.3) est la **première** table dont une politique `SELECT`
doit s'ouvrir au-delà de son propriétaire : une offre publiée doit être lisible par n'importe quel
compte, et probablement par `anon` (profil coach consulté sans session, référencement).

**Règle du lot** : toute politique qui ouvre une lecture au-delà du propriétaire doit être
accompagnée des tests de ce qu'elle **NE** laisse **PAS** passer, et la liste de ces tests fait
partie de la fiche d'écran — pas seulement du banc RLS. Une politique qui élargit un `SELECT`
change deux choses à la fois (qui peut lire, et ce qui devient lisible en creux par une jointure)
et les deux s'oublient séparément :

- **Ce qui doit rester fermé malgré l'ouverture.** Une offre porte un `coach_id` : publier une
  offre publie l'existence d'un profil coach, mais ne doit publier ni les colonnes non destinées
  au public de `profils_coach`, ni une offre `brouillon` ou `retiree` du même coach, ni les offres
  d'un autre coach par une jointure. Chaque table déjà fermée (`profils_coach`, `comptes`) doit
  être vérifiée à nouveau une fois qu'une table voisine s'ouvre : une politique qui protège une
  table seule ne dit rien de ce qui devient atteignable par une table qui référence cette même
  ligne.
- **Le rôle `anon` change la nature de la preuve.** Jusqu'ici, `service_role` mis à part
  (`0003_accorder_service_role.sql`), aucune politique n'accorde `anon` (`0001_creer_identite.sql` :
  « aucun grant à anon »). La première politique qui le fait doit prouver, au banc, qu'`anon` ne
  lit **que** ce que la politique autorise explicitement — pas seulement qu'un compte
  authentifié tiers est bloqué. Un test qui ne couvre que le cas authentifié laisse `anon` non
  éprouvé alors qu'il porte la surface d'attaque la plus large (aucune clé, aucun compte requis).

**Ce que la fiche d'écran doit lister, pas seulement le banc :** pour chaque politique de lecture
inter-comptes qu'un écran expose, la fiche nomme le ou les scénarios de refus attendus (qui ne
doit rien voir, et de quoi précisément), au même titre que ses critères d'acceptation positifs.
Une politique dont la fiche ne dit pas ce qu'elle refuse est une politique dont personne n'a
encore posé la question — le même défaut que « une liste d'exclusion qui ne protégeait rien »
(`docs/prompts/L1.md`, tableau des faux verts, 3ᵉ ligne), appliqué à la lecture plutôt qu'à
l'écriture.

**Contrainte permanente du schéma, pas une note propre à un lot** (trouvée en écrivant
`jeton_invitation`, L3bis, 0026) : depuis `profils_coach_select_verifiee` (0008),
**toute colonne ajoutée à `profils_coach` est publique par défaut, dès qu'elle est accordée** —
la politique laisse déjà passer n'importe quelle ligne vérifiée à `anon`, pour n'importe quelle
colonne que le rôle a le droit de lire. Une politique RLS filtre des LIGNES ; un `GRANT` s'accorde
à un RÔLE ENTIER, jamais « seulement pour son propre profil » — les deux mécanismes ne se
recoupent pas, et c'est le grant, pas la politique, qui décide au final ce qu'une colonne publie.
**Une colonne de `profils_coach` qui ne doit pas être publique n'a donc qu'une seule protection
possible : ne jamais figurer dans le grant `SELECT` d'`anon`/`authenticated`, et passer
exclusivement par une fonction `security definer` dédiée** (même famille que
`date_verification_coach()`, 0019, ou `mes_invitations()`/`coach_par_jeton_invitation()`, 0027) —
jamais une politique RLS supplémentaire sur cette table, qui ne changerait rien à ce que le grant
laisse déjà passer. À vérifier à chaque nouvelle colonne posée sur `profils_coach`, pas seulement
à l'écriture de la migration qui l'ajoute.

---

## 9. Rôle d'équipe (examinateur) : un compte distinct, un rôle serveur

Le back-office de vérification (`docs/ecrans/L2-10-back-office-verification.md`, BO-01) est une
route de ce même dépôt (`app/(admin)/`), pas une application séparée — mais elle donne accès à
des pièces d'identité et décide qui peut encaisser. Trois règles, aucune négociable :

- **Un compte Supabase distinct**, créé dans `auth.users` comme n'importe quel autre — le
  déclencheur `creer_compte_depuis_auth()` (`0001_creer_identite.sql`) lui crée donc aussi une
  ligne `comptes`, sans y échapper : pas la peine de contourner ce mécanisme, la ligne `comptes`
  d'un examinateur n'a simplement ni `profils_client` ni `profils_coach`. Jamais un compte
  client ou coach existant promu à la volée.
- **Le rôle est une colonne serveur, jamais un drapeau côté client.**
  `comptes.est_examinateur boolean not null default false` — **aucun `GRANT SELECT` ni
  `GRANT UPDATE` sur cette colonne**, pour aucun rôle (`anon`, `authenticated`). Rien dans
  l'application ne peut la lire ni l'écrire directement ; elle n'existe que pour être consultée
  par une fonction serveur, sur le modèle exact de `profil_actif_courant()`
  (`0002_politiques.sql`) :

  ```sql
  create or replace function public.est_examinateur_courant()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
  as $$
    select coalesce(est_examinateur, false) from public.comptes where id = auth.uid();
  $$;

  revoke all on function public.est_examinateur_courant() from public, anon, authenticated;
  grant execute on function public.est_examinateur_courant() to authenticated;
  ```

  Toute politique RLS que `app/(admin)/` traverse (lecture des dossiers, des pièces, écriture
  d'une `DecisionVerification`, `docs/domaine.md` §3.14) s'appuie sur
  `public.est_examinateur_courant()`, jamais sur une valeur envoyée par le client — même
  principe que le profil actif (§7 ci-dessus) : la vérité est toujours relue côté serveur, à
  chaque requête.
- **Jamais un mot de passe partagé.** Chaque examinateur a son propre compte `auth.users`, donc
  son propre mot de passe (ou methode d'authentification Supabase Auth) — une décision de
  vérification (`docs/domaine.md` §3.14) porte l'identité de son auteur, ce qui suppose que
  cette identité soit individuelle. Un compte partagé rendrait le champ `examinateur` du journal
  inutile : il dirait « quelqu'un », jamais qui.

Attribuer `est_examinateur = true` à un compte reste une opération manuelle, hors application
(`service_role`, directement en base) — aucun écran de ce dépôt ne doit permettre à un compte de
se l'attribuer, ni à un examinateur d'en promouvoir un autre.

---

## 10. Lecture inter-comptes à grande échelle

Règle durable, pas une note propre au lot qui l'a fait apparaître (L3, recherche et classement) :
une surface qui rend **plusieurs lignes à la fois**, à un appelant qui n'a fourni aucun
identifiant précis, porte un risque d'une autre nature qu'une lecture unitaire (§8).

**Une fuite par recherche est une fuite d'annuaire, pas une fuite de ligne.** §8 établit déjà
qu'une politique d'ouverture doit se tester par ce qu'elle ne laisse pas passer — vrai ici aussi,
mais la conséquence d'un oubli change d'échelle : une politique de `L2-12` mal écrite expose au
pire le profil qu'un attaquant a déjà visé ; une fonction de recherche mal écrite expose
l'intégralité du dépôt en une seule requête, sans qu'aucune ligne n'ait été visée par son
identifiant.

- **Chaque colonne rendue se justifie nommément**, comme pour une lecture unitaire — mais la
  revue doit en plus considérer le volume : une colonne acceptable à l'unité (parce que rendue
  publique par ailleurs, un `coach/[id]` par exemple) reste à réévaluer quand elle devient
  listable en masse, triable, filtrable.
- **`security invoker`, pas `security definer`, par défaut.** Une fonction `security definer`
  contourne RLS par construction : c'est alors son corps, écrit une fois, qui devient la seule
  vérité — les politiques existantes (`offres_select_publiees`, `profils_coach_select_verifiee`,
  0008) ne s'appliquent plus à travers elle, et peuvent diverger d'elle sans qu'aucun test ne le
  remarque. En `security invoker`, les politiques déjà éprouvées au banc s'appliquent réellement,
  quel que soit le chemin d'accès. Un écart vers `security definer` (typiquement : la fonction a
  besoin d'un privilège que l'appelant n'a pas, comme un référentiel non public) s'écrit noir sur
  blanc dans la fiche d'écran concernée, avec la preuve au banc que la fonction refuse exactement
  ce que les politiques refusent — pas approximativement.

**Un bruit de départage rejouable est un canal d'observation.** Répartir l'exposition entre
lignes ex-æquo (`docs/domaine.md` §5.6) est une fonctionnalité légitime — mais si le bruit est
mémorisé, transmis par le client, ou dérivable d'une valeur que l'appelant contrôle, il devient
annulable : un appelant qui répète la requête soustrait le bruit et reconstruit l'ordre stable
sous-jacent, c'est-à-dire l'annuaire complet dans un ordre fixe. Le bruit doit être tiré à
l'exécution, côté serveur, à chaque requête — jamais reçu en paramètre, jamais reproductible à
la demande de l'appelant. Et il ne suffit pas que le bruit lui-même soit irreproductible : la
réponse dans son ensemble (pagination, total de résultats) ne doit rien révéler de plus, d'une
requête à l'autre, que ce que la fiche d'écran a explicitement décidé d'exposer.

**Un plafond dur, dans la fonction elle-même, indépendant de ce que l'écran demande.** Le bruit
protège l'ordre ; rien d'autre ne protège le volume. Une taille de page fixée uniquement côté
client (« l'écran ne demande jamais plus de 20 ») ne protège rien : tout appel direct à la
fonction — un outil, un script, un futur écran qui oublie la même limite — la contourne. La
fonction borne elle-même ce qu'elle rend (`least(p_limite, PLAFOND)`), quelle que soit la valeur
demandée.

---

## 11. Lecture inter-comptes minimale : invitation (L3bis)

Volontairement courte, à la différence de §8 et §10 : cette lecture-ci ne rend jamais plus d'une
poignée de lignes, jamais rien qu'un attaquant ne connaisse déjà en partie (le coach ne lit que
SES propres invitations), et elle ne trie ni ne filtre à grande échelle. Le risque n'est pas
« combien de lignes fuient », c'est « combien de colonnes fuient sur chaque ligne qui, elle,
est légitimement visible ».

**Mécanisme retenu : une fonction dédiée, `security definer`, pas une politique RLS plus un
grant colonne par colonne.** Même famille de décision que `date_verification_coach()`
(`docs/domaine.md` §5.1, 0019) : une fonction étroite qui rend un fait calculé, jamais un accès
direct à la table sous-jacente. Raison précise, pas une préférence de style : la règle de
troncature (`docs/domaine.md` §3.15 — prénom + **initiale** du nom, jamais le nom complet)
n'est pas une restriction de colonnes, c'est une transformation d'une colonne. Un grant ne peut
accorder que des colonnes entières ; il ne peut pas accorder « les trois premiers caractères de
`nom` ». Une politique RLS plus un grant sur `profils_client.nom` laisserait donc, au mieux,
la troncature à la charge de l'écran — exactement le défaut que `CLAUDE.md` §10 interdit
ailleurs (une donnée qui transite en entier alors que seule sa forme réduite doit sortir du
serveur) : un appel direct à l'API, hors de l'écran, lirait le nom complet malgré tout.

La fonction (`mes_invitations()`, ou son nom définitif — à fixer par la fiche I-01) calcule donc
elle-même `left(nom, 1)` et ne rend jamais `nom` en entier, à aucun rôle, à aucun chemin. Elle ne
lit que les invitations dont `coach_id` correspond au `profils_coach` du compte appelant
(`auth.uid()`, jamais un paramètre reçu) — même garde que `profil_actif_courant()` (§7). Comme
`date_verification_coach()`, elle est accordée à `authenticated`, jamais `anon` (l'invité n'a
besoin de rien y lire, voir `docs/prompts/L3bis.md`).

**Aucune politique SELECT, aucun grant SELECT sur `invitations`, pour aucun rôle — la fermeture
EST cette absence.** Une fonction `security definer` n'a besoin d'aucun privilège côté appelant
pour fonctionner : elle lit avec les droits de son propriétaire, jamais ceux du rôle qui
l'invoque. Ajouter malgré tout un grant SELECT sur cette table, même colonne par colonne,
n'apporterait rien à la fonction et ouvrirait un second chemin qui contournerait la troncature
— exactement la tension nommée à la porte de sortie de L3 (règle 9, deux chemins qui doivent
s'accorder), évitée ici en n'en laissant exister qu'un seul. Ce n'est pas un oubli à compléter :
un futur grant sur `invitations`, ajouté en croyant bien faire (« pour que le coach puisse
filtrer ses propres invitations directement »), romprait cette fermeture.
