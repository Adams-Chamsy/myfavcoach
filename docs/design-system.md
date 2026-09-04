# Système de design — règles d'implémentation

Complète `design/tokens.json`. Ce qui ne peut pas vivre dans un token vit ici.

---

## 1. Corrections par rapport au dossier de design

Ces corrections **l'emportent sur les maquettes**. Reproduire la maquette telle quelle serait
reproduire un défaut mesuré.

| # | Défaut d'origine | Mesure réelle | Correction |
|---|---|---|---|
| 1 | Bouton accent : libellé `#FFF7F3` sur `#E2603C`, annoncé 3,6:1 | **3,32:1** | Remplissage d'action → `marque.accentAction` `#C1471F` = **4,74:1** |
| 2 | `text.muted` `#7C766E` sur crème, annoncé 4,6:1 | **4,24:1** | → `#6F695F` = **5,14:1** |
| 3 | Onglet inactif `#7C766E` sur `#F1EDE6`, annoncé 4,6:1 | **3,85:1** | Onglet inactif utilise `texte.secondaire` `#55605B` = **5,61:1** |
| 4 | Onglet inactif, zone de tap 40 | — | **44 pt**, sans exception |
| 5 | `state.warning` `#B4820F` en texte sur crème | **3,23:1** | Texte d'alerte → `etat.alerteEncre` `#7A5A0C` = **6,02:1** |
| 6 | Thème montre : `text.primary` `#17211E` sur `#000000` | 1,3:1 | Le thème montre hérite du sombre |
| 7 | Deux fichiers de tokens divergents | — | `design/tokens.json`, unique |
| 8 | Mode sombre incomplet (teintes d'état non redéfinies) | — | Complété ; non livré au jalon 1 |
| 9 | « 32 icônes » annoncées, 36 nommées | — | **36**, liste §5 |
| 10 | Liens de navigation des maquettes cassés (`.dc.html` vs `_dc.html`) | — | Corrigés à l'import dans `maquettes/` |
| 11 | Bouton primaire pressé, thème sombre : `marque.primaireTeinte2` `#26594A` sur `marque.primaireAppui` `#3FA487` | **2,63:1** | Pas de couleur de texte dédiée à l'appui : garde `texte.surMarque` = **5,61:1** (sombre), **14,38:1** (clair) — les tokens « Teinte » sont une teinte de fond dans les deux thèmes, jamais une couleur de texte stable |

Les ratios annoncés dans le dossier de handoff sont **systématiquement optimistes de 0,3 à
0,8 point**. Ne jamais les reprendre sans recalcul : `npm run test:a11y` recalcule.

---

## 2. Ce que le contraste seul ne dit pas

- **Aucun statut porté par la seule couleur.** Chaque badge porte son libellé : « À JOUR »,
  « INACTIVE 12 J », « PAIEMENT KO », « NOUVEAU ». Le libellé vient du serveur (`docs/api.md` §10).
- **Focus clavier et lecteur d'écran** : contour 1,5 pt `bordure.focus` + halo 4 pt
  `bordure.focusHalo`. Jamais supprimé, y compris sur les boutons flottants.
- **Zone de tap ≥ 44 pt**, portée par le padding, jamais par la taille du pictogramme. Une icône
  de 24 dans un conteneur de 44 : c'est le conteneur qui est tactile.
- **Libellé de lecteur d'écran obligatoire** sur toute icône seule : retour, plus, filtres,
  raccrocher, notification, réglages.
- **Texte jusqu'à 200 % sans troncature.** Toutes les cartes s'étirent en hauteur, aucune
  hauteur fixe sur un conteneur de texte, aucun `numberOfLines` sur un titre d'écran.
  En pratique : `allowFontScaling` reste actif partout, les hauteurs sont des `minHeight`.
- **Une seule action accent par écran.** Le terre cuite est réservé à l'action créative ou
  urgente. Deux boutons accent visibles simultanément = défaut à corriger.

---

## 3. Typographie

L'échelle est en points logiques et suit la mise à l'échelle système. La conversion :

| Token | Usage |
|---|---|
| `texte.display` 44/46 | Titre d'écran, chiffre clé unique |
| `texte.titre1` 32/36 | Titre d'écran secondaire |
| `texte.titre2` 22/28 | Titre de section, nom sur photo |
| `texte.titre3` 17/24 | Titre de carte |
| `texte.corps` 16/25 | Corps, 38 à 42 caractères par ligne sur téléphone |
| `texte.petit` 14/20 | Métadonnées, listes denses côté coach |
| `texte.label` 12/16 caps, interlettrage 0,12em | Étiquettes de section |
| `texte.legende` 12/16 | Mentions |

Instrument Serif pour l'éditorial et les chiffres clés. Manrope pour tout le reste.
**Les deux polices sont embarquées** (licence SIL Open Font), jamais chargées en ligne : une
police qui arrive en retard fait sauter toute la mise en page.

---

## 4. Grammaire de mouvement

Une seule courbe : `mouvement.courbe`. Le mouvement explique la hiérarchie, il ne décore pas.

| Geste | Durée | Détail |
|---|---|---|
| Entrée de contenu | 320 ms | Translation 14 pt + opacité, décalage 40 ms par carte, **plafonné à 5** |
| Appui | 120 ms | Échelle 0,96 + assombrissement 8 %. Retour haptique léger sur validation |
| Bottom sheet | 380 ms | Depuis le bas, voile 42 % en 200 ms, fermeture au glissement à 25 % de hauteur |
| Progression | 600 ms | **Uniquement quand la valeur change à l'écran**, jamais au montage |

`prefers-reduced-motion` : translations et échelles à zéro, opacités conservées à 150 ms.
Sur React Native, la source est `AccessibilityInfo.isReduceMotionEnabled()`, à lire dans un
seul hook `useMouvementReduit()` — jamais en double.

---

## 5. Iconographie — 36 pictogrammes

Grille 24 × 24, trait 1,75 (2,2 à l'état actif), terminaisons et jonctions arrondies, angles à
2, aucun remplissage sauf l'étoile de notation.

`accueil · recherche · seance · message · agenda · pilotage · carte · clients · profil ·
ajouter · valide · fermer · retour · suivant · deplier · filtres · lecture · pause · vocal ·
visio · raccrocher · notification · favori · note · securite · document · duree · information ·
alerte · modifier · reordonner · virement · hors-ligne · reessayer · reglages · plus`

À extraire de `maquettes/MyFavCoach-Handoff_dc.html` vers `src/composants/icones/`, une par
fichier, exportées par un index typé (`type NomIcone = 'accueil' | …`). **Aucune dépendance à
une librairie d'icônes.** Un pictogramme ne désigne jamais une discipline : le système reste
neutre entre musculation et cybersécurité.

Cinq icônes appartiennent à des fonctionnalités hors jalon 1 (`vocal`, `visio`, `raccrocher`,
`hors-ligne`, plus l'usage montre de `duree`). Les extraire quand même — c'est gratuit et ça
évite un aller-retour.

**Ajouts hors dossier de design.** `oeil` et `oeil-barre` (afficher/masquer un mot de passe,
`docs/ecrans/L1-02-creation-compte.md`) ne viennent pas de `maquettes/MyFavCoach-Handoff_dc.html` :
cet écran n'a aucune référence visuelle. Ajoutés au système d'icônes (pas en tracé isolé dans
l'écran) parce que le contrôle se répète — `docs/prompts/L1.md` P1.9 réutilise explicitement les
composants de L1-02 pour la connexion. 38 pictogrammes au total à partir de ce lot.

---

## 6. Primitives à construire au lot L0

Quatorze, chacune avec ses états défaut / survol-pressé / désactivé / focus.

| Primitive | Points d'attention |
|---|---|
| `Bouton` | 4 variantes : primaire, secondaire, discret, accent. Hauteur 48. L'accent utilise `accentAction` |
| `BoutonIcone` | Conteneur 44 minimum, `accessibilityLabel` **requis par le type** |
| `Champ` | Rayon 14, état focus, message d'erreur sous le champ, jamais en surimpression |
| `Chip` | Filtre, catégorie, version retirable avec croix 16 dans une cible de 44 |
| `Onglets` | Soulignement animé, inactif en `texte.secondaire`, tap 44 |
| `Badge` | Statut avec libellé obligatoire — le composant refuse un badge sans texte |
| `Avatar` | Tailles 24/36/44/56/76, initiales en repli, pastille de rôle optionnelle |
| `Carte` | Rayon 16, ombre 1, s'étire en hauteur |
| `Progression` | Barre et segments. N'anime que sur changement de valeur |
| `BarreNavigation` | Deux variantes : client (crème, 5 entrées), coach (encre, 5 entrées, Créer central) |
| `FeuilleBasse` | 380 ms, voile 42 %, fermeture au glissement, piège de focus |
| `Modale` | Titre, corps, deux actions, action destructrice à droite |
| `EmplacementImage` | **Aucune photo n'est fournie** : repli obligatoire, ratio imposé, jamais de zone vide |
| `Squelette` | Formes finales, jamais de spinner plein écran |

Aucune primitive ne fait d'appel réseau ni ne connaît une entité métier.

---

## 7. Le point bloquant que le design ne résout pas

Le dossier ne fournit **aucune photographie**, alors que la direction artistique repose
dessus : « la photo du coach porte l'émotion, l'interface reste en retrait ». Tant qu'il n'y a
pas de photos réelles :

- `EmplacementImage` affiche un repli typographique (initiales en `texte.surMarque` sur
  `marque.primaire`), jamais un cadre vide ni une image générique. `marque.secondaire` a été
  écarté : trop clair pour un repli visible sur tous les coachs tant qu'aucune photo n'existe.
  Même repli dans `Avatar`, pour la même raison (aucune photo fournie).
- Ces initiales de repli sont toujours en **Manrope grasse, jamais Instrument Serif** : c'est de
  l'information utilitaire (un nom réduit à deux lettres), pas de l'éditorial — la règle du §3
  ci-dessus (« Instrument Serif pour l'éditorial et les chiffres clés ») les exclut justement.
  Accessoirement, Instrument Serif n'a aucune graisse grasse dans la police embarquée : même
  sans cette règle, un repli en gras y serait impossible.
- Les ratios sont figés maintenant, pour que les photos futures n'obligent pas à redessiner :
  **portrait 3:4** pour les cartes de coach, **4:3** pour les vignettes de séance, **plein
  cadre 400 pt de haut** pour l'en-tête du profil coach.
- Un profil coach sans photo reste publiable, mais est **rétrogradé dans le classement**
  (composante « fraîcheur du profil », `docs/domaine.md` §5.6).
