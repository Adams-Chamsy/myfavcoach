# Contrat d'API — jalon 1

Contrat entre l'application et le serveur. Il fait foi des deux côtés : ni le client ni le
serveur n'invente un champ. Toute évolution passe par une modification de ce fichier **avant**
le code.

Le backend est Supabase (`CLAUDE.md` §2) : authentification via Supabase Auth, données via
PostgREST protégées par RLS. Ce document décrit la **forme cible** des échanges — vocabulaire,
pagination, format d'erreur, montants — pas un serveur applicatif maison : chaque section de §4
à §14 précise en tête ce qui la sert (PostgREST direct, fonction de base Postgres, ou fonction
distante à écrire). Conventions Supabase (migrations, schéma, sécurité) : `docs/backend.md`.

---

## 1. Conventions

**Base** : l'URL du projet Supabase (`EXPO_PUBLIC_SUPABASE_URL`), suffixée `/rest/v1` pour les
données (PostgREST) et `/auth/v1` pour l'authentification (Supabase Auth). Pas de numéro de
version dans le chemin : PostgREST n'en expose pas — une rupture de contrat sur une table se
traite par une nouvelle vue ou une nouvelle fonction, jamais par une modification silencieuse
d'une existante.

**Format** : JSON UTF-8. Clés en `camelCase`, vocabulaire métier en français
(`prixMensuelCentimes`, `statutVerification`) — porté par des vues et fonctions qui renomment les
colonnes `snake_case` du schéma (`docs/backend.md` §4), jamais exposé tel quel côté client.

**En-têtes obligatoires**

| En-tête | Valeur |
|---|---|
| `Authorization` | `Bearer <jeton d'accès>` — le jeton de session Supabase Auth (`supabase-js`), jamais géré à la main |
| `Accept-Language` | `fr-FR` |
| `Idempotency-Key` | UUID, **obligatoire sur tout POST qui déplace de l'argent**. PostgREST seul ne déduplique rien : toute route qui porte cette exigence est nécessairement une fonction (de base ou distante), jamais un `INSERT` direct |

Le profil actif (`client` ou `coach`) n'est **pas** porté par un en-tête : c'est une colonne du
compte côté serveur (`profilActif`, `docs/domaine.md` §3.1). Le serveur **revalide** toujours
que le profil demandé appartient au compte et qu'il a le droit sur la ressource — le client
n'est jamais l'autorité en matière d'autorisation, RLS en est le mécanisme.

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

**Servi par :** Supabase Auth, via `supabase-js` — aucune route à écrire pour ce qui suit. Le
tableau donne l'équivalence entre le geste et l'appel `supabase-js`, pas un contrat REST maison.

| Geste | Appel `supabase-js` | Notes |
|---|---|---|
| Inscription | `auth.signUp({ email, password, options: { data: { dateNaissance } } })` | `dateNaissance` voyage en métadonnée de l'utilisateur. Le contrôle **≥ 18 ans** (422 `age_insuffisant`, `docs/domaine.md` §3.1) reste **à l'inscription**, comme documenté — le mécanisme exact (déclencheur sur `auth.users`, ou fonction dédiée) est un détail d'implémentation à trancher en L1, pas encore choisi ici |
| Vérification de l'e-mail | gérée par Supabase (lien envoyé automatiquement) | rien à implémenter côté application au-delà de l'écran qui l'explique |
| Connexion | `auth.signInWithPassword({ email, password })` | durée des jetons et rotation : réglages du tableau de bord, voir `docs/backend.md` §3 — pas de valeurs à coder en dur |
| Rafraîchissement | automatique, géré par `supabase-js` | l'application ne l'appelle jamais explicitement en usage normal |
| Déconnexion | `auth.signOut({ scope: 'local' })` | **jamais** le défaut (`'global'`), qui révoquerait toutes les sessions de la personne sur tous ses appareils — révoque seulement le jeton de rafraîchissement de CET appareil ; le dernier jeton d'accès émis reste valable jusqu'à son expiration — voir `docs/backend.md` §3, ce n'est pas immédiat |
| Mot de passe oublié | `auth.resetPasswordForEmail(email)` | réponse constante côté Supabase, qu'un compte existe ou non pour cet e-mail |
| Réinitialisation | `auth.updateUser({ password })`, après le lien reçu | |

La session (jetons d'accès et de rafraîchissement) est stockée par `supabase-js` via son
adaptateur de stockage ; côté application, cet adaptateur
(`src/services/supabase/stockage-securise.ts`) écrit dans le stockage chiffré natif de
l'appareil (`expo-secure-store`), **jamais** un stockage ordinaire. C'est la SEULE mémoire de
session du dépôt (CLAUDE.md §2) — `src/services/trousseau/`, une deuxième mémoire née au lot
L0, a été supprimée en préparant P1.8, précisément pour qu'aucune autre ne puisse diverger de
celle-ci.

---

## 3. Compte et profils (L1)

**Servi par :** PostgREST + politiques RLS, sauf `basculer_profil` et `creer_profil_coach` :
fonctions de base (la bascule doit revalider l'appartenance du profil, la création de profil
coach doit ouvrir le parcours de vérification dans la même transaction).

| Verbe | Chemin | Notes |
|---|---|---|
| `GET` | `/moi` | compte + profils existants + `profilActif` |
| `PATCH` | `/moi` | courriel, téléphone |
| `DELETE` | `/moi` | suppression : 202, purge à J+30, corps `{ "motif": "…" }` |
| `POST` | `/moi/profils/client` | crée le profil client |
| `POST` | `/moi/profils/coach` | crée le profil coach (ouvre le parcours de vérification) — fonction de base `creer_profil_coach` |
| `PATCH` | `/moi/profils/client` | |
| `PATCH` | `/moi/profils/coach` | |
| `POST` | `/moi/profil-actif` | `{ "profil": "coach" }` — la bascule d'espace, fonction de base `basculer_profil` |
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

**Servi par :** Storage (pièces, URL signées). Les changements de statut passent par une
fonction de base — l'examen est humain, hors application, mais l'écriture du résultat reste
côté serveur.

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

**Servi par :** PostgREST + politiques. La publication (`POST /coach/offres/{id}/publication`)
est une fonction de base : elle vérifie coach vérifié et engagement humain non nul avant de
faire passer le statut à `publiee`.

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

**Servi par :** fonction de base. Le classement (`docs/domaine.md` §5.6, score pondéré à six
composantes) n'est pas un filtre PostgREST — c'est un calcul, écrit une fois en SQL.

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

**Servi par :** fonction distante à écrire (appels Stripe, réception des webhooks, gestion de
l'idempotence — rien de tout ça ne s'exprime en PostgREST direct).

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

**Servi par :** fonction distante (le versement lui-même passe par Stripe Connect). Les agrégats
de lecture (`GET /coach/revenus`, `GET /coach/solde`) peuvent être de simples vues.

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

**Servi par :** PostgREST, sauf publication (`POST /coach/programmes/{id}/publication`) et
affectation (`POST /coach/programmes/{id}/affectation`) : fonctions de base.

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

**Servi par :** vues calculées en lecture (`docs/domaine.md` §5.2, assiduité). L'écriture des
mesures (`POST /moi/mesures`) passe par PostgREST, avec contrôle du consentement santé
(`docs/domaine.md` §3.12) porté par la politique RLS de la table.

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

**Servi par :** PostgREST + politiques. Interrogation périodique côté application (§ ci-dessous),
pas de canal temps réel à écrire au jalon 1.

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

**Servi par :** PostgREST, sauf la réservation (`POST /reservations`) : fonction de base — la
concurrence sur le créneau (deux réservations simultanées, erreur `creneau_pris`) doit être
tranchée atomiquement côté serveur, pas par un simple `INSERT`.

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

**Servi par :** fonction distante (envoi effectif vers le service de notifications poussées,
externe à Supabase).

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

**Servi par :** PostgREST + politiques pour signalements et blocages. L'export de portabilité
(`GET /moi/export`) est une fonction distante : elle rassemble des données de plusieurs tables et
envoie un courriel avec un lien signé, hors de portée d'une requête PostgREST unique.

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
