# L2-12 · Profil coach — public, onglet Offres (03)

**Lot** L2 · **Rôle** client, et visiteur non connecté pour la lecture (`anon`, voir Règles) ·
**Route** `app/(client)/coach/[id].tsx`
**Référence visuelle** `maquettes/MyFavCoach-System_dc.html`, bloc « 03 · Profil coach »,
`data-screen-label="03 Profil coach"`. **Une correction, lue en Règles.**

---

## Raison d'être

La fiche publique d'un coach, telle qu'un client la découvre depuis la recherche (L3, hors
périmètre de cette fiche) ou depuis un lien direct. Premier écran du dépôt à exposer une
lecture **au-delà du propriétaire** (`docs/backend.md` §8) : ce que ce coach a publié devient
visible à n'importe qui.

---

## Contenu

Bandeau plein cadre (vidéo ou photo de présentation, `taille.pleinCadre`, 400 pt) : bouton
retour, favori, partage ; disque de lecture au centre si vidéo ; en pied du bandeau : badge
discipline, nom, note (« 4,9 · 214 avis », `docs/domaine.md` §5.1 — badge « Nouveau » sous 5
avis), commune ou « visio ».

Corps : bio, badges de certification (repris de `docs/domaine.md` §3.2, affichés seulement si
`statutVerification = verifiee` — voir Règles), onglets **Offres / Avis / Parcours** (cet écran
couvre l'onglet Offres ; `L2-13` et `L2-14` couvrent les deux autres).

**Onglet Offres — une seule carte** (correction, voir Règles) : titre de l'offre, prix
`XX €/mois`, 3 à 5 lignes de bénéfices, étiquette « LE PLUS CHOISI » si `estMiseEnAvant`.
En dessous : « Ce qu'en disent ses abonnés », un avis mis en avant (le plus utile, mécanisme
non spécifié plus finement).

Pied fixe : bouton message (ouvre une conversation, hors périmètre L2) + bouton principal
« S'abonner · XX €/mois » (ouvre le tunnel, lot L4 — inatteignable à ce lot, voir Règles).

---

## Règles

- **Correction à la maquette** : elle montre deux cartes d'offre, « Suivi complet » et
  « Programme seul ». `docs/domaine.md` arbitrage #9 et `docs/perimetre.md` (écran 03,
  remarque : « offre "Programme seul" retirée ») suppriment la seconde. Cet écran n'affiche
  **que** les offres réellement publiées par ce coach (`publieeLe` posée, `retireeLe` nulle,
  `docs/domaine.md` §3.3) — une seule dans le jeu de démonstration actuel, mais l'écran doit
  rester correct si un coach publie plusieurs offres un jour (`estMiseEnAvant` en distingue une
  seule).
- **Lecture inter-comptes, la première du dépôt** (`docs/backend.md` §8). Cet écran doit rester
  correct pour `anon` **et** pour un compte authentifié qui n'est ni ce coach ni son abonné :
  seules les offres publiées sont lisibles, jamais un brouillon, jamais une offre retirée d'un
  autre coach par confusion d'identifiant. La fiche `docs/backend.md` §8 exige que ces refus
  soient testés, pas seulement l'accès légitime.
- Les badges de certification ne s'affichent que pour un coach `verifiee` (`docs/domaine.md`
  §4.2 : « Le badge public "vérifié" n'apparaît qu'en `verifiee` ») — un coach en `en_examen`
  reste consultable (il peut préparer son profil, §4.2), mais sans le badge.
- Le bouton « S'abonner » est **affiché mais inatteignable** à ce lot : le tunnel (04a) est
  L4. Il doit exister à l'écran (la maquette de référence pour L4 s'y attend) sans jamais
  déclencher d'appel réseau de paiement — non tranché plus précisément ici, voir la remarque de
  `docs/modele-offres.md` §6 sur la fenêtre L2/L4 où une offre s'affiche sans pouvoir
  être payée.

---

## Ce qui a été inventé pour cette fiche

- Le mécanisme de sélection de l'avis « mis en avant » : non spécifié dans `docs/domaine.md`,
  repris tel quel de la maquette sans règle de tri précisée.
- Le comportement exact du bouton « S'abonner » avant L4 (désactivé ? actif mais menant à un
  état d'attente ?) : signalé comme non tranché plutôt qu'inventé arbitrairement.

---

## Critères d'acceptation

1. Un brouillon ou une offre retirée n'apparaît jamais, quel que soit le compte qui consulte —
   testé pour `anon`, pour un autre client, et pour un autre coach.
2. Le badge « vérifié » n'apparaît que si `statutVerification = verifiee`.
3. Sous 5 avis, badge « Nouveau », aucune note affichée (`docs/domaine.md` §5.1).
4. Aucune carte « Programme seul » ni aucune offre autre qu'un abonnement.
5. Accessible sans session (`anon`).
6. Galerie, deux thèmes.
7. `npm run verif` passe.
