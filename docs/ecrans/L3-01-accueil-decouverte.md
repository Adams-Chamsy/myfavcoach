# L3-01 · Accueil / découverte (01)

**Lot** L3 · **Rôle** client, connecté (l'écran vit derrière la coquille `app/(client)/`, dont
l'accès exige déjà un compte avec profil client actif — voir Règles pour le cas `anon`)
**Route** `app/(client)/accueil.tsx` — existe déjà comme `EcranProvisoire` depuis L1 (P1.12), qui
y a posé l'avatar et la bascule d'espace ; cette fiche construit tout le reste.
**Référence visuelle** `maquettes/MyFavCoach-System_dc.html`, bloc « 01 · Accueil »,
`data-screen-label="01 Accueil"`. **Trois corrections, lues en Règles.**

---

## Raison d'être

Le point d'entrée quotidien d'un client : reprendre sa séance en cours, retrouver des coachs
suggérés, ou partir en recherche. C'est le premier écran vu après connexion, et le seul de ce
lot qui n'est pas accessible sans session (contrairement à `L3-02`/`L3-03`, qui doivent
fonctionner pour `anon`, comme `L2-12`).

---

## Contenu

En-tête : date, salutation par prénom (`profils.identiteActive.prenom`, déjà lu par l'écran
actuel), avatar ouvrant la feuille de bascule (déjà construit, L1).

Barre de recherche, en lecture seule sur cet écran : un appui ouvre `L3-02` (elle ne filtre rien
sur place). Rangée de puces de discipline (« Tout » + quelques disciplines) : un appui ouvre
`L3-02` pré-filtrée sur la discipline choisie.

Bloc « Coachs pour toi » : un carrousel horizontal de coachs, issu de la fonction de recherche de
`L3-02`/P3.2 (discipline nulle, pas de commune imposée — ou la commune du profil client si
`communeBase` existe, voir Règles), sans filtre explicite de l'utilisateur. Chaque carte : photo,
discipline, prénom + nom, accroche courte (`titreCourt`), prix.

---

## Règles

- **Correction à la maquette (1/3) — aucune note, aucun avis, nulle part sur cet écran.** La
  maquette affiche une note par étoile sur chaque carte coach (« 4,8 », « 4,9 »). Retirée :
  `docs/domaine.md` §5.1/§5.6 l'interdisent en dessous de 5 avis publiés, et aucun coach n'aura
  d'avis au lancement (table `avis` replanifiée à L4, `docs/perimetre.md` §2/§4). La carte
  n'affiche donc ni note ni compteur, seulement ce que `L3-02`/P3.2 rend réellement : photo,
  discipline, prénom, accroche, prix.
- **Correction à la maquette (2/3) — pas de « Ta séance du jour » ni de « Reprends là où tu t'es
  arrêtée ».** Les deux blocs dépendent de `Programme`/`Seance`/`ExecutionSeance`
  (`docs/domaine.md` §3.6), qui n'existent ni comme entité ni comme table avant L6. Ce n'est pas
  une simplification honnête au sens de L2-14 (un contenu réel montré en moins riche) : c'est une
  donnée qui n'existe nulle part, et qui ne peut donc être ni affichée ni même son absence
  décidée avant que L6 ne construise `Programme`. Ces deux blocs n'apparaissent pas sur cet
  écran à ce lot ; `docs/dette.md` note leur ajout comme dépendant de L6/L7, pas comme un oubli.
- **Correction à la maquette (3/3) — les puces de discipline listent des disciplines réelles.**
  La maquette montre « Musculation », « Nutrition », « Cuisine » : trois valeurs choisies pour la
  maquette, pas une liste figée de disciplines écrite dans `docs/domaine.md`. Aucune énumération
  de disciplines n'existe dans le schéma (`profils_coach.discipline` est `text`, pas un type
  énuméré) — la fiche ne peut donc pas fixer une liste ici. Proposition à valider avant P3.4 :
  soit une poignée de disciplines les plus représentées dans le jeu de démonstration
  (`docs/domaine.md` §6), soit « Tout » seul jusqu'à ce qu'un référentiel de disciplines existe.
- **Lecture publique du carrousel, mais écran non accessible à `anon`.** Le bloc « Coachs pour
  toi » appelle la même fonction publique que `L3-02` (§10, `docs/backend.md`) — un `anon` qui y
  accéderait directement verrait la même chose qu'un client connecté, aucune personnalisation
  n'existe à ce lot. La coquille `app/(client)/` elle-même reste réservée à un compte avec profil
  client actif (garde déjà posée en L1) : ce n'est pas une politique propre à cet écran.
- La bascule d'espace et l'avatar de l'en-tête sont **déjà livrés** (P1.12) : ne pas les
  reconstruire, seulement les laisser en place.

---

## Ce qui a été inventé pour cette fiche

- Le fait que le carrousel « Coachs pour toi » utilise la commune du profil client si elle
  existe : non spécifié ailleurs, choix qui suit la logique déjà posée par `docs/domaine.md`
  §5.7 (proximité), à confirmer avant P3.4.
- La liste des disciplines proposées en puces (voir Règles, correction 3/3) : aucune source ne la
  fixe, proposition à valider avant P3.4, pas une décision prise ici.

---

## Critères d'acceptation

1. Aucune note, aucun avis, aucun badge « Nouveau » nulle part sur l'écran.
2. Aucun bloc « séance du jour » ou « reprendre un programme » (dépendances L6, absentes).
3. Un appui sur la barre de recherche ou une puce de discipline ouvre `L3-02`, filtrée le cas
   échéant.
4. Le carrousel « Coachs pour toi » vient de la fonction de recherche réelle (P3.2), jamais d'une
   fixture codée en dur dans l'écran.
5. La bascule d'espace (déjà livrée) continue de fonctionner sans régression.
6. Galerie, deux thèmes.
7. `npm run verif` passe.
