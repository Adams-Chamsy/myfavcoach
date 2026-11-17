// Jeu de donnees de demonstration : la source est docs/domaine.md §6, complete par les
// maquettes ou la fiche renvoie explicitement (maquettes/MyFavCoach-System_dc.html, notamment
// l'ecran "03 Profil coach" et le bloc "Cartes" ; maquettes/MyFavCoach-Client_dc.html, ecrans
// "S'abonner a Yannick" et "07 Messagerie" ; noms de famille et messages retrouves, coherents
// sur plusieurs ecrans, dans MyFavCoach-Parcours_dc.html et MyFavCoach-Coach_dc.html). Le detail
// visuel (photos, mise en page) reste dans maquettes/ ; ce fichier n'en reprend que le contenu.
// Reference unique de contenu d'exemple pour toute l'application (CLAUDE.md §4) : aucun ecran
// n'invente ses propres noms, prix, notes, avis ou messages — tout vient d'ici.
//
// Fichier volontairement incomplet par endroits : seuls les champs retrouves dans
// docs/domaine.md §6 ou dans les maquettes sont renseignes. Yannick Berthaud est le seul coach
// pour lequel le dossier de design detaille une offre complete (bio, avantages, engagement
// humain) : les cinq autres n'ont que ce que leurs cartes montrent (titre, prix, note). Les
// offres "Programme seul" sont exclues du modele (arbitrage docs/domaine.md §0.9) : la carte
// "Programme seul" de Yannick (24 €/mois, maquettes/MyFavCoach-System_dc.html, ecran "03 Profil
// coach") a ete vue et deliberement ecartee, pas manquee.

import type { DetailAbonnement } from '@/services/donnees/port';

export type FormatCoaching = 'presentiel' | 'visio';

export type CoachDemonstration = {
  prenom: string;
  nom: string;
  discipline: string;
  // Absent quand aucune source ne precise ni commune ni format pour ce coach.
  communeBase?: string;
  formats?: FormatCoaching[];
  // En dessous de 5 avis, la regle d'affichage (docs/domaine.md §5.1) est le badge "Nouveau",
  // jamais une note : nombreAvis peut donc exister seul (des avis existent, juste trop peu pour
  // publier une note — cas d'Ophelie Renard, 3 avis). Un coach sans aucun des deux n'a
  // simplement pas encore d'avis dans la fiche source.
  note?: number;
  nombreAvis?: number;
};

export const coachsDemonstration: CoachDemonstration[] = [
  {
    prenom: 'Yannick',
    nom: 'Berthaud',
    discipline: 'préparation physique',
    communeBase: 'Lyon',
    formats: ['presentiel', 'visio'],
    note: 4.9,
    nombreAvis: 214,
  },
  {
    prenom: 'Nadia',
    nom: 'Belkacem',
    discipline: 'cybersécurité',
    communeBase: 'Paris',
    formats: ['visio'],
    note: 4.9,
    nombreAvis: 87,
  },
  {
    prenom: 'Inès',
    nom: 'Marchand',
    discipline: 'yoga',
    communeBase: 'Bordeaux',
    formats: ['visio', 'presentiel'],
    note: 4.8,
    nombreAvis: 62,
  },
  {
    // 3 avis, volontairement sans note : sous le seuil de 5 (docs/domaine.md §5.1), la regle
    // d'affichage est le badge "Nouveau", jamais une note. Ce coach exerce ce cas dans la
    // galerie et partout ou une carte coach est rendue.
    prenom: 'Ophélie',
    nom: 'Renard',
    discipline: 'cuisine',
    communeBase: 'Nantes',
    formats: ['visio'],
    nombreAvis: 3,
  },
  {
    prenom: 'Thomas',
    nom: 'Kieffer',
    discipline: 'développement professionnel',
    communeBase: 'Lille',
    formats: ['visio'],
    note: 4.6,
    nombreAvis: 11,
  },
  {
    prenom: 'Marc',
    nom: 'Ferreira',
    discipline: 'RGPD',
    communeBase: 'Toulouse',
    formats: ['visio', 'presentiel'],
    note: 4.7,
    nombreAvis: 41,
  },
];

// docs/domaine.md §3.3. "coach" identifie le profil par "prenom nom", cle de rapprochement avec
// coachsDemonstration ci-dessus (pas d'identifiant numerique dans ce jeu de demonstration).
export type OffreDemonstration = {
  coach: string;
  titre: string;
  prixMensuelCentimes: number;
  estMiseEnAvant: boolean;
  // 3 a 5 lignes (docs/domaine.md §3.3 : "benefices"). Seule l'offre de Yannick en a — c'est la
  // seule dont le dossier de design montre le detail complet (maquettes/MyFavCoach-System_dc.html,
  // ecran "03 Profil coach"). Absent pour les autres : ni benefices, ni description, ni
  // engagement humain ne sont donnes nulle part dans les maquettes lues. Une offre sans ces
  // champs n'est pas publiable en l'etat (docs/domaine.md §3.3, "une offre sans engagement
  // humain est refusee a la publication") : ce jeu de demonstration ne pretend pas le contraire.
  description?: string;
  benefices?: string[];
  offreDureeSemaines?: number;
  nombreAbonnes?: number;
};

export const offresDemonstration: OffreDemonstration[] = [
  {
    // maquettes/MyFavCoach-System_dc.html, ecran "03 Profil coach" (badge "LE PLUS CHOISI").
    coach: 'Yannick Berthaud',
    titre: 'Suivi complet',
    prixMensuelCentimes: 4900,
    estMiseEnAvant: true,
    description:
      "Je remets en mouvement les gens qui n'aiment pas les salles de sport. 12 ans de préparation physique, dont 4 en rééducation. On avance par paliers, sans culpabilité — et tu me dis tout, même les semaines ratées.",
    benefices: [
      'Programme adapté chaque semaine',
      '1 visio de 30 min par mois',
      // Corrigé le 1er novembre 2026 : la maquette écrit « Messagerie illimitée », et « illimité »
      // est un terme interdit (docs/domaine.md §2). « Réponse en 24 h » est une promesse
      // vérifiable ; « illimité » n'en était pas une.
      'Messagerie avec ton coach, réponse en 24 h',
    ],
  },
  {
    // maquettes/MyFavCoach-System_dc.html, bloc "Cartes" — la carte coach de reference de la
    // galerie (L0-00 pointe explicitement vers ce bloc).
    coach: 'Nadia Belkacem',
    titre: 'Sécuriser sa boîte sans DSI',
    prixMensuelCentimes: 3900,
    estMiseEnAvant: false,
    offreDureeSemaines: 12,
    nombreAbonnes: 128,
  },
  {
    // maquettes/MyFavCoach-System_dc.html, écran 01, bloc "Coachs pour toi".
    coach: 'Inès Marchand',
    titre: 'Dos souple en 20 min par jour',
    prixMensuelCentimes: 2900,
    estMiseEnAvant: false,
  },
  {
    // maquettes/MyFavCoach-System_dc.html, écran 02 (résultats de recherche).
    coach: 'Marc Ferreira',
    titre: 'RGPD et hygiène numérique pour TPE',
    prixMensuelCentimes: 5400,
    estMiseEnAvant: false,
  },
  {
    // maquettes/MyFavCoach-Parcours_dc.html, écran "24 · Mon compte & abonnements" (abonnement
    // de Camille, EN PAUSE). Titre raccourci par rapport au programme associe ("Batch cooking
    // d'automne", voir programmesDemonstration) : les deux formes viennent chacune d'un ecran
    // reel, pas d'une incoherence introduite ici.
    coach: 'Ophélie Renard',
    titre: 'Batch cooking',
    prixMensuelCentimes: 3400,
    estMiseEnAvant: false,
  },
  {
    // Aucune carte d'offre pour Thomas dans les maquettes lues : titre repris de son programme
    // (maquettes/MyFavCoach-System_dc.html, écran 01, bloc "Reprends là où tu t'es arrêtée" —
    // voir programmesDemonstration), seule phrase reelle associee a son activite de coaching.
    // Meme logique que la reprise du titre de programme d'Ophelie, sous une autre forme.
    coach: 'Thomas Kieffer',
    titre: 'Négocier son augmentation',
    prixMensuelCentimes: 4500,
    estMiseEnAvant: false,
  },
];

// maquettes/MyFavCoach-System_dc.html, écran 01, carte "Ta séance du jour" — reprise à
// l'identique dans le bloc "Cartes" du même fichier.
export type SeanceDemonstration = {
  titre: string;
  nombreExercices: number;
  dureeMinutes: number;
  coach: string; // "prenom nom"
};

export const seancesDemonstration: SeanceDemonstration[] = [
  {
    titre: 'Bas du corps · force',
    nombreExercices: 6,
    dureeMinutes: 42,
    coach: 'Yannick Berthaud',
  },
];

// maquettes/MyFavCoach-System_dc.html, bloc "Cartes" et écran 01, bloc "Reprends là où tu t'es
// arrêtée".
export type ProgrammeDemonstration = {
  titre: string;
  coach: string;
  nombreModules: number;
  moduleActuel: number;
  // Description brute de la maquette, pas un champ de docs/domaine.md §3.6 (Programme n'a pas
  // de duree hebdomadaire, seulement dureeSemaines) : absente quand la source n'en donne pas.
  chargeHebdomadaire?: string;
};

export const programmesDemonstration: ProgrammeDemonstration[] = [
  {
    titre: "Batch cooking d'automne",
    coach: 'Ophélie Renard',
    nombreModules: 8,
    moduleActuel: 3,
    chargeHebdomadaire: '3 h par semaine',
  },
  {
    // maquettes/MyFavCoach-System_dc.html, écran 01, bloc "Reprends là où tu t'es arrêtée".
    titre: 'Négocier son augmentation',
    coach: 'Thomas Kieffer',
    nombreModules: 6,
    moduleActuel: 5,
  },
];

export type ClientDemonstration = {
  prenom: string;
  nom?: string;
  // "prenom nom" du coach auquel ce client est abonné.
  abonneAuCoach?: string;
  semaineAbonnement?: number;
  seancesFaitesSemaine?: number;
  seancesProgrammeesSemaine?: number;
  ancienneteAbonnementMois?: number;
  auteureAvisMisEnAvant?: boolean;
};

export const clientsDemonstration: ClientDemonstration[] = [
  {
    prenom: 'Camille',
    nom: 'Dupré',
    abonneAuCoach: 'Yannick Berthaud',
    semaineAbonnement: 3,
    seancesFaitesSemaine: 3,
    seancesProgrammeesSemaine: 5,
  },
  {
    // Nom complet "Lambert" (maquettes/MyFavCoach-Coach_dc.html, MyFavCoach-Parcours_dc.html).
    // L'avis mis en avant l'abrège en "Sophie L." (docs/domaine.md §6, maquettes/
    // MyFavCoach-System_dc.html écran "Ce qu'en disent ses abonnés") : forme publique tronquée,
    // pas un nom de famille différent.
    prenom: 'Sophie',
    nom: 'Lambert',
    // maquettes/MyFavCoach-System_dc.html, écran "03 Profil coach" : l'avis mis en avant y
    // apparaît, donc son auteure est abonnée à Yannick.
    abonneAuCoach: 'Yannick Berthaud',
    ancienneteAbonnementMois: 3,
    auteureAvisMisEnAvant: true,
  },
  // Prenoms et coach retrouvés dans la boîte de réception de Yannick
  // (maquettes/MyFavCoach-Parcours_dc.html, écran "Boîte de réception coach") — les cinq
  // personnes qui y écrivent sont donc ses cinq clientes et clients. Noms de famille : Osei vient
  // de cette même maquette ; Talbot et Nguyen remplacent les noms de famille (Mercier, Dumont)
  // lus dans cette maquette — corrigés sur instruction explicite, qui l'emporte ici.
  { prenom: 'Karim', nom: 'Osei', abonneAuCoach: 'Yannick Berthaud' },
  { prenom: 'Bruno', nom: 'Talbot', abonneAuCoach: 'Yannick Berthaud' },
  { prenom: 'Léa', nom: 'Nguyen', abonneAuCoach: 'Yannick Berthaud' },
];

// docs/domaine.md §3.11.
export type AvisDemonstration = {
  client: string;
  coach: string;
  note: number;
  texte: string;
};

export const avisDemonstration: AvisDemonstration[] = [
  {
    // maquettes/MyFavCoach-System_dc.html, écran "03 Profil coach", bloc "Ce qu'en disent ses
    // abonnés" — 5 étoiles pleines. C'est l'avis mis en avant de docs/domaine.md §6.
    client: 'Sophie Lambert',
    coach: 'Yannick Berthaud',
    note: 5,
    texte:
      'Trois mois et je ne rate plus une séance. Il ajuste dès que je bloque, et il ne me sort jamais le discours "no pain no gain".',
  },
];

// L4-27a — l'avis en cours de saisie de la maquette 27a (maquettes/MyFavCoach-Avis_dc.html,
// « 27a Deposer un avis ») : cinq étoiles, « Écoute » et « Exigence » cochées, le texte tel
// quel, « depuis 4 mois ». Sert à la galerie et au corpus d'accessibilité (27a, modification).
export const saisieAvisDemonstration = {
  dureeSuiviMois: 4,
  note: 5,
  etiquettes: ['ecoute', 'exigence'],
  texte:
    'Il adapte vraiment le programme quand je lui dis que quelque chose coince. Le genou dont je lui parlais a été pris au sérieux dès la semaine suivante.',
} as const;

// docs/domaine.md §3.8. "quandAffiche" reprend tel quel le libellé relatif de la maquette
// ("hier", "lundi"...) : aucune des deux maquettes lues ne fixe de date de référence absolue
// pour "aujourd'hui", donc aucune ne permet de calculer un envoyeLe ISO 8601 réel sans
// l'inventer. À trancher si un vrai horodatage devient nécessaire ailleurs que dans la galerie.
export type MessageDemonstration = {
  client: string;
  coach: string;
  auteur: 'client' | 'coach';
  texte: string;
  quandAffiche: string;
};

export const messagesDemonstration: MessageDemonstration[] = [
  // maquettes/MyFavCoach-Client_dc.html, écran "07 Messagerie" — conversation Camille/Yannick
  // dans l'ordre d'affichage, recoupée avec la boîte de réception de Yannick
  // (maquettes/MyFavCoach-Parcours_dc.html) : même texte de Camille dans les deux écrans.
  {
    client: 'Camille Dupré',
    coach: 'Yannick Berthaud',
    auteur: 'coach',
    texte: "Alors, cette semaine 3 ? J'ai vu que tu avais sauté la séance de jeudi 👀",
    quandAffiche: 'hier',
  },
  {
    client: 'Camille Dupré',
    coach: 'Yannick Berthaud',
    auteur: 'client',
    texte: 'Réunion qui a débordé… j’ai rattrapé vendredi matin par contre !',
    quandAffiche: 'hier',
  },
  // maquettes/MyFavCoach-Parcours_dc.html, écran "Boîte de réception coach" (celle de Yannick).
  {
    client: 'Sophie Lambert',
    coach: 'Yannick Berthaud',
    auteur: 'client',
    texte: 'Merci pour l’ajustement, c’était parfait !',
    quandAffiche: 'lundi',
  },
  {
    client: 'Bruno Talbot',
    coach: 'Yannick Berthaud',
    auteur: 'client',
    texte: 'Je change de carte ce week-end, désolé',
    quandAffiche: '12 août',
  },
  // Karim Osei a aussi écrit dans cette boîte de réception, mais en message vocal (0:47) : hors
  // périmètre (docs/perimetre.md §3, "Messages vocaux et vidéo"), donc pas repris ici. Léa
  // Nguyen n'y a pas de message, seulement un statut ("Inactive 12 j").
];

// docs/ecrans/L1-05-onboarding-client.md, étape 2/4 : liste figée dictée mot pour mot par la
// fiche elle-même (pas une invention à partir des maquettes, cet écran n'en a pas au-delà de
// l'écran 22 repris au pixel) — huit valeurs, dans cet ordre exact.
export type ObjectifOnboarding = {
  cle: string;
  libelle: string;
};

export const objectifsOnboarding: ObjectifOnboarding[] = [
  { cle: 'reprendre-le-sport', libelle: 'Reprendre le sport' },
  { cle: 'perdre-du-poids', libelle: 'Perdre du poids' },
  { cle: 'prendre-du-muscle', libelle: 'Prendre du muscle' },
  { cle: 'mieux-manger', libelle: 'Mieux manger' },
  { cle: 'gerer-le-stress', libelle: 'Gérer le stress' },
  { cle: 'progresser-au-travail', libelle: 'Progresser au travail' },
  { cle: 'apprendre-une-competence', libelle: 'Apprendre une compétence' },
  { cle: 'autre', libelle: 'Autre' },
];

// docs/ecrans/L1-05-onboarding-client.md, étape 2/4 : "3 tuiles exclusives (1–2 fois, 3–4 fois,
// 5 fois et plus par semaine)" — une liste en prose, pas trois chaînes ponctuées comme les huit
// objectifs ci-dessus. Rendu ici en trois libellés autonomes (utiles seuls au lecteur d'écran) :
// le tiret devient "à" (typographie orale/écran, pas un tiret cadratin), et "par semaine" est
// répété sur les trois — la fiche ne l'écrit qu'une fois par économie de prose, pas pour exclure
// les deux premières tuiles.
export type RythmeOnboarding = {
  cle: string;
  libelle: string;
};

export const rythmesOnboarding: RythmeOnboarding[] = [
  { cle: '1-2-fois', libelle: '1 à 2 fois par semaine' },
  { cle: '3-4-fois', libelle: '3 à 4 fois par semaine' },
  { cle: '5-fois-et-plus', libelle: '5 fois et plus par semaine' },
];

// La liste des disciplines a vécu ici (disciplinesCoach) jusqu'au 13 septembre 2026 : retirée à
// la clôture de la validation de L3 — une règle métier n'a rien à faire dans un jeu de
// démonstration figé (CLAUDE.md §3). Elle vit désormais dans une vraie table
// (`disciplines`, 0020_creer_disciplines_reference.sql, `docs/domaine.md` §3.2bis), lue par
// `port.lireDisciplines()` — `DISCIPLINES_FIGEES` (`src/services/donnees/faux.ts`) porte le même
// contenu pour le faux port, qui ne touche jamais Postgres.

// L4-04b (P4.6b) — le récapitulatif de paiement que la galerie et le corpus d'accessibilité
// rendent. maquettes/MyFavCoach-Client_dc.html, bloc « 04b · Récapitulatif & paiement » :
// « Suivi complet » de Yannick Berthaud à 49 €, « puis le 18 de chaque mois ». La maquette ne
// donne que le JOUR : le mois et l'année de la date du prochain prélèvement sont choisis ici
// (docs/decisions-en-attente.md, 11 novembre 2026), jamais lus nulle part.
export const recapitulatifPaiementDemonstration = {
  prixCentimes: 4900,
  totalCentimes: 4900,
  jourPrelevement: 18,
  prochainPrelevementLe: '2026-12-18',
} as const;

// L4-04c (P4.7) — le détail d'abonnement que la galerie et le corpus d'accessibilité rendent :
// l'abonnement de démonstration à « Suivi complet » de Yannick Berthaud (Lyon), payé 49 € par la
// carte de test •••• 4242 (maquette 04c, MyFavCoach-L2_dc.html), prochain prélèvement à la date
// de recapitulatifPaiementDemonstration. Les engagements sont ceux de l'offre de démonstration.
// Identifiants fictifs, jamais lus nulle part.
export const detailAbonnementDemonstration: DetailAbonnement = {
  id: 'abonnement-demonstration',
  statut: 'actif',
  moyen: 'carte',
  moyenDerniersChiffres: '4242',
  prixFigeCentimes: 4900,
  prochainPrelevementLe: '2026-12-18',
  pauseJusquLe: null,
  finAccesLe: null,
  coachId: 'coach-yannick',
  offreId: 'offre-suivi',
  offreTitre: 'Suivi complet',
  offreEngagementHumain: ['ajustement hebdomadaire', 'visio mensuelle'],
  coachPrenom: 'Yannick',
  coachNom: 'Berthaud',
  coachCommuneBase: 'Lyon',
  derniereFactureMontantCentimes: 4900,
  derniereFacturePayeeLe: '2026-11-18T10:00:00.000Z',
  dernierEchecMotif: null,
  dernierEchecEcheanceLe: null,
  graceJusquAu: null,
  regularisationAvantLe: null,
  prochaineTentativeLe: null,
  nouveauMoyenEnregistre: false,
};

// L4-20 (P4.7) — le même abonnement, après un prélèvement d'échéance refusé. Le motif (« plafond
// de carte atteint ») et la carte •••• 4218 sont ceux de la maquette 20 (MyFavCoach-Etats_dc.html).
// La maquette ne donne aucune date : elles sont choisies ici (docs/decisions-en-attente.md,
// 15 novembre 2026) à partir de l'échéance du 18 décembre 2026 — fin de la période de grâce à
// J+6, régularisation avant J+37, prochaine tentative le lendemain (docs/domaine.md §4.4).
export const detailAbonnementImpayeDemonstration: DetailAbonnement = {
  ...detailAbonnementDemonstration,
  statut: 'impaye',
  moyenDerniersChiffres: '4218',
  prochainPrelevementLe: null,
  dernierEchecMotif: 'plafond_atteint',
  dernierEchecEcheanceLe: '2026-12-18',
  graceJusquAu: '2026-12-24',
  regularisationAvantLe: null,
  prochaineTentativeLe: '2026-12-19',
};

export const detailAbonnementSuspenduDemonstration: DetailAbonnement = {
  ...detailAbonnementImpayeDemonstration,
  statut: 'suspendu',
  graceJusquAu: null,
  regularisationAvantLe: '2027-01-24',
  prochaineTentativeLe: null,
};

// L5 — écran 13 Revenus (maquettes/MyFavCoach-Coach_dc.html, « 13 Revenus »). La maquette donne
// le mois d'août 2026 : 28 abonnements pour 3 020 €, une commission de 324 €, et deux virements
// (« 31 juillet, versé, 2 604 € » ; « 30 juin, en cours, 2 380 € »). La ligne « 4 séances à
// l'unité · 220 € » est retirée (hors périmètre) : le net d'août est donc 3 020 − 324 = 2 696 €.
// Les nets des cinq mois précédents ne figurent pas dans la maquette : ils sont CHOISIS ici, en
// proportion des hauteurs de ses barres (42, 56, 48, 70, 64 et 100 %), arrondis à l'euro. Le
// solde et la date du prochain virement (le 5 du mois suivant, docs/domaine.md §4.8) sont choisis
// aussi (docs/decisions-en-attente.md, P5.6).
export const revenusDemonstration = [
  {
    mois: '2026-08-01',
    encaissementsCentimes: 302000,
    nombrePaiements: 28,
    commissionCentimes: 32400,
    netCentimes: 269600,
  },
  {
    mois: '2026-07-01',
    encaissementsCentimes: 191500,
    nombrePaiements: 18,
    commissionCentimes: 19000,
    netCentimes: 172500,
  },
  {
    mois: '2026-06-01',
    encaissementsCentimes: 209200,
    nombrePaiements: 20,
    commissionCentimes: 20500,
    netCentimes: 188700,
  },
  {
    mois: '2026-05-01',
    encaissementsCentimes: 143400,
    nombrePaiements: 14,
    commissionCentimes: 14000,
    netCentimes: 129400,
  },
  {
    mois: '2026-04-01',
    encaissementsCentimes: 167300,
    nombrePaiements: 16,
    commissionCentimes: 16300,
    netCentimes: 151000,
  },
  {
    mois: '2026-03-01',
    encaissementsCentimes: 125500,
    nombrePaiements: 12,
    commissionCentimes: 12300,
    netCentimes: 113200,
  },
] as const;

export const soldeDemonstration = {
  soldeCentimes: 269600,
  versementEnCours: false,
  prochainVersementLe: '2026-09-05',
  compteOperationnel: true,
} as const;

export const versementsDemonstration = [
  {
    id: 'versement-juillet',
    montantCentimes: 260400,
    fraisCentimes: 0,
    mode: 'mensuel',
    statut: 'verse',
    emisLe: '2026-07-31T06:00:00.000Z',
    verseLe: '2026-07-31T06:00:05.000Z',
  },
  {
    id: 'versement-juin',
    montantCentimes: 238000,
    fraisCentimes: 0,
    mode: 'mensuel',
    statut: 'en_cours',
    emisLe: '2026-06-30T06:00:00.000Z',
    verseLe: null,
  },
] as const;

// L5 — C-05 : une facture de l'abonnement de démonstration (Sophie Lambert chez Yannick
// Berthaud, « Suivi complet », 49 €). Le SIREN (clé de contrôle juste, sans existence réelle) et
// l'adresse sont CHOISIS ici : aucune maquette n'en donne. Yannick est en franchise en base de
// TVA (choisi aussi), d'où HT = TTC et TVA nulle.
export const factureDemonstration = {
  resume: {
    id: 'facture-demonstration',
    numero: '2026-000001',
    libelle: 'Suivi complet',
    autrePartie: 'Yannick Berthaud',
    periodeDu: '2026-11-18',
    periodeAu: '2026-12-17',
    montantTtcCentimes: 4900,
    commissionCentimes: null,
    payeeLe: '2026-11-18T10:00:00.000Z',
  },
  detail: {
    numero: '2026-000001',
    emiseLe: '2026-11-18T10:00:00.000Z',
    payeeLe: '2026-11-18T10:00:00.000Z',
    vendeurPrenom: 'Yannick',
    vendeurNom: 'Berthaud',
    vendeurSiren: '732829320',
    vendeurAdresse: '12 rue des Lilas, 69003 Lyon',
    vendeurRegimeTva: 'franchise_en_base',
    vendeurTauxTvaPourMille: null,
    clientPrenom: 'Sophie',
    clientNom: 'Lambert',
    libelle: 'Suivi complet',
    periodeDu: '2026-11-18',
    periodeAu: '2026-12-17',
    montantTtcCentimes: 4900,
    montantHtCentimes: 4900,
    tvaCentimes: 0,
    commissionCentimes: null,
  },
} as const;
