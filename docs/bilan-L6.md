# Porte de sortie de L6 — passée le 17 novembre 2026

Passée par Claude, sous le mandat du 15 novembre 2026 (`docs/decisions-en-attente.md`). Le plan
du lot est `docs/prompts/L6.md` ; tout ce qui a été décidé seul est écrit dans
`docs/decisions-en-attente.md`.

**L6 est clos dans le navigateur, sur la base de dev, avant toute ouverture de L7**, comme
`docs/perimetre.md` l'exige (« arrêt obligatoire » : L6 pose des données de santé, L7 les calcule).
Si un défaut de L7 devient difficile à situer, cette clôture est la référence : captures dans
`myfavcoach-captures/L6-studio/` et `myfavcoach-captures/L6-seance-du-jour/`.

État du dépôt à la clôture : `npm run verif` vert de bout en bout (926 tests applicatifs, 3 tests
d'accessibilité, 391 tests au banc, 99 tests des fonctions serveur, bundles web, iOS et Android,
six routes du vrai serveur) ; la CI verte sur `main`, dont le rejeu de toutes les migrations de
zéro, jusqu'à 0087.

**Ce que cette porte ne couvre pas.** Rien n'a été vu sur un téléphone (`docs/seance-iphone.md`,
section L6). **Le questionnaire santé (05a) n'est pas construit** (décision 1 de
`docs/prompts/L6.md`). Le ressenti d'effort avec consentement n'est prouvé qu'au banc et en test
d'écran.

---

## Les sept commits du lot

| Commit | Étape |
|---|---|
| `eb21ed2` | P6.1 — le plan, les fiches, le questionnaire santé reporté |
| `951db47` | P6.2 — programmes, séances, exercices (0080, 0081) |
| `a3e017e` | P6.3 — médias, dossier privé (0082, 0083) |
| `adf8cbe` | P6.4 — affectation et accès du client (0084, 0085) |
| `b0f05e7` | P6.5 — exécution, tâche du matin (0086, 0087) |
| `49f9dae` | P6.6 — le studio |
| `f659234` | P6.7 — la séance du jour et sa carte d'accueil |

---

## Porte de sortie de L6 (dix points)

| # | Point | Constat |
|---|---|---|
| 1 | Écarts fiches / code | Les deux fiches sont closes dans le navigateur par le chemin de l'application. La clôture a trouvé **cinq défauts**, tous corrigés avant commit avec un test rouge puis vert : deux écrans restés dessous qui ne relisaient pas (studio, accueil), une durée perdue après un titre tapé, des écritures qui pouvaient arriver dans le désordre, une icône de menu prise pour « ajouter ». Écarts voulus et écrits : thème clair au lieu du fond sombre de 05, chronomètre de repos écarté, « Importer », « Blocs réutilisables » et « Aperçu client » de 11 écartés. |
| 2 | Aucune table de L6 accessible directement | Programmes, séances, exercices, médias, séances programmées, séries : aucun droit pour l'application ; tout passe par des fonctions. Banc : « aucune des trois tables n'est accessible directement » (vert dès le décor : garde-fou). |
| 3 | Un coach ne voit rien d'un autre, dans les deux sens | Banc : un autre coach lit `programme_introuvable` ou `seance_introuvable`, ne dépose pas dans le dossier d'un autre, ne signe pas son URL, n'enregistre ni ne joint ce qui n'est pas à lui ; le coach, lui, lit et écrit tout ce qui est à lui. |
| 4 | Un client ne lit que ses séances, et seulement avec accès | Banc : la cliente lit sa séance du jour, ses exercices et l'URL signée de leur média ; un autre compte, rien ; en pause, plus rien, et tout revient à la reprise. Navigateur : l'URL signée ouverte par la démo répond 200 pour la cliente. |
| 5 | La machine §4.5, transition par transition | Banc : démarrage, double démarrage refusé, saisie, fin, fin répétée refusée, pas avant le jour, manquée au matin, rattrapage dans 7 jours, refus au-delà, partielle après 24 h. |
| 6 | §4.6 | Banc : publication sans séance ou sans vérification refusée ; publié non modifiable ; retour en édition refusé avec un abonné en cours ; archivage. |
| 7 | Données de santé | Le ressenti d'effort : refusé sans consentement (banc), jamais dans une adresse ni un journal, gardé dans l'état de l'écran le temps de l'envoi. Aucune donnée médicale collectée (05a non construit). Répétitions et charges ne sont pas des données de santé (décision 7). |
| 8 | Migrations rejouables | CI verte jusqu'à 0087. |
| 9 | Rien hors périmètre | Ni mode sombre, ni visio, ni photo corporelle, ni hors-ligne. Aucune dépendance nouvelle (`expo-document-picker` existait). |
| 10 | Dettes échues | Ci-dessous. |

### Les dettes échues à cette porte (point 10)

| Dette | Constat |
|---|---|
| Preuve contre Stripe Connect (reportée de L5) | **Reportée de nouveau**, à la porte de L7 : la clé du dev n'a toujours pas accès aux comptes connectés ; seul le développeur peut la régler. |
| Bloc « Répondre aux questions santé » de 04c (attendait 05a) | **Reportée avec 05a** (décision 1 de L6) : à réintroduire quand 05a existe, avant L12. |
| Jeu de démonstration, part de L6 | **Soldée pour L6** : la séance du jour de la galerie et des tests vient de `seancesDemonstration`. Les programmes « par modules » de la maquette d'accueil restent descriptifs (aucun écran de L6 ne les montre). |
| Supabase Pro | Toujours pas fait (une dépense) : avant la première séance iPhone. |

**Porte close**, avec deux reports écrits (preuve Stripe, 05a et le bloc de 04c). **L7 peut
s'ouvrir.** Reste sur appareil : `docs/seance-iphone.md`, section L6.
