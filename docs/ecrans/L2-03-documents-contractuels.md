# L2-03 · Documents contractuels (C-06)

**Lot** L2 · **Rôle** client, coach, et visiteur non connecté · **Deux surfaces distinctes**
(voir Règles) · **Référence visuelle** `maquettes/MyFavCoach-L2_dc.html`, bloc « C-06 ·
Documents contractuels » — **couvre la surface authentifiée seulement** ; la surface publique
reste sans maquette.

---

## Raison d'être

Trois endroits pointent déjà vers des documents qui n'existent pas : les deux liens de mention
légale de L1-01 (`app/(public)/index.tsx`), le lien CGU de l'écran d'inscription
(`app/(public)/inscription.tsx`), et la ligne « Documents contractuels » que L1-07 retire tant
que rien ne l'ouvre. Cette fiche couvre les deux, et ce ne sont pas le même écran.

---

## Deux surfaces, pas une

1. **Surface publique**, `app/(public)/documents/[type].tsx` — ouverte par les liens de L1-01 et
   de l'inscription, **sans session**. Lit un document, un seul à la fois : titre, date de
   version en vigueur, corps de texte, défilable. Aucune liste, aucune mention de ce qu'un
   compte a accepté — un visiteur non connecté n'a rien accepté.
2. **Surface authentifiée**, `app/(compte)/documents.tsx` — ouverte par la ligne « Documents
   contractuels » de « Compte et réglages ». C'est celle que montre la maquette : une **liste**
   de documents, chacun avec la version **acceptée par ce compte** et sa date, un chevron menant
   au corps du texte (réutilise le lecteur de la surface publique pour l'affichage).

Les deux partagent le même contenu de document (`GET /documents-legaux`), pas le même contexte
d'affichage : la surface publique ne parle jamais d'acceptation, l'authentifiée ne parle que de
ça.

---

## Contenu — surface authentifiée

Titre : « Documents. »
Texte d'intro : « Tout ce que tu as accepté, avec la version exacte en vigueur au moment où tu
l'as fait. »

Liste, une ligne par document :

| Document | Condition d'affichage |
|---|---|
| Conditions générales d'utilisation | toujours |
| Conditions générales de vente | toujours |
| Politique de confidentialité | toujours |
| Contrat coach | **seulement si le compte a un profil coach** |

Chaque ligne : icône document, titre, « Version {X} · acceptée le {date} » (ou « mise à jour le
{date} » si le compte n'a jamais eu à l'accepter formellement — cas de la politique de
confidentialité, simple information), chevron.

**Bandeau « Une version a changé »** — affiché quand la version en vigueur d'un document diffère
de la version que le compte a acceptée (comparaison `comptes.cgu_version_acceptee` /
`consentements.version` contre la version courante rendue par `GET /documents-legaux`) :
« La politique de {document} a été mise à jour. Lis ce qui change avant de continuer. » Bouton
« Voir ce qui change » → ouvre le document concerné.

---

## Contenu — surface publique

Titre selon le document. Corps de texte, défilable. Pied fixe : bouton retour uniquement —
aucune action d'acceptation ici, l'acceptation reste portée par le geste qui la déclenche
ailleurs (inscription, activation coach), jamais par la lecture du document lui-même.

---

## Règles

- **Accessible sans session, pour la surface publique uniquement.** Les liens de L1-01 doivent
  pouvoir ouvrir un document avant toute connexion : cette route vit dans `(public)`, jamais
  derrière la garde de session (`src/fonctionnalites/identite/garde.ts`). La surface
  authentifiée, elle, vit dans `(compte)` comme le reste des réglages.
- **Aucun texte inventé.** Le contenu réel de ces quatre documents dépend d'un juriste
  (`docs/perimetre.md` §6) — non rédigé à ce jour. Tant qu'aucun texte réel n'est publié, la
  version de développement datée déjà utilisée par `VERSION_CGU_ACCEPTEE`
  (`src/services/auth/supabase.ts`) et `VERSION_CONSENTEMENT_SANTE`
  (`src/fonctionnalites/identite/consentement-sante.ts`) s'affiche — jamais un texte de
  remplissage inventé pour l'occasion.
- **Le bandeau de mise à jour est un cas que le schéma sait déjà détecter** : une comparaison de
  version courante contre version acceptée, aucune nouvelle colonne — `cgu_version_acceptee`
  (`comptes`) et `consentements.version` existent depuis L1.
- Le contrat coach ne s'affiche que pour un compte ayant un profil coach — un client sans
  profil coach n'a jamais eu à l'accepter, une ligne vide serait une confusion, pas une
  information.
- La ligne « Documents contractuels » réapparaît dans `docs/ecrans/L1-07-compte-reglages.md`
  (elle en avait été retirée, aucune ligne n'ouvrant rien en L1) : elle ouvre la surface
  authentifiée.

---

## États

| État | Comportement |
|---|---|
| Chargement | Squelette de liste (authentifiée) ou de texte (publique) |
| Normal | Liste ou corps de document |
| Version modifiée | Bandeau visible en tête de la liste authentifiée |
| Erreur | `EtatErreur`, retour toujours actif |

---

## Ce qui a été inventé pour cette fiche

- La route publique (`(public)/documents/[type].tsx`) reste sans maquette — seule la surface
  authentifiée en a une.
- Le texte exact du bandeau de mise à jour, au-delà de celui montré par la maquette pour la
  politique de confidentialité : généralisé aux trois autres documents par cohérence.

---

## Critères d'acceptation

1. Les liens CGU/confidentialité de L1-01 et de l'inscription ouvrent la surface publique, sans
   session.
2. La ligne « Documents contractuels » de « Compte et réglages » ouvre la surface authentifiée.
3. Le contrat coach n'apparaît que pour un compte avec un profil coach.
4. Le bandeau « Une version a changé » n'apparaît que si la version en vigueur diffère de la
   version acceptée par ce compte.
5. Aucune action d'acceptation n'est présente sur aucune des deux surfaces.
6. `npm run verif` passe.
