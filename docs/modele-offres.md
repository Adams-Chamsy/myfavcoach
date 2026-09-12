# Modèle V1 — révision 2

> **Avertissement, ajouté après relecture (12 septembre 2026).** Ce document décrit un modèle
> **cible**, au-delà du jalon 1. `docs/perimetre.md` fait seul autorité sur ce qui se code et
> quand — ne rien tirer d'ici sans vérifier le périmètre en vigueur au moment de la lecture.
> La première relecture a trouvé, dans la section 1 ci-dessous, des contraintes SQL posées sur
> des tables correspondant à des fonctionnalités que `docs/perimetre.md` §3 liste explicitement
> « hors périmètre — reporté au jalon 2 » (photos de suivi corporelles, retour de séance client,
> bibliothèque vidéo du coach). Même dans un document de proposition, c'est le socle que
> `CLAUDE.md` §4 interdit : « ne propose pas d'ajouter juste le socle pour plus tard ». Ces
> éléments ont été retirés, pas commentés — voir la section 1 pour ce qui reste.

Remplace les sections 1.1, 1.2 et 1.3 du document précédent, qui étaient écrites en anglais
contre un schéma supposé. Cette version s'aligne sur le dépôt réel : français, snake_case, sans
accent, unités en suffixe du nom de colonne, énumérations suffixées `_enum`, migrations
`NNNN_verbe_complement.sql`, aucune politique DELETE, effacement logique par colonne
`supprime_le` / `retiree_le`.

Le DDL ci-dessous est une proposition à relire, pas une migration à appliquer telle quelle.

---

## 1. Portée de visibilité

**Réduite après relecture.** La version précédente illustrait `portee_enum` sur six tables :
`photos_suivi`, `mesures`, `seances`, `retours_seance`, `medias`, `reponses_questionnaire_sante`.
Trois d'entre elles — `photos_suivi`, `retours_seance`, `medias` — correspondent à des éléments
que `docs/perimetre.md` §3 liste explicitement « hors périmètre — reporté au jalon 2 » (photos
de suivi corporelles, retour de séance client, bibliothèque vidéo du coach). Retirées, pas
commentées. `mesures` et `seances` retirées aussi, par la même prudence : rien ici ne doit
préparer un mécanisme pour une table qui n'est pas explicitement planifiée.

**Ne reste que `reponses_questionnaire_sante`**, écran 05a de `docs/perimetre.md`, lot **L6** —
et encore : rien ci-dessous n'est à construire avant ce lot. Ce qui suit décrit un mécanisme
cible pour L6, pas pour L2.

### 1.1 Pourquoi une colonne, pas un champ `scope` autonome

`consentements`, `consentements_courants` et `verifier_consentement_sante_poids()` font déjà le
travail juridique (« cette personne a-t-elle accepté, quand, sur quelle version »).
**`portee`** est une colonne technique distincte, sur l'objet de contenu lui-même : elle répond
à « qui peut lire cette ligne », pas à « qui a consenti à quoi ».

### 1.2 L'énumération

```sql
create type public.portee_enum as enum ('privee', 'coach', 'cohorte', 'publique');
```

Ordre d'élargissement : `privee` < `coach` < `cohorte` < `publique`. À ce jour, la seule table
visée par cette colonne (`reponses_questionnaire_sante`) a un plafond fixé à `coach` (§1.3) —
elle n'atteint jamais `cohorte` ni `publique`. L'énumération complète est gardée telle quelle
pour rester le vocabulaire commun d'une future table qui, elle, s'élargirait réellement.

### 1.3 Le plafond, en contrainte et non en déclencheur

```sql
alter table public.reponses_questionnaire_sante
  add constraint reponses_questionnaire_sante_portee_plafond
  check (portee = 'coach');
```

Une contrainte `check` ne se contourne pas, y compris par une fonction `security definer` mal
écrite ou une migration future distraite — c'est le verrou architectural, pas un réglage
d'interface. Ce plafond fixe cette table à `coach` seul : la portée n'y est pas un choix
variable, elle documente juste ce qui restera toujours vrai.

### 1.4 Le mécanisme de partage — non nécessaire ici, retiré

La révision précédente proposait un déclencheur `verifier_consentement_partage()` et deux types
de consentement (`partage_cohorte`, `partage_public`) pour autoriser un élargissement vers
`cohorte`/`publique`. Avec `reponses_questionnaire_sante` comme seule table restante — plafonnée
à `coach` par construction (§1.3) — ce mécanisme n'a rien à protéger : aucune ligne de cette
table n'atteint jamais une portée qui en aurait besoin. Retiré plutôt que gardé « au cas où » —
même règle qu'ailleurs dans cette section. Il reviendra, sous une forme à revalider, le jour où
une table de ce modèle élargira réellement au-delà de `coach`.

### 1.5 Types de consentement

`consentements.type` reste `text` avec liste fermée côté application (choix déjà justifié en
commentaire dans le SQL réel, `0001_creer_identite.sql`).

| Type | Existe | Objet |
|---|---|---|
| `sante_poids` | oui | poids de départ et cible |
| `sante_questionnaire` | à créer, pas avant L6 | contre-indications, blessures, traitements |

### 1.6 Règles

La valeur par défaut d'une colonne `portee` est toujours la plus restrictive applicable. Le
retrait d'un consentement n'efface rien et ne rétrograde rien automatiquement — décision produit
à écrire le moment venu, pas un effet de bord implicite. Par cohérence avec le journal en ajout
seul (`docs/domaine.md` §3.12), le retrait est une nouvelle ligne `accorde = false`.

---

## 2. Offres

**Nature unique, après relecture.** La révision précédente proposait quatre natures d'offre
(`type_offre_enum` : `abonnement`, `appel_decouverte`, `seance_unique`, `pack`), avec `devise` et
`recurrence` en colonnes libres pour les couvrir toutes. `docs/perimetre.md` (écran 04a) limite
le jalon 1 à une seule nature — l'abonnement — et `docs/domaine.md` §3.3 le fixe déjà ainsi.
Trois choses retirées, pas commentées :

- **`type_offre_enum` et la colonne `type`** : une énumération à quatre valeurs dont trois
  n'existent nulle part ce jalon est le même socle que celui retiré de la section 1 — une
  colonne qui existe « sans valeur alternative réelle » (comme le dit la décision qui a fait
  retirer `recurrence`, ci-dessous) n'a pas sa place ici non plus.
- **`devise`** : `CLAUDE.md` §2 fixe l'euro seul, décision figée ; `docs/perimetre.md` §3 liste
  « Multilingue, autres devises » hors périmètre. Une colonne pour une variabilité qui n'existera
  pas est le même socle interdit.
- **`recurrence`**, **`deduite_du_premier_mois`**, **`requiert_creneau`**, **`duree_minutes`** :
  toutes les quatre n'ont de sens que pour une nature d'offre autre que l'abonnement. Une seule
  nature, un seul rythme (mensuel, implicite, jamais une colonne) : ces champs disparaissent
  avec les natures qu'ils décrivaient. `benefices`, `engagement_humain` et `est_mise_en_avant`,
  déjà fixés par `docs/domaine.md` §3.3, sont ajoutés ci-dessous — absents de la proposition
  d'origine, qui n'allait pas jusque-là.

### 2.1 Le point de rupture

Les dix politiques actuelles (`0002_politiques.sql`) disent toutes la même chose : le
propriétaire, et personne d'autre. Une offre publiée doit être lisible par n'importe quel compte,
et par `anon` (référencement du profil coach). C'est la première lecture inter-comptes du
produit — `docs/backend.md` §8 en fait désormais une règle du dépôt, pas seulement une remarque
de ce document : toute politique qui ouvre une lecture au-delà du propriétaire s'accompagne des
tests de ce qu'elle ne laisse **pas** passer.

Attention particulière à ce qui fuit avec elle : une offre porte un `coach_id`, donc publier une
offre publie l'existence d'un profil coach. Vérifier que `profils_coach` reste fermé et
qu'aucune jointure ne le contourne.

### 2.2 DDL proposé

```sql
create table public.offres (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profils_coach (id) on delete cascade,
  titre text not null,
  description text,
  prix_centimes integer not null,
  benefices text[] not null default '{}',
  engagement_humain text[] not null default '{}',
  est_mise_en_avant boolean not null default false,
  publiee_le timestamptz,
  retiree_le timestamptz,
  cree_le timestamptz not null default now(),

  constraint offres_prix_bornes
    check (prix_centimes between 1000 and 50000)
);

create index offres_coach_publiee_idx
  on public.offres (coach_id, publiee_le desc)
  where retiree_le is null;

alter table public.offres enable row level security;
```

Choix à relire :

- `prix_centimes` suit la convention d'unité en suffixe. Borné 1 000 à 50 000 (10 € à 500 €),
  comme `docs/domaine.md` §3.3 le fixe déjà.
- `benefices` et `engagement_humain` restent nullables **de fait** (`default '{}'`) : un
  brouillon peut exister sans eux. Leur non-vacuité n'est exigée qu'**à la publication**
  (§2.4) — une contrainte `check` sur la table entière interdirait un brouillon incomplet, ce
  que `docs/domaine.md` §3.3 n'exige pas.
- **Pas de politique `DELETE`, conformément au dépôt.** `retiree_le` retire une offre de la
  vente sans casser les abonnements déjà souscrits qui la référencent — `docs/domaine.md` §3.3 :
  « Une offre `retiree` reste facturée aux abonnés existants ». `docs/api.md` §5 documente un
  verbe `DELETE /coach/offres/{id}` : c'est un nom d'action HTTP, pas un `DELETE` SQL — voir
  §2.4.

**Grants**, même convention que `0001_creer_identite.sql`/`0006_verrouiller_grants.sql`
(revoke puis grant, jamais grant seul ; `UPDATE` colonne par colonne, jamais table entière) :

```sql
revoke all on public.offres from anon, authenticated;

grant select on public.offres to anon, authenticated;
grant insert on public.offres to authenticated;
grant update (
  titre, description, prix_centimes, benefices, engagement_humain, est_mise_en_avant
) on public.offres to authenticated;
```

`publiee_le` et `retiree_le` sont **volontairement absentes** de ce `GRANT UPDATE` : seules les
fonctions du §2.4 doivent pouvoir les écrire, exactement pour la raison que
`0001_creer_identite.sql` protège déjà `comptes.profil_actif` et
`profils_coach.statut_verification` — une transition qui porte une règle métier (ici : coach
vérifié, engagement humain non vide) ne s'écrit jamais par un `UPDATE` direct.

### 2.3 Politiques

```sql
create policy offres_select_publiees on public.offres
  for select to anon, authenticated
  using (publiee_le is not null and retiree_le is null);

create policy offres_select_proprietaire on public.offres
  for select to authenticated
  using (coach_id in (
    select id from public.profils_coach where compte_id = auth.uid()
  ));

create policy offres_insert_espace_coach on public.offres
  for insert to authenticated
  with check (
    coach_id in (select id from public.profils_coach where compte_id = auth.uid())
    and public.profil_actif_courant() = 'coach'
  );

create policy offres_update_espace_coach on public.offres
  for update to authenticated
  using (
    coach_id in (select id from public.profils_coach where compte_id = auth.uid())
    and public.profil_actif_courant() = 'coach'
  )
  with check (
    coach_id in (select id from public.profils_coach where compte_id = auth.uid())
    and public.profil_actif_courant() = 'coach'
  );
```

À prouver au banc, dans les deux sens (`docs/backend.md` §8) : un coach ne modifie pas l'offre
d'un autre ; un brouillon non publié n'est lu par personne d'autre que son auteur ; `anon` ne lit
que les offres publiées et rien d'autre de la table — pas seulement qu'un compte authentifié
tiers est bloqué, `anon` a sa propre preuve.

### 2.4 Publication et retrait : deux fonctions, pas un `UPDATE` direct

`docs/api.md` §5 le dit déjà : la publication est « une fonction de base : elle vérifie coach
vérifié et engagement humain non nul avant de faire passer le statut à `publiee` ». Les deux
fonctions ci-dessous sont `SECURITY DEFINER` **et ce n'est pas une préférence** — même
justification que `basculer_profil`/`creer_profil_coach`
(`0002_politiques.sql`/`0005_creer_profil_coach.sql`) : `publiee_le`/`retiree_le` n'ont aucun
`GRANT UPDATE` pour `authenticated` (§2.2), un `UPDATE` direct échouerait donc pour tout le
monde, y compris le propriétaire légitime de l'offre.

```sql
create or replace function public.publier_offre(offre_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_verifiee boolean;
  v_engagement_non_vide boolean;
begin
  select o.coach_id,
         pc.statut_verification = 'verifiee',
         coalesce(array_length(o.engagement_humain, 1), 0) > 0
    into v_coach_id, v_verifiee, v_engagement_non_vide
  from public.offres o
  join public.profils_coach pc on pc.id = o.coach_id
  where o.id = offre_id
    and o.coach_id in (select id from public.profils_coach where compte_id = auth.uid());

  if v_coach_id is null then
    raise exception 'offre introuvable ou non possedee par ce compte';
  end if;

  if not v_engagement_non_vide then
    raise exception 'engagement_humain_requis';
  end if;

  if not v_verifiee then
    raise exception 'coach_non_verifie';
  end if;

  update public.offres set publiee_le = now(), retiree_le = null where id = offre_id;
end;
$$;

revoke all on function public.publier_offre(uuid) from public, anon, authenticated;
grant execute on function public.publier_offre(uuid) to authenticated;

create or replace function public.retirer_offre(offre_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.offres
  set retiree_le = now()
  where id = offre_id
    and coach_id in (select id from public.profils_coach where compte_id = auth.uid());

  if not found then
    raise exception 'offre introuvable ou non possedee par ce compte';
  end if;
end;
$$;

revoke all on function public.retirer_offre(uuid) from public, anon, authenticated;
grant execute on function public.retirer_offre(uuid) to authenticated;
```

Les messages `engagement_humain_requis` et `coach_non_verifie` reprennent tels quels les codes
déjà fixés par `docs/api.md` §5 (422 et 409 respectivement) — la fonction et le contrat d'API
doivent rester d'accord, pas deux vocabulaires distincts pour la même erreur.

`DELETE /coach/offres/{id}` (`docs/api.md` §5) est donc servi par `retirer_offre`, jamais par un
`DELETE` SQL : le verbe HTTP ne dit rien du mécanisme serveur qui l'exécute.

---

## 3. Séances et blocs

La séance n'existe pas encore dans le schéma, donc rien à migrer : il suffit de ne pas coder en
dur la forme musculation.

```sql
create type public.type_bloc_enum as enum (
  'serie',
  'minuteur',
  'lecture',
  'video',
  'quiz',
  'livrable'
);

create table public.seances (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profils_coach (id) on delete cascade,
  client_id uuid references public.profils_client (id) on delete cascade,
  titre text not null,
  prevue_le timestamptz,
  statut text not null default 'brouillon',
  portee public.portee_enum not null default 'coach',
  terminee_le timestamptz,
  cree_le timestamptz not null default now()
);

create table public.blocs (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances (id) on delete cascade,
  position smallint not null,
  type public.type_bloc_enum not null,
  titre text not null,
  duree_estimee_secondes integer,
  contenu jsonb not null default '{}',
  media_id uuid references public.medias (id) on delete set null,

  constraint blocs_position_unique unique (seance_id, position)
);
```

`contenu` en `jsonb` parce que la charge utile diffère radicalement d'un type à l'autre. La
validation de forme se fait côté application, comme pour `consentements.type` et
`profils_coach.discipline` — même arbitrage, même justification.

| Type | `contenu` |
|---|---|
| `serie` | `{ series: [{ repetitions, charge_grammes, repos_secondes }], consigne }` |
| `minuteur` | `{ duree_secondes, consigne }` |
| `lecture` | `{ corps, temps_lecture_secondes }` |
| `video` | `{ reperes: [{ seconde, libelle }] }` — la vidéo elle-même est dans `media_id` |
| `quiz` | `{ questions: [{ enonce, choix, bonne_reponse, corrige }] }` |
| `livrable` | `{ consigne, formats_acceptes, echeance }` |

Règles de rendu :

- L'écran de séance est un aiguilleur. Il ne connaît aucun type en particulier.
- Un type inconnu s'affiche en carte neutre avec son titre, il ne casse pas l'écran. C'est ce qui
  permet d'ajouter un type sans forcer une mise à jour de l'application.
- La montre n'affiche que `serie` et `minuteur`. Elle filtre le reste et l'annonce
  (« 2 blocs à faire sur le téléphone »). Ne jamais lui envoyer un bloc `lecture`.
- La clé de cache hors-ligne est `seance:{id}:blocs`.

En V1 seul `serie` a besoin d'un rendu complet. Les cinq autres peuvent rester des cartes
minimales jusqu'à ce que le studio les produise.

---

## 4. Rendez-vous

Nécessaire dès que `requiert_creneau` existe.

```sql
create type public.statut_rdv_enum as enum (
  'reserve',
  'honore',
  'annule_client',
  'annule_coach',
  'absent'
);

create table public.rendez_vous (
  id uuid primary key default gen_random_uuid(),
  offre_id uuid not null references public.offres (id),
  coach_id uuid not null references public.profils_coach (id) on delete cascade,
  client_id uuid not null references public.profils_client (id) on delete cascade,
  debut timestamptz not null,
  duree_minutes smallint not null,
  format text not null,
  lien_visio text,
  adresse text,
  statut public.statut_rdv_enum not null default 'reserve',
  annule_le timestamptz,
  cree_le timestamptz not null default now()
);
```

`absent` est distinct de `annule_client` : les deux ne se facturent pas pareil et la limite
d'annulation gratuite ne s'applique qu'au second. L'heure limite est calculée, affichée en clair
dans l'écran 39, et non renvoyée aux CGU.

Deuxième table à lecture inter-comptes : le client lit un rendez-vous qui porte un `coach_id`, et
réciproquement. À traiter avec la même prudence que `offres`.

---

## 5. Médias

```sql
create type public.genre_media_enum as enum ('presentation', 'geste', 'seance');

create table public.medias (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profils_coach (id) on delete cascade,
  genre public.genre_media_enum not null,
  portee public.portee_enum not null default 'coach',
  duree_secondes integer,
  statut text not null default 'televersement',
  cree_le timestamptz not null default now(),

  constraint medias_portee_coherente check (
    (genre = 'presentation' and portee = 'publique')
    or (genre = 'geste' and portee = 'coach')
    or (genre = 'seance' and portee in ('coach', 'cohorte'))
  )
);
```

Un clip `geste` est attaché à un exercice de la bibliothèque du coach, pas à une séance : il est
réutilisé partout où l'exercice apparaît. Il n'est jamais facturé séparément.

Vocabulaire interdit dans l'interface, quel que soit le genre : déverrouiller, débloquer, contenu
verrouillé, vignette floutée, compteur de contenus non accessibles.

---

## 6. Ce qui reste à caler avec toi

**Réduit après relecture** : les deux points sur `appel_decouverte` (prix plafonné) et
`deduite_du_premier_mois` (avoir) portaient sur des natures d'offre retirées de la section 2 —
sans objet tant qu'une seule nature (abonnement) existe. Ils reviendront si un jour une nature
d'offre autre que l'abonnement est reconçue, pas avant.

**Le plan de lots.** Le dépôt place les offres en L2, le paiement en L4, l'édition d'offre en L5.
Mon ordre de construction de la révision 1 plaçait le paiement en deuxième position. Le tien fait
foi, je m'aligne dessus.

**Une conséquence qui reste vraie même à une seule nature** : entre L2 et L4, une offre existe,
s'affiche, et le bouton « S'abonner » du profil coach public doit rester visible mais
inatteignable (`docs/ecrans/L2-12-profil-coach-public.md`, Règles) — aucun appel de paiement
avant L4. Vérifie que cette fenêtre ne produit pas un état où le produit paraît vendable alors
qu'il ne l'est pas.
