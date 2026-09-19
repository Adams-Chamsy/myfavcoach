# L1-01 · Bienvenue / inscription

**Lot** L1 · **Rôle** aucun (public) · **Route** `app/(public)/index.tsx`
**Référence visuelle** `maquettes/MyFavCoach-Parcours_dc.html`, `data-screen-label="21 Bienvenue"`

---

## Raison d'être

Le premier écran qu'un inconnu voit. Il ne vend pas la marketplace, il propose deux gestes :
entrer, ou publier. Tout le reste est en dessous du pli.

Il remplace l'écran provisoire `(public)/accueil` posé au lot L0.

---

## Contenu

Photo plein cadre en fond, dégradé du bas vers l'encre pour porter le texte.

| Élément | Détail |
|---|---|
| Fond | `EmplacementImage` ratio `pleinCadre`. **Aucune photo n'existe** : repli typographique obligatoire, jamais de cadre vide |
| Dégradé | de `transparent` à `fond.inverse`, sur les 55 % inférieurs |
| Titre | « Un meilleur toi, chaque jour. », en haut d'écran, `texte.display`, `texte.surSombre` |
| Trait | sable (`marque.ruban`), sous le titre — voir « Ce qui a été inventé » |
| Symbole de marque | 88 px, au-dessus des actions — symbole seul, jamais le verrouillage complet (assets/marque/README.md, « Écran 21 ») |
| Action 1 | « Continuer avec Apple », bouton secondaire sur fond clair, icône Apple |
| Action 2 | « Continuer par e-mail », bouton à contour clair |
| Ligne de retour | « J'ai déjà un compte · Se connecter » — **ajout, voir Règles** |
| Mention légale | `texte.legende`, deux liens : conditions d'utilisation, confidentialité |
| Porte coach | « Je suis coach, je veux publier », lien 15/700 en `sombre.marque.primaire` |

**Tokens sombres.** L'écran est une île sombre dans un thème clair, comme la barre coach du lot
L0 : son contenu utilise les valeurs du thème `sombre`. C'est le deuxième et dernier endroit du
jalon 1 où c'est autorisé.

---

## États

| État | Comportement |
|---|---|
| Normal | Les deux actions actives |
| Chargement | Uniquement après un appui : le bouton concerné passe en attente, l'autre se désactive |
| Erreur | Bandeau `EtatErreur` au-dessus des actions, le contenu reste visible |
| Apple indisponible | Le bouton Apple n'est pas rendu du tout (Android, ou capacité absente) — jamais grisé |

---

## Règles

- **La ligne « J'ai déjà un compte » est un ajout au dossier de design.** La maquette n'offre
  aucun chemin de retour à un utilisateur existant qui s'est déconnecté : c'est un oubli, pas
  une intention. Elle est discrète, sous les deux actions.
- « Continuer avec Apple » et « Continuer par e-mail » mènent au **même compte** : un compte
  créé par Apple puis reconnecté par e-mail sur la même adresse est le même compte.
- La porte coach ne crée pas un compte différent. Elle mémorise une intention (`viaCoach`) qui
  déclenchera l'écran L1-08 après la création du compte. Un compte reste **un compte, deux
  profils optionnels**.
- Les liens de la mention légale ouvrent une vue web sur les documents publiés. Tant que les
  textes ne sont pas rédigés (lot L2, C-06), ils pointent vers une **version de développement
  datée**, et c'est la **version acceptée qui est enregistrée** avec le compte. Le texte peut
  changer, la trace de ce qui a été accepté ne se rattrape pas.
- Aucune valeur en dur : le titre utilise `display` (44 pt), jamais une taille écrite à la main.
- Cet écran ne fait **aucun appel réseau au montage**.

### Ce qui a été inventé

Révision du 19 septembre 2026 (planche de marque, splash clair et écran de lancement) :
l'ancienne accroche (« Le bon coach, pas le plus bruyant ») disparaît, remplacée par ce titre et
le trait sable. Ni la maquette HTML (`maquettes/MyFavCoach-Parcours_dc.html`, « 21 Bienvenue »,
toujours la référence pour la disposition générale — photo, dégradé, actions), ni
`assets/marque/README.md` ne décrivent la position exacte du titre en haut d'écran ni les
dimensions du trait sable dessous : les deux sont dessinés à la main (`app/(public)/index.tsx`),
dans l'esprit de la planche de marque fournie séparément, pas tracés depuis une source exacte.

---

## Critères d'acceptation

1. Sans session, le démarrage arrive sur cet écran (remplace l'écran provisoire de L0).
2. Avec une session valide, cet écran est inatteignable : la garde de routage redirige vers
   l'espace du profil actif.
3. Sur Android, le bouton Apple est absent de l'arbre rendu — testé par une requête qui ne
   trouve rien, pas par une capture d'écran.
4. Le repli de `EmplacementImage` s'affiche : aucun aplat vide, aucune image générique.
5. Tous les couples texte/fond de l'écran atteignent 4,5:1 **mesurés sur le dégradé au point le
   plus clair**, pas sur l'encre pleine.
6. Le lien coach et la ligne « J'ai déjà un compte » ont chacun une cible ≥ 44 pt.
7. À 200 % de taille de police, le titre n'est jamais tronqué ; les actions restent visibles
   sans défilement.
8. L'écran est présent dans la galerie L0-00, exercé **en clair et en sombre**.
9. `npm run verif` passe.

**En attente de build de développement** (même file que les six critères visuels de L0) :
le parcours « Continuer avec Apple » de bout en bout, non testable dans Expo Go.
