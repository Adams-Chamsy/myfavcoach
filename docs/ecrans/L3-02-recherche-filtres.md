# L3-02 · Recherche + filtres (02)

**Lot** L3 · **Rôle** client, et visiteur non connecté pour la lecture (`anon`, même famille que
`L2-12`, voir Règles) · **Route** `app/(client)/explorer.tsx` — existe déjà comme
`EcranProvisoire` depuis L0.
**Référence visuelle** `maquettes/MyFavCoach-System_dc.html`, bloc « 02 · Recherche + filtres
actifs », `data-screen-label="02 Recherche"`. **Cinq corrections, lues en Règles, plus une
décision de portée tranchée le 13 septembre 2026 — voir « Référentiel géographique ».**

---

## Raison d'être

Le chemin qui mène de « je ne connais aucun coach » à `L2-12`. C'est le deuxième écran du dépôt à
exposer une lecture inter-comptes, et le premier à en exposer **plusieurs lignes à la fois**
(`docs/backend.md` §10) : tout ce qui suit dans cette fiche répond aux deux points de tête de
`docs/prompts/L3.md`.

---

## Contenu

En-tête : retour, champ de recherche texte (discipline ou mot-clé), bouton filtres (badge = nombre
de filtres actifs).

Puces de filtres actifs (retrait individuel par appui).

Ligne de compte + tri : « N coachs · [commune ou "visio"] », sélecteur « Pertinence » (seule
option au jalon 1, voir Règles).

Liste de résultats, un par offre publiée d'un coach vérifié (**jamais** un par coach — un coach
avec deux offres publiées, situation rare mais non exclue par `docs/domaine.md` §3.3, apparaît
une fois par offre) : photo, discipline + accroche (`titreCourt`), badge « Vérifié » (même
mécanisme que `L2-12`, jamais un badge de certification nommé — voir Règles), format(s), prix.

Feuille de filtres : commune (choix fermé parmi les six villes du référentiel réduit, ou
« Visio » — voir « Référentiel géographique »), format (visio / présentiel — pas « Asynchrone »,
retiré), budget mensuel (borne min/max sur `prixMensuelCentimes`), bouton d'application.

Basculement vers `L3-03` quand la fonction de recherche rend un ensemble vide.

---

## Règles

### Les décisions demandées par P3.1 (`docs/prompts/L3.md`)

- **`security invoker`, pas `security definer`.** Toutes les colonnes rendues (voir plus bas)
  sont déjà accordées à `anon`/`authenticated` par les politiques de 0008
  (`offres_select_publiees`, `profils_coach_select_verifiee`) ou le seraient de la même façon
  pour le référentiel de communes (donnée publique, voir « Référentiel géographique ») : aucun
  privilège supplémentaire n'est nécessaire, donc aucune raison de sortir de RLS. Ces deux
  politiques, appliquées avec les droits réels de l'appelant, ferment la fonction — elle ne les
  recopie pas.
- **Colonnes rendues, table par table** (`docs/backend.md` §8/§10) :

  | Table | Colonnes | Déjà accordées à `anon` par |
  |---|---|---|
  | `profils_coach` | `id`, `prenom`, `nom`, `photo_url`, `discipline`, `titre_court`, `commune_base_insee`, `formats` | `profils_coach_select_verifiee` (0008) |
  | `offres` | `id`, `titre`, `prix_centimes` | `offres_select_publiees` (0008) |
  | `communes_reference` (nouvelle, voir « Référentiel géographique ») | `code_insee`, `nom`, `latitude`, `longitude` | Nouveau `grant select` à `anon`/`authenticated` — donnée publique, aucune sensibilité, même statut qu'un référentiel de disciplines |

  Aucune colonne nouvelle sur les tables existantes. `compte_id`, la bio complète, le parcours,
  les pièces d'identité : jamais rendus ici, comme sur `L2-12`.
- **Pagination : défilement infini, plafond dur de 30 lignes par appel.** `p_limite` est borné à
  `least(p_limite, 30)` dans la fonction elle-même (`docs/backend.md` §10) — 30 correspond à
  plusieurs écrans de résultats avant un nouvel appel, un ordre de grandeur choisi pour limiter
  les allers-retours réseau sans jamais approcher un volume qui vide l'annuaire d'un coup.
- **L'énumération complète par pages successives est assumée, et le total est exposé.** Une
  marketplace publique est faite pour être parcourue (`docs/prompts/L3.md`, tête de fichier) ; le
  nombre total de coachs par discipline n'est pas une donnée personnelle. La fonction rend donc
  un total exact (`count(*) over()` ou équivalent), affiché tel quel (« N coachs · … »), jamais
  reconstruit côté client par comptage de pages.
- **Le bruit de départage, en français avant le SQL de P3.2** : le tri applique dans l'ordre
  discipline demandée (correspondance exacte puis partielle), proximité, complétude — trois clés
  strictement ordonnées. Seulement au sein d'un groupe de lignes strictement à égalité sur les
  trois, un nombre tiré à l'exécution (`random()`, ou équivalent côté serveur) départage. Ce
  nombre n'est calculé qu'au moment de l'appel, jamais mémorisé ni renvoyé à l'appelant, jamais
  reçu en paramètre.
- **Retour depuis un profil coach : la liste déjà reçue est réutilisée, jamais un nouvel appel.**
  Le bruit tiré à chaque requête réordonnerait les ex-æquo à chaque retour arrière si l'écran
  refaisait l'appel — gênant sans aucun bénéfice. L'écran garde donc en mémoire, pour la durée de
  cette navigation (tant que l'écran reste monté dans la pile), la ou les pages déjà obtenues ; il
  ne relance un appel que sur une action explicite de l'utilisateur (nouveau filtre, tirer pour
  rafraîchir, faire défiler plus bas). Aucune graine envoyée au serveur pour stabiliser l'ordre.

### Corrections à la maquette

- **Correction 1/5 — aucune note sur les cartes de résultat.** La maquette affiche une étoile et
  une note (« 4,9 », « 4,7 ») sur chaque carte. Retirée, même raison que `L3-01` : aucun coach
  n'aura d'avis au lancement, `docs/domaine.md` §5.1/§5.6.
- **Correction 2/5 — pas de tri « Note ».** Le sélecteur de tri de la maquette laisse deviner
  d'autres options qu'une flèche non développée ; au jalon 1, une seule option existe
  (« Pertinence », `docs/domaine.md` §5.6). Un tri par note n'aurait aucune donnée à trier tant
  qu'aucun avis n'existe — pas construit, pas même comme option désactivée.
- **Correction 3/5 — pas de badges de certification nommés (« Certifiée OSCP »), pas
  d'interrupteur « Coachs certifiés uniquement ».** Aucun champ de `docs/domaine.md` §3.2 ne
  porte de certification nommée par coach (`ProfilCoach` n'a que `statutVerification`, une seule
  valeur pour tout le dossier). L'interrupteur de la maquette serait de toute façon sans effet :
  chaque résultat de cette fonction est déjà un coach `verifiee` par construction — l'ouvrir ou
  le fermer ne changerait jamais rien à l'ensemble rendu. Seul le badge « Vérifié » déjà construit
  pour `L2-12` reste affiché.
- **Correction 4/5 — pas de tag « 2 places ».** Aucune notion de capacité ou de liste d'attente
  n'existe dans `docs/domaine.md` — invention de la maquette, sans appui, retirée.
- **Correction 5/5 — pas de filtre « Asynchrone ».** Retiré du périmètre
  (`docs/perimetre.md` §3) ; `formats ⊆ {visio, presentiel}` (`docs/domaine.md` §3.2) ne laisse
  de toute façon aucune place à une troisième valeur.

### Lecture inter-comptes

Même famille que `L2-12` (`docs/backend.md` §8) : l'écran doit rester correct pour `anon` **et**
pour un compte authentifié — aucun coach `absente`/`en_examen`/`refusee`/`revoquee`, aucune offre
`brouillon`/`retiree`, jamais un résultat partiel (« le coach existe mais son offre est masquée »)
plutôt qu'une absence totale.

---

## Référentiel géographique — tranché le 13 septembre 2026

**Aucune table de ce dépôt ne portait de coordonnées par commune** (`docs/domaine.md` §5.7 en a
besoin pour la proximité, `profils_coach.commune_base_insee` n'est qu'un `text`, 0001) — décidé :
**sous-ensemble réduit aux six communes du jeu de démonstration**
(`docs/domaine.md` §6), pas le référentiel national complet.

Conséquence directe et volontaire, qui simplifie le reste de la fiche : **le filtre de commune de
cet écran n'est pas un champ texte libre avec recherche d'adresse, c'est un choix fermé parmi ces
six villes plus « Visio »** — comme il n'existe aucune coordonnée en dehors de cet ensemble, il
n'y a littéralement rien d'autre à proposer, et donc aucun cas « commune inconnue » à traiter.

| Commune | Code INSEE (à vérifier à la migration) | Latitude | Longitude |
|---|---|---|---|
| Lyon | 69123 | 45,7640 | 4,8357 |
| Paris | 75056 | 48,8566 | 2,3522 |
| Bordeaux | 33063 | 44,8378 | −0,5792 |
| Nantes | 44109 | 47,2184 | −1,5536 |
| Lille | 59350 | 50,6292 | 3,0573 |
| Toulouse | 31555 | 43,6047 | 1,4442 |

Table `communes_reference` (nom à confirmer à la migration) : `code_insee` (clé), `nom`,
`latitude`, `longitude` — donnée publique, aucune sensibilité, `select` accordé à `anon` et
`authenticated` sans réserve, cohérent avec `security invoker` (aucun besoin de contourner RLS
pour la lire). Seedée par la migration elle-même (six lignes), pas par un script séparé.

**Limite acceptée, à écrire dans `docs/dette.md` à la clôture du lot** : au jour où le produit
ouvre au-delà de ces six villes, cette table doit grandir (import réel ou ajout au coup par coup)
— pas un défaut de conception à corriger, une portée délibérément réduite au jalon 1.

---

## Ce qui a été inventé pour cette fiche

- La valeur du plafond dur (30) : ordre de grandeur choisi, pas mesuré sur un usage réel.
- Le choix du défilement infini plutôt que des pages numérotées : cohérent avec le reste du
  dépôt (aucun autre écran ne pagine par numéro), non explicitement demandé par une maquette.
- L'exposition du total exact plutôt qu'une approximation : la maquette montre un total exact
  (« 7 coachs »), suivi tel quel plutôt que réinterprété.

---

## Critères d'acceptation

1. Aucune note, aucun tri par note, aucun badge de certification nommé, aucun tag de capacité.
2. Pas de filtre « Asynchrone ».
3. Un coach non vérifié ou une offre brouillon/retirée n'apparaît jamais — testé pour `anon` et
   pour un autre compte authentifié.
4. Une requête demandant plus que le plafond ne reçoit jamais plus que le plafond.
5. Deux requêtes identiques peuvent rendre un ordre différent parmi des ex-æquo, jamais un total
   différent.
6. Le retour depuis `L2-12` réaffiche la liste déjà obtenue, sans réordonnancement perceptible.
7. Ensemble vide → bascule vers `L3-03`.
8. Accessible sans session (`anon`).
9. Galerie, deux thèmes.
10. `npm run verif` passe.
