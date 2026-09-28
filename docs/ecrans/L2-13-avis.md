# L2-13 · Profil coach — onglet Avis (27)

**Lot** L4 (**replanifié depuis L2 le 12 septembre 2026**, `docs/perimetre.md` §2/§4 — voir
Règles) · **Rôle** client, et visiteur non connecté (`anon`) · **Route**
`app/(client)/coach/[id]/avis.tsx` (ou onglet de `L2-12`, voir Règles)
**Référence visuelle** `maquettes/MyFavCoach-Parcours_dc.html`, bloc « 27 · Profil coach —
onglet Avis », `data-screen-label="27 Avis"`.

**Ce qui est déjà livré, à L2, et le reste au jalon 1** : l'onglet existe
(`app/(client)/coach/[id].tsx`, `OngletAvis`) et affiche un état vide honnête — **pas un
placeholder en attente de L4, l'état normal de tous les profils au lancement**, tant qu'aucun
abonnement ne rend un dépôt possible (voir Règles). Le reste de cette fiche (moyenne, filtre par
étiquette, liste d'avis) décrit ce que `L4` construit par-dessus cet état vide, pas ce qui
manque à L2.

---

## Contenu

En-tête : retour, avatar + nom du coach, onglets Offres/Avis/Parcours (Avis actif).

Bloc note : moyenne (`docs/domaine.md` §5.1, arrondie au dixième, affichée à partir de 5 avis
publiés seulement), étoiles, nombre d'avis, distribution par étoile (comptage simple par
valeur). En dessous de 5 avis, jamais de moyenne ni de badge « Nouveau » — à 1-4 avis, la liste
d'avis en dessous s'affiche telle quelle sans bloc note ; à 0 avis, l'onglet entier devient un
état vide honnête (révisé le 12 septembre 2026).

Filtres par étiquette : « Tous » + les étiquettes réellement portées par au moins un avis publié
de ce coach (0 à 3 par avis, liste figée de 8, `docs/domaine.md` §3.11, arbitrage #16).

Liste d'avis publiés : auteur (prénom + initiale du nom), **durée de suivi** (« 7 mois de
suivi », jamais une date — `docs/domaine.md` §3.11), étoiles, étiquettes, texte s'il existe.
Révisé le 28 septembre 2026 : « réponse du coach » hors L4 (`docs/jalon-2.md`, n° 25) ;
« offre souscrite » retirée (validé le 28 septembre 2026) — afficher ce qu'une personne
identifiable paie n'apporte rien au lecteur et l'expose ; la maquette 27b ne la montre plus (la
maquette 27 d'origine l'affichait : « abonnée depuis 3 mois · Suivi complet »).

---

## Règles

- **Replanifiée depuis L2, pas un écran non livré** : la condition de dépôt d'un avis
  (`docs/domaine.md` §3.11 — abonnement actif ≥ 30 jours ou résilié ≤ 60 jours) ne peut être
  vérifiée avant que `Abonnement` existe (L4) — aucune insertion légitime n'est possible plus
  tôt. La distinction avec « pas encore construit » compte : ce n'est plus une dette de L2
  (`docs/dette.md` ne la liste plus), c'est une dépendance réelle, écrite ici et dans
  `docs/perimetre.md`.
- **Lecture inter-comptes** (`docs/backend.md` §8), même famille que `L2-12` : seuls les avis
  `statut = publie` sont lisibles ici — jamais un avis `signale` ou `masque`, pour aucun
  lecteur, propriétaire de l'avis excepté.
- Sous 5 avis publiés : jamais de badge « Nouveau », aucune moyenne ni tri par note
  (`docs/domaine.md` §5.1, révisé le 12 septembre 2026) — l'onglet reste accessible, il affiche
  simplement moins : les avis un par un entre 1 et 4, un état vide honnête à 0.
- Aucune extraction automatique de thème : les étiquettes sont celles que l'auteur a lui-même
  cochées au dépôt, jamais recalculées ou devinées côté serveur (arbitrage #16).

---

## Ce qui a été inventé pour cette fiche

- Le découpage en route séparée vs. onglet d'un même écran que `L2-12` : les deux fiches
  partagent une seule en-tête et les mêmes onglets dans la maquette ; cette fiche les traite
  comme des routes distinctes par cohérence avec le reste du dépôt (une route par écran
  numéroté), à réconcilier si l'implémentation choisit un seul écran à onglets internes.

---

## Critères d'acceptation

**Déjà vrai à L2, jalon 1** :

1. À 0 avis (tous les profils, au lancement) : état vide honnête, jamais de badge « Nouveau »,
   ni note ni compteur.
2. Accessible sans session (`anon`).
3. Galerie, deux thèmes.
4. `npm run verif` passe.

**Reste à construire à L4**, une fois `avis` réelle et un dépôt possible :

5. Un avis `signale` ou `masque` n'apparaît jamais, quel que soit le compte qui consulte —
   testé pour `anon` et pour un autre client.
6. Entre 1 et 4 avis : les avis un par un, sans moyenne calculée. À 5 avis ou plus : moyenne,
   étoiles, distribution.
7. Le filtre par étiquette ne montre que les étiquettes réellement portées par un avis publié.

---

## Relue à P4.1 (28 septembre 2026), côte à côte avec `docs/domaine.md` §3.11 et §4.9

La fiche couvre bien la **lecture** (critères 5 à 7). Ce qu'elle ne couvre pas, et que P4.9 doit
construire ou faire trancher — rien n'est décidé ici, chaque point est à valider :

1. **Tranché le 28 septembre 2026** — liste fermée des huit écrite dans `docs/domaine.md` §3.11,
   en table de référence (`etiquettes_avis`). Constat d'origine : **la liste figée des 8
   étiquettes n'était écrite nulle part.** L'arbitrage #16
   (`docs/domaine.md` §0) fixe leur nombre et le principe ; la maquette n'en montre que deux
   (« Pédagogie », « Réactivité »). Sans la liste, ni la contrainte en base ni le formulaire de
   dépôt ne peuvent s'écrire. **À fixer dans `docs/domaine.md` §3.11 avant P4.9**, pas inventée
   au code.
2. **Tranché le 28 septembre 2026** — écrans 27a et 27b ajoutés au périmètre, fiche
   `docs/ecrans/L4-27a-depot-avis.md`, maquette `maquettes/MyFavCoach-Avis_dc.html`. Constat d'origine : **le dépôt n'avait
   ni maquette, ni fiche, ni ligne dans `docs/perimetre.md` §2.** Cette fiche dit
   « ce que L4 construit » (le dépôt), mais aucun écran ne le porte : note, texte (30 à 1 200
   caractères), 0 à 3 étiquettes, puis modification pendant 14 jours. Même famille que les
   écrans « à concevoir, absents du dossier » (`docs/perimetre.md` §2). **À ajouter au
   périmètre et à ficher avant P4.9** — ou à déclarer hors L4 explicitement.
3. **Tranché le 28 septembre 2026** — hors L4 : `reponseCoach` reste vide, aucun écran ; reporté
   au pilotage coach ou au jalon 2 (`docs/jalon-2.md`, n° 25, avec ses quatre règles à écrire).
   Constat d'origine : **la réponse du coach** (`reponseCoach?`, §3.11, visible dans la maquette) n'a ni écran côté
   coach, ni règle (longueur, modifiable ?, une seule ?), ni transition dans §4.9. Même
   traitement que le point 2.
4. **Tranché le 28 septembre 2026** — écrit dans `docs/domaine.md` §3.11 : jours calendaires
   depuis `actifDepuisLe` (pauses comprises), statut `actif` ou `resiliation_programmee` au
   dépôt ; 60 jours comptés depuis `finAccesLe`. Constat d'origine : **conditions de dépôt, deux
   ambiguïtés de §3.11** : « actif depuis ≥ 30 jours » — les jours en
   `en_pause` ou `impaye` comptent-ils ? « résilié depuis ≤ 60 jours » — à compter de la demande
   de résiliation (`resilieLe`) ou de la fin d'accès (`finAccesLe`) ? À écrire dans §3.11, pas à
   choisir dans la fonction SQL.
5. **Tranché le 28 septembre 2026 par la maquette 27b** (`maquettes/MyFavCoach-Avis_dc.html`) :
   sous chaque avis, une **durée de suivi** (« 7 mois de suivi »), jamais une date — écrit dans
   `docs/domaine.md` §3.11. La lecture étroite ci-dessous reste la forme à construire ; la
   question RGPD reste à faire relire. Constat d'origine : **« Ancienneté d'abonnement » et
   « offre souscrite » affichées sous chaque avis, lisibles par `anon`.** C'est une lecture inter-comptes d'une donnée d'`Abonnement` (table de contenu, lecture
   stricte, `docs/domaine.md` §2) : elle ne peut sortir que calculée et réduite (« suivi depuis 3 mois »,
   jamais `debuteLe` ; la maquette accorde « abonnée »/« abonné » au genre supposé de l'auteur,
   à neutraliser comme en `L4-04c`), par une fonction étroite — même mécanisme que
   `mes_invitations()` (`docs/backend.md` §11), avec prénom + initiale pour l'auteur. Dire
   publiquement qu'une personne nommée suit un coach en nutrition peut, selon la discipline,
   toucher à la santé : **à faire relire** avec les autres questions RGPD (`docs/perimetre.md`
   §6).
6. **Tranché le 28 septembre 2026** — pas d'extension de `Signalement` à L4. Les états
   `signale`/`masque` existent en base sans transition d'entrée jusqu'à L8 ; le critère 5
   ci-dessus se prouve au banc par des lignes posées directement par le rôle serveur du banc (`docs/backend.md` §6). `docs/domaine.md` §3.13
   prévoit déjà `avis` parmi les cibles de `Signalement` (vérifié) ; `docs/perimetre.md` (C-01,
   L8) inscrit qu'il devra la couvrir. Constat d'origine : **`publie --(signalement)--> signale`
   n'a aucun chemin à L4.** `Signalement` (§3.13, C-01) est
   L8 et aucune table ne l'implémente (vérifié : aucune migration ne crée `signalements`).
   `docs/prompts/L4.md` P4.9 point 2 demande d'« étendre » une table qui n'existe pas. Deux
   options, à trancher : construire à L4 la seule part de C-01 qui vise un avis, ou laisser les
   états `signale`/`masque` sans transition d'entrée jusqu'à L8 — et dire alors que le
   critère 5 ci-dessus reste prouvé au banc par des lignes posées directement par le rôle serveur du banc (`docs/backend.md` §6), pas par un
   parcours réel.
