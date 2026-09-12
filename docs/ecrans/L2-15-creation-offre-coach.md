# L2-15 · Créer et publier une offre — côté coach (03a)

**Lot** L2 · **Rôle** coach · **Route** `app/(coach)/creer/offre.tsx` (remplace la coquille
`EcranProvisoire` du lot L0 pour `type = 'offre'`, dans `app/(coach)/creer/[type].tsx`)
**Référence visuelle** `maquettes/MyFavCoach-L2_dc.html`, bloc « Créer une offre ». Une version
antérieure simplifiait trois champs que `docs/domaine.md` §3.3 exige déjà (engagement humain,
bénéfices structurés, mise en avant) — corrigé dans le fichier déposé, détaillé en Règles.

---

## Raison d'être

C'est l'écran qui écrit une ligne dans `offres` (`docs/domaine.md` §3.3) et qui appelle
`publier_offre`/`retirer_offre` (`docs/modele-offres.md` §2.4, `docs/api.md` §5).
Sans lui, aucune offre ne peut exister — l'écran 03 (`L2-12`) n'aurait jamais rien à afficher.

---

## Contenu

Ouvert depuis la feuille « Créer » de la barre coach (`app/(coach)/_layout.tsx`, déjà posée en
L0) en choisissant « Nouvelle offre ».

**Champs** (`docs/domaine.md` §3.3) :

| Champ | Obligatoire pour publier | Détail |
|---|---|---|
| Titre | oui | |
| Description | non | |
| Prix mensuel | oui | 10 € à 500 €, saisi en euros, converti en centimes |
| « Ce que le client reçoit » (bénéfices) | oui (3 à 5) | lignes courtes, ajoutées une par une — compteur « N sur 5 » |
| « Ce que tu fais toi-même » (engagement humain) | oui (au moins un) | choix parmi une liste figée, en jetons sélectionnables (ajustement hebdomadaire, visio mensuelle, messagerie avec délai de réponse annoncé — `docs/domaine.md` §3.3), pas de saisie libre |
| Mise en avant | non, une seule par coach | interrupteur ; l'activer désactive automatiquement celle d'une autre offre du même coach, s'il en existe une |

**Hiérarchie des actions** (maquette) : « Enregistrer » est un lien discret en en-tête —
enregistrer un brouillon n'est pas l'action principale de cet écran, seulement un filet de
sécurité. « Publier » est le seul bouton de pied, plein et proéminent : c'est l'action que cet
écran existe pour produire.

---

## Règles

**Trois défauts d'une version antérieure de la maquette, déjà corrigés dans le fichier déposé** —
documentés parce qu'ils expliquent pourquoi ces trois champs portent le nom qu'ils portent,
pas parce qu'il reste quelque chose à corriger :

1. **Engagement humain.** `docs/domaine.md` §3.3 : « Une offre sans engagement humain est
   refusée à la publication. C'est la règle qui tient tout le modèle économique : elle évite
   que l'offre soit qualifiée de contenu numérique, ce qui imposerait l'achat in-app. » Sans ce
   champ, cette règle n'aurait nulle part où s'écrire — la maquette le porte désormais sous
   « Ce que tu fais toi-même ».
2. **Bénéfices.** `docs/domaine.md` §3.3 fixe `benefices` à 3 à 5 lignes distinctes, pas un
   paragraphe libre — la maquette le porte désormais sous « Ce que le client reçoit », en liste.
3. **Mise en avant.** `docs/domaine.md` §3.3 (« une seule par coach — étiquette "LE PLUS
   CHOISI" », déjà utilisée sur l'écran 03, `L2-12`) — la maquette porte désormais l'interrupteur.

Le reste des règles :

- **Un brouillon existe sans coach vérifié.** `docs/domaine.md` §4.2 : un coach non `verifiee`
  « peut préparer son profil et ses programmes » — une offre en `brouillon` en fait partie.
  Rien dans `docs/api.md` §5 ne gate `POST /coach/offres` sur le statut de vérification, à la
  différence de la publication.
- **La publication appelle `publier_offre`, jamais un `UPDATE` direct** sur `publiee_le`
  (`docs/modele-offres.md` §2.4). Deux refus possibles, à afficher avec leur texte
  exact :
  - `coach_non_verifie` (409) : « Ton identité doit être vérifiée avant de publier une offre. »
    → lien vers `L2-06`/`L2-09` selon l'état du dossier.
  - `engagement_humain_requis` (422) : « Choisis au moins un engagement humain. » → focus sur le
    champ concerné.
- **Le retrait appelle `retirer_offre`**, jamais un `DELETE`. Confirmation simple (pas de double
  confirmation comme la suppression de compte — retirer une offre n'efface aucune donnée,
  `docs/domaine.md` §3.3 : les abonnés en cours restent facturés).
- Le prix est **figé au moment de la souscription** d'un client (`docs/domaine.md` §3.3) : le
  modifier ici n'affecte que les futurs abonnés, jamais ceux déjà souscrits. Ce texte doit
  apparaître près du champ prix pour une offre déjà publiée, afin qu'un coach ne s'attende pas à
  un effet rétroactif.
- Une seule nature d'offre au jalon 1 (`docs/perimetre.md`, écran 04a) : aucun champ de type,
  aucune récurrence éditable, aucun champ lié à un créneau ou une réduction. Si un prompt futur
  y conduit, arrête-toi — même règle que partout ailleurs dans ce lot.

---

## États

| État | Comportement |
|---|---|
| Brouillon incomplet | « Enregistrer » (en-tête) actif ; « Publier » (pied) inactif |
| Brouillon complet | « Enregistrer » et « Publier » actifs |
| Publiée | Champs toujours modifiables (sauf ce que `docs/modele-offres.md` §2.2 protège), bouton « Retirer » remplace « Publier » en pied |
| Retirée | Bandeau : « Cette offre n'est plus en vente. Tes abonnés en cours gardent l'accès. » Bouton « Republier » — **non tranché**, voir Ce qui a été inventé |
| Erreur de publication | Message exact selon le code (`coach_non_verifie` / `engagement_humain_requis`), aucun champ perdu |

---

## Ce qui a été inventé pour cette fiche

- Le comportement « Mise en avant » (désactivation automatique d'une autre offre du même coach) :
  déduit de « une seule par coach » (`docs/domaine.md` §3.3), mécanisme non précisé ailleurs
  (trigger ? vérification applicative ?).
- **Écart de formulation, pas de fond, entre la maquette et `docs/domaine.md` §3.3.** Le domaine
  décrit trois catégories (« ajustement hebdomadaire, visio mensuelle, messagerie avec délai de
  réponse annoncé ») ; la maquette montre quatre jetons au libellé plus concret (« J'écris
  chaque programme », « Je réponds aux messages », « Je corrige les séances », « Point mensuel
  en visio »). Les deux décrivent le même principe (au moins un engagement réel) sans que les
  libellés se recouvrent mot pour mot — à réconcilier en une seule liste avant de coder.
- **Republier une offre retirée** : `docs/domaine.md` §4.10 ne décrit que
  `brouillon → publiee → retiree`, sans retour. Cette fiche laisse la question ouverte plutôt
  que d'inventer un chemin — à trancher avant de coder l'état « Retirée » ci-dessus.

---

## Critères d'acceptation

1. Un coach non vérifié peut enregistrer un brouillon complet ; la publication échoue avec
   `coach_non_verifie`.
2. Une offre sans engagement humain ne se publie pas : `engagement_humain_requis`.
3. Le retrait n'efface aucune ligne, ne touche à aucun abonnement en cours.
4. Aucune offre autre qu'un abonnement mensuel n'est constructible depuis cet écran.
5. Galerie, deux thèmes.
6. `npm run verif` passe.
