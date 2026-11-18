# L2-04 · Export de mes données (C-07)

**Lot** L2 · **Rôle** client et coach · **Route** `app/(compte)/export.tsx`
**Référence visuelle** `maquettes/MyFavCoach-L2_dc.html`, bloc « C-07 · Exporter mes données ».

---

## Raison d'être

Obligation légale (portabilité des données personnelles) bloquante pour la publication, au même
titre que C-03/C-04/C-06 — pas une fonctionnalité produit demandée par un client. Accessible
directement depuis « Compte et réglages » et depuis `L2-01` (suppression de compte, « Exporter
mes données d'abord »).

---

## Contenu

Titre serif : « Tout ce qu'on a sur toi. »

**Trois états, un seul affiché à la fois** :

| État | Rendu |
|---|---|
| Aucun export demandé | Texte explicatif + bouton unique « Demander mon export » |
| En préparation | Carte sombre : badge « EN PRÉPARATION », pas de bouton de téléchargement |
| Prêt | Carte sombre : badge « PRÊT », taille et format (« 2,1 Mo · JSON »), date de l'export, date d'expiration du lien (« Disponible jusqu'au {date}, puis supprimé »), bouton « Télécharger » |

**Ce que le fichier peut contenir**, selon les profils et l'activité du compte :
compte et profil, objectifs, poids et mesures sous consentement, séances,
abonnements et factures, coachs suivis, factures de commission et versements,
autorisations. Les notes privées du coach restent hors de l'export automatique
en attendant l'arbitrage.

Avertissement pour un profil client : « Ce fichier peut contenir ton poids et tes
mesures. Le lien est personnel et expire au bout de 7 jours — ne le transfère à personne. »

Pied fixe : bouton contour « Demander un nouvel export » (ou « Demander mon export » à l'état
initial) — **une fois par mois** (voir Règles).

---

## Règles

- **Fonction distante**, pas PostgREST direct (`docs/api.md` §14) : l'export rassemble des
  données de plusieurs tables. L'écran affiche un lien à jeton temporaire réservé
  au compte demandeur. Le courriel de notification reste à raccorder à un prestataire.
- **Le lien de téléchargement expire 7 jours après la préparation de l'export.** Passé ce délai,
  le fichier est supprimé côté serveur — pas seulement un lien qui casse, une suppression réelle.
  Une donnée de santé exportée ne doit pas dormir indéfiniment derrière un lien permanent
  (`CLAUDE.md` §10).
- **Un export par mois maximum.** Protection, pas une contrainte technique arbitraire : un
  fichier contenant du poids et des mesures ne doit pas être régénérable sans limite.
  **Textes validés le 2 novembre 2026** pour un export demandé moins d'un mois après le
  précédent (`export_trop_recent`) : titre « Tu as déjà demandé un export ce mois-ci », détail
  « Tu pourras en redemander un le mois prochain. ». Une règle du produit, dite comme telle :
  jamais sous le titre du repli serveur (« On a un souci de notre côté »), et sans « Réessayer »,
  qui mènerait au même refus.
- Le bouton « Télécharger » ouvre le lien temporaire dans le navigateur. L'application affiche uniquement l'état de l'export.
- L'avertissement sur le contenu sensible est **explicite sur ce qu'il contient**, pas une
  formule générique — les gens transfèrent ce genre de lien sans y penser.

---

## États (transitions)

| Transition | Déclencheur |
|---|---|
| Aucun export → En préparation | Bouton pressé |
| En préparation → Prêt | Réouverture de l’écran après la préparation |
| Prêt → Aucun export | 7 jours écoulés (le fichier n'existe plus) |
| Erreur | Message d'erreur, l'état antérieur reste affiché |

---

## Ce qui a été inventé pour cette fiche

- Le mécanisme précis qui fait passer l'écran de « en préparation » à « prêt » sans rechargement
  manuel (sondage à la réouverture ? notification ?) : non spécifié au-delà de « rouvrir
  l'écran », cohérent avec la règle « pas de sondage en boucle » déjà posée ailleurs (`L2-09`,
  `L1-03`).

---

## Critères d'acceptation

1. La ligne « Exporter mes données » de « Compte et réglages » (et le lien depuis `L2-01`)
   ouvrent cet écran, dans les deux espaces.
2. Le bouton déclenche une demande unique par pression, sans double appel.
3. Le lien de téléchargement n'est plus utilisable après 7 jours.
4. Une nouvelle demande est refusée avant qu'un mois se soit écoulé depuis la précédente.
5. Les catégories affichées correspondent aux profils du compte et au périmètre du fichier.
6. `npm run verif` passe.
