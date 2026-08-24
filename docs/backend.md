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

---

## 5. Ce qui ne quitte jamais le serveur

- **La clé `service_role` n'entre jamais dans l'application mobile**, ni en dur, ni via une
  variable d'environnement `EXPO_PUBLIC_*`, ni dans un journal. Elle contourne RLS entièrement :
  une fuite équivaut à un accès total à la base. Règle imposée par ESLint
  (`eslint.config.js`), voir `CLAUDE.md` §2.
- Toute logique qui a besoin de cette clé (tâche planifiée, appel à un prestataire externe,
  opération inter-tables qui doit ignorer RLS) s'écrit dans une fonction distante (Supabase Edge
  Function), jamais dans le code de l'application.
