# L7-06 · Suivi chiffré (06)

**Lot** L7 · **Rôle** client · **Route** l'onglet « Séance » du client
(`app/(client)/(tabs)/seance.tsx`), sous la séance du jour ; une feuille « Ajouter une mesure ».
**Référence visuelle** `maquettes/MyFavCoach-Client_dc.html`, `data-screen-label="06 Suivi"`.
**Quatre écarts à la maquette, lus en « Ce qui a été inventé ou retiré ».**

Fiche écrite par Claude le 18 novembre 2026, sous le mandat du 15 novembre, **revue par le
développeur le même jour** (`docs/decisions-en-attente.md`, revue de P7.1). Plan et décisions :
`docs/prompts/L7.md` (décisions 3 et 5).

---

## Raison d'être

Montrer au client qu'il avance : ce qu'il a fait (séances, assiduité, semaines) et, s'il l'a
accepté, ce que ses mesures disent. C'est sa motivation à revenir, pas un tableau de bord.

## Contenu, de haut en bas

Sous la séance du jour (L6-05, inchangée), titre « Ta progression ».

1. **Séances** — trois tuiles côte à côte :
   - « Séances » : le nombre de séances faites depuis le début (rattrapées comprises), avec
     « depuis {mois année} » (première séance programmée) ;
   - « Assiduité » : `{n} %` sur 28 jours (`docs/domaine.md` §5.2) ; quand elle ne se calcule
     pas, « — » et, **écrit sous la valeur, visible par tous**, « Pas encore assez de
     séances » ;
   - « Série » : « {n} semaines » (§5.3, décision 3), « — » à zéro.
2. **Huit semaines** — un histogramme : une barre par semaine (lundi–dimanche, Europe/Paris), de
   la plus ancienne à la semaine en cours. Chaque barre montre **les séances faites et les
   séances prévues** : la barre pleine pour les faites sur un fond qui marque les prévues, et
   au-dessus, en texte, « {faites}/{prévues} » — une semaine de repos se lit « 0/0 », une
   semaine sans séance faite « 0/3 ». Sous chaque barre, la date du lundi (« 12/10 »). Pour le
   lecteur d'écran, un seul libellé qui donne les huit « semaine du {date} : {faites} sur
   {prévues} ». Même construction que l'histogramme des revenus (L5-13), sans dépendance.
3. **Mesures** — seulement avec le consentement santé :
   - deux tuiles : « Poids » (« 68,4 kg ») et « Tour de taille » (« 74 cm »), chacune avec la
     date de la dernière mesure (« Mesuré le 12 novembre ») et l'écart depuis la première
     (« −2,6 kg depuis le 2 mars »). L'écart est écrit en texte, signe compris : jamais une
     couleur seule, et **jamais « bien » ou « mal »** (perdre du poids n'est pas l'objectif de
     tout le monde) ;
   - aucune mesure de ce type : « Aucune mesure pour l'instant. » ;
   - bouton « Ajouter une mesure » → la feuille.
4. **Sans consentement santé**, à la place du bloc 3 : « Pour suivre ton poids et ton tour de
   taille, autorise l'enregistrement de tes données de santé. » et un lien « Mes réglages de
   confidentialité » vers `app/(compte)/informations.tsx`, section Confidentialité (L1-09). Rien
   n'est demandé ici : le consentement s'accorde là où on peut le retirer.

## La feuille « Ajouter une mesure »

Deux jetons « Poids » / « Tour de taille » (aucun présélectionné) ; un champ numérique (« Poids
(kg) » ou « Tour de taille (cm) », une décimale, virgule française) ; « Enregistrer ». La mesure
est datée du jour par le serveur.

- **Valeur hors des seuils de plausibilité** (§3.7 : 20–300 kg, 40–200 cm) : la feuille demande
  confirmation avant d'envoyer — « Tu as saisi {valeur} {unité}. C'est bien ça ? », « Oui,
  enregistrer » / « Corriger ». Le seuil vérifie la valeur **et l'unité** (74 saisi en kg au lieu
  de cm, par exemple) ; il ne refuse rien.
- Succès : la feuille se ferme, le bloc 3 relit.
- Refus `mesure_invalide` (valeur nulle ou négative, ou pas un nombre) : « Cette valeur n'est
  pas valide. », la saisie gardée.
- Refus `consentement_sante_absent` (consentement retiré ailleurs entre-temps) : la feuille se
  ferme, le bloc 4 remplace le bloc 3.

## Règles

- Tout est calculé par le serveur (`mon_suivi`, `mes_mesures`) ; l'écran ne compte rien, ne
  date rien, ne soustrait rien. Seule la comparaison aux seuils de confirmation est faite dans
  l'écran, avec les seuils rendus par le serveur.
- Les mesures sont des données de santé (`docs/domaine.md` §3.7, `CLAUDE.md` §10) : jamais dans
  une adresse, un journal, un rapport d'erreur ; aucune mise en cache au-delà de l'écran ; rien
  dans un titre de navigation ni une notification.
- Retrait du consentement : les mesures déjà enregistrées **ne s'affichent plus** ici (bloc 4),
  même si elles restent en base jusqu'à leur effacement (L1-09).
- Les séances comptées sont celles des coachs auxquels le client a encore accès (§5.2).

## États

Chargement : squelettes des tuiles. Erreur : `EtatErreur` à la place du bloc, la séance du jour
reste. Aucune séance programmée de sa vie : « Ta progression apparaîtra après ta première
séance. » à la place des blocs 1 et 2.

## Ce qui a été inventé ou retiré

- **Retiré** : l'onglet et le bloc « Photos » (hors périmètre, `docs/perimetre.md`) ; le mot du
  coach en citation (il demande la messagerie, L8) ; la courbe du poids sur six mois (une
  dernière valeur, sa date et un écart, validé à la revue) ; l'onglet « Mesures » de la maquette,
  fusionné dans le bloc 3.
- **Inventé** : la tuile « Assiduité », la tuile « Série », l'histogramme de huit semaines, la
  feuille d'ajout et sa confirmation, tous les textes ci-dessus hors « Ta progression »,
  « Poids », « Séances », « Ajouter ».

## Critères d'acceptation

1. Un client avec consentement ajoute un poids : la tuile affiche la valeur, sa date et l'écart
   depuis la première, calculés par le serveur.
2. Une valeur hors seuils demande confirmation, puis s'enregistre ; une valeur nulle ou
   négative est refusée par le serveur (banc).
3. Sans consentement, aucun bloc de mesures, et l'écriture est refusée par le serveur (banc).
4. Un client ne lit ni n'écrit les mesures d'un autre ; **aucun coach ne les lit**, même le sien
   (banc, deux sens).
5. L'assiduité affiche « — » et « Pas encore assez de séances » sous 4 séances programmées sur
   28 jours, un pourcentage au-delà, prouvé transition par transition des statuts de séance
   (banc). Une semaine « 0/0 » et une semaine « 0/3 » se distinguent à l'écran.
6. Galerie et corpus d'accessibilité ; clos dans le navigateur sur la base de dev.
7. `npm run verif` passe.
