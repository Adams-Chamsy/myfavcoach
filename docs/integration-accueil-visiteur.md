# Accueil visiteur et signature de marque — 15 novembre 2026

La bienvenue permet désormais de découvrir les coachs avant de créer un compte. Le lien
« Comment ça marche ? » ouvre trois étapes facultatives, illustrées par des photos sportives
locales : trouver un coach, comparer les offres, choisir son accompagnement.

## Comportement livré

- Accueil responsive, photos sportives inclusives, connexion, inscription, porte coach et documents.
- Recherche publique `/decouvrir`, avec les mêmes requêtes et filtres que l’onglet client.
- Profil public `/profil/{id}`, partageant son corps avec la route client historique.
- Reprise du même profil après connexion et onboarding éventuel ; résultats de recherche
  conservés derrière la pile publique, sans second profil ni paiement automatique.
- Retour limité à un UUID public, expirant après une heure, effacé après consommation,
  annulation ou changement de compte ; aucun jeton ou contenu de santé dans ce stockage.
- Erreurs de lecture interceptées, filtres conservés et réessai ; offres relues au changement de session.
- Signature de lancement : ruban sable, symbole officiel, nom. Environ 2,2 secondes à la première
  découverte, 600 ms aux suivantes, 150 ms sans mouvement décoratif si le réglage système le demande.
- Splash configuré en vert profond avec symbole clair. Les interfaces se préparent en parallèle ;
  la signature ne décide pas du routage et ne se rejoue pas au simple retour d’arrière-plan.

Aucune dépendance ni règle de données serveur ajoutée. Les visuels d’ambiance ne deviennent
pas des profils du catalogue et les autres disciplines restent accessibles.

## Vérification

`npm run verif` a réussi sur la branche isolée, avec la version Node 22.13.0 déjà installée :

- 127 suites et 860 tests applicatifs réussis.
- Corpus d’accessibilité : 3 tests réussis, incluant les nouvelles routes.
- Banc Supabase de développement : 304 tests réussis.
- Fonctions serveur : types, lint et 52 tests réussis.
- Bundles web, iOS et Android construits et contrôlés.
- Six routes du vrai serveur Expo vérifiées.

Un contrôle Chrome du vrai rendu a validé 15 points : ressources, largeurs 320/390/1440 px,
carrousel, catalogue et profil publics, demande de connexion, annulation par retour navigateur,
nettoyage de la reprise, réessai réseau et absence d’exception JavaScript. Les captures restent
hors du dépôt dans le dossier utilisateur `myfavcoach-captures/accueil-visiteur-20261115`.

Les tests de tunnel conservent leurs assertions de navigation ; leur préparation crée
explicitement le profil client terminé désormais requis. Un cas négatif vérifie qu’une
session sans ce profil repasse par le routage d’onboarding.

## Limite native et séparation du travail en cours

Le simulateur iOS n’est pas disponible sur cette machine (`simctl` absent). Les transitions
du splash natif, zones sûres physiques, fluidité et lecteurs d’écran sur iPhone/Android
restent à éprouver sur appareil ; cette validation est inscrite dans `docs/dette.md`.
La configuration du splash requiert une construction native pour être visible hors Expo Go.

L’intégration est partie de `fb544fe`. Le travail P4.11 non commité sur la publication des
offres reste séparé et n’est ni terminé, ni déclaré validé par ces résultats. Ses neuf fichiers
ont été sauvegardés et comparés avant le report de cette intégration sur le dépôt principal.
