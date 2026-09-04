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
