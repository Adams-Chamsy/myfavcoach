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

Le triptyque du prototype est utilisé uniquement comme image d’ambiance dans les panneaux
éditoriaux des formulaires. Il ne représente jamais un coach du catalogue. Pour les profils
et les résultats de recherche, les URL réelles restent utilisées ; les initiales restent
le repli en leur absence.
Les routes provisoires le restent. Aucun avis, indicateur d’activité, document légal,
paiement ou contenu futur n’est créé pour remplir une mise en page.

## Source et validation

Les valeurs sont dans `design/tokens.json`, puis régénérées par `npm run tokens`. Les fichiers
de `src/theme/` ne sont jamais corrigés manuellement. La référence complète V2 a été
retrouvée le 16 novembre 2026 dans l’historique local, puis restaurée dans
`/private/tmp/myfavcoach-reference-v2-recuperee-20261116/`. Elle comprend la découverte,
le tunnel d’abonnement, le catalogue complet des pages et les finitions communes.
Une archive avec manifeste SHA-256 est conservée dans
`.expo/reference-visuelle-v2-20261116.zip` du dépôt principal, ignorée par Git.
Les maquettes historiques du dépôt sont intactes.

La nouvelle page de bienvenue, son carrousel sportif et l’ouverture du logo suivent
la préparation validée dans `/private/tmp/myfavcoach-preparation-accueil-v2-20261115/`.
Le seuil responsive des pages V2 est de 700 pixels sur web ; la bienvenue utilise
son propre seuil de 740 pixels, comme sa référence.

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

## Conformité V2 en cours — 16 novembre 2026

Le travail se fait dans une branche isolée fondée sur `4dc883c`, après les derniers
changements serveur de L4. Les mesures et captures se trouvent dans
`/private/tmp/myfavcoach-conformite-visuelle-20261115/` ; les captures de référence
complètes ont été restaurées avant de poursuivre les formulaires et le tunnel.

La conformité totale n’est pas encore déclarée. Les mesures web ne prouvent pas le rendu
natif au pixel près. Les différences suivantes doivent rester explicites :

- Les données du catalogue, les prix, les reçus et les dates viennent des ports réels.
- Les annotations « maquette », les fausses pièces et les simulations restent hors produit.
- Les contrôles tactiles gardent au moins 44 points, même lorsqu’un contrôle du HTML
  de référence est plus petit.
- Les champs futurs et les pages hors périmètre ne deviennent pas des fonctionnalités fictives.
- Les états de paiement suivent le constat serveur ; aucun succès n’est déduit de la fermeture
  du navigateur ou du seul moyen de paiement choisi.

La première vérification complète du 16 novembre a passé le lint et TypeScript, puis
rencontré cinq échecs dans une même suite : les tests d’accueil attendaient encore
l’ancien salut. Après adaptation du sélecteur au texte V2, les quatre suites ciblées
(accueil, recherche, retour au catalogue, accessibilité) passent, soit 17 tests.
Les étapes suivantes de cette première vérification complète n’ont pas tourné.
Une nouvelle vérification complète est nécessaire avant tout commit.

L’étape d’identité place maintenant prénom et nom côte à côte. Le champ « Commune » du
prototype n’est pas ajouté artificiellement à cette étape : la création du profil actuelle
accepte seulement prénom et nom. La commune réelle reste modifiable dans « Mes informations ».
Reproduire ce champ à l’entrée demanderait une évolution du contrat de création du profil,
avec ses vérifications serveur, au-delà d’un déplacement de contrôles visuels.

La galerie isolée rétablit le chrome des onglets (barre supérieure sur bureau, navigation
inférieure sur mobile), normalement fourni par les layouts du routeur. Les captures de ces
écrans ne doivent plus être évaluées comme si leur navigation était absente.

Un premier contrôle complet a réussi : 128 suites, 871 tests applicatifs, 3 contrôles
d’accessibilité, 331 tests Supabase et 76 tests de fonctions serveur. Les trois bundles
et les six routes du serveur ont été vérifiés. Les ajustements effectués ensuite imposent
une dernière exécution avant commit ; ce premier résultat n’est pas une preuve du rendu final.

La première série complète de 56 captures mobiles ne présente ni débordement horizontal
ni exception JavaScript. Une nouvelle série est lancée après les derniers ajustements
de l’onboarding, des filtres et du tunnel. Le simulateur iOS n’est pas disponible sur cette
machine (`xcrun` ne trouve pas `simctl`) ; les bundles natifs ne remplacent pas un contrôle
visuel sur appareil.

## Vérification finale du lot — 16 novembre 2026

Après les ajustements de l’onboarding, des filtres bureau et du tunnel :

- `npm run verif` : code de sortie 0.
- Tokens, ESLint, Prettier et TypeScript : réussis.
- Jest : 128 suites et 872 tests réussis.
- Accessibilité : 1 suite et 3 contrôles réussis.
- Banc Supabase : 1 suite et 331 tests réussis.
- Fonctions serveur : types, lint et 76 tests réussis.
- Bundles web, iOS et Android : construits et contrôlés.
- Serveur Expo : six routes contrôlées avec succès.

La nouvelle série mobile couvre 56 écrans à 390 × 844, sans débordement horizontal
ni exception JavaScript. Les résultats sont dans
`galerie-controle-20261116-390.json`. La série bureau est contrôlée séparément ; ses
délais d’automatisation ne sont pas interprétés comme une conformité visuelle.

Le test du compte attend maintenant le rendu asynchrone avant ses assertions. Les tests
visuels dont le texte change suivent les titres V2 ; les assertions sur les montants, les
écritures, les refus et les sorties de navigation sont conservées. Un test supplémentaire
vérifie que le choix d’une discipline transmet sa clé réelle au port de recherche.

La branche V2 reste isolée du dépôt principal, où le lot L5 a repris. Les fichiers serveur
en cours de modification dans ce dépôt ne sont pas inclus dans le lot visuel.
