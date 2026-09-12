# L2-02 · Consentement aux communications commerciales (C-04)

**Lot** L2 · **Rôle** client et coach · **Route** `app/(compte)/confidentialite.tsx`
(existant, L1 — **extension**, pas un nouvel écran)
**Référence visuelle** `maquettes/MyFavCoach-L2_dc.html`, bloc « C-04 · Mes consentements ».
Une version antérieure ajoutait un troisième réglage hors périmètre — corrigé dans le fichier
déposé, voir Règles.

---

## Raison d'être

`docs/perimetre.md` (C-04) place « la gestion des consentements (santé, notifications,
communications) » en L2. Le consentement **santé** existe déjà, construit en L1
(`app/(compte)/confidentialite.tsx`, P1.13d). Le consentement **notifications** reste au lot L10
(`docs/ecrans/L1-09-mes-informations.md` : « le consentement aux notifications arrive avec le
lot L10 »). Ce qui reste réellement à ce lot, et qui manquait, est le consentement aux
**communications commerciales** — le seul des trois qui ne dépend d'aucune fonctionnalité pas
encore construite (contrairement aux notifications, qui n'ont rien à activer avant L10).

Ce n'est donc pas un nouvel écran : c'est un second interrupteur sur l'écran existant.

---

## Contenu

L'écran se nomme désormais « Mes autorisations » (repris de la maquette — auparavant sans
titre propre au-delà de « Confidentialité »), avec deux sections :

- **Santé** : le bloc déjà construit en L1 (poids et mesures), inchangé.
- **Communications** : un interrupteur, « Nouveautés et conseils » — « Courriels occasionnels
  de MyFavCoach » (`consentements.type = 'communicationsCommerciales'`, `docs/domaine.md`
  §3.12). Sous le bloc : « Les messages liés à ton abonnement et à tes paiements arrivent quoi
  qu'il arrive : ils ne relèvent pas d'une autorisation. » — distingue explicitement ce
  consentement des communications transactionnelles (confirmation de paiement, etc.), qui ne
  sont jamais soumises à ce réglage.
- Retrait : **sans** modale de conséquences — contrairement au consentement santé, un retrait
  ici n'a qu'une seule conséquence (plus de courriel de ce type), déjà dite par l'intitulé
  lui-même.
- **« Historique de mes décisions »** : un lien, en pied de liste, ouvrant le journal
  `consentements` en lecture pour le compte courant (`docs/domaine.md` §3.12) — le journal
  existe déjà (`0001_creer_identite.sql`), cet écran n'en écrit pas un nouveau, il en expose la
  lecture. Présenté comme une frise (le journal est en ajout seul : un retrait y apparaît comme
  une ligne de plus, jamais une modification d'une ligne existante).

---

## Règles

**Un défaut d'une version antérieure de `maquettes/MyFavCoach-L2_dc.html`, déjà corrigé dans le
fichier déposé :** elle ajoutait un troisième interrupteur, « Rappels de séance » (notification
avant chaque séance). C'était une préférence de notification, et
`docs/ecrans/L1-09-mes-informations.md` fixe déjà que ce consentement arrive avec le lot **L10**,
pas ici. Il n'existe à ce lot que deux réglages : santé (déjà construit en L1) et communications
(celui-ci).

- **Même mécanisme d'écriture que le consentement santé** : le consentement est un journal
  d'ajout (`consentements`, `docs/domaine.md` §3.12) — accorder ou retirer insère une nouvelle
  ligne, jamais une mise à jour. Le texte exact et sa version datée sont un couple unique,
  partagé par tout endroit qui les affiche (même règle que
  `src/fonctionnalites/identite/consentement-sante.ts`).
- Aucun envoi réel de communication commerciale n'existe à ce lot (aucun canal, aucun
  fournisseur d'e-mailing choisi) : cet écran n'écrit que l'intention et la trace, pour être
  prêt le jour où un envoi existera. Ne pas construire l'envoi ici — hors périmètre de cette
  fiche.
- Le texte exact du consentement n'est pas rédigé (aucune valeur de contenu inventée) : la
  fiche fixe le mécanisme, pas la phrase juridique — même situation que les CGU (`docs/dette.md`).
- **Effet immédiat, aucun bouton « Enregistrer ».** Chaque interrupteur écrit dès qu'il est
  actionné — même mécanisme que le bloc santé déjà construit en L1. Un bouton d'enregistrement
  séparé laisserait croire qu'un changement non confirmé pourrait être perdu, alors que le
  journal d'ajout n'a jamais cette notion d'état « non sauvegardé ».

---

## États

Identiques à ceux déjà décrits pour le bloc santé de `docs/ecrans/L1-09-mes-informations.md`,
section « Confidentialité » : pas d'état propre à ajouter.

---

## Ce qui a été inventé pour cette fiche

- La décision de ne pas dupliquer la modale de conséquences pour ce retrait : jugé
  disproportionné vis-à-vis de la donnée de santé, à confirmer.

---

## Critères d'acceptation

1. Le second interrupteur s'affiche sous celui de santé, dans les deux espaces.
2. Accorder ou retirer insère une nouvelle ligne dans `consentements`
   (`type = 'communicationsCommerciales'`), jamais une mise à jour — même test que pour le
   consentement santé, dupliqué pour ce type.
3. Le texte affiché et sa version portent la même valeur partout où ils apparaissent.
4. L'écran (déjà dans la galerie depuis L1) reste exercé en clair et en sombre avec ce second
   bloc visible.
5. « Historique de mes décisions » ouvre le journal `consentements` du compte courant, en
   lecture seule.
6. Aucun bouton « Enregistrer » n'est présent : chaque interrupteur écrit immédiatement — testé.
7. Aucun troisième interrupteur « rappels de séance » ou toute autre préférence de notification
   n'apparaît sur cet écran — testé.
8. `npm run verif` passe.
