# L1-01 · Accueil visiteur et présentation

Révision validée le 15 novembre 2026 : préparation externe V2 et GO utilisateur.
Routes `app/(public)/index.tsx` et `app/(public)/presentation.tsx` ; corps partagé
`src/fonctionnalites/accueil/ecran-bienvenue.tsx`.

## But et contenu

Donner envie de découvrir un accompagnement humain avant de créer un compte. Les photos
locales montrent un effort sportif accessible et incluent un adulte d’environ 55 ans.
Elles ne représentent pas les coachs du catalogue et ne limitent pas ses disciplines.

Accueil : logo officiel, « Se connecter », titre « Un vrai coach. Pour avancer. », puis
« Reprendre le sport, gagner en confiance, aller plus loin : trouve le coach qui te correspond. »
Action principale « Découvrir les coachs » vers la vraie recherche publique `/decouvrir`.
« Comment ça marche ? » ouvre `/presentation`. « Créer mon compte », « Je suis coach »,
CGU et Confidentialité gardent leurs destinations réelles ; la porte coach conserve `viaCoach=1`.
L’acceptation des documents reste à l’inscription. Les anciennes actions Apple factices de
bienvenue ne sont plus présentées comme une connexion utilisable.

## Trois étapes manuelles

| Étape | Titre | Texte |
|---|---|---|
| 1 | Trouve ton coach. | Explore les profils selon ton objectif, ton rythme et ton budget. |
| 2 | Compare les offres. | Regarde le prix, ce qui est inclus et l’engagement humain du coach. |
| 3 | Choisis ton accompagnement. | Crée ton compte quand tu es prêt, puis choisis l’offre qui te correspond. |

« Suivant », retour, points actionnables, balayage horizontal et « Passer ». Annonce
« Étape n sur 3 ». Aucun défilement automatique ou compte créé en fin de présentation.
La sortie vers la découverte remplace la présentation, sans trois étapes dans l’historique.

## États et critères

1. Aucun appel réseau au montage de l’accueil et du carrousel ; images et polices embarquées.
2. Image en échec : repli typographique « Un vrai coach. Pour avancer. », jamais de zone vide.
3. Police en échec : repli système existant ; session valide : garde existante et reprise
   du profil demandé après onboarding éventuel, selon la fiche L1-01a.
4. Toutes les actions sont réelles, les cibles font au moins 44 points et les titres se mettent à la ligne.
5. À texte agrandi, les actions restent atteignables par défilement ; pas de police réduite
   pour forcer l’écran dans une capture. Les visages sont préservés par les cadrages retenus.
6. Mobile : photo puis texte. Web large : deux colonnes ; aucune version tablette native ajoutée.
7. Texte sur fond uni, couleurs cohérentes sous les deux thèmes de la galerie.
8. Bienvenue, présentation et découverte entrent dans la galerie et le corpus d’accessibilité.
9. `npm run verif` passe. Géométrie, lecteurs d’écran et zones sûres restent à éprouver sur appareil.
