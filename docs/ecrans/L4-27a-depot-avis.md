# L4-27a · Déposer ou modifier un avis (27a) — et 27b, avis pas encore possible

**Lot** L4 · **Rôle** client · **Route** `app/(client)/avis/[coachId].tsx` pour 27a (nom
inventé) ; 27b n'est pas une route, c'est un état de l'onglet Avis du profil coach
(`docs/ecrans/L2-13-avis.md`).
**Référence visuelle** `maquettes/MyFavCoach-Avis_dc.html` : bloc « 27a · Déposer un avis »
(`data-screen-label="27a Deposer un avis"`) et bloc « 27b · Pas encore d'avis possible »
(`data-screen-label="27b Avis pas encore possible"`). **Quatre corrections, lues en Règles.**

---

## Raison d'être

Sans 27a, aucun avis ne peut exister et l'onglet Avis reste vide pour toujours. 27b explique à
un client déjà abonné pourquoi il ne peut pas encore en déposer un — un bouton absent laisserait
croire que la fonction n'existe pas, un bouton actif qui échoue serait pire (maquette). Les
règles d'éligibilité sont celles du serveur : les deux écrans ne font que les expliquer.

---

## Contenu — 27a, dépôt

En-tête : retour, titre « Ton avis ». Carte du coach : avatar, nom, et **« Suivi depuis
{durée} »** (correction 1).

| Bloc | Contenu (`docs/domaine.md` §3.11) |
|---|---|
| « Comment ça se passe ? » | Note de 1 à 5, **seul champ obligatoire**. Cinq étoiles, chacune cible ≥ 44 pt et libellée « {n} sur 5, {mot} » ; sous les étoiles, le mot de la note choisie : **1 Décevant · 2 Mitigé · 3 Correct · 4 Très bien · 5 Excellent** (tranché le 28 septembre 2026 ; la maquette montrait « Très bien » sur 5, corrigé en 4) |
| « Ce qui caractérise {prénom} » | Les huit étiquettes de `etiquettes_avis`, dans leur ordre d'affichage, en jetons ; compteur « {n} sur 3 » ; la quatrième sélection est refusée avec un message, pas ignorée en silence |
| « Raconte, si tu veux » | Texte **facultatif** (mention « Facultatif »), **600 caractères au plus, aucun minimum** (`docs/domaine.md` §3.11), compteur « {n} / 600 » |
| Encart de publication | « Ton avis sera public sur le profil de {prénom du coach}, signé de ton prénom, de l'initiale de ton nom et de la durée de ton suivi. Tu peux le modifier pendant 14 jours, puis il se fige. » (correction 2) |

Pied : « Publier mon avis » (dépôt) ou « Enregistrer les modifications » (modification), actif
dès qu'une note est choisie.

## Contenu — 27b, pas encore possible (état de l'onglet Avis)

Dans l'onglet Avis du profil coach (`L2-13`), pour un client **abonné à ce coach mais pas encore
éligible** :

- Un encart en tête : **« Encore {n} jours »**, puis « Tu pourras donner ton avis après 30 jours
  de suivi. Le temps de savoir ce que tu en penses vraiment. » (correction 3). `{n}` vient du
  serveur, jamais calculé par l'écran (`docs/api.md` §15).
- En dessous, « Ce que disent les autres » : la liste d'avis de `L2-13`, inchangée (auteur
  prénom + initiale, **« {durée} de suivi »**, étiquettes, texte).
- Le bouton **« Donner mon avis »** reste visible mais **inactif**, avec l'état d'accessibilité
  `disabled` et un libellé qui dit pourquoi (« Donner mon avis, possible dans {n} jours »).

Pour un client éligible, le même bouton est actif et ouvre 27a. Pour tout autre lecteur
(`anon`, client sans abonnement chez ce coach, suivi terminé depuis plus de 60 jours) : ni
encart ni bouton, **seulement la liste**. Pour un client en `en_pause`, `impaye`, `suspendu` ou
`en_attente_confirmation` qui a déjà 30 jours de suivi : même encart que 27b, sans compte à
rebours — « Tu pourras donner ton avis quand ton suivi aura repris. »

---

## Règles

**Corrections de la maquette :**

1. **« Tu le suis depuis 4 mois » → « Suivi depuis 4 mois »**, et **« Ce qui le caractérise » →
   « Ce qui caractérise {prénom} »** : pas de pronom genré pour le coach, même règle que
   `L4-04c`.
2. **L'encart annonce l'initiale du nom**, que la maquette omet (« signé de ton prénom et de la
   durée de ton suivi ») alors que la liste d'avis de la même maquette l'affiche (« Marc T. »).
   L'encart doit annoncer **tout** ce qui sera public, sans exception — c'est sa seule raison
   d'être.
3. **« après un mois de suivi » → « après 30 jours de suivi »** : la règle est en jours
   (`docs/domaine.md` §3.11), et un mois de février en compte 28.
4. **« Très bien » sous 5 étoiles → « Excellent »** : l'échelle tranchée le 28 septembre 2026
   place « Très bien » sur 4. (Le compteur « / 600 » de la maquette, lui, est confirmé :
   `docs/domaine.md` §3.11.)

**Le reste :**

- **Éligibilité tranchée par le serveur** (`docs/domaine.md` §3.11, précisée le 28 septembre
  2026) : en cours (`actif` ou `resiliation_programmee`, 30 jours calendaires au moins depuis
  `actifDepuisLe`, pauses comprises), ou terminé (`resilie`, `finAccesLe` il y a 60 jours au plus,
  30 jours de suivi au moins). Même ouvert par un lien construit, un dépôt non éligible est
  refusé par le serveur et le refus s'affiche tel quel.
- **Durée de suivi** : toujours une durée (« 4 mois », « 7 mois de suivi »), jamais une date,
  calculée par le serveur sur `actifDepuisLe`, arrondie au mois le plus proche sur une base de
  30 jours, figée à `finAccesLe` pour un suivi terminé (`docs/domaine.md` §3.11). Jamais moins
  de « 1 mois ».
- **Un seul avis par couple client/coach**, contrainte en base. Un client qui a déjà déposé arrive
  en modification (≤ 14 jours) ou ne voit plus le bouton (au-delà).
- **Modifiable 14 jours**, puis figé (`publie --(modification ≤ 14 j)--> publie`, §4.9). Un avis
  `signale` ou `masque` n'est pas modifiable — et aucun ne peut l'être avant L8
  (`docs/perimetre.md`, C-01).
- **Pas de modération automatique, pas d'extraction de thème** (arbitrage #16). Le texte est
  publié tel qu'écrit.
- **Magasins d'applications** : aucun terme de la liste interdite (`docs/domaine.md` §2).

---

## États

| État | Comportement |
|---|---|
| 27a, dépôt | « Publier » inactif tant qu'aucune note n'est choisie ; texte et étiquettes facultatifs |
| 27a, modification (≤ 14 j) | Champs pré-remplis depuis l'avis existant, relu du serveur |
| 27a, envoi en cours | Bouton en chargement, non pressable deux fois |
| 27a, refus serveur (non éligible, délai dépassé, déjà déposé) | Message rendu tel quel, aucun champ perdu |
| 27a, succès | Retour à l'onglet Avis, avis visible |
| 27b, abonné pas encore éligible | Encart « Encore {n} jours », bouton inactif |
| Onglet Avis, abonné éligible | Bouton « Donner mon avis » actif, sans encart |

---

## Ce qui a été inventé pour cette fiche

- ~~Mots sous les étoiles~~ — **fournis le 28 septembre 2026** : Décevant, Mitigé, Correct, Très
  bien, Excellent.
- ~~Lecteurs non abonnés~~ — **validé le 28 septembre 2026** : pour `anon`, un client sans
  abonnement chez ce coach, ou un client dont le suivi est terminé depuis plus de 60 jours, ni
  encart ni bouton — seulement la liste d'avis.
- Le refus explicite d'une quatrième étiquette.
- Nom de route de 27a.

---

## Critères d'acceptation

1. Un dépôt avec une note seule, sans texte ni étiquette, est accepté.
2. Un client non éligible (actif depuis 29 jours ; `finAccesLe` il y a 61 jours ; résilié après
   moins de 30 jours de suivi ; en pause) ne peut pas déposer :
   refus serveur, prouvé au banc avec des dates posées directement par le rôle serveur du banc
   (`docs/backend.md` §6), jamais attendues (`docs/prompts/L4.md` point 9).
3. Un second dépôt pour le même couple client/coach est refusé en base ; une modification au
   quinzième jour est refusée.
4. Note hors de 1–5, plus de 3 étiquettes, étiquette hors de `etiquettes_avis`, texte de plus de
   600 caractères : refusés par le serveur, pas seulement par l'écran. Une note seule avec un
   texte d'un caractère est acceptée (aucun minimum).
5. L'encart de 27a annonce prénom, initiale du nom et durée du suivi ; aucun autre champ du profil
   client n'est publié.
6. Sous chaque avis, une durée de suivi, jamais une date, jamais moins de « 1 mois » ; elle ne
   bouge plus une fois le suivi terminé.
7. 27b : « Encore {n} jours » vient du serveur ; le bouton est `disabled` avec un libellé qui dit
   pourquoi ; aucun pronom genré sur 27a ni 27b.
8. **Libellés interdits** : aucun terme de la liste partagée.
9. Zones tactiles ≥ 44 pt ; à 200 %, rien n'est tronqué.
10. Galerie, deux thèmes (27a dépôt, 27a modification, 27b).
11. `npm run verif` passe.
