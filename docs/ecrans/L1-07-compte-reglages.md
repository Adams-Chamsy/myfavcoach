# L1-07 · Mon compte et réglages

**Lot** L1 · **Rôle** les deux · **Route** `app/(client)/moi.tsx` et `app/(coach)/moi.tsx`
**Référence visuelle** `maquettes/MyFavCoach-Parcours_dc.html`,
`data-screen-label="24 Mon compte"` — **sans le bloc abonnements**

---

## Raison d'être

Le point fixe du produit : qui je suis, comment j'en sors, comment je passe dans l'autre espace.
La maquette y ajoute les abonnements ; ils viendront au lot L4, quand il y aura quelque chose à
abonner.

---

## Contenu

**En-tête** : avatar 56 (repli initiales), prénom + nom en `texte.titre1`, adresse e-mail en
`texte.petit` `texte.secondaire`. L'avatar est tactile : il ouvre la feuille de bascule (L1-06).

**Liste de réglages**, `Carte` à séparateurs `bordure.discrete`, chaque ligne : icône 20,
libellé `texte.corps`, chevron `suivant`.

| Ligne | Destination | Lot |
|---|---|---|
| Mes informations | L1-09 | L1 |
| Adresse e-mail et mot de passe | L1-09, section identifiants | L1 |
| Confidentialité | L1-09, section consentement | L1 |

**Bloc encre** `fond.inverse`, rayon `carte` : titre `texte.titre3` en `texte.surSombre`,
sous-titre, et action. Presser le bloc **ouvre la feuille de bascule (L1-06)** — au même titre
que l'avatar, jamais une bascule directe ni un aiguillage direct vers L1-08. Deux raisons : la
bascule est un changement d'espace, elle mérite le même geste depuis les deux entrées ; et
quand le profil coach n'existe pas, la feuille est le seul endroit qui montre les deux espaces
côte à côte — un bloc qui sauterait tout droit vers « Devenir coach » ne le montrerait jamais.
Le titre et le sous-titre du bloc sont un aperçu du contenu de la feuille, pas une action
propre :

- Profil coach existant → aperçu « Passer en espace coach » · « Tes clients et tes revenus »
- Profil coach absent → aperçu « Devenir coach » · « Publie tes offres, fixe tes prix »

**Déconnexion** : ligne seule, libellé centré en `etat.erreur`, `texte.titre3`. Confirmation par
`Modale` : « Se déconnecter ? · Il faudra te reconnecter avec ton mot de passe. » Actions
« Annuler » et « Se déconnecter » (destructrice, à droite).

En pied, `texte.legende` `texte.attenue` : la version de l'application et le numéro de build.
C'est ce que le support demandera un jour.

---

## Ce qui n'est PAS sur cet écran au lot L1

Et qui ne doit pas y figurer, même désactivé, même en « à venir » :

| Absent | Lot |
|---|---|
| Les deux cartes d'abonnement, la pause, la résiliation | L4 |
| Notifications | L10 |
| Aide, documents contractuels, factures | L11 |
| Supprimer mon compte | L11 |
| Choix du thème | jamais au jalon 1 — le clair est forcé |

**Règle** : une ligne qui n'ouvre rien ne s'affiche pas. Un réglage grisé « bientôt disponible »
est une promesse que personne n'a demandée et que le produit devra tenir.

---

## États

| État | Comportement |
|---|---|
| Chargement | Squelettes aux formes finales : bloc d'en-tête, trois lignes, bloc encre |
| Normal | Données du compte et du profil actif |
| Erreur | `EtatErreur` en bandeau au-dessus, la liste reste utilisable, la déconnexion **toujours** possible |
| Hors ligne | Hors périmètre du jalon 1 |

---

## Règles

- L'écran existe **dans les deux espaces**, avec la même route relative `moi`. Le contenu de
  l'en-tête change de profil, la liste ne change pas.
- La déconnexion appelle `port.deconnecter()` (`src/services/auth/port.ts`) — jamais un
  "trousseau" : ce mécanisme (une seconde mémoire de session locale, née au lot L0) a été
  supprimé en préparant P1.8, remplacé par le stockage chiffré du client Supabase lui-même,
  seule mémoire de session du dépôt (`src/services/supabase/stockage-securise.ts`, voir
  `docs/api.md` §2). `port.deconnecter()` vide cette mémoire ET l'état en mémoire vive, et
  renvoie sur L1-01. Elle réussit **même hors ligne** : une déconnexion qui échoue parce que le
  réseau manque est un défaut de sécurité, pas une gêne — déjà garanti par le port
  (`{ scope: 'local' }`, vérifié contre un vrai compte à P1.10, voir `docs/dette.md`), cet écran
  n'a rien de plus à faire pour ça que d'appeler `port.deconnecter()` normalement.
- Aucun identifiant technique visible : ni identifiant de compte, ni jeton, ni identifiant de
  projet.
- Le nom affiché vient du profil actif, jamais d'un cache local.

---

## Critères d'acceptation

1. L'écran s'ouvre dans les deux espaces et affiche le bon profil.
2. Les trois lignes de réglages ouvrent réellement leur destination — aucune ligne inerte.
3. Le bloc encre affiche « Devenir coach » sans profil coach, « Passer en espace coach » avec ;
   le presser dans les deux cas ouvre la feuille de bascule (L1-06), jamais une bascule
   directe ni une navigation directe vers L1-08.
4. La déconnexion demande confirmation, puis ramène sur L1-01 ; une nouvelle ouverture de
   l'application n'y retrouve aucune session.
5. **Déconnexion en mode avion** : elle aboutit quand même, et aucune donnée du compte ne reste
   lisible.
6. L'avatar ouvre la feuille de bascule, avec une cible ≥ 44 pt et un libellé accessible
   (« Camille Dupré, changer d'espace »).
7. L'action de déconnexion est annoncée comme destructrice au lecteur d'écran.
8. À 200 %, les libellés passent sur deux lignes, les lignes de liste s'étirent, rien n'est
   tronqué.
9. Un test vérifie qu'aucune chaîne des lots L4, L10 ou L11 (« abonnement », « notification »,
   « supprimer mon compte ») n'apparaît dans le rendu.
10. L'écran est dans la galerie, **exercé en clair et en sombre**.
11. `npm run verif` passe.
