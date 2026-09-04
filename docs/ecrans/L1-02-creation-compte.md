# L1-02 · Création de compte par e-mail

**Lot** L1 · **Rôle** aucun (public) · **Route** `app/(public)/inscription.tsx`
**Référence visuelle** **aucune — écran absent du dossier de design, conçu ici**

---

## Raison d'être

Le dossier de design dessine la porte (écran 21) et ce qu'il y a derrière (écran 22), mais pas
le formulaire. Il faut pourtant une adresse, un mot de passe et une date de naissance : sans
date de naissance, la règle des 18 ans (`docs/domaine.md` §0.27) n'existe que sur le papier.

---

## Contenu

En-tête : bouton retour, fil d'étapes **1/4 masqué** — l'inscription n'est pas une étape de
l'onboarding, elle le précède.

Titre `texte.titre1` : « On commence par ton compte. »

Trois champs, dans cet ordre :

| Champ | Type | Règles de saisie |
|---|---|---|
| Adresse e-mail | `Champ`, clavier e-mail, sans majuscule automatique, sans correction | Format vérifié à la sortie du champ, jamais pendant la frappe |
| Mot de passe | `Champ` masqué, bouton œil dans une cible de 44 | **10 caractères minimum, 72 maximum**, aucune règle de composition |
| Date de naissance | Sélecteur de date natif, jamais trois champs texte | Le sélecteur s'OUVRE sur l'année en cours moins 25 ans — c'est un point de départ pour naviguer, jamais une valeur pré-saisie. Le champ reste vide (aucune date affichée, un texte invite à choisir) tant que la personne n'a pas confirmé un choix par un geste explicite ; le bouton de pied de page en tient compte comme d'un champ vide |

Sous le mot de passe : un indicateur de longueur atteinte, textuel (« 10 caractères minimum
· 7 sur 10 »), jamais une jauge colorée seule.

Sous les champs : la mention d'acceptation, `texte.legende`, avec les deux liens légaux et la
phrase « En créant ton compte, tu acceptes… ». **Pas de case à cocher** : l'acceptation est
portée par le geste de création, et enregistrée avec sa version.

Pied fixe : bouton primaire « Créer mon compte ».

---

## États

| État | Comportement |
|---|---|
| Normal | Bouton actif dès que les trois champs sont remplis, jamais avant — pour la date, « rempli » veut dire confirmée par un geste explicite, jamais seulement une valeur par défaut présente en mémoire |
| Chargement | Bouton en attente, champs en lecture seule, retour toujours possible |
| Erreur de champ | Message **sous le champ concerné**, en `etat.erreurEncre`, le focus y retourne |
| Erreur globale | `EtatErreur` en bandeau au-dessus du titre, la saisie est conservée |

---

## Messages d'erreur — les seuls autorisés

| Cause | Message |
|---|---|
| Format d'adresse | Cette adresse ne ressemble pas à une adresse e-mail. |
| Mot de passe trop court | Il faut au moins 10 caractères. |
| Mot de passe trop long | 72 caractères au maximum. |
| Moins de 18 ans | My fav Coach est réservé aux majeurs. |
| Réseau | Pas de connexion. Ta saisie est gardée, réessaie. |
| Serveur | On a un souci de notre côté. Ce n'est pas toi. |

Aucun autre. Si une situation nouvelle apparaît, elle s'ajoute à ce tableau avant d'apparaître
à l'écran.

---

## Règles

- **Aucune énumération de comptes.** Une adresse déjà inscrite produit exactement la même
  réponse qu'une adresse nouvelle : passage à l'écran L1-03. C'est le comportement par défaut
  du service d'authentification, il ne doit pas être « amélioré » par un message plus utile.
- **La règle des 18 ans est contrôlée deux fois** : dans l'écran pour le confort, et dans la
  base par un déclencheur. Le contrôle applicatif est une politesse, celui de la base est la
  règle. Un test doit prouver que la base refuse, l'écran désactivé ou non.
- La date de naissance n'est **pas modifiable** ensuite depuis l'application (voir L1-09).
- Le mot de passe n'est jamais journalisé, jamais placé dans un état global, jamais conservé
  après l'appel.
- Aucune vérification de force de mot de passe côté application au-delà de la longueur : les
  règles de composition font choisir de plus mauvais mots de passe.
- **La borne de 72 caractères est une limite dure de bcrypt**, l'algorithme de hachage du
  service d'authentification (`docs/domaine.md` §3.1). Elle est contrôlée dans l'écran pour
  produire un message en français plutôt qu'un refus du service. Ce n'est pas un choix
  d'ergonomie : au-delà, les caractères supplémentaires sont ignorés silencieusement, ce qui
  est pire qu'un refus.
- L'écran ne connaît pas le service d'authentification : il appelle le port
  `src/services/auth/port.ts`.

---

## Critères d'acceptation

1. Une date de naissance à 17 ans et 364 jours est refusée ; à 18 ans exactement, acceptée.
   Deux tests, aux bornes.
2. Un test **contre la base réelle** prouve que l'insertion d'un compte mineur échoue, même en
   contournant l'écran.
3. Un mot de passe de 73 caractères est refusé par l'écran avec le message dédié, jamais
   transmis au service ni tronqué en silence.
4. Une adresse déjà utilisée mène au même écran suivant, avec le même texte, que si elle était
   nouvelle — testé en comparant les deux rendus.
5. Le message d'erreur d'un champ est relié au champ pour le lecteur d'écran et lui rend le
   focus.
6. Le bouton reste inactif tant qu'un des trois champs est vide, et l'inactivité est visible
   autrement que par la couleur.
7. À 200 %, les trois champs et le bouton restent atteignables par défilement, le pied reste
   fixe.
8. Aucune trace du mot de passe dans la sortie de journalisation en développement — testé par
   interception de `console`.
9. Les surfaces nouvelles sont dans la galerie, **exercées en clair et en sombre**.
10. `npm run verif` passe.
