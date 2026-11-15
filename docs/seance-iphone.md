# Séance iPhone — ce qui reste à voir sur appareil

Une seule liste, ouverte le 15 novembre 2026 (mandat du même jour, `docs/decisions-en-attente.md`).
Chaque étape d'écran est close par Claude dans un navigateur piloté, sur la base de dev ; ce qui
ne peut se voir que sur un téléphone est écrit ici, dans l'ordre où le faire. Une ligne se coche
quand le développeur l'a vue ; un défaut trouvé va dans `docs/dette.md` ou se corrige.

Ce que le navigateur ne voit pas, par nature (`CLAUDE.md` §6 et §8) : les modules natifs sans
rendu web, les zones sûres réelles, le clavier, les gestes du système, le retour dans
l'application depuis un navigateur du téléphone, la mise à l'échelle du texte à 200 %.

Préparation : `npm start`, le relais Stripe (`npm run relais:stripe`), l'iPhone sur le même
réseau. Comptes : `comptes-scenarios.local.md`.

## L4 — abonnement et paiement

- [ ] **04b → page de paiement → retour.** « Payer » ouvre la page du prestataire dans le
      navigateur intégré ; le fermer (ou finir le paiement) ramène à 04b, qui constate seul.
      Carte `4242 4242 4242 4242`, puis l'IBAN de test `AT61 1904 3002 3457 3201` (reste « en
      cours » quelques minutes : c'est lui qui montre 04c en variante SEPA).
- [ ] **04c.** Aucun geste de retour ne ramène à 04b ni à 04a ; « Voir le profil » mène au profil.
- [ ] **24b.** Pause (feuille basse, jetons 2/4/6/8 semaines), reprise, résiliation (la modale
      dit la date d'effet), annulation ; rien de tronqué à 200 %.
- [ ] **Écran 20, retour de la page du nouveau moyen.** C'est le seul morceau de l'écran 20 que
      le web ne montre pas : sur le web, la session ne survit pas au retour de la page. Sur
      l'iPhone, fermer la page doit afficher « Nouveau moyen enregistré, le prochain essai aura
      lieu le … ». Il faut un abonnement impayé : la préparation est décrite dans
      `docs/decisions-en-attente.md` (ligne « Clôture de l'écran 20 ») ; Claude peut la refaire
      sur un compte au choix juste avant la séance.
- [ ] **Écran 20, zones sûres.** L'en-tête sous l'encoche, le bouton « Changer de moyen de
      paiement » au-dessus de la barre gestuelle.
- [ ] **27a, clavier.** Le champ « Raconte, si tu veux » sur plusieurs lignes : le clavier ne
      cache ni le champ ni « Publier mon avis » ; les cinq étoiles se touchent sans viser ; à
      200 %, les huit étiquettes passent à la ligne sans être tronquées. Il faut un client
      dont le suivi a 30 jours : Claude en prépare un juste avant la séance (même préparation
      que la clôture de 27a, `docs/decisions-en-attente.md`).
