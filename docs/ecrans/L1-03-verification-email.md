# L1-03 · Vérification de l'adresse e-mail

**Lot** L1 · **Rôle** aucun (public) · **Route** `app/(public)/verification.tsx`
**Référence visuelle** **aucune — écran absent du dossier de design, conçu ici**

---

## Raison d'être

Entre « Créer mon compte » et l'onboarding, il y a une boîte de réception. C'est le moment où
l'on perd le plus de monde : l'écran doit dire exactement ce qui se passe, à quelle adresse, et
quoi faire si rien n'arrive.

`docs/domaine.md` §4.1 : un compte reste en `en_attente_verification` jusqu'au clic sur le lien.

---

## Contenu

Icône `document` 62 dans une pastille `marque.secondaire`.

Titre `texte.titre1` : « Regarde tes e-mails. »
Corps : « On a envoyé un lien à **camille@exemple.fr**. Clique dessus et on continue. »
L'adresse est en gras, et c'est le seul élément variable de la phrase.

Deux actions, dans cet ordre :

| Action | Variante | Comportement |
|---|---|---|
| Renvoyer l'e-mail | secondaire | Actif après **60 secondes**, décompte visible en toutes lettres |
| Ce n'est pas la bonne adresse | discret | Retour à L1-02, adresse préremplie, mot de passe conservé |

Encart `marque.secondaire` en bas : « Rien dans ta boîte ? Regarde dans les indésirables.
L'expéditeur est bonjour@myfavcoach.fr. »

**Sous l'encart**, toujours visible : « Tu as peut-être déjà un compte avec cette adresse. » +
action discrète « Se connecter » → L1-04. Voir la règle ci-dessous : cette ligne s'affiche pour
tout le monde, sans condition, donc elle ne révèle rien.

---

## États

| État | Comportement |
|---|---|
| Attente | Décompte de renvoi en cours |
| Renvoyé | Confirmation textuelle « C'est reparti », le décompte redémarre |
| Vérifié | Transition automatique vers l'onboarding, sans que l'écran ait à être réaffiché |
| Erreur | `EtatErreur` en bandeau, l'adresse reste lisible |

---

## Retour dans l'application

Le lien du courriel ouvre l'application par lien profond : `myfavcoach://auth/rappel`.

1. Le lien est **déclaré dans les deux projets** (développement et production) comme adresse de
   redirection autorisée. Un lien non déclaré retombe silencieusement sur l'adresse par défaut
   du service — c'est la panne la plus fréquente de ce parcours, et elle ne produit aucune
   erreur visible.
2. À l'ouverture, la session est établie, puis la redirection suit l'état du compte :
   onboarding non terminé → L1-05 ; onboarding terminé → espace du profil actif.
3. Si l'application est fermée, le lien la démarre et la destination est la même. Le lien profond
   est traité **après** le chargement des polices et du thème, jamais avant.
4. Un lien expiré ou déjà utilisé affiche « Ce lien a expiré » avec l'action « M'en renvoyer un ».

---

## Règles

- **La ligne « Se connecter » est inconditionnelle** — trou de conception rattrapé après coup.
  L'anti-énumération de comptes (`docs/ecrans/L1-02`) est correcte et ne bouge pas : une
  réinscription avec une adresse **déjà confirmée** renvoie une réponse de succès obfusquée et
  n'envoie **aucun** courriel (il n'y a rien à confirmer). L'utilisateur atterrit alors sur cet
  écran à attendre un courriel qui n'arrivera jamais, sans moyen de le savoir — et le serveur
  ne peut pas le lui dire sans rouvrir la faille. La seule aide possible est une porte de sortie
  affichée pour **tous** : puisqu'elle ne dépend d'aucun état de compte, elle ne distingue rien.
- L'écran **n'interroge pas le serveur en boucle**. Il attend le lien profond, ou un retour au
  premier plan : à ce moment-là, une seule vérification d'état.
- Le décompte de renvoi est côté application pour le confort ; la limite réelle est côté
  service. Un renvoi refusé par le service affiche « Attends une minute avant de réessayer »,
  jamais un code technique.
- La purge des comptes non vérifiés à 30 jours (`docs/domaine.md` §4.1) **n'est pas
  implémentée à ce lot** : elle demande une tâche planifiée côté base. Inscrite dans
  `docs/dette.md`, échéance lot L11.

---

## Critères d'acceptation

1. Le décompte de 60 secondes s'écoule et libère le bouton — testé avec des minuteurs simulés,
   la simulation étant remise à zéro explicitement à la fin du test, sans compter sur une
   restauration globale.
2. Le lien profond ouvre l'application et établit la session, application fermée comme ouverte —
   deux essais manuels sur appareil, notés dans le journal du lot.
3. Un lien expiré affiche le message dédié et propose un renvoi.
4. L'adresse affichée est bien celle saisie, y compris après retour arrière et correction.
5. Aucun appel réseau répété : un test compte les appels sur 30 secondes d'écran ouvert, le
   compte attendu est zéro.
6. Le lecteur d'écran annonce le titre à l'arrivée, et le changement d'état au renvoi.
7. La ligne « Se connecter » est présente dans **tous** les états de l'écran (attente, renvoyé,
   lien expiré, erreur) et mène à L1-04 — testé.
8. Surfaces nouvelles dans la galerie, **exercées en clair et en sombre**.
9. `npm run verif` passe.
