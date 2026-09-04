# L1-09 · Mes informations, identifiants et consentement

**Lot** L1 · **Rôle** les deux · **Routes** `app/(compte)/informations.tsx`,
`app/(compte)/identifiants.tsx`, `app/(compte)/confidentialite.tsx`
**Référence visuelle** **aucune — écrans absents du dossier de design, conçus ici**

---

## Raison d'être

Les trois destinations des trois lignes de L1-07. Sans elles, l'écran compte n'ouvre rien et la
règle « une ligne qui n'ouvre rien ne s'affiche pas » vide l'écran.

---

## Mes informations

Modifie le **profil actif**, pas le compte. Le formulaire n'est donc pas le même des deux côtés.

| Champ | Client | Coach |
|---|---|---|
| Photo | oui, `EmplacementImage` circulaire 76 | oui |
| Prénom, nom | oui | oui |
| Commune | oui | commune de base |
| Discipline | — | oui, liste figée |
| Titre court, bio | — | oui — **édités mais non publiés** avant le lot L2 |
| Date de naissance | **lecture seule**, avec la mention « Pour la modifier, écris-nous » | idem |

Enregistrement **explicite** par un bouton en pied, jamais à la frappe : une sauvegarde
automatique sur un champ de nom produit des états intermédiaires absurdes côté serveur.

La date de naissance est en lecture seule parce qu'elle porte la règle des 18 ans. La rendre
modifiable, c'est offrir le contournement.

---

## Adresse e-mail et mot de passe

**Changement d'adresse** : nouvelle adresse, puis confirmation envoyée **aux deux adresses**,
l'ancienne et la nouvelle. Tant que les deux ne sont pas confirmées, l'adresse ne change pas.
L'écran affiche l'état d'attente, avec les deux adresses et le renvoi possible.

**Changement de mot de passe** : mot de passe actuel, nouveau (10 à 72 caractères, mêmes bornes
et mêmes messages qu'en L1-02 — la borne haute vient de bcrypt, pas de nous). Après
succès, **toutes les autres sessions du compte sont révoquées**, et un message le dit.

« Révoquées » — même formulation que docs/ecrans/L1-04-connexion.md, "Nouveau mot de passe",
vérifiée contre la base réelle (P1.9), pas supposée, et conforme à `docs/backend.md` §3 (source
unique du mécanisme de session, à ne pas redécrire ailleurs) : un jeton d'accès déjà émis est un
JWT auto-vérifié, jamais recontrôlé en base à chaque requête. Une session ouverte ailleurs ne
peut **plus jamais se reconnecter** dès cet instant (son jeton de rafraîchissement est invalidé
immédiatement), mais son jeton d'accès EN COURS reste valable jusqu'à sa propre expiration — 1 h
au moment où ceci est écrit. Ce n'est pas « ne peut plus rien lire à l'instant » : c'est « ne
peut plus jamais obtenir un nouveau jeton », avec un résidu de lecture possible sur l'ancien
jeton pendant au plus une heure. Le message affiché à l'écran doit refléter cette distinction,
pas promettre une coupure immédiate.

---

## Confidentialité

Un seul réglage au lot L1 : le consentement aux données de santé.

- Interrupteur, avec le texte exact accepté et sa **version datée** sous l'intitulé.
- Retrait : `Modale` de confirmation qui énonce les deux conséquences —
  « Tes mesures ne seront plus enregistrées. » et « Celles déjà enregistrées restent, sauf si tu
  demandes leur effacement. »
- Après retrait, une ligne apparaît : « Effacer mes mesures enregistrées », en `etat.erreur`,
  avec double confirmation.

Les consentements aux notifications et aux communications commerciales arrivent aux lots L10 et
L11 : **ils ne figurent pas ici**, pas même désactivés.

---

## États

| État | Comportement |
|---|---|
| Chargement | Squelettes de champs aux formes finales |
| Normal | Valeurs du serveur, bouton d'enregistrement inactif tant que rien n'a changé |
| Enregistrement | Bouton en attente, champs en lecture seule |
| Erreur | `EtatErreur` en bandeau, saisie conservée, aucune valeur écrasée |
| Attente de confirmation d'adresse | Bandeau persistant tant que les deux confirmations manquent |

---

## Règles

- Le bouton d'enregistrement reste inactif tant qu'aucune valeur n'a changé. Un bouton toujours
  actif apprend à appuyer sans lire.
- Quitter avec des changements non enregistrés déclenche une `Modale` : « Tu as des
  modifications non enregistrées. » Deux issues, pas trois.
- Le retrait du consentement **bloque l'écriture côté serveur**, pas seulement côté écran. Un
  test doit le prouver contre la base.
- L'effacement des mesures est irréversible et le dit avant, pas après.
- Aucun de ces écrans n'affiche une donnée de santé dans un titre, une notification ou une URL.

---

## Critères d'acceptation

1. Les trois écrans s'ouvrent depuis L1-07 et reviennent proprement.
2. Le bouton d'enregistrement est inactif à l'ouverture et s'active à la première modification
   réelle — testé, y compris le cas « je modifie puis je remets la valeur d'origine ».
3. La date de naissance n'est pas modifiable : aucun champ éditable dans l'arbre rendu.
4. Un changement d'adresse ne prend effet qu'après les deux confirmations — testé contre la
   base réelle.
5. Après changement de mot de passe, une session ouverte ailleurs ne peut plus jamais obtenir un
   nouveau jeton d'accès (son jeton de rafraîchissement est immédiatement invalidé) — testé
   contre la base réelle, pas par un simulacre. Son jeton d'accès déjà émis, lui, reste valable
   jusqu'à sa propre expiration (résidu de lecture possible, borné dans le temps — voir « Adresse
   e-mail et mot de passe » ci-dessus) : ce résidu n'est PAS ce que ce critère prouve, seule
   l'impossibilité de rafraîchir l'est. Même critère que docs/ecrans/L1-04-connexion.md,
   critère 4 — un seul mécanisme, déjà prouvé par `src/test/rls.banc.ts` à P1.9 ; ce critère-ci
   ne demande pas un second scénario redondant, seulement que l'écran affiche le bon message.
6. Consentement retiré : un test contre la base réelle prouve que l'écriture d'une mesure est
   refusée par le serveur.
7. La version du texte de consentement est enregistrée et affichée ; un consentement sans
   version est impossible à créer (contrainte de base).
8. Quitter avec des modifications non enregistrées ouvre la modale — testé avec l'attente
   explicite du geste, pas un déclenchement d'événement non attendu.
9. Les trois écrans sont dans la galerie, **exercés en clair et en sombre**.
10. `npm run verif` passe.
