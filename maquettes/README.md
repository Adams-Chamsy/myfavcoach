# Maquettes — lecture seule

Ce dossier contient le rendu visuel de référence du dossier de design. **Il ne se modifie
jamais**, sauf instruction explicite (voir `CLAUDE.md` §3 et §4).

Les corrections listées dans `docs/design-system.md` §1 Corrections l'emportent sur ce qui
est dessiné ici : en cas d'écart entre une maquette et une correction, c'est la correction qui
fait foi.

**Ajout du 12 septembre 2026.** `MyFavCoach-L2_dc.html` est postérieur au dossier de cadrage du
20 août : produit pour combler des écrans absents du dossier d'origine, listés « à concevoir »
dans `docs/perimetre.md`. Il est lecture seule au même titre que les sept fichiers du dossier
d'origine dès son premier commit — la même règle s'applique, la date de production ne change
rien à son statut une fois déposé.

## Les 8 fichiers

### `MyFavCoach-System_dc.html`
Design system + écrans 1→3.
- 01 Accueil
- 02 Recherche
- 03 Profil coach

### `MyFavCoach-Client_dc.html`
Écrans 4→7.
- 04a Choix offre
- 04b Paiement
- 05 Seance du jour
- 06 Suivi
- 07 Messagerie

### `MyFavCoach-Coach_dc.html`
Écrans 8→13.
- 08 Pilotage coach
- 09 Clients
- 10 Fiche client
- 11 Studio
- 12 Agenda
- 13 Revenus

### `MyFavCoach-Etats_dc.html`
États 14→20.
- 14 Recherche vide
- 15 Chargement
- 16 Hors-ligne
- 17 Bascule de role
- 18 Notifications
- 19 Coach vide
- 20 Paiement refuse

### `MyFavCoach-Parcours_dc.html`
Parcours 21→28.
- 21 Bienvenue
- 22 Onboarding objectifs
- 23 Verification coach
- 24 Mon compte
- 25 Inbox coach
- 26 Visio
- 27 Avis
- 28 Parcours

### `MyFavCoach-Tablette-Montre_dc.html`
Tablette & montre — écrans 29→36, **hors périmètre du jalon 1** (voir `docs/perimetre.md` §3).
- 29 Tablette pilotage
- 30 Tablette decouverte
- 31 Montre complication
- 32 Montre lancer
- 33 Montre serie
- 34 Montre repos
- 35 Montre fin
- 36 Montre notif

### `MyFavCoach-L2_dc.html`
Huit écrans absents du dossier d'origine, produits après le 20 août pour le lot L2 (un pour L4,
un pour L5, le reste L2). Aucune nature d'offre au-delà de l'abonnement, aucune photo
corporelle, aucun média — rien n'anticipe le jalon 2.
- 23b Dépôt des pièces
- 23c Attente de vérification
- Créer une offre (coach)
- 04c Confirmation d'abonnement — lot L4
- C-03 Supprimer mon compte
- C-04 Mes consentements
- C-06 Documents contractuels
- C-07 Exporter mes données

### `MyFavCoach-Handoff_dc.html`
Pas un écran de l'application : documentation de passation pour l'équipe dev.
- Iconographie · 32 pictogrammes
- Grammaire de mouvement
- Accessibilité · par composant
- Tokens exportables
