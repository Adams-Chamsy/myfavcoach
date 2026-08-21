# Contrat d'API — jalon 1

Contrat entre l'application et le serveur. Il fait foi des deux côtés : ni le client ni le
serveur n'invente un champ. Toute évolution passe par une modification de ce fichier **avant**
le code.

Aucun nom de prestataire n'apparaît ici : ce contrat est le nôtre, les fournisseurs sont derrière.

---

## 1. Conventions

**Base** : `https://api.myfavcoach.fr/v1`. Le numéro de version est dans le chemin ; il ne
change qu'en cas de rupture. Tout le reste est additif.

**Format** : JSON UTF-8. Clés en `camelCase`, vocabulaire métier en français
(`prixMensuelCentimes`, `statutVerification`).

**En-têtes obligatoires**

| En-tête | Valeur |
|---|---|
| `Authorization` | `Bearer <jeton d'accès>` |
| `X-Profil` | `client` ou `coach` — le profil sous lequel la requête est faite |
| `Accept-Language` | `fr-FR` |
| `Idempotency-Key` | UUID, **obligatoire sur tout POST qui déplace de l'argent** |

Le serveur **revalide** que le profil demandé appartient au compte et qu'il a le droit sur la
ressource. Le client n'est jamais l'autorité en matière d'autorisation.

**Argent** : toujours un entier de centimes plus une devise.
`{"montantCentimes": 4900, "devise": "EUR"}`. Jamais `49.00`.

**Dates** : ISO 8601 UTC, suffixe `Z`. Le formatage en Europe/Paris est fait par l'application.

**Pagination** : par curseur, jamais par numéro de page.

```
GET /coachs?limite=20&curseur=eyJ...
→ { "donnees": [...], "curseurSuivant": "eyJ...", "aSuite": true }
```

`limite` : 1 à 50, défaut 20.

**Erreurs** : `application/problem+json` (RFC 9457).

```json
{
  "type": "https://api.myfavcoach.fr/erreurs/auto-abonnement-interdit",
  "title": "Tu ne peux pas t'abonner à toi-même",
  "status": 409,
  "code": "auto_abonnement_interdit",
  "detail": "Ce profil coach appartient à ton compte.",
  "champs": { "offreId": "appartient au compte courant" }
}
```

`title` et `detail` sont **affichables tels quels**, rédigés dans le registre du produit
(tutoiement, factuel, jamais moralisateur). `code` est stable, c'est sur lui que l'application
branche son comportement — jamais sur `title`.

Codes de statut utilisés : 200, 201, 202, 204, 400, 401, 403, 404, 409, 410, 422, 429, 503.
Un 503 porte toujours `Retry-After`.

**Limitation de débit** : 60 requêtes/minute par compte, 10/minute sur l'authentification et le
paiement. Réponse 429 avec `Retry-After`.

**Champs calculés** : les métriques de `docs/domaine.md` §5 sont calculées par le serveur et
livrées prêtes à afficher, avec leur unité. L'application ne recalcule rien.

---

## 2. Cycle d'authentification (L1)

| Verbe | Chemin | Rôle |
|---|---|---|
| `POST` | `/auth/inscription` | crée un compte. Corps : `email`, `motDePasse`, `dateNaissance`. 422 si < 18 ans (`age_insuffisant`) |
| `POST` | `/auth/verification-email` | `{ "jeton": "…" }` |
| `POST` | `/auth/connexion` | → `jetonAcces` (15 min) + `jetonRafraichissement` (30 j, rotatif) |
| `POST` | `/auth/rafraichir` | rotation ; l'ancien jeton est révoqué |
| `POST` | `/auth/deconnexion` | révoque le jeton de rafraîchissement |
| `POST` | `/auth/mot-de-passe/oubli` | réponse 202 constante, qu'il existe ou non |
| `POST` | `/auth/mot-de-passe/reinitialisation` | |

Les jetons sont stockés dans le trousseau sécurisé de l'appareil (`expo-secure-store`),
**jamais** dans un stockage ordinaire.

---

## 3. Compte et profils (L1)

| Verbe | Chemin | Notes |
|---|---|---|
| `GET` | `/moi` | compte + profils existants + `profilActif` |
| `PATCH` | `/moi` | courriel, téléphone |
| `DELETE` | `/moi` | suppression : 202, purge à J+30, corps `{ "motif": "…" }` |
| `POST` | `/moi/profils/client` | crée le profil client |
| `POST` | `/moi/profils/coach` | crée le profil coach (ouvre le parcours de vérification) |
| `PATCH` | `/moi/profils/client` | |
| `PATCH` | `/moi/profils/coach` | |
| `POST` | `/moi/profil-actif` | `{ "profil": "coach" }` — la bascule d'espace |
| `GET` | `/moi/consentements` | |
| `PUT` | `/moi/consentements/{type}` | `{ "accorde": true, "version": "2026-08-01" }` |

`GET /moi` (extrait) :

```json
{
  "compte": { "id": "…", "email": "camille@exemple.fr", "emailVerifie": true },
  "profilActif": "client",
  "profils": {
    "client": { "id": "…", "prenom": "Camille", "nom": "Dupré", "photoUrl": null },
    "coach": null
  },
  "attentes": { "coach": { "messagesNonLus": 3, "demandesEnAttente": 0 } }
}
```

`attentes` alimente le compteur orange de la bascule d'espace (écran 17).

---

## 4. Vérification du coach (L2)

| Verbe | Chemin |
|---|---|
| `POST` | `/coach/verification/dossier` — dépôt initial |
| `POST` | `/coach/verification/pieces` — envoi d'une pièce (URL signée obtenue avant) |
| `GET` | `/coach/verification` — statut, motif de refus, pièce manquante |

Statuts renvoyés : `absente`, `en_examen`, `complement_demande`, `verifiee`, `refusee`,
`revoquee`. Les pièces d'identité **ne repassent jamais** par l'API applicative : téléversement
direct vers un stockage chiffré via URL signée à usage unique, expiration 10 minutes.

---

## 5. Offres et profil public (L2)

| Verbe | Chemin | Notes |
|---|---|---|
| `GET` | `/coachs/{id}` | profil public : bio, badges, note, délai de réponse |
| `GET` | `/coachs/{id}/offres` | offres publiées uniquement |
| `GET` | `/coachs/{id}/avis` | paginé, `?etiquette=pedagogie` |
| `GET` | `/coachs/{id}/parcours` | diplômes, chronologie, méthode |
| `POST` | `/coach/offres` | 422 `engagement_humain_requis` si le champ est vide |
| `PATCH` | `/coach/offres/{id}` | |
| `POST` | `/coach/offres/{id}/publication` | 409 `coach_non_verifie` |
| `DELETE` | `/coach/offres/{id}` | passe en `retiree`, les abonnés en cours continuent |

---

## 6. Découverte (L3)

```
GET /recherche/coachs
  ?q=cybersécurité
  &commune=69123
  &format=visio,presentiel
  &budgetMaxCentimes=6000
  &noteMin=4.5
  &certifiesUniquement=true
  &tri=pertinence|note|prix_asc
  &limite=20&curseur=…
```

Réponse :

```json
{
  "donnees": [{
    "id": "…", "prenom": "Nadia", "nom": "Belkacem",
    "discipline": "Cybersécurité",
    "titreCourt": "Sécurité offensive · sensibilisation d'équipe",
    "photoUrl": null,
    "note": 4.9, "nombreAvis": 214,
    "badges": ["Certifiée OSCP"],
    "formats": ["visio"],
    "prixMinCentimes": 3900,
    "placesRestantes": null
  }],
  "total": 7,
  "libelleZone": "Lyon et visio",
  "filtreLePlusCouteux": { "cle": "certifiesUniquement", "resultatsSiRetire": 12 }
}
```

`filtreLePlusCouteux` est ce qui permet à l'écran 14 de dire « retire ce filtre et tu auras
12 résultats » sans que l'application ait à le deviner. Le serveur le calcule ; il vaut `null`
s'il y a des résultats.

`GET /recherche/suggestions?q=cyb` — complétion, 10 maximum.

---

## 7. Abonnement et paiement (L4)

Le paiement se fait en trois temps, et l'application ne voit jamais un numéro de carte.

```
POST /abonnements/intention
  { "offreId": "…", "codePromo": "RENTREE10" }
→ 201 {
    "intentionId": "…",
    "recapitulatif": {
      "prixCentimes": 4900, "remiseCentimes": 490, "totalCentimes": 4410,
      "prochainPrelevementLe": "2026-09-20T00:00:00Z", "jourPrelevement": 20
    },
    "jetonPrestataire": "…",       // à usage unique, 15 minutes
    "moyensAcceptes": ["carte", "sepa"]
  }
```

L'application remet `jetonPrestataire` au module du prestataire, qui collecte le moyen de
paiement et rend un identifiant. Puis :

```
POST /abonnements                       Idempotency-Key obligatoire
  { "intentionId": "…", "moyenPaiementId": "…" }
→ 201  { "abonnement": { … , "statut": "actif" } }
→ 202  { "statut": "authentification_requise", "urlAuthentification": "…" }   // 3-D Secure
→ 402  { "code": "paiement_refuse", "motifBanque": "fonds_insuffisants",
         "title": "Ta banque a refusé le paiement", "rienDebite": true }
```

`motifBanque` alimente l'écran 20. Valeurs : `fonds_insuffisants`, `carte_expiree`,
`opposition`, `plafond_atteint`, `authentification_echouee`, `inconnu`.

| Verbe | Chemin | Notes |
|---|---|---|
| `GET` | `/abonnements` | ceux du profil actif |
| `GET` | `/abonnements/{id}` | statut, échéance, période de grâce restante |
| `POST` | `/abonnements/{id}/pause` | `{ "jusquAu": "…" }` — 409 `pause_deja_utilisee` |
| `POST` | `/abonnements/{id}/reprise` | |
| `POST` | `/abonnements/{id}/resiliation` | fin de période, jamais immédiate |
| `DELETE` | `/abonnements/{id}/resiliation` | annule la résiliation programmée |
| `POST` | `/abonnements/{id}/moyen-paiement` | remplacement après échec |
| `GET` | `/factures` | |
| `GET` | `/factures/{id}/pdf` | URL signée, 5 minutes |

**Les notifications d'événements de paiement viennent du prestataire vers le serveur, jamais
vers l'application.** L'application apprend un changement d'état en interrogeant
`GET /abonnements/{id}` ou par notification poussée.

---

## 8. Revenus et versements (L5)

| Verbe | Chemin |
|---|---|
| `GET` | `/coach/revenus?mois=2026-08` |
| `GET` | `/coach/solde` |
| `POST` | `/coach/versements` — `{ "mode": "immediat" }`, frais 100 centimes |
| `GET` | `/coach/versements` |
| `GET` | `/coach/identification` — statut KYC, ce qui manque |

`GET /coach/revenus` :

```json
{
  "mois": "2026-08",
  "netCentimes": 128400,
  "detail": [
    { "libelle": "Abonnements", "nombre": 26, "montantCentimes": 145600 },
    { "libelle": "Commission plateforme", "taux": 0.10, "montantCentimes": -14560 }
  ],
  "variationMois": 0.12,
  "prochainVersementLe": "2026-09-05T00:00:00Z",
  "historique6Mois": [ { "mois": "2026-03", "netCentimes": 98200 } ]
}
```

Les montants négatifs sont livrés négatifs : l'application n'invente pas de signe.

---

## 9. Contenu et séances (L6)

| Verbe | Chemin |
|---|---|
| `GET` | `/coach/programmes`, `POST /coach/programmes` |
| `PATCH` | `/coach/programmes/{id}` — réordonnancement inclus |
| `POST` | `/coach/programmes/{id}/publication` |
| `POST` | `/coach/programmes/{id}/affectation` — `{ "profilClientId": "…", "debutLe": "…" }` |
| `GET` | `/moi/seance-du-jour` |
| `GET` | `/moi/seances?du=…&au=…` |
| `POST` | `/seances/{id}/demarrage` |
| `POST` | `/seances/{id}/validation` — `{ "valeurs": […], "ressentiEffort": 7 }` |
| `GET` | `/medias/{id}/url` — URL signée, 15 minutes |

`ressentiEffort` est une **donnée de santé** : jamais dans une URL, jamais dans un journal.

---

## 10. Suivi (L7)

| Verbe | Chemin |
|---|---|
| `GET` | `/moi/suivi` — assiduité, série en cours, 8 semaines |
| `POST` | `/moi/mesures` — `{ "type": "poids", "valeurGrammes": 64200 }` — 403 `consentement_sante_absent` |
| `GET` | `/coach/clients?statut=a_relancer` |
| `GET` | `/coach/clients/{id}` — fiche, avec `statutBadge` prêt à afficher |
| `PUT` | `/coach/clients/{id}/notes` — notes privées |

`statutBadge` vaut `a_jour`, `inactive`, `nouveau`, `paiement_ko`, accompagné de son libellé
français et du nombre de jours quand il y en a un. **Le libellé vient du serveur**, pour que la
règle « aucun statut porté par la seule couleur » tienne d'un bout à l'autre.

---

## 11. Messagerie (L8)

| Verbe | Chemin |
|---|---|
| `GET` | `/conversations` |
| `GET` | `/conversations/{id}/messages?curseur=…` |
| `POST` | `/conversations/{id}/messages` — `{ "texte": "…" }`, `Idempotency-Key` |
| `POST` | `/conversations/{id}/lecture` |
| `POST` | `/coach/messages-groupes` — `{ "cible": "a_relancer", "texte": "…" }` |

Au jalon 1 : **interrogation périodique** (30 s en avant-plan), pas de connexion permanente.
Texte seul. Pas d'indicateur de saisie, pas de présence.

---

## 12. Agenda (L9)

| Verbe | Chemin |
|---|---|
| `GET` | `/coach/creneaux?du=…&au=…`, `POST`, `DELETE` |
| `PUT` | `/coach/disponibilites` |
| `GET` | `/coachs/{id}/creneaux-libres?du=…&au=…` |
| `POST` | `/reservations` — `Idempotency-Key`, 409 `creneau_pris` |
| `DELETE` | `/reservations/{id}` — 409 `annulation_trop_tardive` si ≤ 24 h |

Le lien de visio est un champ texte `lienVisio` fourni par le coach. La plateforme ne le génère
pas et ne porte aucun flux.

---

## 13. Notifications (L10)

| Verbe | Chemin |
|---|---|
| `POST` | `/moi/appareils` — jeton poussé, plateforme |
| `DELETE` | `/moi/appareils/{id}` |
| `GET` | `/notifications?curseur=…` — groupées par jour |
| `POST` | `/notifications/lecture` |
| `PUT` | `/moi/preferences-notifications` |

Le corps d'une notification poussée ne contient **jamais** de donnée de santé ni de montant.

---

## 14. Conformité (L11)

| Verbe | Chemin |
|---|---|
| `POST` | `/signalements` — `{ "cibleType": "message", "cibleId": "…", "motif": "…" }` → 202 |
| `GET` | `/signalements` — les miens et leur suite |
| `POST` | `/blocages`, `DELETE /blocages/{id}`, `GET /blocages` |
| `GET` | `/documents-legaux` — versions en vigueur |
| `GET` | `/moi/export` — portabilité, 202 puis courriel avec lien signé |

---

## 15. Ce que l'application ne fait jamais

- Calculer un montant, une note, une assiduité, une commission ou un classement.
- Décider d'une transition d'état. Elle demande, le serveur tranche et renvoie le nouvel état.
- Stocker un moyen de paiement, même partiellement.
- Écrire une donnée de santé dans un cache persistant ou un journal.
- Faire confiance à un champ pour l'autorisation : le serveur revalide toujours.
