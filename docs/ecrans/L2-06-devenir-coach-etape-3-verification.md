# L2-06 · Devenir coach — étape 3/4 : vérification (23)

**Lot** L2 · **Rôle** coach en cours d'activation, ou déjà actif · **Route**
`app/(onboarding)/devenir-coach-verification.tsx`
**Référence visuelle** `maquettes/MyFavCoach-Parcours_dc.html` (bloc « 23 · Devenir coach —
vérification ») **et** `maquettes/MyFavCoach-L2_dc.html` (bloc « 23b · Dépôt des pièces ») —
**fusionnées en une seule fiche** : la seconde maquette montre que le dépôt et la vérification
ne sont pas deux écrans mais un seul, ce que cette fiche remplace `L2-08` pour refléter.
**Plusieurs corrections aux deux maquettes, lues en Règles ci-dessous.**

---

## Raison d'être

Ouvrir le dépôt des pièces qui débloquent la vérification humaine (`docs/domaine.md` §4.2) et
l'encaissement. Fait suite à l'étape 2 (`L2-05`) ; mène à l'étape 4 (`L2-07`).

**Fusion, pas deux écrans.** La première maquette lue (`Parcours_dc.html`, écran 23) montrait un
écran de récapitulatif avec des entrées « Ajouter » ; la seconde (`MyFavCoach-L2_dc.html`,
23b) montre un unique écran listant les trois documents avec une action inline par ligne — pas
un écran de récapitulatif renvoyant vers un écran de dépôt séparé. C'est la seconde qui
l'emporte : `L2-08` (dépôt d'une pièce, écran séparé) est retirée, son contenu absorbé ici.

---

## Contenu

En-tête : chevron retour, fil d'étapes **3/4**, sous-titre « Tes justificatifs ».

Titre serif : « Trois documents. »
Sous-titre : « Une personne les examine sous 48 h ouvrées. Ils servent à ça et à rien d'autre. »

**Trois lignes, toutes obligatoires** (`docs/domaine.md` §4.2) :

| Document | Obligatoire | Interaction |
|---|---|---|
| Pièce d'identité | oui | tap → sélecteur natif (photo/fichier) → envoi direct vers une URL signée (`docs/api.md` §4) |
| Diplôme ou certification | oui | même mécanisme |
| Attestation d'assurance responsabilité civile professionnelle | oui | même mécanisme |

Chaque ligne affiche son propre état, **inline**, pas un écran séparé :

| État de la ligne | Rendu |
|---|---|
| Non déposée | Bordure en tirets, bouton « Choisir un fichier » |
| Envoi en cours | Barre/pourcentage de progression |
| Déposée | Coche, nom du fichier, date de dépôt, poids ; action « Remplacer » (voir Règles) |

Bandeau verrouillé : « Une fois envoyé, un document n'est plus consultable ici — ni par toi, ni
par personne d'autre que l'examinateur. Tu peux le remplacer, pas le rouvrir. »

Pied fixe : « Continuer » (mène à l'étape 4, `L2-07`) — actif seulement quand **les trois**
documents sont déposés ; sinon, texte sous le bouton nommant précisément ce qui manque
(« Il manque l'attestation d'assurance. »).

---

## Règles

**Corrections aux deux maquettes de référence, assumées, pas oubliées :**

1. **Trois documents obligatoires, aucun facultatif.** La première maquette (`Parcours_dc.html`)
   montrait le diplôme comme « facultatif mais recommandé » et n'incluait pas d'assurance ; la
   seconde (`MyFavCoach-L2_dc.html`) montre bien trois documents mais annonce un délai
   différent (voir point 2). `docs/domaine.md` §4.2 tranche : les trois sont obligatoires — pièce
   d'identité, diplôme/certification, **attestation d'assurance responsabilité civile
   professionnelle**. Une plateforme de mise en relation sportive sans RC pro de ses coachs est
   exposée ; ce n'est pas une nuance d'écran.
2. **Délai : 48 h ouvrées, pas 3 jours ouvrés.** `docs/domaine.md` §4.2 fixe 48 h ouvrées pour
   l'ensemble du dossier — c'était une divergence d'une version antérieure de
   `MyFavCoach-L2_dc.html` (« 3 jours ouvrés »), déjà corrigée dans le fichier déposé (voir le rapport de corrections
   fourni séparément).
3. **Pas de vérification automatique « en 2 minutes »** (défaut de l'ancienne maquette
   `Parcours_dc.html`, coche verte immédiate sur la pièce d'identité). Rien dans ce dépôt ne
   choisit de prestataire de vérification d'identité automatisée, et `docs/domaine.md` §4.2
   décrit un seul examen humain, portant sur le dossier entier.
4. **Aucune ligne « Coordonnées bancaires / IBAN ».** Stripe Connect Express gère l'onboarding
   de paiement, aucune intégration avant L4 (`CLAUDE.md` §2, `docs/prompts/L1.md`).
5. **Aucune statistique non vérifiable** (« le badge vérifié double le taux d'abonnement selon
   nos chiffres », ancienne maquette) : même traitement que l'arbitrage #15 de `docs/domaine.md`
   §0.
6. **« Remplacer » est une action destructive** (`MyFavCoach-L2_dc.html`) : l'ancienne version du
   fichier disparaît dès l'envoi de la nouvelle, aucun retour en arrière. Le libellé est
   présenté en rouge/encre d'alerte, jamais dans la couleur d'action neutre.

**Mécanisme de dépôt** (absorbé depuis l'ancienne `L2-08`) :

- **Téléversement direct vers un stockage chiffré via URL signée à usage unique**
  (`docs/api.md` §4 : `POST /coach/verification/pieces`, expiration 10 minutes). Le fichier ne
  transite jamais par l'API applicative de ce dépôt.
- **Aucune relecture depuis l'application, par aucun chemin** (`docs/perimetre.md` §5, critère
  10) : une fois envoyée, une pièce n'a pas d'écran de consultation de son contenu — seuls nom,
  date et poids restent visibles. Le back-office (`L2-10`) est le seul endroit qui rouvre le
  fichier, pour un examinateur humain.
- Donnée sensible au même titre qu'une donnée de santé (`CLAUDE.md` §10) : jamais journalisée,
  jamais mise en cache au-delà de la session, jamais dans un rapport d'erreur — y compris le nom
  de fichier, par prudence.

---

## États

| État | Comportement |
|---|---|
| Aucun document déposé | Bouton « Continuer » inactif, message générique |
| 1 ou 2 documents déposés | Bouton « Continuer » inactif, message nommant ce qui manque |
| 3 documents déposés | Bouton « Continuer » actif, quel que soit le statut de l'examen |
| Envoi en cours (une ligne) | Barre de progression sur cette ligne, les autres restent interactives |
| Erreur d'envoi (réseau, format refusé) | Message sur la ligne concernée, rien n'est marqué déposé |
| `verifiee` | Cet écran devient inatteignable pour un retour arrière |

---

## Ce qui a été inventé pour cette fiche

- La fusion elle-même : décidée après lecture de `MyFavCoach-L2_dc.html`, qui montre un seul
  écran là où l'ancienne maquette et une première fiche en supposaient deux.
- Les formats de fichier acceptés, la taille maximale : aucune valeur trouvée dans le dépôt, à
  fixer avant de coder.
- Le comportement exact du bouton « Continuer » avant décision de l'examinateur (actif dès les
  trois documents déposés, sans attendre la décision) : déduit du fait qu'une fiche `L2-09`
  distincte existe pour « ce que voit un coach entre le dépôt et la décision ».

---

## Critères d'acceptation

1. Le bouton « Continuer » reste inactif tant que les trois documents ne sont pas déposés, avec
   un message nommant précisément ce qui manque.
2. Chaque fichier part vers l'URL signée, jamais vers une route de ce dépôt.
3. Aucun écran de ce dépôt ne réaffiche le contenu d'une pièce déjà envoyée.
4. « Remplacer » efface l'ancienne version sans confirmation supplémentaire au-delà de l'action
   elle-même (l'action est déjà présentée comme destructive par sa couleur).
5. Aucune ligne bancaire, aucune mention de Stripe, aucune mention de délai autre que 48 h
   ouvrées, aucune statistique non sourcée dans le rendu — testé.
6. Un coach déjà `verifiee` n'atteint plus cet écran par la navigation normale.
7. Aucune trace d'un nom de fichier ou du contenu d'une pièce dans un journal ou un rapport
   d'erreur — testé.
8. Galerie, deux thèmes.
9. `npm run verif` passe.
