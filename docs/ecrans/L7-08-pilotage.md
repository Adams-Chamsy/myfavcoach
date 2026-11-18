# L7-08 · Pilotage coach (08)

**Lot** L7 · **Rôle** coach · **Route** `app/(coach)/(tabs)/pilotage.tsx` (la branche « coach
vérifié avec offre publiée », provisoire jusqu'ici)
**Référence visuelle** `maquettes/MyFavCoach-Coach_dc.html`, `data-screen-label="08 Pilotage
coach"`. **Trois retraits, lus en « Ce qui a été inventé ou retiré ».**

Fiche écrite par Claude le 18 novembre 2026, sous le mandat du 15 novembre, **revue par le
développeur le même jour**. Plan et décisions : `docs/prompts/L7.md` (décisions 2 et 4).

---

## Raison d'être

En un coup d'œil, à l'ouverture : combien il gagne ce mois-ci, combien de clients il suit, s'ils
s'entraînent, et qui demande son attention maintenant.

## Ce qui ne change pas

L'en-tête de l'espace coach (avec l'avatar de la bascule) reste **au-dessus de toutes les
branches** (`CLAUDE.md` §8). Les branches L2-09 (dossier non vérifié) et L2-11 (aucune offre
publiée) restent telles quelles. La carte « Importer mes clients » (L3bis) reste, sous le bloc 3.

## Contenu, de haut en bas (coach vérifié, au moins une offre publiée)

Titre « Bonjour {prénom} ».

1. **Revenus du mois** — « Revenus de {mois} » et le net du mois (`mes_revenus`, L5) en grand.
   Presser la carte ouvre l'onglet « Revenus ».
2. **Deux tuiles** :
   - « Clients » et, dessous, « avec accès au suivi » : le nombre de clients dont l'abonnement
     est `actif`, `resiliation_programmee` ou `impaye`. Ce nombre est plus petit que « Tous » de
     la liste, qui compte aussi les abonnements en pause et suspendus ;
   - « Assiduité » : la moyenne des assiduités de ses clients qui en ont une (§5.2, ses séances
     seules), arrondie à l'entier ; « — » et « Pas encore assez de séances » si aucun n'en a.
   Presser « Clients » ouvre l'onglet « Clients ».
3. **À traiter · {n}** — une ligne par client à relancer (décision 2, même règle que le filtre
   « À relancer » de la liste), au plus cinq, dans l'ordre des badges :
   - « {Prénom N.} · paiement en échec » ;
   - « {Prénom N.} · {n} séance(s) non rattrapée(s) » : les séances de ce coach dont l'échéance
     réelle de rattrapage de L6 est passée, comptées depuis sa dernière séance faite chez ce
     coach (ou depuis sa première séance prévue s'il n'en a fait aucune) — `docs/domaine.md`
     §5.3. Dès qu'il termine une séance, la ligne disparaît. **Une semaine de repos (aucune séance prévue) ne déclenche rien**, quel que
     soit le temps écoulé depuis la dernière séance.
   Chaque ligne ouvre la fiche client (10). Au-delà de cinq : « Voir les {n} » → la liste
   clients, filtre « À relancer ». Rien à traiter : « Rien à traiter. Tes clients sont à jour. ».
4. **Aucun client encore** (zéro abonnement non terminé) : à la place des blocs 2 et 3,
   « Tes premiers clients apparaîtront ici dès leur abonnement. » ; la carte d'import reste.

Les anciens clients (L7-09, « Anciens clients ») ne comptent nulle part ici : ni dans « Clients »,
ni dans l'assiduité moyenne, ni dans « À traiter ».

## Règles

- Tout vient du serveur en une lecture (`mon_pilotage`) ; aucun calcul dans l'écran.
- **Aucune donnée de santé** (décision 1) : ni poids, ni tour de taille, ni ressenti, **même
  agrégés** — la règle est appliquée par le serveur, pas par l'écran.
- Le statut d'un client est toujours écrit en texte, jamais porté par la seule couleur.

## États

Chargement : squelettes des cartes. Erreur : `EtatErreur` avec « Réessayer », sous l'en-tête
(comme aujourd'hui).

## Ce qui a été inventé ou retiré

- **Retiré** : les évolutions (« +12 % », « +2 cette semaine », « −3 pts ») — reportées jusqu'à
  disposer de périodes comparables (décision 4, validé à la revue) ; le bloc « Aujourd'hui » et
  « Voir l'agenda » (L9).
- **Remplacé** : « Clients actifs » → « Clients · avec accès au suivi » (le mot « actif » est un
  statut d'abonnement, pas ce que la tuile compte) ; « Léa D. inactive depuis 12 jours » →
  « séances non rattrapées » (revue : un seuil de jours depuis la dernière séance signale à tort
  un client qui suit un programme espacé) ; « 2 paiements échoués » → une ligne par client, pour
  que chaque ligne mène quelque part.
- **Inventé** : la limite de cinq lignes, « Voir les {n} », les états vides, les textes ci-dessus
  hors « Bonjour », « Assiduité », « À traiter ».

## Critères d'acceptation

1. Un coach avec des abonnés voit son net du mois, son nombre de clients avec accès et
   l'assiduité moyenne, égaux à ce que rendent les lectures de L5 et de la fiche client.
2. Un client en paiement en échec et un client avec une séance non rattrapée apparaissent dans
   « À traiter », et chacun ouvre sa fiche. Un client en semaine de repos, ou dont la séance
   manquée est encore rattrapable, n'y apparaît pas (banc).
3. Un coach ne voit dans son pilotage aucun client d'un autre coach, ni ses anciens clients
   (banc, deux sens).
4. L'avatar et la bascule restent atteignables dans les quatre états de l'écran (test).
5. Galerie et corpus d'accessibilité ; clos dans le navigateur sur la base de dev.
6. `npm run verif` passe.
