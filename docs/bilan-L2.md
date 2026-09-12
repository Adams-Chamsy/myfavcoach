# Bilan du lot L2 — profil coach, offres, vérification

Clos le 12 septembre 2026. `npm run verif` vert de bout en bout, les deux workflows CI
(`Vérification`, `Banc RLS`) verts sur la branche `main`. Ce document fixe l'état à la clôture ;
il ne se met pas à jour au fil de L3 — `docs/dette.md` reste la seule source vivante des dettes.

---

## Ce qui est livré

### Profil coach public, offres

- **L2-05/06/07** — Parcours « Devenir coach », étapes 2 à 4 : profil public (titre court, bio),
  dépôt des trois pièces obligatoires (identité, diplôme/certification, assurance RC pro) via
  URL signée à usage unique et `expo-document-picker` (images/PDF, 10 Mo), écran de clôture.
- **L2-09/L2-11** — `app/(coach)/pilotage.tsx` bifurque entièrement entre l'écran d'attente de
  vérification (quatre statuts) et le premier lancement (checklist à trois items, compteur
  dynamique), selon `statut_verification`. Échéance 48 h ouvrées calculée (calendrier simplifié,
  voir Dette).
- **L2-10** — Back-office (`app/(admin)/`) : file d'attente, décision motivée (vérifier /
  demander un complément / refuser), consultation des pièces par le compte examinateur réel,
  jamais la clef de service à privilège maximal — prouvé dans les deux sens au banc. Absent du bundle de production
  mobile, sur les trois plateformes (web, iOS, Android).
- **L2-12/13/14** — Profil coach public à trois onglets (Offres/Avis/Parcours), lecture
  publique (`anon` compris) : une seule offre affichée si publiée par un coach vérifié, jamais
  un brouillon ni une offre retirée. **L2-13 (Avis) livré comme placeholder statique
  uniquement — voir Dette, ce n'est pas l'écran de la fiche.**
- **L2-15** — Création et publication d'offre côté coach : brouillon possible sans coach
  vérifié, publication refusée sans engagement humain (`engagement_humain_requis`) ou coach non
  vérifié (`coach_non_verifie`), retrait sans suppression de ligne.

### Conformité (C-03, C-04, C-06, C-07 — remontées de L11 à L2 le 12 septembre)

- **L2-01** — Suppression de compte : confirmation par saisie exacte de « SUPPRIMER », jamais
  une case à cocher. Pose `comptes.supprime_le` ; ne purge rien elle-même (voir Dette).
- **L2-02** — Second interrupteur « Nouveautés et conseils » sur l'écran Confidentialité
  (renommé « Mes autorisations »), retrait immédiat sans modale, historique des décisions en
  lecture seule sur le journal `consentements`.
- **L2-03** — Deux surfaces distinctes : lecteur public sans session (CGU, CGV,
  confidentialité, contrat coach) et liste authentifiée avec bandeau « Une version a changé ».
  A fermé une dette ouverte depuis L1 : les liens CGU/confidentialité de l'écran de bienvenue et
  de l'inscription, morts depuis leur création, ouvrent désormais ce lecteur.
- **L2-04** — Export de données : trois états (aucun / en préparation / prêt), un export par
  mois maximum imposé côté serveur. **La transition vers « prêt » n'a aucun mécanisme réel — voir
  Dette.**

### Sécurité et outillage, propres à ce lot

- `scripts/verifier-bundle-production.mjs` construit et scanne les bundles de production des
  **trois** plateformes (`expo export -p all`) — pas seulement le web.
- Garde mécanique sur `.env` (`chmod 444`, `npm run env:proteger`) après un incident
  d'écrasement par un sous-agent ; interdiction explicite ajoutée à `CLAUDE.md` §4.
- `scripts/reproduire-conditions-ci.sh` (`npm run reproduire:ci`) : reproduit les conditions du
  runner CI sur un clone jetable, à la demande.
- `docs/prompts/L2.md` : règle de conduite n°9, « un refus doit venir du mécanisme qu'on
  teste » — à reprendre dans `docs/prompts/L3.md`.

---

## Ce qui est en dette

Liste complète et à jour : `docs/dette.md`. Ce qui suit résume ce qui a été **créé pendant ce
lot**, par thème — pas une reformulation, un index.

| Thème | Ce qui manque | Bloquant avant publication ? |
|---|---|---|
| **L2-13 (Avis)** | Écran du lot non livré, pas une simplification. Aucune table `avis` n'existe. Échéance à décider avec le porteur du projet | Oui — c'est un écran du périmètre |
| **Purge à J+30** | Aucune tâche planifiée ne purge un compte `supprime` (ni pour la suppression volontaire de L2-01, ni pour l'inscription jamais vérifiée de L1) | Oui |
| **Générateur d'export** | `demandes_export` ne transitionne jamais réellement vers « prêt » — aucune fonction distante ne rassemble les données ni ne dépose de fichier | Oui (obligation légale de portabilité) |
| **Back-office derrière une route serveur** | `app/(admin)/` lit encore une clé `EXPO_PUBLIC_*` côté client (distincte de la clé mobile, absence du bundle prouvée sur les trois plateformes) — pas la même garantie qu'une clé qui ne quitte jamais un serveur | Oui, avant mise en production |
| **`VERSION_CGU_ACCEPTEE` en double** | Neutralisé par un test de synchronisation, pas résolu à la racine | Non — surveillé |
| **CGV sous la colonne CGU** | À valider par un juriste : acceptation conjointe CGU/CGV sous une seule version, pas un raccourci technique déguisé | Oui, avant publication |
| **`AppState` absent (L2-09)** | Le retour au premier plan ne redéclenche aucune lecture — un coach ne voit une décision qu'en rouvrant l'écran | Non, mais réel |
| **`comptes.motif_suppression`** | Colonne écrite mais absente de `docs/domaine.md` §3.1 | Non |
| **Calendrier 48 h ouvrées simplifié** | Ni jours fériés ni heures de bureau | Non |
| **Sélecteur de fichier (L2-06)** | Jamais essayé sur un vrai appareil ni un vrai navigateur | Non — vérification manuelle en attente de matériel |
| **« Premier lancement » par proxy (L2-11)** | Détecté par « aucune offre publiée », pas par « aucun abonné actif » (`Abonnement` n'existe pas encore) | Non |

---

## Comptes de tests par famille

| Famille | Commande | Avant L2 (fin L1) | Après L2 |
|---|---|---|---|
| Tests unitaires et d'écran | `npm test` | — | **535 tests, 88 suites** |
| Accessibilité (galerie + coquilles, deux thèmes) | `npm run test:a11y` | — | **2 tests** (un par thème), balayant l'intégralité de la galerie et du corpus de coquilles |
| Banc RLS (contre le vrai projet Supabase) | `npm run test:rls` | 42 tests | **91 tests** (+49) |
| Bundle de production | `npm run verif:bundle` | web seul, jamais exécuté en continu | **3 plateformes** (web, iOS, Android), scannées séparément |

Le banc RLS est la mesure la plus significative du lot : L2 introduit la première lecture
inter-comptes du produit (`docs/prompts/L2.md`, « Ce que ce lot change dans le modèle de
sécurité ») — chaque politique d'ouverture est couverte dans les deux sens (accès légitime qui
rend la donnée, accès illégitime qui ne rend rien), y compris la relation imbriquée
`pieces_verification`/`profils_coach`, trouvée manquante à la revue de fin de lot et fermée
avant la clôture (`docs/prompts/L2.md`, règle 9).

---

## Ce que L3 hérite

- `docs/prompts/L2.md`, règles de conduite 1 à 9 — la neuvième à recopier explicitement en tête
  de `docs/prompts/L3.md`, comme L2.md l'a fait pour les quatre premières.
- `docs/dette.md` sans aucune ligne touchant à l'isolation des comptes ou aux pièces d'identité
  (critère de sortie explicite du lot, vérifié à la clôture).
- `scripts/reproduire-conditions-ci.sh`, à utiliser dès qu'un doute apparaît entre un `npm run
  verif` local vert et un résultat CI qui ne l'est pas — avant de deviner, reproduire.
