# L2-10 · Back-office de vérification des coachs (BO-01)

**Lot** L2 · **Rôle** examinateur (équipe de la plateforme — dans ce projet, le porteur du
projet lui-même, `CLAUDE.md` §1 : « développée par une seule personne ») · **Route**
`app/(admin)/verification.tsx` — **dans ce même dépôt**, pas une application séparée.
**Référence visuelle** aucune — absent du dossier, hors application mobile
(`docs/perimetre.md`, section « Hors application mobile »).

---

## Raison d'être

Donner à un humain le moyen de décider `absente → en_examen → verifiee | complement_demande |
refusee` (`docs/domaine.md` §4.2), en consultant des pièces qu'aucun chemin de l'application
mobile ne doit jamais rouvrir (`docs/perimetre.md` §5, critère 10).

**Tranché** : une route protégée dans ce dépôt, pas une seconde application. Une application
séparée double le déploiement, la CI et la gestion des secrets pour un écran utilisé par une
seule personne — coût disproportionné au bénéfice pour ce projet (`CLAUDE.md` §1 : préférer la
solution ennuyeuse à l'astucieuse).

---

## Contenu

Trois écrans, dans le groupe `app/(admin)/` :

1. **File d'attente** : dossiers `en_examen`, triés par date de dépôt (le plus ancien d'abord).
   Chaque ligne : nom du coach, discipline, date de dépôt, pièces présentes.
2. **Consultation d'un dossier** : les pièces déposées (`L2-06`), affichées à l'examinateur —
   seul endroit du système entier où leur contenu est rouvert.
3. **Décision** : trois boutons, chacun avec un champ motif — vide refusé pour
   `complement_demande` et `refusee` (motif facultatif pour `verifiee`) :
   - Vérifier → `verifiee`
   - Demander un complément → `complement_demande`, motif transmis au coach (`L2-09`)
   - Refuser → `refusee`, motif transmis au coach (`L2-09`)

   **Un seul statut par dossier, même si un seul document pose problème parmi plusieurs.**
   Quand une pièce précise bloque le dossier (ex. un diplôme illisible, une pièce d'identité
   valide), la décision reste `complement_demande` pour le dossier entier — l'examinateur
   **nomme la pièce dans le motif** (« Diplôme illisible : la photo est trop floue pour lire
   l'organisme et la date. ») plutôt que de choisir un statut par document. C'est le compromis
   qui tient sans ajouter de colonne ni d'entité : le coach lit une friction précise, le modèle
   (`docs/domaine.md` §4.2) garde une seule valeur de statut pour tout le dossier. L'écran de
   consultation peut lister les pièces déposées côte à côte (voir `L2-09`), mais aucune d'elles
   ne porte un statut individuel stocké — seul le motif, texte libre, les distingue.

---

## Règles

- **Groupe de routes distinct, jamais lié depuis la navigation mobile.** `app/(admin)/` n'est
  atteint par aucun `Tabs`, aucun lien, aucun bouton des groupes `(client)`/`(coach)`/`(compte)`
  — seule une URL directe y mène. Ce n'est pas la protection réelle (voir points suivants), mais
  ça évite qu'un geste normal de navigation y échoue accidentellement.
- **Jamais la clef anonyme de l'application mobile.** `app/(admin)/` n'importe pas
  `src/services/supabase/client.ts` (le client configuré avec `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  celui embarqué dans le paquet mobile) : il instancie son propre client Supabase, avec sa
  propre variable d'environnement dédiée — jamais lue ni exposée par le paquet mobile, jamais
  dans `.env.exemple` aux côtés des variables `EXPO_PUBLIC_*`. La clé reste anonyme au sens
  Supabase (RLS fait le travail, comme partout ailleurs dans ce dépôt), mais elle n'est plus
  *la même* clé que celle qu'un utilisateur mobile porte dans son appareil — révoquer l'une
  n'affecte jamais l'autre.
- **Un accès qui n'est pas un mot de passe partagé, et un rôle qui n'est jamais un drapeau
  côté client.** Tranché (`docs/backend.md` §9) : un compte `auth.users` dédié par examinateur,
  distinct de tout compte `client`/`coach` — jamais de compte partagé, jamais un compte
  ordinaire promu par une case à cocher côté application. Le rôle est porté par
  `comptes.est_examinateur`, une colonne **sans aucun `GRANT SELECT` ni `GRANT UPDATE`** pour
  `anon`/`authenticated` : rien dans l'application ne peut la lire ni l'écrire. Toute politique
  RLS que cette route traverse s'appuie sur `public.est_examinateur_courant()` (fonction
  `SECURITY DEFINER`, `docs/backend.md` §9), jamais sur une valeur envoyée par le client — le
  serveur revalide l'identité de l'examinateur à chaque requête, exactement comme il revalide le
  profil actif ailleurs dans ce dépôt.
- **Toute décision passe par une fonction journalisée**, jamais un `UPDATE` direct sur
  `profils_coach.statut_verification` — même raison que partout ailleurs : cette colonne n'a
  aucun `GRANT UPDATE` pour `authenticated` (`0001_creer_identite.sql`). La fonction, en plus
  d'écrire le statut, insère une ligne dans `DecisionVerification` (`docs/domaine.md` §3.14) —
  qui a décidé, quand, quel motif — journal en ajout seul, jamais modifié.
- Cet outil touche des pièces d'identité : toute son activité (connexions, décisions) est une
  donnée sensible, avec la même prudence que le reste (`CLAUDE.md` §10).

---

## États

| État | Comportement |
|---|---|
| Non authentifié | Écran de connexion dédié, aucun contenu du dossier visible avant |
| File vide | « Aucun dossier en attente » |
| Décision envoyée | Retour à la file, la ligne disparaît |
| Erreur | Message d'erreur, aucune décision à moitié écrite |

---

## Ce qui a été inventé pour cette fiche

- Le tri de la file d'attente (plus ancien d'abord) : raisonnable, non spécifié ailleurs.
- Le mécanisme précis d'exclusion de `app/(admin)/` du build mobile de production (voir critère
  7) : la non-atteignabilité par la navigation se prouve par un test ; l'absence dans le bundle
  compilé iOS/Android est une garantie d'un autre ordre, dont l'outillage exact (résolveur
  Metro, configuration Expo Router par plateforme) n'est pas choisi ici.

---

## Critères d'acceptation

Pas de critère automatisable par `npm run verif` au même titre qu'un écran mobile (pas de
galerie, pas de test d'accessibilité mobile) — mais du code du même dépôt, donc types et lint le
couvrent. Ce qui doit rester vrai :

1. Un dossier passe de `en_examen` à l'un des trois statuts, jamais directement depuis un autre
   état, et jamais par un `UPDATE` direct depuis un test qui contournerait la fonction.
2. Un motif est exigé pour `complement_demande` et `refusee`, refusé s'il est vide.
3. Aucune variable `EXPO_PUBLIC_*` n'est lue par `app/(admin)/`.
4. Une décision insère une ligne dans `DecisionVerification`, pas seulement le statut.
5. Le coach voit le motif transmis, via `L2-09`, dans l'application mobile.
6. **Un test parcourt tous les écrans de `(client)`, `(coach)`, `(compte)`, `(public)` et
   `(onboarding)` et échoue s'il trouve une navigation, un lien ou une référence de route vers
   `(admin)`** — même mécanisme que `src/test/aucun-import-supabase-direct.test.ts` et la liste
   de libellés interdits de `ecran-compte.test.tsx` : une interdiction non éprouvée par un test
   qui tente l'interdit est une interdiction absente (`docs/prompts/L1.md`, tableau des faux
   verts, 3ᵉ ligne).
7. **Un contrôle prouve que `app/(admin)/` n'est pas embarqué dans le build de production
   mobile** (iOS et Android) — pas seulement inatteignable par la navigation à l'exécution, mais
   absent du paquet compilé lui-même.
