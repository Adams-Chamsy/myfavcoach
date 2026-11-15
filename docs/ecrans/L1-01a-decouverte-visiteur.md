# L1-01a · Découverte sans compte et reprise après connexion

GO utilisateur du 15 novembre 2026. Route `app/(public)/decouvrir.tsx` ; composant partagé
avec la recherche client, sans dupliquer les requêtes ni les filtres.

Accueil → recherche publique → profil → offres publiées → connexion si nécessaire →
onboarding éventuel → même profil. La personne choisit ensuite volontairement son offre.
Aucun paiement ni abonnement ne démarre automatiquement à la reprise.

La recherche montre les données publiques du port existant. Elle n’ouvre pas les onglets
privés et ne modifie pas les politiques de données, les disciplines ou le classement.
Les exceptions d’accès restent nommées, sans ouvrir le groupe client entier.

## Contexte et erreurs

La liste reste montée derrière le profil ; le retour réutilise les résultats et les filtres.
La reprise après connexion retrouve le profil existant au lieu d’en empiler un second.
La destination est uniquement un UUID de coach, jamais une URL libre. Elle expire après
une heure et s’efface au profil atteint, à l’annulation, à une nouvelle découverte explicite
ou au changement de compte constaté. Aucun jeton, paiement ou contenu d’onboarding n’est copié.
Sur web, la destination est limitée à l’onglet ; sur mobile, le stockage sécurisé existant
permet la reprise après un lien d’e-mail. Un échec de stockage ne bloque pas le geste courant.

Un client non terminé suit d’abord l’onboarding ; un espace coach actif reste dans son espace.
Un échec réseau affiche l’erreur existante et « Réessayer », en conservant les filtres.
Le vide n’affiche pas de faux résultats ; un profil disparu propose une sortie vers la découverte.
Les offres sont relues après connexion et le tunnel garde ses validations serveur.

## Critères

1. Recherche et profils sont lisibles sans compte avec les vrais composants de lecture.
2. Un test de pile traverse recherche → profil → connexion → même profil → retour liste.
3. Le retour seul ne relit pas la liste et les autres écrans privés restent protégés.
4. Destinations externes, mal formées, périmées ou futures rejetées.
5. Onboarding respecté, profils et offres relus, aucun achat automatique.
6. Annulation, erreur, absence de résultat et retour sans historique ont une sortie utilisable.

Le profil découvert depuis la recherche publique utilise `/profil/{id}` dans le même Stack
public ; la route historique `/coach/{id}` reste compatible pour l’espace client. Les deux
routes partagent le même corps. Le Stack public reste monté pendant les redirections pour
préserver la liste, ses filtres et son historique derrière la connexion.

Le retour arrière depuis la connexion vers le profil public annule aussi l’intention de
reprise. Un client connecté dont l’onboarding n’est pas terminé est ramené à ce parcours
avant le tunnel ; un coach actif reçoit une sortie explicite vers son espace pour basculer
volontairement, sans changement de profil silencieux.
