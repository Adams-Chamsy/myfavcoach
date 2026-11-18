# L7-09 · Liste clients (09) et anciens clients

**Lot** L7 · **Rôle** coach · **Routes** `app/(coach)/(tabs)/clients.tsx` (onglet existant
depuis L0, écran provisoire jusqu'ici) ; `app/(coach)/clients/anciens.tsx` (écran poussé)
**Référence visuelle** `maquettes/MyFavCoach-Coach_dc.html`, `data-screen-label="09 Clients"`.
« Anciens clients » n'a pas de maquette : il reprend les lignes de la liste.
**Quatre retraits, lus en « Ce qui a été inventé ou retiré ».**

Fiche écrite par Claude le 18 novembre 2026, sous le mandat du 15 novembre, **revue par le
développeur le même jour** : la vue « Anciens clients » est une décision de la revue. Plan et
décisions : `docs/prompts/L7.md` (décisions 2 et 6).

---

## Raison d'être

Tous ses clients sur une page, ceux qui demandent son attention d'abord ; et, à part, ceux qui
sont partis.

## Qui figure où

- **Mes clients** : abonnement chez ce coach `actif`, `resiliation_programmee`, `impaye`,
  `suspendu` ou `en_pause`.
- **Anciens clients** : aucun abonnement de ce type chez ce coach, et au moins un `resilie`.
  Un client qui se réabonne revient dans « Mes clients ».
- Nulle part : `en_attente_confirmation` (le suivi n'est pas ouvert, §4.3) et `annule` (il n'a
  jamais commencé).

## Mes clients — contenu, de haut en bas

En-tête de l'espace coach, titre « Mes clients », action « Inviter » → `app/(coach)/invitations.tsx`
(L3bis).

1. **Recherche** — « Chercher un client » : filtre la liste déjà chargée sur le prénom et le
   nom, sans appel au serveur.
2. **Filtres** — trois jetons : « Tous · {n} », « À relancer · {n} », « Nouveaux · {n} ».
   « À relancer » applique **exactement la règle de « À traiter » du pilotage** (L7-08) :
   paiement en échec, ou séance non rattrapée. Les nombres viennent du serveur.
3. **La liste** — une ligne par client, dans l'ordre des badges (paiement en échec, séances non
   rattrapées, nouveau, à jour), puis par nom :
   - avatar à l'initiale, « {Prénom Nom} » (nom complet, décision 7), et le badge
     (`statutBadge`, libellé du serveur : « Paiement en échec », « {n} séance(s) non
     rattrapée(s) », « Nouveau », « À jour ») ;
   - sous-ligne, selon l'abonnement :
     - accès ouvert : « {titre de l'offre} · semaine {k} · {faites}/{prévues} séances » (semaine
       en cours, §5.3) ; sans programme en cours : « {titre de l'offre} · semaine {k} · aucun
       programme » ;
     - `en_pause` : « {titre de l'offre} · en pause jusqu'au {date} » ;
     - `suspendu` : « {titre de l'offre} · abonnement suspendu » ;
     - `resiliation_programmee` : « {titre de l'offre} · fin le {date} ».
   Presser une ligne ouvre la fiche client (10).
4. **En bas de la liste** — une ligne « Anciens clients · {n} » → l'écran « Anciens clients ».
   Absente s'il n'y en a aucun.

## Anciens clients — contenu

Titre « Anciens clients », retour en haut à gauche. Une ligne par client, du plus récemment
parti au plus ancien : avatar à l'initiale, « {Prénom Nom} », sous-ligne « {titre de l'offre} ·
du {date de début} au {date de fin} » (dernier abonnement terminé). Pas de badge, pas de filtre ;
la recherche, comme sur « Mes clients ». Presser une ligne ouvre la fiche client **en lecture
seule** (L7-10). Aucun : « Aucun ancien client. ».

## Règles

- Tout vient du serveur (`mes_clients`, `mes_anciens_clients`) ; l'écran ne calcule ni badge, ni
  semaine, ni compte.
- **Aucune donnée de santé** (décision 1).
- Un client en pause ou suspendu n'a plus accès à ses séances (L6, décision 2) : il n'est jamais
  « séances non rattrapées » pour les séances de cette période. Il garde le badge que sa
  situation de paiement lui donne, sinon « À jour ».
- Le badge est toujours un texte ; la couleur l'accompagne, ne le remplace pas.

## États

Chargement : squelettes de lignes. Erreur : `EtatErreur` avec « Réessayer ». Aucun client :
« Aucun client pour l'instant. » et « Inviter mes clients » → I-01. Filtre ou recherche sans
résultat : « Aucun client ne correspond. ».

## Ce qui a été inventé ou retiré

- **Retiré** : « vue il y a 2 h » (aucun indicateur de présence, `docs/domaine.md` §5.4) ;
  « relance envoyée hier » (les relances arrivent avec les notifications, L10) ; « bilan à
  planifier » (agenda, L9) ; « Programme seul » (offre supprimée, catalogue à nature unique).
- **Remplacé** : « INACTIVE 12 J » → « {n} séances non rattrapées » ; « PAIEMENT KO » →
  « Paiement en échec » (décision 2, revue).
- **Inventé** : qui figure où, l'ordre, les sous-lignes de pause, de suspension et de
  résiliation, l'écran « Anciens clients » et son entrée, les états vides.

## Critères d'acceptation

1. Un coach voit ses clients avec le badge et la sous-ligne calculés par le serveur ; les
   filtres en donnent les bons nombres ; « À relancer » rend les mêmes clients que « À traiter »
   du pilotage (banc).
2. Un client résilié passe de « Mes clients » à « Anciens clients », et revient s'il se
   réabonne (banc).
3. Un coach ne voit aucun client, actuel ou ancien, d'un autre coach ; un client ne lit pas ces
   listes (banc, deux sens).
4. Chaque badge est prouvé règle par règle, ordre de priorité compris, semaine de repos comprise
   (banc).
5. Galerie et corpus d'accessibilité ; clos dans le navigateur sur la base de dev.
6. `npm run verif` passe.
