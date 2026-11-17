# L5-C05 · Factures et reçus (C-05)

**Lot** L5 · **Rôle** client et coach · **Routes** `app/(compte)/factures.tsx` (la liste) et
`app/(compte)/factures/[id].tsx` (une facture)
**Référence visuelle** aucune : écran absent du dossier de design (`docs/perimetre.md` §2,
« écrans obligatoires absents du dossier »). Composé avec les primitives du design system.

Fiche écrite par Claude le 16 novembre 2026, sous le mandat du 15 novembre : **tout est à
relire**, et les mentions de la facture **à faire valider par le juriste** (`docs/perimetre.md`
§6 : mandat de facturation, mentions obligatoires).

---

## Raison d'être

Remettre au client la facture de ce qu'il a payé, et au coach celles émises en son nom, plus les
factures de commission que la plateforme lui adresse. Critère 3 du jalon (« reçoit une
facture »). Au jalon 1, une facture se lit dans l'application ; elle n'est pas un fichier
(`docs/prompts/L5.md`, décision 6).

---

## Contenu

**La liste** (« Mes factures ») :

- Côté client (ouverte depuis la ligne « Paiements et factures » de l'écran compte, qui apparaît
  dès qu'une facture existe) : une ligne par facture — libellé (« Suivi complet »), le coach,
  la période, le montant, et « Payée le {date} ».
- Côté coach (ouverte depuis Revenus) : deux onglets, « Mes ventes » (les factures émises en son
  nom : libellé, client, montant, commission) et « Commission » (les factures de la plateforme :
  mois, montant, nombre de paiements).
- Aucune facture : « Aucune facture pour l'instant. »

**Une facture** (écran poussé) :

- « Facture n° {numero} » ; « Émise le {date} · payée le {date} ».
- **Vendeur** : prénom et nom du coach ; SIREN ; adresse. Si l'identité fiscale manque (une
  facture de mode test d'avant L5) : « Mentions fiscales du vendeur absentes (facture de test). »
- **Client** : prénom et nom.
- « Facture émise par My Fav Coach au nom et pour le compte de {prénom nom du coach}. »
- **Objet** : le libellé et la période (« du 18 novembre au 17 décembre 2026 »).
- **Montants** : « Total HT », « TVA ({taux} %) », « Total TTC ». En franchise en base : « Total »
  seul, et la mention « TVA non applicable, art. 293 B du CGI ». Montants absents (mode test) :
  « Total TTC » seul.
- Côté coach seulement : « Commission de la plateforme » et son montant.

---

## Règles

- **Tout vient du serveur** ; l'écran ne calcule ni HT ni TVA.
- **Le client ne voit jamais la commission** ; une facture d'un autre ne s'ouvre pas (le serveur
  rend « introuvable »).
- **Espace** : la liste suit l'espace actif ; une facture n'est lue que dans l'espace où elle
  concerne son lecteur (`CLAUDE.md` §10).
- **La ligne « Paiements et factures »** de l'écran compte, écartée en L1-07 parce qu'elle
  n'ouvrait rien, apparaît désormais côté client quand au moins une facture existe ; côté coach,
  les factures s'ouvrent depuis Revenus.

## États

| État | Comportement |
|---|---|
| Chargement | Squelette |
| Erreur de lecture | Erreur de repli et « Réessayer » |
| Aucune facture | « Aucune facture pour l'instant. » |
| Facture introuvable | « Cette facture est introuvable. » et un retour |

## Critères d'acceptation

1. Le client lit ses factures et chacune avec toutes ses mentions, sans la commission.
2. Le coach lit ses ventes (avec commission) et ses factures de commission.
3. Les trois cas de montants (assujetti, franchise, mode test) s'affichent chacun correctement.
4. Une facture d'un autre ne s'ouvre pas.
5. Zones tactiles ≥ 44 pt ; à 200 %, rien n'est tronqué.
6. Galerie, deux thèmes.
7. `npm run verif` passe.
