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

**Ce que contient le fichier** : liste d'étiquettes — Compte et profil, Objectifs, Poids et
mesures, Séances faites, Messages, Paiements, Tes autorisations. Reflète les tables réellement
exportées ; s'étend au fil des lots (rien à ce jour sur séances/messages/paiements avant L6/L8/
L4, l'étiquette n'apparaît que si la donnée existe pour ce compte).

Avertissement, si le fichier contient une donnée de santé : « Ce fichier contient ton poids et
tes mesures. Le lien est personnel et expire au bout de 7 jours — ne le transfère à personne. »

Pied fixe : bouton contour « Demander un nouvel export » (ou « Demander mon export » à l'état
initial) — **une fois par mois** (voir Règles).

---

## Règles

- **Fonction distante**, pas PostgREST direct (`docs/api.md` §14) : l'export rassemble des
  données de plusieurs tables et envoie un courriel avec un lien signé — hors de portée d'une
  requête PostgREST unique, donc hors de portée d'un accès direct depuis l'écran.
- **Le lien de téléchargement expire 7 jours après la préparation de l'export.** Passé ce délai,
  le fichier est supprimé côté serveur — pas seulement un lien qui casse, une suppression réelle.
  Une donnée de santé exportée ne doit pas dormir indéfiniment derrière un lien permanent
  (`CLAUDE.md` §10).
- **Un export par mois maximum.** Protection, pas une contrainte technique arbitraire : un
  fichier contenant du poids et des mesures ne doit pas être régénérable sans limite.
- Aucune donnée n'est affichée ni téléchargée **dans** l'application au-delà du bouton qui
  déclenche l'envoi : le fichier part par lien signé, jamais par un flux géré côté client.
- L'avertissement sur le contenu sensible est **explicite sur ce qu'il contient**, pas une
  formule générique — les gens transfèrent ce genre de lien sans y penser.

---

## États (transitions)

| Transition | Déclencheur |
|---|---|
| Aucun export → En préparation | Bouton pressé |
| En préparation → Prêt | Courriel reçu, ou rouverture de l'écran après coup |
| Prêt → Aucun export | 7 jours écoulés (le fichier n'existe plus) |
| Erreur | Message d'erreur, l'état antérieur reste affiché |

---

## Ce qui a été inventé pour cette fiche

- Le mécanisme précis qui fait passer l'écran de « en préparation » à « prêt » sans rechargement
  manuel (sondage à la réouverture ? notification ?) : non spécifié au-delà de « rouvrir
  l'écran », cohérent avec la règle « pas de sondage en boucle » déjà posée ailleurs (`L2-09`,
  `L1-03`).
- La liste exacte des étiquettes de contenu qui apparaissent selon l'avancement des lots : la
  maquette montre l'état final (tous les lots construits) ; à ce lot, seules « Compte et profil »,
  « Objectifs », « Poids et mesures » et « Tes autorisations » ont une donnée réelle à exporter.

---

## Critères d'acceptation

1. La ligne « Exporter mes données » de « Compte et réglages » (et le lien depuis `L2-01`)
   ouvrent cet écran, dans les deux espaces.
2. Le bouton déclenche une demande unique par pression, sans double appel.
3. Le lien de téléchargement n'est plus utilisable après 7 jours.
4. Une nouvelle demande est refusée avant qu'un mois se soit écoulé depuis la précédente.
5. Seules les étiquettes de contenu réellement disponibles à ce lot apparaissent.
6. `npm run verif` passe.
