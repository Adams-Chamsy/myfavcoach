# L5-13 · Revenus (13)

**Lot** L5 · **Rôle** coach · **Route** `app/(coach)/(tabs)/revenus.tsx` (onglet existant depuis
L0, écran provisoire jusqu'ici)
**Référence visuelle** `maquettes/MyFavCoach-Coach_dc.html`, `data-screen-label="13 Revenus"`.
**Trois corrections, lues en Règles.**

Fiche écrite par Claude le 16 novembre 2026, sous le mandat du 15 novembre
(`docs/decisions-en-attente.md`) : **tout ce qui n'est pas dans la maquette est à relire**.

---

## Raison d'être

Dire au coach ce qu'il a gagné ce mois-ci, ce que la plateforme a pris, quand l'argent arrive, et
lui permettre de le recevoir tout de suite. Et, tant qu'il n'est pas en règle, lui dire quoi faire
pour pouvoir vendre et être payé (`docs/domaine.md` §3.3). C'est le critère 6 du jalon
(`docs/perimetre.md` §5) : « le coach voit son solde, commission déduite, et déclenche un
versement ».

---

## Contenu, de haut en bas

En-tête de l'espace coach, titre « Revenus ».

1. **Ce qu'il reste à faire** — seulement si le coach ne peut pas encore vendre
   (`peutPublier` faux, `docs/api.md` §8). Une carte par chose à faire :
   - **Informations de facturation** (identité fiscale incomplète) : « Tes informations de
     facturation » ; « Elles figurent sur les factures émises en ton nom. » ; bouton
     « Renseigner » → le formulaire (§ Formulaire).
   - **Compte de versement**, selon son état :
     - `absent` ou `a_completer` : « Ton compte de versement » ; « Pour recevoir ton argent,
       termine ton inscription auprès de notre prestataire de paiement. » ; bouton
       « Continuer mon inscription » → la page d'inscription du prestataire.
     - `en_verification` : « Notre prestataire vérifie tes informations. Rien à faire de ton
       côté. »
     - `restreint` : « Notre prestataire a bloqué ton compte de versement. Ouvre ton inscription
       pour voir ce qu'il te demande. » ; bouton « Ouvrir mon inscription ».
2. **Le mois** — libellé du mois (« Novembre 2026 ») ; « Net à percevoir » et le montant net du
   mois (`net_centimes`, `mes_revenus`) en grand.
3. **Six mois** — un histogramme des nets des six derniers mois, du plus ancien au plus récent,
   chaque barre libellée de son mois ; pour le lecteur d'écran, un seul libellé qui donne les six
   montants.
4. **Le détail du mois** — « {n} abonnements » et les encaissements ; « Commission plateforme »
   et son montant, négatif, en encre d'alerte ; « Total net ».
5. **Ton solde** — « Solde disponible » et le montant (`mon_solde`) ; « Prochain virement le
   {date} » ; bouton « Virement immédiat · 1 € ».
6. **Derniers virements** — une ligne par versement (`mes_versements`) : date, état en texte
   (« Versé », « En cours », « Prévu », « Échoué »), montant.
7. **Mes factures** — une ligne qui ouvre les factures du coach (`docs/ecrans/L5-C05-factures-recus.md`).

## Formulaire — informations de facturation

Feuille ou écran poussé, titre « Informations de facturation ». Champs : SIREN (9 chiffres),
adresse, code postal, commune ; régime de TVA en deux jetons, « Franchise en base de TVA » et
« Assujetti à la TVA » ; si assujetti, « Taux de TVA (%) » (20 par défaut proposé, jamais
présélectionné). Pré-rempli avec ce qui est déjà enregistré. « Enregistrer ». Le refus du
serveur (`identite_fiscale_invalide`) s'affiche avec son titre et son détail, aucun champ perdu.

---

## Règles

**Corrections de la maquette :**

1. **« 4 séances à l'unité · 220 € » retiré** : la séance à l'unité est hors périmètre
   (`docs/perimetre.md` §3).
2. **« Versé · CIC ••8841 » → « Versé »** : l'application ne connaît pas la banque du coach (son
   compte bancaire est chez le prestataire, `docs/prompts/L5.md`).
3. **« Commission plateforme · 10 % » → « Commission plateforme »** : le taux peut différer d'une
   facture à l'autre dans un même mois (0 % pendant les 90 jours offerts, puis 10 %) ; le montant
   est exact, un taux unique ne le serait pas toujours.

**Le reste :**

- **Tout vient du serveur** (`docs/api.md` §15) : nets, solde, dates. L'écran ne calcule rien.
- **Virement immédiat** : actif seulement si le solde atteint 20 €, que le compte de versement
  est opérationnel et qu'aucun versement n'est en route ; sinon inactif, avec la raison en texte
  sous le bouton (« Un virement part à partir de 20 € de solde. », « Termine d'abord ton
  inscription. », « Un virement est déjà en route. »). Avant de le faire partir, une
  confirmation : « Virer {montant} maintenant ? 1 € de frais est retenu. » ; « Virer » ; « Annuler ».
  Après : l'état rendu par le serveur (« Virement envoyé. », ou « Ton virement partira demain. »
  quand les fonds ne sont pas encore disponibles), et l'écran relit.
- **Le retour de la page d'inscription** du prestataire ramène sur Revenus, qui relit l'état.
- **Le montant net négatif** n'existe pas (une commission ne dépasse jamais l'encaissement).
- **Aucun statut par la seule couleur** (`CLAUDE.md` §5).

---

## États

| État | Comportement |
|---|---|
| Chargement | Squelette |
| Erreur de lecture | Erreur de repli (L0-03) et « Réessayer », qui relit |
| Coach en règle, aucun revenu | Net à 0, histogramme à zéro, « Aucun virement pour l'instant. » |
| Coach pas en règle | La partie « Ce qu'il reste à faire » en tête |

## Ce qui a été inventé pour cette fiche

Toute la partie « Ce qu'il reste à faire », le formulaire, les raisons sous le bouton de virement,
la confirmation et ses suites, « Aucun virement pour l'instant. », et les trois corrections.

## Critères d'acceptation

1. Net du mois, détail, solde et prochaine date viennent du serveur ; aucun calcul dans l'écran.
2. Un coach sans identité fiscale ou sans compte opérationnel voit quoi faire, et peut le faire.
3. « Virement immédiat » est inactif avec sa raison tant qu'une condition manque ; actif, il
   demande confirmation, puis affiche l'état rendu et relit.
4. Chaque versement porte son état en texte.
5. Aucune ligne « séance à l'unité », aucun nom de banque.
6. Zones tactiles ≥ 44 pt ; à 200 %, rien n'est tronqué.
7. Galerie, deux thèmes : en règle avec revenus, pas en règle.
8. `npm run verif` passe.
