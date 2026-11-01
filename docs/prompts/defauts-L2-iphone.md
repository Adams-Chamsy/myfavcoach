# Défauts de L2 trouvés sur iPhone (1er novembre 2026)

Prompt correctif, pas un lot. Trouvés pendant l'essai sur iPhone de la montée du SDK 58
(`docs/prompts/SDK58.md`), tous **antérieurs** à cette montée. Détail et décisions :
`docs/dette.md`, ligne « le coach ne sait pas désigner son propre profil ».

## Ordre, changé le 1er novembre 2026 — décision assumée

Ordre prévu : porte de l'étape SDK 58, puis ce prompt. **Changé** : la partie A (serveur et
chemin de l'application) est faite le soir même, pendant que la porte du SDK 58 attend quatre
points d'essai sur iPhone ; la partie B (retours à l'écran) attend la séance du lendemain.

Raison : la partie A ne dépend d'aucun rendu natif, et sera prête pour la séance. La partie B
touche des écrans : la faire avant la séance mêlerait un correctif d'écran aux quatre points qui
doivent prouver la montée sur le code tel qu'il était.

Ordre du 2 novembre : les quatre points d'essai du SDK 58, la porte du SDK 58, la partie B, la
revalidation du parcours coach de L2 (`docs/dette.md`), puis P4.6b.

## Partie A — le coach désigne son profil par le serveur

```
Règle : docs/backend.md §7, « L'application ne cherche jamais sa propre ligne : elle la demande
au serveur ». CLAUDE.md §8 : le banc emprunte le chemin de l'application.

La fonction existe depuis 0011 : public.mon_profil_coach_id(), security definer, par
auth.uid(), accordée à authenticated, déjà utilisée par les politiques des offres et des pièces.
L'application ne l'a jamais appelée. Aucune migration.

1. src/services/donnees/supabase.ts : les trois écritures qui ont besoin du profil coach
   l'obtiennent par rpc('mon_profil_coach_id'), jamais par une recherche :
   - enregistrerInformations (coach) : UPDATE profils_coach par id, plus par compte_id
     (refusé en 42501 depuis 0008) ;
   - deposerPieceVerification et creerOffreBrouillon : plus de select('id').limit(1) (qui pouvait
     rendre le profil d'un autre coach).
   Rouge d'abord : les tests de l'adaptateur vérifient l'appel à la fonction et le filtre par id.

2. Banc, sur le chemin de l'application, avec la session d'un coach créé par
   creer_profil_coach (le chemin de l'application, pas le rôle serveur) :
   - mon_profil_coach_id() rend le profil de l'appelant, alors qu'une lecture sans filtre en rend
     plusieurs dès qu'un coach vérifié existe ;
   - l'enregistrement du profil, la création d'offre et le dépôt d'une ligne de pièce passent, avec
     le coach_id de l'appelant ;
   - l'ancien chemin (UPDATE … WHERE compte_id) est refusé en 42501 : la raison du changement ;
   - sens illégitime : un compte sans profil coach reçoit null, anon est refusé.
   Ces tests du banc sont verts par construction (la fonction marche depuis 0011) : ils prouvent
   que le chemin de l'application est couvert, pas un correctif serveur. Le dire dans le rapport.
```

## Partie B — retours à l'écran (après la séance du 2 novembre)

Textes et décisions validés : `docs/ecrans/L2-15-creation-offre-coach.md`, « Retours à l'écran ».
Plus : le texte de repli serveur unique (« Ce n'est pas toi. Réessaie dans un instant. ») dans
`docs/ecrans/L0-03-etats-systeme.md`, `src/composants/etats/textes.ts` et
`docs/ecrans/L1-02-creation-compte.md` ; le texte dupliqué de `echec()` ; le bouton « Réessayer »
qui relance vraiment l'envoi sur les trois écrans concernés ; le message d'erreur ramené dans le
champ de vision sur les six écrans relevés (`docs/dette.md`).

## Porte de sortie

1. Partie A : les tests de l'adaptateur ont montré leur rouge nommé avant le correctif ; les
   tests du banc empruntent le chemin de l'application ; `npm run verif` vert ; CI verte.
2. Partie B : textes conformes à la fiche, rouges nommés, `npm run verif` vert, CI verte.
3. Sur appareil ou sur le web : l'étape 2 de l'onboarding coach enregistre, « Mes informations »
   côté coach enregistre, une offre s'enregistre avec son retour visible. (La revalidation complète
   du parcours coach est une étape à part, `docs/dette.md`.)
