// Jeu de donnees de demonstration, fige a partir de docs/domaine.md §6, complete par les
// maquettes ou la fiche renvoie explicitement (maquettes/MyFavCoach-System_dc.html, blocs
// "Cartes" et ecran 01 ; maquettes/MyFavCoach-Client_dc.html ; noms de famille retrouves,
// coherents sur plusieurs ecrans, dans MyFavCoach-Parcours_dc.html et MyFavCoach-Coach_dc.html).
// Reference unique de contenu d'exemple pour toute l'application (CLAUDE.md §4) : aucun ecran
// n'invente ses propres noms, prix ou notes — tout vient d'ici.
//
// Fichier volontairement partiel : seuls les champs retrouves dans docs/domaine.md §6 ou dans
// les maquettes sont renseignes, pour couvrir les sections 7 et 8 de la galerie (L0-00). Le
// prompt P0.14 l'etoffe avec les offres completes, les programmes, les seances, les avis et les
// messages. Les offres "Programme seul" sont exclues du modele (arbitrage docs/domaine.md §0.9) :
// aucune n'apparait ici.
//
// Valeurs volontairement ecartees : maquettes/MyFavCoach-Tablette-Montre_dc.html donne une note
// 4,7 pour Ophelie et un prix 45 €/mois pour Thomas, mais ce meme bloc introduit un coach "Paul
// Nguyen" hors de la liste figee des 6 — signe d'un ecran non aligne sur le jeu de demonstration
// verrouille. Non repris ici.

export type FormatCoaching = 'presentiel' | 'visio';

export type CoachDemonstration = {
  prenom: string;
  nom: string;
  discipline: string;
  // Absent quand aucune source ne precise ni commune ni format pour ce coach.
  communeBase?: string;
  formats?: FormatCoaching[];
  // Absents ensemble : en dessous de 5 avis, la regle d'affichage (docs/domaine.md §5.1) est
  // le badge "Nouveau", jamais une note. Un coach sans les deux n'a simplement pas encore de
  // note publiee dans la fiche source.
  note?: number;
  nombreAvis?: number;
  // Provisoire : deviendra Offre (docs/domaine.md §3.3) a l'etoffement du prompt P0.14. Absent
  // quand aucune source ne donne ce champ pour ce coach.
  prixMensuelCentimes?: number;
  offreTitre?: string;
  offreDureeSemaines?: number;
  nombreAbonnes?: number;
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
    prixMensuelCentimes: 4900,
    // maquettes/MyFavCoach-Client_dc.html, écran "S'abonner à Yannick".
    offreTitre: 'Suivi complet',
  },
  {
    prenom: 'Nadia',
    nom: 'Belkacem',
    discipline: 'cybersécurité',
    formats: ['visio'],
    note: 4.9,
    prixMensuelCentimes: 3900,
    // maquettes/MyFavCoach-System_dc.html, bloc "Cartes" — la carte coach de référence de la
    // galerie (L0-00 pointe explicitement vers ce bloc).
    offreTitre: 'Sécuriser sa boîte sans DSI',
    offreDureeSemaines: 12,
    nombreAbonnes: 128,
  },
  {
    prenom: 'Inès',
    nom: 'Marchand',
    discipline: 'yoga',
    note: 4.8,
    prixMensuelCentimes: 2900,
    // maquettes/MyFavCoach-System_dc.html, écran 01, bloc "Coachs pour toi".
    offreTitre: 'Dos souple en 20 min par jour',
  },
  {
    prenom: 'Ophélie',
    nom: 'Renard',
    discipline: 'cuisine',
  },
  {
    prenom: 'Thomas',
    nom: 'Kieffer',
    discipline: 'développement professionnel',
  },
  {
    prenom: 'Marc',
    nom: 'Ferreira',
    discipline: 'RGPD',
    note: 4.7,
    prixMensuelCentimes: 5400,
    formats: ['visio'],
    // maquettes/MyFavCoach-System_dc.html, écran 02 (résultats de recherche).
    offreTitre: 'RGPD et hygiène numérique pour TPE',
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

export const seanceDemonstration: SeanceDemonstration = {
  titre: 'Bas du corps · force',
  nombreExercices: 6,
  dureeMinutes: 42,
  coach: 'Yannick Berthaud',
};

// maquettes/MyFavCoach-System_dc.html, bloc "Cartes" et écran 01, bloc "Reprends là où tu t'es
// arrêtée".
export type ProgrammeDemonstration = {
  titre: string;
  coach: string;
  nombreModules: number;
  moduleActuel: number;
  // Description brute de la maquette : deviendra Programme.dureeSemaines (docs/domaine.md §3.6)
  // a l'etoffement du prompt P0.14, qui ne donne pour l'instant qu'une charge hebdomadaire.
  chargeHebdomadaire: string;
};

export const programmeDemonstration: ProgrammeDemonstration = {
  titre: "Batch cooking d'automne",
  coach: 'Ophélie Renard',
  nombreModules: 8,
  moduleActuel: 3,
  chargeHebdomadaire: '3 h par semaine',
};

export type ClientDemonstration = {
  prenom: string;
  nom?: string;
  // "prenom nom" du coach auquel ce client est abonné, seulement quand la fiche le précise.
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
    ancienneteAbonnementMois: 3,
    auteureAvisMisEnAvant: true,
  },
  // Noms de famille retrouvés dans maquettes/MyFavCoach-Parcours_dc.html et
  // MyFavCoach-Coach_dc.html, absents de docs/domaine.md §6.
  { prenom: 'Karim', nom: 'Osei' },
  { prenom: 'Bruno', nom: 'Mercier' },
  { prenom: 'Léa', nom: 'Dumont' },
];
