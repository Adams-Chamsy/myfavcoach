# L2-09 · En attente de vérification (23c)

**Lot** L2 · **Rôle** coach avec dossier `en_examen`, `complement_demande`, `refusee` ou
`revoquee` · **Route** `app/(coach)/pilotage.tsx` — **même route que l'écran 19** (`L2-11`) :
tant que le dossier n'est pas `verifiee`, cette route rend cet écran-ci en entier, pas une carte
ajoutée à celui de `L2-11`.
**Référence visuelle** `maquettes/MyFavCoach-L2_dc.html`, bloc « 23c · Attente de
vérification » — **maquette un seul état : `complement_demande`** (dossier avec un document
rejeté et son motif). Les trois autres lignes du tableau ci-dessous (`en_examen`, `refusee`,
`revoquee`) n'ont pas de maquette propre : `en_examen` réutilise la même mise en page **sans le
bloc de motif** (aucune pièce à corriger, donc rien à afficher à cet endroit), l'échéance restant
calculée sur 48 h ouvrées comme pour les autres états. `refusee`/`revoquee` sont déduits par
analogie avec le bloc de motif de `complement_demande`, jamais montrés. **Deux défauts trouvés
dans une version antérieure du fichier, déjà corrigés dans celui déposé — voir Règles pour ce
qu'ils étaient et pourquoi le compromis retenu tient.**

---

## Raison d'être

Combler le trou que `docs/perimetre.md` nomme : entre le dépôt (`L2-06`) et la décision du
back-office (`L2-10`), un coach ne doit pas atterrir sur un écran vide.

**Écran indépendant, pas un bandeau** — corrigé après lecture de `maquettes/MyFavCoach-L2_dc.html` :
la première fiche de ce dossier traitait 23c comme une carte ajoutée à l'écran 19. La maquette
tranche dans l'autre sens : sa propre composition (en-tête sombre distinct, pas la « Bienvenue
{prénom} » de `L2-11`), sa propre checklist. Cette fiche remplace l'ancienne approche.

---

## Contenu

En-tête sombre : « Espace coach », icône réglages.

Badge, titre et sous-titre varient selon le statut (voir tableau ci-dessous) — l'exemple
maquetté est `complement_demande` : badge « COMPLÉMENT DEMANDÉ », titre « On a besoin d'une
chose », sous-titre « Ton dossier est en pause le temps que tu renvoies ce document. L'examen
reprend ensuite sous 48 h ouvrées. » Pour `en_examen` (non maquetté) : badge « DOSSIER EN
EXAMEN », titre « On regarde ton dossier », sous-titre « Déposé le {date}. Réponse sous 48 h
ouvrées, soit d'ici le {date + 48 h ouvrées}. » — l'échéance est **calculée**, pas un texte
fixe : elle ajoute 48 h ouvrées (pas des heures calendaires) à la date de dépôt du dossier.

**Si `complement_demande`** : un encart rouge en tête du corps — « Il manque quelque chose »,
le motif de l'examinateur (« La photo de ton diplôme est trop floue [...] »), « Message de
l'examinateur · {date} », bouton « Renvoyer {nom du document concerné} » → `L2-06`.

**« Ton dossier »** : les trois documents (`L2-06`) affichés en **étiquettes neutres**, sans
aucun état individuel — « Pièce d'identité », « Diplôme », « Assurance RC pro » — suivies de
« Trois documents déposés le {date}. Ils sont examinés ensemble. » **Aucun indicateur de
présence par ligne** (pas de coche, pas d'horloge) : c'est le dossier qui a un statut, pas
chaque document (voir Règles).

**En attendant**, deux lignes :
- « Rédige ton profil » — « Bio, parcours, photo. Ton profil est déjà consultable par lien
  direct, sans badge. » Ouvre `L2-05`/informations coach. Disponible tout de suite.
- « Publier une offre » — grisée, opacité réduite : « Seule la publication attend la
  vérification. » Ouvre `L2-15` en lecture (brouillon), jamais la publication.

**Pied fixe : « Rédiger mon profil », constant quel que soit le statut.** L'action spécifique au
statut (renvoyer un document, redéposer un dossier) reste **dans l'encart de motif lui-même**
(« Renvoyer {nom du document} », voir ci-dessus) — le bouton de pied encourage toujours la même
chose : avancer sur ce qui reste disponible pendant l'attente. `refusee`/`revoquee` suivent le
même principe : un encart nommant la raison du refus, avec « Déposer un nouveau dossier »
dans l'encart, pas dans le pied.

---

## Tableau des statuts

| Statut (`docs/domaine.md` §4.2) | Badge | Encart de motif | Action dans l'encart |
|---|---|---|---|
| `en_examen` | « DOSSIER EN EXAMEN » | absent | — |
| `complement_demande` | « COMPLÉMENT DEMANDÉ » | présent, **nommant la pièce concernée** (`GET /coach/verification`, `docs/api.md` §4) | « Renvoyer {document} » → `L2-06` |
| `refusee` | « DEMANDE REFUSÉE » | présent | « Déposer un nouveau dossier » → `L2-06` |
| `revoquee` | même traitement que `refusee` | présent | « Déposer un nouveau dossier » → `L2-06` |

Le pied fixe (« Rédiger mon profil ») ne change pas selon le statut — voir Contenu.

Une fois `verifiee` : cette route rend `L2-11` normalement, plus jamais cet écran.

---

## Règles

**Deux défauts d'une version antérieure de `maquettes/MyFavCoach-L2_dc.html`, déjà corrigés dans
le fichier déposé — documentés ici parce qu'ils expliquent le compromis retenu, pas parce qu'il
reste quelque chose à corriger :**

1. **Un seul statut par dossier, jamais un statut par pièce.** Une version antérieure affichait
   trois états indépendants par document (accepté / en attente / illisible), ce qui donnait à
   penser que chaque pièce portait son propre statut stocké. `docs/domaine.md` §4.2 n'a qu'**une**
   valeur de statut pour le dossier entier. Le compromis retenu, désormais reflété par le fichier
   déposé : le statut du dossier est `complement_demande`, et **le motif rédigé par
   l'examinateur nomme la pièce** (« Diplôme illisible : la photo est trop floue pour lire
   l'organisme et la date. »). Les documents s'affichent en étiquettes neutres, sans état
   individuel — seul le motif, texte libre, distingue ce qui pose problème.
2. **« Rien n'est visible tant que le dossier n'est pas validé » était faux**, corrigé dans le
   fichier déposé (« Ton profil est déjà consultable par lien direct, sans badge »).
   `docs/domaine.md` §4.2 : un coach non `verifiee` « peut préparer son profil [...] et son
   profil est consultable par lien direct dès qu'il existe, sans le badge ». **Préparer et être
   consultable, oui ; publier une offre ou encaisser, non**, avant `verifiee`.

**Autres règles :**

- **Pas de sondage réseau en boucle** — même règle que `docs/ecrans/L1-03-verification-email.md` :
  l'état se lit à l'ouverture et à un retour au premier plan, jamais par un minuteur.
- Le motif affiché est **celui renvoyé par le serveur**, jamais un texte générique inventé à
  l'écran.
- Aucune notification push de changement de statut à ce lot (L10) : le coach découvre le
  changement en rouvrant l'application.

---

## Ce qui a été inventé pour cette fiche

- **Trois des quatre lignes du tableau des statuts ne sont pas maquettées.** Seul
  `complement_demande` a un rendu de référence. `en_examen` (même mise en page, bloc de motif
  simplement absent) est une extrapolation directe et à faible risque ; `refusee`/`revoquee`
  (badge et bouton différents, même absence de bloc « où en est chaque pièce » puisque le
  dossier est clos) sont moins certains — aucun rendu à comparer avant de les construire pour de
  vrai.
- Le calcul exact de « 48 h ouvrées » (jours fériés compris ou non, fuseau) : non précisé
  ailleurs dans le dépôt — `docs/domaine.md` §4.2 fixe la durée, pas le calendrier de calcul.
- Le lien entre un motif et la ligne de document qu'il nomme (repérage textuel simple, pas un
  champ structuré) : mécanisme de présentation, pas de modèle de données.

---

## Critères d'acceptation

1. Écran affiché en entier à la place de `L2-11` tant que le dossier n'est pas `verifiee`.
2. Aucun statut individuel stocké par document — un seul `statut_verification` pour le dossier.
3. L'échéance affichée est calculée depuis la date de dépôt réelle + 48 h ouvrées.
4. Le profil est présenté comme consultable (sans badge), jamais comme invisible.
5. « Publier une offre » reste grisée jusqu'à `verifiee`.
6. Aucun appel réseau répété hors ouverture et retour au premier plan.
7. Galerie : les quatre variantes de statut, deux thèmes.
8. `npm run verif` passe.
