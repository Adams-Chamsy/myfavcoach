# L2-11 · Premier lancement coach (19)

**Lot** L2 · **Rôle** coach · **Route** `app/(coach)/pilotage.tsx` (remplace l'écran provisoire
du lot L0 pour un coach sans aucun client)
**Référence visuelle** `maquettes/MyFavCoach-Etats_dc.html`, bloc « 19 · Pilotage coach —
premier lancement », `data-screen-label="19 Coach vide"`.

---

## Raison d'être

L1-08 le disait déjà en le mettant hors périmètre : « L'écran 19 — premier lancement coach, la
mise en route 1/3, les revenus à 0 € — appartient au lot L2. » C'est cet écran. Il remplace,
pour un coach qui vient d'ouvrir son espace, l'écran provisoire du lot L0.

---

## Contenu

En-tête sombre (île, comme la barre coach du lot L0) : « Bienvenue {prénom} », avatar. Bloc
revenus : « Revenus du mois », « 0 € », « Ton premier abonné apparaîtra ici. »

Corps :

- Icône + « Encore aucun client » + « Trois étapes et ton profil devient visible dans la
  marketplace. Compte 15 minutes. »
- Carte « Mise en route », **N sur 3** (compteur dynamique, pas figé à « 1 sur 3 » comme la
  maquette le montre pour son cas de démonstration) :
  1. Photo et bio renseignées (`L2-05`)
  2. Créer ta première offre (`L2-15`, côté coach)
  3. Vérifier ton identité (`L2-06`, obligatoire pour être payé)
- Bandeau : « Tes 3 premiers mois sont sans commission. Tu restes cliente de tes propres coachs
  en basculant d'espace à tout moment. »

**Tant que le dossier de vérification n'est pas `verifiee`** (`en_examen`, `complement_demande`,
`refusee`, `revoquee`) : cette route (`app/(coach)/pilotage.tsx`) rend `L2-09` **en entier** à
la place de cet écran — pas une carte ajoutée à celui-ci. Corrigé après lecture de
`maquettes/MyFavCoach-L2_dc.html` (bloc 23c), qui montre une composition entièrement distincte
(en-tête propre, sa propre checklist), pas un bandeau greffé sur « Bienvenue {prénom} ».

Barre d'onglets bas : Pilotage, Clients, **Créer** (action centrale), Agenda, Revenus — déjà
posée en L0 (`app/(coach)/_layout.tsx`).

---

## Règles

- Les trois items de la checklist se cochent indépendamment de leur ordre : rien n'empêche un
  coach de créer une offre avant de renseigner sa bio. La checklist informe, elle ne bloque
  rien — à la différence du fil d'étapes 1-4 de « Devenir coach », qui lui est strictement
  linéaire.
- « Photo et bio renseignées » se coche dès que `titre_court` **et** `bio` sont non nuls
  (`profils_coach`) — la photo elle-même reste hors périmètre (`docs/dette.md`, aucun stockage).
  Le libellé de la maquette (« Photo et bio ») garde son nom bien que la photo n'y participe
  pas encore : renommer le libellé casserait une correspondance texte-pour-texte avec la
  maquette sans rien changer au fond ; à trancher si ça gêne.
- Une fois les trois items cochés (ou dès qu'au moins une offre est publiée et l'identité
  vérifiée), cet écran cesse de se comporter comme « premier lancement » : l'écran normal de
  pilotage (hors périmètre de cette fiche, lot L7) prend le relais.

---

## Ce qui a été inventé pour cette fiche

- Le compteur dynamique « N sur 3 » (la maquette fige « 1 sur 3 » pour son cas de
  démonstration) : logique évidente mais non écrite ailleurs.
- L'item 2 de la checklist (« Créer ta première offre ») menait à un écran non nommé par
  `docs/perimetre.md` — comblé le 12 septembre par l'ajout de l'écran 03a
  (`docs/ecrans/L2-15-creation-offre-coach.md`).

---

## Critères d'acceptation

1. Affiché uniquement pour un coach sans aucun abonné actif — au premier client, l'écran normal
   de pilotage prend le relais (hors périmètre ici).
2. Le compteur de la carte « Mise en route » reflète l'état réel des trois items, pas une
   valeur figée.
3. `L2-09` remplace cet écran en entier tant que le dossier n'est pas `verifiee`.
4. Galerie, deux thèmes.
5. `npm run verif` passe.
