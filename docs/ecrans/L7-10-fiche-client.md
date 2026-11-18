# L7-10 · Fiche client (10)

**Lot** L7 · **Rôle** coach · **Route** `app/(coach)/client/[clientId].tsx` (écran poussé depuis
la liste clients, les anciens clients et le pilotage ; `clientId` = l'identifiant du profil
client, jamais une donnée de santé)
**Référence visuelle** `maquettes/MyFavCoach-Coach_dc.html`, `data-screen-label="10 Fiche
client"`. **Deux retraits, dont un de principe, lus en « Ce qui a été inventé ou retiré ».**

Fiche écrite par Claude le 18 novembre 2026, sous le mandat du 15 novembre, **revue par le
développeur le même jour**. Plan et décisions : `docs/prompts/L7.md` (décisions 1, 2 et 6).

---

## Raison d'être

Tout ce dont le coach a besoin pour suivre un client : s'il s'entraîne, ce qu'il a fait, ce
qu'il lui a écrit après ses séances, et ses propres notes.

## Contenu, de haut en bas — client actuel

Retour en haut à gauche, au-dessus de tous les états.

1. **En-tête** — « {Prénom Nom} » ; « {titre de l'offre} · client depuis {mois année} » ; le
   badge (libellé du serveur) et « {prix} €/mois » ; « Dernière séance le {date} » (ou « Aucune
   séance faite »), en information de contexte, sans couleur d'alerte.
2. **Deux tuiles** — « Assiduité » (`{n} %` sur 28 jours, ses séances seules ; sinon « — » et
   « Pas encore assez de séances ») et « Séances » (faites chez ce coach depuis le début).
3. **Huit semaines** — « Séances par semaine », **la même construction que sur le suivi client**
   (L7-06) : faites et prévues, « {faites}/{prévues} » au-dessus de chaque barre ; ses séances
   seules ; un seul libellé pour le lecteur d'écran.
4. **Programme** — « {titre du programme} · semaine {k} sur {n} », qui ouvre le programme dans
   le studio (`app/(coach)/studio/[programmeId].tsx`) ; sans programme en cours : « Aucun
   programme en cours. » et « Affecter un programme » → le studio.
5. **Historique** — les séances passées, la plus récente d'abord, quinze au plus : « {titre} ·
   {jour} · {durée} min » et le statut en texte (« Faite », « Faite (rattrapée) », « Partielle »,
   « Non réalisée ») ; dessous, en citation, **le commentaire que le client a laissé pour cette
   séance** (« Un mot pour {prénom} ? », L6-05), s'il y en a un.
6. **Notes privées** — un champ de texte multiligne (2 000 caractères au plus), pré-rempli ;
   « Enregistrer », inactif tant que rien n'a changé ; sous le titre : « Visibles uniquement par
   toi dans l'application. ». Succès : « Notes enregistrées. ».

## Ancien client — lecture seule

Ouverte depuis « Anciens clients » (L7-09). En-tête : « {Prénom Nom} », « {titre de l'offre} ·
du {date de début} au {date de fin} », sans badge ni prix. Puis la tuile « Séances » et
l'historique des séances **réalisées chez ce coach** (statuts « Faite », « Faite (rattrapée) »,
« Partielle »). Ni assiduité, ni huit semaines, ni programme, ni écriture.

**En attente du développeur** (`docs/decisions-en-attente.md`) : les notes privées et les
commentaires de séance sont-ils visibles dans cette lecture seule, et pendant combien de temps
l'historique d'un ancien client reste-t-il consultable ? **En attendant, ni notes ni
commentaires, et aucune durée n'est codée** : la question doit être tranchée avant la porte de
L7.

## Règles

- Tout vient du serveur (`fiche_client`, `enregistrer_notes_client`). Refus `client_introuvable`
  (ni client actuel ni ancien client de ce coach) : « Ce client n'est pas dans ta liste. ». Une
  écriture de notes sur un ancien client est refusée par le serveur.
- **Aucune donnée de santé** (décision 1) : ni poids, ni tour de taille, ni ressenti d'effort,
  même si le client a donné son consentement santé, et **même agrégés**. Ce consentement couvre
  l'enregistrement pour sa progression, pas un partage avec son coach.
- Les notes privées ne sont lues que par ce coach : ni le client, ni un autre coach du même
  client. Quitter avec des notes non enregistrées : la `Modale` de L1-09 (« Tu as des
  modifications non enregistrées. »).
- Les notes ne sont ni journalisées ni envoyées à un rapport d'erreur : un coach peut y écrire
  une information de santé que son client lui a confiée. Elles ne sont pas dans l'export
  automatique ; une demande de droit d'accès qui les concerne est traitée à la main (décision en
  attente).

## États

Chargement : squelettes. Erreur de lecture : `EtatErreur` avec « Réessayer ». Erreur
d'enregistrement des notes : `EtatErreur` en bandeau, texte conservé.

## Ce qui a été inventé ou retiré

- **Retiré, par principe** : la tuile « Poids −2,6 kg » et le « RPE 7 » de l'historique
  (décision 1, validé à la revue). Réversible si un consentement de partage est conçu avec le
  juriste.
- **Remplacé** : « Ajuster le programme » → la ligne « Programme » qui ouvre le studio ; ajuster
  pour un seul client n'existe pas (un programme publié ne se modifie pas, L6-11).
- **Inventé** : « Dernière séance le {date} », le commentaire de fin de séance dans l'historique,
  la lecture seule d'un ancien client, la limite de quinze séances et de 2 000 caractères, tous
  les textes d'état.

## Critères d'acceptation

1. Un coach ouvre la fiche d'un de ses clients et voit son assiduité, ses huit semaines
   (faites et prévues) et son historique, égaux au calcul du serveur.
2. **Aucune lecture du coach ne rend de poids, de tour de taille ni de ressenti**, même pour un
   client qui a consenti et en a saisi (banc, prouvé sur les fonctions et sur les tables).
3. Un coach ne lit pas la fiche ni n'écrit les notes du client d'un autre coach ; un client ne
   lit pas les notes à son sujet ; un coach n'écrit pas les notes d'un ancien client (banc, deux
   sens).
4. La fiche d'un ancien client s'ouvre en lecture seule, sans notes ni commentaires.
5. Le retour reste atteignable dans tous les états (test).
6. Galerie et corpus d'accessibilité ; clos dans le navigateur sur la base de dev.
7. `npm run verif` passe.
