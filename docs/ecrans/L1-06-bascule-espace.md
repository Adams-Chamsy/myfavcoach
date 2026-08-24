# L1-06 · Bascule d'espace client ↔ coach

**Lot** L1 · **Rôle** les deux · **Composant** `src/fonctionnalites/identite/feuille-bascule.tsx`
**Référence visuelle** `maquettes/MyFavCoach-Etats_dc.html`,
`data-screen-label="17 Bascule client coach"`

---

## Raison d'être

Un compte, deux espaces, un seul geste. C'est la décision d'architecture du produit rendue
visible : pas d'onglet gaspillé, pas de seconde application, pas de déconnexion-reconnexion.

Le changement de fond de la barre de navigation (crème ↔ encre) est **le signal principal**. Il
a été posé au lot L0 ; ce lot le déclenche.

---

## Ouverture

Deux points d'entrée, et deux seulement :

1. L'**avatar** de l'en-tête d'accueil (écran 01, client) ou de pilotage (écran 08, coach) — au
   lot L1 ces écrans sont encore provisoires, l'avatar y est ajouté.
2. Le **bloc encre** de l'écran compte (L1-07).

Feuille basse par-dessus l'écran atténué à 50 %, primitive `FeuilleBasse` du lot L0 :
380 ms, voile 42 %, fermeture au glissement à 25 %.

---

## Contenu

| Zone | Détail |
|---|---|
| Poignée | Barre 36 × 4, `bordure.marquee` |
| Identité | Avatar 56, prénom + nom en `texte.titre3`, adresse e-mail en `texte.petit` `texte.secondaire` |
| Espace client | Icône `profil`, libellé « Espace client », sous-titre « Tes coachs et tes séances » |
| Espace coach | Icône `pilotage`, libellé « Espace coach », sous-titre « Tes clients et tes revenus » |
| Marque d'état | Coche `valide` `marque.primaire` sur l'espace **actif** |
| Compteur d'attente | Pastille `marque.accent` avec le nombre, sur l'espace **inactif** |
| Lien de pied | « Réglages du compte », icône `reglages` |

**Si le profil coach n'existe pas**, la deuxième ligne devient : « Devenir coach » avec le
sous-titre « Publier tes offres et être payé », et mène à L1-08. Elle n'est jamais grisée.

---

## États

| État | Comportement |
|---|---|
| Normal | Deux lignes, l'une cochée |
| Bascule en cours | La ligne appuyée passe en attente, la feuille reste ouverte, rien d'autre n'est tactile |
| Erreur | La feuille reste ouverte, `EtatErreur` en bandeau interne, l'espace ne change pas |
| Compteur à zéro | La pastille **n'est pas rendue**. Jamais de « 0 » |

---

## Règles

- **Le profil actif est une valeur du serveur, pas de l'application.** La bascule appelle une
  fonction du serveur qui vérifie que le profil demandé existe et appartient au compte, met à
  jour la valeur, et rend le nouvel état. L'application n'écrit jamais ce champ elle-même et ne
  décide jamais d'un droit à partir de lui.
- Le champ `profilActif` de l'application ne sert qu'à **choisir la branche de navigation et la
  palette**. Toute donnée reste protégée par les politiques du serveur, y compris si quelqu'un
  force la valeur locale.
- La bascule ne referme pas la session et ne recharge pas l'application : elle change de groupe
  de routes. L'arbre de navigation de l'espace quitté est réinitialisé, pas conservé — sinon un
  retour arrière ramènerait dans l'autre espace.
- Au lot L1, `attentes.coach` vaut toujours 0 : il n'y a ni message ni demande. Le compteur est
  câblé sur le champ du serveur dès maintenant, et il ne s'affichera qu'au lot L8.
- La feuille piège le focus : le lecteur d'écran n'atteint pas l'écran atténué derrière.
- Après bascule, le lecteur d'écran annonce le nouvel espace.

---

## Critères d'acceptation

1. Depuis l'espace client, la bascule ouvre l'espace coach avec la barre encre ; l'inverse
   fonctionne aussi. Deux tests de routage, **hors du dossier `app/`** (un fichier de test dans
   `app/` deviendrait une route).
2. Sans profil coach, la deuxième ligne mène à L1-08 et **aucune bascule n'est tentée**.
3. Un test contre la base réelle prouve qu'une demande de bascule vers un profil inexistant est
   refusée par le serveur, avec un message exploitable.
4. Un test contre la base réelle prouve qu'un compte **A** ne peut pas basculer vers le profil
   d'un compte **B**, même en fournissant son identifiant.
5. Après bascule, le retour arrière matériel Android ne ramène pas dans l'espace précédent.
6. Le compteur d'attente n'est pas rendu quand il vaut 0 — testé en cherchant l'absence du
   nœud, pas la présence d'un texte vide.
7. Quand la feuille est ouverte, le contenu derrière est marqué inaccessible.
8. En mouvement réduit, la feuille apparaît en fondu sans translation.
9. La feuille est dans la galerie, **exercée en clair et en sombre**, dans ses deux variantes
   (avec et sans profil coach).
10. `npm run verif` passe.
