# L6-11 · Studio de contenu (11)

**Lot** L6 · **Rôle** coach · **Routes** `app/(coach)/studio/index.tsx` (mes programmes),
`app/(coach)/studio/[programmeId].tsx` (un programme), `app/(coach)/studio/seance/[seanceId].tsx`
(une séance et ses exercices), `app/(coach)/studio/bibliotheque.tsx` (mes médias)
**Référence visuelle** `maquettes/MyFavCoach-Coach_dc.html`, `data-screen-label="11 Studio"`.

Fiche écrite par Claude le 17 novembre 2026, sous le mandat du 15 novembre
(`docs/decisions-en-attente.md`) : **tout ce qui n'est pas dans la maquette est à relire**. Plan
et décisions : `docs/prompts/L6.md`.

---

## Raison d'être

Le coach construit ce qu'il vend : un programme de plusieurs semaines, ses séances, leurs
exercices, et il l'affecte à ses abonnés. Sans le studio, l'onglet « Séance du jour » du client
n'a rien à montrer.

## Entrées

- Feuille « Créer » → « Nouveau programme » : crée un brouillon sans titre et ouvre le
  programme.
- Feuille « Créer » → « Nouvelle séance » : ouvre « Mes programmes » (une séance s'ajoute dans un
  programme), avec la phrase « Une séance s'ajoute dans un programme. Choisis-le. ».

## Mes programmes

En-tête « Studio », lien « Bibliothèque ». Une ligne par programme : titre (« Sans titre » s'il
est vide), « {n} semaines · {m} séances », statut en toutes lettres (« Brouillon », « Publié »,
« Archivé »). Vide : « Aucun programme pour l'instant. » et le bouton « Nouveau programme ».

## Un programme

Contenu, de haut en bas (maquette) :

1. Titre du programme et durée en semaines, modifiables en brouillon (champ « Titre », sélecteur
   « Durée » de 1 à 12 semaines) ; le statut en badge (« BROUILLON », « PUBLIÉ », « ARCHIVÉ »).
2. Résumé : « {n} séances · {m} abonnés en cours ».
3. Les semaines : « Semaine 1 », « Semaine 2 »… Sous chacune, ses séances : jour de la semaine
   abrégé (« Lun »…« Dim »), titre, « {n} exercices ». Un appui ouvre la séance. « Ajouter une
   séance » sous chaque semaine (brouillon seulement), « Dupliquer » sur chaque semaine qui a des
   séances (copie ses séances dans la semaine suivante, brouillon seulement).
4. Pied : selon le statut —
   - brouillon : « Publier » (bouton principal) ;
   - publié : « Affecter à un abonné » (principal), « Revenir en édition », « Archiver » ;
   - archivé : rien.

Les refus du serveur (`identite_non_verifiee`, `programme_vide`, `retour_edition_interdit`)
s'affichent avec leur titre et leur détail, comme ailleurs.

## Une séance

Champs « Titre », « Durée (minutes) », sélecteur « Jour » (de la semaine, dans la semaine de la
séance). Liste des exercices dans l'ordre : nom, « {séries} × {répétitions} » et la charge en kg
quand elles existent, la consigne, le média joint (« Vidéo », « Image », « PDF »). « Ajouter un
exercice » ouvre un formulaire : « Nom », « Séries », « Répétitions », « Charge (kg) »,
« Consigne », « Média » (choisi dans la bibliothèque). Monter, descendre, supprimer un exercice.
Tout est en lecture seule hors brouillon. « Supprimer la séance », avec confirmation.

## Bibliothèque

La liste des médias du coach (nom du fichier, type, poids) ; « Ajouter un média » ouvre le
sélecteur de fichiers du téléphone (images JPEG ou PNG, vidéos MP4, PDF ; 50 Mo au plus).
Refus : « Ce fichier est trop lourd (50 Mo au plus). », « Ce type de fichier n'est pas accepté. ».

## Affecter à un abonné

Une feuille : la liste des abonnés qui ont accès (`docs/prompts/L6.md`, décision 2), prénom et
nom complet (prénom et initiale jusqu'à la revue de L7 du 18 novembre 2026, décision 7 de
`docs/prompts/L7.md`, livré en P7.5) ; une date de début (aujourd'hui par défaut, sélecteur de date) ; « Affecter ».
Succès : « Programme affecté. Ses séances apparaissent dans son application. ». Refus
`programme_deja_en_cours` : son texte. Aucun abonné : « Aucun abonné ne peut recevoir ce
programme pour l'instant. ».

## Règles

- Tout vient du serveur et s'écrit par lui ; l'écran ne calcule ni dates ni statuts.
- Publier exige un coach vérifié et au moins une séance (§4.6).
- Un programme publié ou archivé ne se modifie pas ; revenir en édition est refusé tant qu'un
  abonné a une séance à venir de ce programme.
- Un média n'est lisible que par une URL signée ; jamais d'adresse publique.

## États

Chargement : squelette. Erreur de lecture : `EtatErreur` avec « Réessayer ». Envoi en cours :
boutons désactivés, « Envoi en cours… ».

## Ce qui a été inventé pour cette fiche

Tout ce qui n'est pas dans la maquette 11 : les quatre routes, les textes de vide et de refus,
« Dupliquer » qui copie dans la semaine suivante, le formulaire d'exercice, la feuille
d'affectation. Écartés de la maquette : « Importer », « Blocs réutilisables », « Aperçu client »
(`docs/prompts/L6.md`, décision 9).

## Critères d'acceptation

1. Un coach crée un programme, lui ajoute une séance et un exercice avec un média, le publie, et
   l'affecte à un abonné : l'abonné voit la séance le jour prévu.
2. Un programme publié ne se modifie pas ; revenir en édition est refusé avec un abonné en cours.
3. Un coach ne voit, ne modifie et ne lit les médias d'aucun autre coach (banc, deux sens).
4. Galerie et corpus d'accessibilité, deux thèmes ; clos dans le navigateur sur la base de dev.
5. `npm run verif` passe.
