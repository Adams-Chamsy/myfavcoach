# L3bis-I02 · Arrivée par invitation

**Lot** L3bis · **Rôle** visiteur non connecté (`anon`), devient client au clic sur « Créer mon
compte » · **Route** `app/(public)/y/[jeton].tsx`, sans session — ouverte par un lien
`https://<domaine>/y/<jeton>`, Universal Link (iOS) / App Link (Android) une fois configurés
(`docs/prompts/L3bis.md`, point 3). **Référence visuelle**
`maquettes/MyFavCoach-Import_dc.html`, bloc I-02, `data-screen-label="I-02 Arrivee par
invitation"`.

---

## Raison d'être

La page que le lien d'un coach ouvre pour quelqu'un qui n'a pas encore de compte. Elle ne vend
pas la plateforme : elle vend le fait de continuer avec quelqu'un qu'on connaît déjà (légende
sous I-02 dans la maquette) — c'est ce qui la distingue d'une arrivée par la recherche (L3).

---

## Contenu

1. **Bandeau plein cadre** : photo du coach (`EmplacementImage`, repli initiales), « INVITATION
   PERSONNELLE », « *Prénom* t'invite à te suivre ici ».
2. **Texte de présentation** : une phrase qui nomme le coach en entier (prénom + nom complet —
   son propre nom, déjà public, rien à voir avec la troncature de I-01 qui protège l'identité
   de l'INVITÉ, pas celle du coach).
3. **Deux points forts fixes** (maquette) : « Ton programme, écrit par lui/elle », « Vos
   échanges au même endroit ». Texte fixe, non lu depuis une donnée du coach.
4. **Carte de l'offre** : titre et prix de l'offre du coach marquée `estMiseEnAvant`
   (`docs/domaine.md` §3.3) — s'il n'en existe aucune, la plus récemment publiée. Jamais
   improvisée : si le coach n'a aucune offre publiée, voir Règles (état « rien à proposer
   encore »).
5. **Bandeau de réassurance** : « *Prénom* ne voit rien de ton compte tant que tu ne t'abonnes
   pas. Créer un compte ne l'engage à rien, et toi non plus. » — texte fixe, reflète la règle de
   troncature réelle de `docs/domaine.md` §3.15, pas une promesse en l'air.
6. **Deux actions** : « Créer mon compte » (primaire), « Voir son profil d'abord » (secondaire).

---

## Règles

- **Rien ici n'excède le profil public du coach** (L2-12, déjà accordé à `anon`) : prénom, nom,
  photo, titre court, et les offres publiées avec leur titre/prix (déjà lisibles sans session
  depuis L2). Aucune colonne, aucune fonction nouvelle ne s'ajoute pour cet écran.
- **Le jeton ne résout JAMAIS à autre chose qu'un coach.** Un jeton absent, invalide, ou
  appartenant à un jeton régénéré (donc remplacé) affiche le même état honnête que « ce lien
  n'existe pas » — jamais une erreur technique, jamais un indice sur ce qui a changé (voir
  États). Même prudence qu'un chemin de stockage construit à la main en P2.5 : un jeton presque
  correct ne doit se comporter en rien différemment d'un jeton totalement absent.
- **Aucune lecture de la table `invitations` par cet écran.** Créer la ligne d'invitation est
  un effet de la création de compte (`docs/prompts/L3bis.md`, P3bis.3 point 4), jamais une
  lecture préalable par I-02 lui-même.
- **« Créer mon compte »** entre dans le parcours d'inscription existant (`app/(public)/
  inscription.tsx`, L1-02) en portant le jeton en paramètre de route — même mécanique que
  `viaCoach` (`app/(public)/index.tsx`, `docs/dette.md`), pas un nouveau mécanisme parallèle.
- **« Voir son profil d'abord »** ouvre exactement l'écran public de profil coach (L2-12,
  `app/(client)/coach/[id].tsx`) — déjà fonctionnel sans session (règle de L2-11). Aucune
  variante dédiée à ce parcours.
- **Cet écran est la cible de la configuration Universal Links/App Links**
  (`docs/prompts/L3bis.md`, point 3) : ce qu'un test automatisé peut prouver s'arrête à « la
  route existe et lit le bon jeton depuis ses paramètres ». Qu'un lien réel, tapé dans une
  messagerie, ouvre CET écran sur un téléphone reste une vérification manuelle (voir Critères).
- **Aucune offre publiée pour ce coach** : état honnête distinct du jeton invalide (le coach
  existe, l'invitation est réelle, il n'a simplement rien à présenter encore) — pas un message
  d'erreur, un état vide construit comme les autres (`docs/composants/etats`).

---

## États

| État | Comportement |
|---|---|
| Chargement | Squelette du bandeau et de la carte d'offre |
| Normal | Profil du coach, offre mise en avant (ou la plus récente), les deux actions |
| Jeton absent ou invalide | État honnête (« Ce lien n'est plus valide »), aucune information sur le coach visé, aucune distinction avec un jeton simplement inconnu |
| Coach sans offre publiée | État vide dédié, jamais un message d'erreur |
| Erreur réseau | `EtatErreur` générique, action Réessayer |

---

## Critères d'acceptation

1. Fonctionne réellement sans session — vérifié déconnecté, pas seulement avec un compte sans
   profil.
2. Aucune donnée affichée n'excède le profil public déjà accordé à `anon` en L2 — testé contre
   le projet de développement.
3. Un jeton construit à la main (nom de coach connu, suffixe deviné) se comporte exactement
   comme un jeton absent — testé au banc, dans les deux cas.
4. « Créer mon compte » porte le jeton jusqu'à l'inscription ; le compte créé apparaît côté
   coach à l'état `compte_cree`, prénom + initiale seulement.
5. « Voir son profil d'abord » ouvre le même écran que la recherche, jamais une variante.
6. **Non automatisable, à vérifier sur un appareil physique** (`docs/prompts/L3bis.md`, point
   3) : un lien `https://` réel, tapé depuis une messagerie (pas la barre d'adresse d'un
   navigateur), ouvre l'application installée directement sur cet écran, avec le bon jeton —
   dépend d'une build de développement, d'un compte développeur Apple/Google et de
   l'hébergement réel du domaine, aucun des trois disponible dans cet environnement à ce jour.
7. Galerie, deux thèmes.
8. `npm run verif` passe.
