# L2-01 · Suppression du compte (C-03)

**Lot** L2 · **Rôle** client et coach · **Route** `app/(compte)/suppression.tsx`
**Référence visuelle** `maquettes/MyFavCoach-L2_dc.html`, bloc « C-03 · Supprimer mon compte ».

---

## Raison d'être

Un compte doit pouvoir se supprimer depuis l'application, sans passer par un support humain —
exigence de conformité bloquante pour la publication (`docs/perimetre.md` §2, C-03), pas une
fonctionnalité de confort. `comptes.supprime_le` existe depuis L1 (`0001_creer_identite.sql`)
et n'est écrit par rien : cet écran est le seul chemin qui doit l'écrire.

---

## Contenu

Accessible depuis « Compte et réglages » (`docs/ecrans/L1-07-compte-reglages.md`) — la ligne
« Supprimer mon compte », retirée de L1 car elle n'ouvrait rien, ouvre désormais celui-ci.

Titre serif : « Ce qui disparaît, et quand. »

**Trois catégories** (maquette), pas une liste plate — elles correspondent exactement aux trois
fenêtres de `docs/domaine.md` §2 :

| Icône | Titre | Texte |
|---|---|---|
| Croix | Tout de suite | « Ton profil, tes objectifs, ton poids, tes mesures et tes échanges avec {prénom du coach, si abonné}. » |
| Horloge | Conservé 10 ans | « Tes factures, parce que la loi l'exige. Elles ne contiennent aucune donnée de santé. » |
| Flèche montante | À récupérer avant | « Tu peux exporter tes données. Après suppression, ce n'est plus possible. » → lien direct vers `L2-04` |

**Si un abonnement est actif** (côté client), bandeau conditionnel :
« Ton abonnement est actif. Supprimer ton compte résilie ton suivi avec {prénom du coach}. Le
mois déjà payé n'est pas remboursé. »

**Côté coach**, bandeau équivalent si des offres sont publiées : « Tes offres sont retirées ;
tes abonnés en cours gardent l'accès jusqu'à la fin de leur période payée » —
`docs/domaine.md` §4.3.

Confirmation par **saisie**, pas une case à cocher : « Écris SUPPRIMER pour confirmer », champ
de texte, comparaison stricte et sensible à la casse.

Champ facultatif : « Dis-nous pourquoi (facultatif) », texte libre court — correspond au corps
`{ "motif": "…" }` de `DELETE /moi` (`docs/api.md` §3).

Pied fixe, deux boutons :
1. « Exporter mes données d'abord » (secondaire, contour) → `L2-04`.
2. « Supprimer définitivement » (destructeur, plein) — inactif tant que le champ ne contient pas
   exactement `SUPPRIMER`.

---

## Après confirmation

1. Appel à `DELETE /moi`. Le compte passe à l'état `supprime` (`docs/domaine.md` §4.1).
2. La session est vidée exactement comme `port.deconnecter()` (stockage chiffré + état mémoire),
   puis retour sur `(public)`.

Pas de seconde modale de confirmation : la saisie du mot « SUPPRIMER » est déjà le geste qui
coûte quelque chose — une modale supplémentaire par-dessus serait une redondance, pas une
prudence de plus.

---

## États

| État | Comportement |
|---|---|
| Champ vide ou incorrect | « Supprimer définitivement » inactif |
| Champ = « SUPPRIMER » exactement | Bouton actif |
| Chargement | Bouton en attente |
| Erreur | `EtatErreur` en bandeau, le compte n'est **pas** marqué supprimé, aucun état à moitié |

---

## Règles

- **Aucune suppression physique immédiate.** L'écriture ici pose `comptes.supprime_le` (déjà
  nullable, déjà présent) — elle n'appelle aucun `DELETE` SQL, il n'en existe nulle part dans ce
  dépôt et cet écran n'en introduit pas.
- La purge réelle à J+30 (`docs/domaine.md` §4.1, §2) est une **tâche serveur** (Supabase Edge
  Function + cron), pas un mécanisme de cet écran — `docs/dette.md` la documente comme non
  implémentée. Cet écran ne fait qu'écrire l'intention et la date.
- **Aucun remboursement au prorata.** Le mois déjà payé n'est pas remboursé, côté client comme
  côté coach — tranché, ce n'était qu'une hypothèse dans une version précédente de cette fiche.
- Cet écran ne touche à rien du prestataire de paiement : la résiliation d'un abonnement suit
  sa propre machine à états (`docs/domaine.md` §4.3), déclenchée par la suppression, pas
  recodée ici.
- Le lien vers l'export (`L2-04`) est **une aide, pas un blocage** : rien n'empêche de supprimer
  sans être passé par lui.

---

## Ce qui a été inventé pour cette fiche

- Le nom du coach/des coachs cités dans les bandeaux conditionnels : logique d'affichage
  évidente (reprendre les abonnements/offres réels du compte), non détaillée par la maquette
  au-delà de son cas de démonstration (« Yannick »).

---

## Critères d'acceptation

1. La ligne « Supprimer mon compte » de L1-07 ouvre cet écran, dans les deux espaces.
2. Le bouton « Supprimer définitivement » reste inactif tant que le champ ne contient pas
   exactement « SUPPRIMER ».
3. La confirmation appelle `DELETE /moi`, vide la session, ramène sur `(public)`.
4. Une erreur serveur ne marque pas le compte supprimé et n'efface pas la session.
5. « Exporter mes données d'abord » ouvre `L2-04` sans déclencher la suppression.
6. Aucune importation du module de paiement, aucune lecture de `EXPO_PUBLIC_STRIPE_PK`.
7. L'écran est dans la galerie, exercé en clair et en sombre.
8. `npm run verif` passe.
