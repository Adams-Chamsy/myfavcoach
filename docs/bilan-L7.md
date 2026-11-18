# Bilan provisoire de L7 — Suivi et pilotage

La porte de sortie de L7 reste ouverte.

| Étape | Livrable | Commit |
| --- | --- | --- |
| P7.1 | Spécification du suivi, du pilotage et des fiches clients | `a9fad01` |
| P7.2 | Mesures corporelles sous consentement | `2a72083` |
| P7.3a | Calcul du suivi et prise en compte des pauses | `f3641ce` |
| P7.3b | Pilotage, clients actuels et anciens, fiches et notes | `f3d646f` |
| P7.4 | Progression et mesures dans l'onglet Séance | `85c3a92` |
| P7.5 | Écrans coach et retouches L6 | `b1b66fd` |

## Galerie de développement

La route `/_galerie` présente six aperçus L7 avec des données de démonstration :
progression, pilotage, clients actuels, anciens clients, fiche actuelle et fiche
en lecture seule.

## Vérification automatisée

`npm run verif` passe : 947 tests applicatifs, 3 contrôles d'accessibilité,
460 tests d'accès sur Supabase dev et 99 tests des fonctions serveur. Les bundles
Web, iOS et Android ainsi que les routes du serveur Expo de développement sont vérifiés.

## Conditions de clôture

- **Export des données.** La migration 0096 prépare le JSON et supprime le fichier
  expiré. L'écran Export donne accès au téléchargement pendant sept jours. Restent
  le déploiement en dev, la recette de bout en bout et le courriel prévu par
  [la fiche d'export](ecrans/L2-04-export-donnees.md).
- **Notes privées.** Valider le périmètre de l'export et le traitement des
  demandes d'accès aux notes.
- **Anciens clients.** Valider la durée de conservation et la visibilité des
  notes et commentaires après la fin de la relation. La fiche reste en lecture
  seule et masque provisoirement ces éléments.
- **Recette sur appareil.** Vérifier les parcours client et coach sur iOS et
  Android, dont la navigation et la lecture d'écran.

Les arbitrages ouverts figurent dans [les décisions en attente](decisions-en-attente.md).

## Mise en service de l'export

Déployer la migration 0096 et la fonction `telecharger-export`. Sur le projet de
recette, renseigner dans Vault `url_telechargement_export` avec l'URL HTTPS de
cette fonction (`/functions/v1/telecharger-export`, sans paramètres). Les demandes
en attente sont alors préparées par lots de dix par le job `preparer-exports`.
Le job `purger-exports` supprime chaque minute les fichiers expirés ou liés à un
compte marqué supprimé. Le lien devient inutilisable dès l'expiration.

Vérifier en recette avec des comptes fictifs : demande, quota, isolation des
demandes, passage à « Prêt », téléchargement, retrait du consentement et purge.
Le JSON contient le profil, les autorisations, les données de suivi du client et
ses éléments de paiement, ainsi que les commissions et versements du coach
concerné. Les mesures et le ressenti sont inclus sous consentement. Le retrait
du consentement ou l'effacement des mesures révoque une copie déjà prête.
