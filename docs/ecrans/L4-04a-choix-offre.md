# L4-04a · Tunnel — choix de l'offre (04a)

**Lot** L4 · **Rôle** client (profil client actif, session requise — voir Règles) · **Route**
`app/(client)/souscription/[coachId].tsx` (nom inventé, voir « Ce qui a été inventé »)
**Référence visuelle** `maquettes/MyFavCoach-Client_dc.html`, bloc « 04a · Choix de l'offre »,
`data-screen-label="04a Choix offre"`. **Quatre corrections, lues en Règles** : la maquette
montre une offre supprimée, une statistique que rien ne calcule, et deux phrases inexactes au
regard de `docs/domaine.md`.

---

## Raison d'être

Premier écran du tunnel. Le client y confirme **quelle offre** du coach il prend, avant tout
appel au prestataire de paiement. Point d'entrée unique : le bouton « S'abonner » déjà posé sur
`app/(client)/coach/[id].tsx` (`docs/ecrans/L2-12-profil-coach-public.md`, inerte jusqu'ici) —
jamais un second bouton, jamais une autre route (`docs/prompts/L4.md` point 7).

---

## Contenu

En-tête : retour, titre « S'abonner à {prénom du coach} », indicateur d'étape (voir Règles).

Titre de section : « Quelle formule te ressemble ? » (maquette).

**Une carte par offre publiée du coach** (`docs/domaine.md` §3.3 — toutes de nature
abonnement mensuel), dans l'ordre de `L2-12` :

| Élément | Source |
|---|---|
| Titre de l'offre | `Offre.titre` |
| Prix | `Offre.prixMensuelCentimes`, formaté « 49 €/mois » |
| Engagement humain | `Offre.engagementHumain`, en clair — c'est ce que le client achète (`docs/domaine.md` §2, magasins) |
| Étiquette « LE PLUS CHOISI » | seulement si `Offre.estMiseEnAvant` (même libellé que `L2-12`) |
| Sélection | une carte sélectionnée à la fois ; présélection : l'offre mise en avant, sinon la première |

Phrase sous les cartes (corrigée, voir Règles) : « Sans engagement de durée : tu peux arrêter
quand tu veux, l'arrêt prend effet à la fin du mois payé. »

Pied : bouton principal « Continuer · {prix} €/mois », puis « Premier prélèvement aujourd'hui,
puis une fois par mois. »

---

## Règles

**Corrections de la maquette** (l'emportent sur elle, `CLAUDE.md` §3) :

1. **« Programme seul · 24 € » retiré.** Offre supprimée par l'arbitrage #9
   (`docs/domaine.md` §0, §3.3) — et exemple exact de ce que la règle des magasins interdit :
   « 8 semaines en autonomie, sans échange direct » est du contenu numérique
   (`docs/domaine.md` §2).
2. **« Choisi par 8 abonnés sur 10 » retiré.** Aucune règle de calcul de `docs/domaine.md` §5 ne
   le produit, et l'application ne calcule rien (`docs/api.md` §15). Remplacé par l'étiquette
   « LE PLUS CHOISI » quand `estMiseEnAvant` est vrai — seul signal de ce type qui existe dans le
   domaine.
3. **« tu peux mettre en pause ou arrêter à tout moment » corrigé.** Faux au regard de
   `docs/domaine.md` §4.3 : la pause est limitée (≤ 60 jours, une fois par 12 mois) et la
   résiliation prend effet en fin de période payée, jamais immédiatement. Une promesse inexacte
   sur la sortie est précisément ce qui produit des oppositions bancaires.
4. **« puis le 18 de chaque mois » remplacé par « puis une fois par mois ».** Le jour de
   prélèvement est une règle serveur (`jourPrelevement`, 29/30/31 ramenés à 28,
   `docs/domaine.md` §3.4) : 04a n'a encore appelé aucune fonction serveur de paiement, il ne
   calcule pas ce jour lui-même (`docs/api.md` §15). La date exacte apparaît en 04b, venue de
   `recapitulatif.jourPrelevement`.

Le reste :

- **Magasins d'applications** (`docs/domaine.md` §2) : aucun terme interdit dans l'écran ; ce que
  la carte met en avant est l'engagement humain du coach, jamais un contenu.
- **Aucun appel au prestataire depuis l'application.** « Continuer » demande l'intention de
  paiement (`POST /abonnements/intention`, `docs/api.md` §7) — c'est le serveur qui crée la page
  Stripe — et, en cas de succès, pousse 04b avec le récapitulatif et l'URL de paiement rendus.
  **L'`Idempotency-Key` naît ici**, une par appui sur « Continuer », réutilisée pour les nouveaux
  essais réseau de cette même demande (`docs/backend.md` §13). L'offre choisie part au serveur par son identifiant ; le prix affiché ici
  n'est jamais renvoyé comme vérité (le serveur relit et fige `prixFigeCentimes`).
- **Session requise, profil client actif.** L'écran est dans `(client)` ; un visiteur `anon` qui
  presse « S'abonner » sur `L2-12` n'arrive jamais ici sans session — voir « Ce qui a été
  inventé ».
- **Auto-abonnement** : refusé par le serveur (`auto_abonnement_interdit`, 409,
  `docs/domaine.md` §3.2). L'écran affiche le `title`/`detail` de l'erreur tels quels
  (`docs/api.md` §1), jamais un texte à lui.
- **Offre devenue indisponible** entre l'ouverture de l'écran et « Continuer » (retirée par le
  coach) : erreur serveur affichée telle quelle, la liste est relue.
- Une seule nature d'offre (`docs/perimetre.md` §2, 04a) : aucun sélecteur de durée, de
  récurrence, de nombre de séances.

---

## États

| État | Comportement |
|---|---|
| Chargement des offres | Squelette (`L0-03`) |
| Une offre | La carte seule, déjà sélectionnée ; l'écran reste affiché (il montre l'engagement humain avant le paiement) |
| Plusieurs offres | Cartes sélectionnables, présélection comme ci-dessus |
| Aucune offre publiée | État vide honnête : « {Prénom} n'a pas d'offre ouverte pour le moment. » — cas atteignable si le coach retire sa dernière offre pendant que le client consulte son profil |
| « Continuer » en cours | Bouton en chargement, non pressable deux fois |
| Erreur de l'intention | Message du serveur tel quel (dont `requete_en_cours`, 409), bouton réactivé |

---

## Ce qui a été inventé pour cette fiche

- **Indicateur d'étape.** La maquette écrit « Étape 1 sur 3 » (04a) puis « Étape 3 sur 3 »
  (04b) : aucune étape 2 n'existe dans le dossier. Cette fiche propose « Étape 1 sur 2 » /
  « Étape 2 sur 2 » — **à valider**, ou à retirer.
- **Visiteur sans session.** Le chemin `anon` → connexion/inscription → retour au tunnel n'est
  décrit nulle part. Proposition : « S'abonner » ouvre la connexion, puis ramène au profil coach
  (pas directement au tunnel). **À valider** avant P4.6.
- **Deuxième abonnement au même coach.** `docs/domaine.md` n'interdit pas qu'un client ait deux
  abonnements actifs chez le même coach (il n'en parle pas). Rien n'est affiché ni bloqué par
  cette fiche. **À trancher dans `docs/domaine.md` avant P4.3**, pas par l'écran.
- Nom de route `souscription/[coachId]`.
- Texte de l'état « aucune offre publiée ».

---

## Critères d'acceptation

1. Le bouton « S'abonner » de `app/(client)/coach/[id].tsx` ouvre cet écran ; aucun autre point
   d'entrée n'existe.
2. Seules les offres publiées du coach apparaissent ; aucune carte « Programme seul », aucune
   statistique « N abonnés sur 10 ».
3. L'engagement humain de chaque offre est visible sur sa carte.
4. Aucun jour de prélèvement n'est calculé ni affiché sur cet écran.
5. Un double appui sur « Continuer » ne produit qu'une seule demande d'intention.
6. **Libellés interdits** (`docs/domaine.md` §2) : aucun terme de la liste partagée de
   `src/test/` dans les textes rendus ni dans les libellés d'accessibilité.
7. Toute zone tactile ≥ 44 pt ; la carte sélectionnée l'annonce par son état d'accessibilité
   (`selected`), pas seulement par sa couleur.
8. Galerie, deux thèmes.
9. `npm run verif` passe.
