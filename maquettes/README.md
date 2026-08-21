# Maquettes — lecture seule

Ce dossier contient le rendu visuel de référence du dossier de design. **Il ne se modifie
jamais**, sauf instruction explicite (voir `CLAUDE.md` §3 et §4).

Les corrections listées dans `docs/design-system.md` §1 Corrections l'emportent sur ce qui
est dessiné ici : en cas d'écart entre une maquette et une correction, c'est la correction qui
fait foi.

## Les 7 fichiers

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

### `MyFavCoach-Handoff_dc.html`
Pas un écran de l'application : documentation de passation pour l'équipe dev.
- Iconographie · 32 pictogrammes
- Grammaire de mouvement
- Accessibilité · par composant
- Tokens exportables
