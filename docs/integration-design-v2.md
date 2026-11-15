# Intégration de la direction visuelle V2

L’intégration porte la direction validée dans les composants React Native réels. Elle ne
copie pas le JavaScript du prototype HTML : les fournisseurs de session et de données,
les actions, les consentements et les états d’abonnement existants restent la référence.

## Règles visuelles

- Crème et vert forêt, avec une surface vert profond pour l’accueil et les revenus de mise en route.
- Instrument Serif pour les titres et les prix clés ; Manrope pour les contenus et les actions.
- Boutons à rayon court, champs blancs, cartes délimitées sans ombre systématique.
- Navigation claire commune ; l’action Créer reste distincte d’un onglet.
- La navigation coach reste une surface claire fixe, fond et texte pairés sous les deux
  valeurs de thème de la galerie. Elle remplace l’ancienne barre sombre de L0.
- Les onglets internes sont soulignés. Les contrôles gardent leurs rôles, états, libellés,
  tailles tactiles et réglages de réduction des animations.
- Les titres et les accroches de découverte ne sont plus tronqués.

## Adaptation aux supports

Les conteneurs communs conservent les zones sûres de chaque écran. Sur web large, les
formulaires ont une largeur de lecture limitée, la navigation passe en haut et l’accueil
présente une grille. Il ne s’agit pas d’ajouter une version tablette native hors périmètre.

Le profil présente la photo réelle quand elle existe, le titre, la bio, les offres, les
avis et le parcours réels. La bio n’est pas arbitrairement découpée en une cible marketing :
le port ne fournit pas de champ « Pour qui ». Aucun texte propre à Yannick n’est affiché
pour un autre coach.

## Images et périmètre

Les portraits fictifs du prototype ne sont pas importés dans l’application. Les URL de photo
réelles continuent d’être utilisées ; les initiales restent le repli en leur absence.
Les routes provisoires le restent. Aucun avis, indicateur d’activité, document légal,
paiement ou contenu futur n’est créé pour remplir une mise en page.

## Source et validation

Les valeurs sont dans `design/tokens.json`, puis régénérées par `npm run tokens`. Les fichiers
de `src/theme/` ne sont jamais corrigés manuellement. La copie temporaire de présentation a disparu. Les modifications ont été reconstituées
le 15 novembre 2026 à partir des commandes conservées dans l’historique local ; les
maquettes historiques du dépôt sont intactes.

Les contrôles appropriés sont la vérification TypeScript, le lint, les tests de composants,
les parcours existants et le corpus d’accessibilité. La commande `npm run verif` doit réussir avant tout commit. Aucun déploiement ni
paiement réel ne fait partie de cette intégration. Un contrôle sur iOS/Android réel reste nécessaire pour le clavier,
les gestes système et les zones sûres physiques.

## Vérification du 15 novembre 2026

`npm run verif` réussit avec l’accès réseau au projet Supabase de développement :

- Génération des tokens, lint, formatage et TypeScript : réussis.
- Jest : 118 suites et 786 tests réussis.
- Accessibilité : 1 suite et 3 tests réussis.
- Banc Supabase : 1 suite et 304 tests réussis.
- Fonctions serveur : vérification des types, lint et 52 tests réussis.
- Bundles web, iOS et Android : construits et contrôlés.
- Serveur Expo : les six routes contrôlées répondent correctement, dont `/_galerie`.

La migration `0062_detail_abonnement_coach_et_offre.sql` figure dans les exceptions
explicites du contrôle des secrets : elle nomme le rôle serveur uniquement pour lui
retirer le droit d’exécution de `detail_abonnement`, selon la convention de `0031`.

Une sauvegarde avant intégration et le patch de récupération sont conservés dans
`.expo/recuperation-v2-20261115.zip`, ignoré par Git. La sauvegarde est archivée pour
éviter que Jest ne découvre les anciennes copies de tests.
