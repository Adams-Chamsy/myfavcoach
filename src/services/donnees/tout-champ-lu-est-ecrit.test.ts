import type { InformationsCompte, ModificationsInformations, ResultatCoachRecherche } from './port';

// Garde structurelle, écrite le 17 septembre 2026 après la quatrième fois que le même défaut
// est trouvé PAR HASARD (formats, commune_base_insee, commune côté client, parcours_texte,
// langues — docs/dette.md) : une colonne réelle, lue par un écran ou par rechercher_coachs(),
// que pourtant aucun formulaire n'écrit jamais. Rien ne le criait avant aujourd'hui — ni le
// typecheck (les champs manquaient des DEUX côtés du port, lecture ET écriture, donc rien n'y
// était incohérent), ni un test d'écran (informations.tsx compilait très bien sans jamais
// afficher ces quatre champs).
//
// Ce que ce fichier vérifie, et pas plus : à l'intérieur de src/services/donnees/port.ts, tout
// champ du type LU par « Mes informations » (`InformationsCompte`) ou par `rechercher_coachs()`
// (`ResultatCoachRecherche`) existe aussi dans le type qu'un formulaire peut ÉCRIRE
// (`ModificationsInformations`) — sauf les exceptions nommées une par une ci-dessous, jamais un
// motif générique. Ça ne prouve pas qu'un écran RÉEL affiche/écrit chaque champ (ça, ce sont les
// tests d'écran, informations.test.tsx) : ça prouve que le PORT ne peut plus, à lui seul,
// laisser un champ de lecture sans aucune contrepartie d'écriture, silencieusement.
//
// Ce que ce fichier NE PEUT PAS attraper : un champ qui existe en vrai dans le schéma SQL
// (`profils_coach`/`profils_client`) mais qui n'a jamais été ajouté à `InformationsCompte` NI à
// `ResultatCoachRecherche` — exactement le trou des quatre champs qui ont motivé ce test. Une
// fois qu'un champ apparaît dans le port (lecture ou recherche), ce fichier empêche l'écriture
// de rester oubliée ; il ne peut pas forcer quelqu'un à ajouter le champ au port en premier
// lieu. C'est un filet, pas une garantie contre schéma réel et types TypeScript qui divergent —
// cette divergence-là ne se prouve que contre la vraie base (voir docs/prompts/L3.md, « Porte de
// sortie », point 2 : lister les champs réels non couverts reste une vérification à la main,
// lot par lot).
//
// Technique : chaque « témoin » ci-dessous est un objet littéral typé `Record<clé, true>` — s'il
// manque une clé (ou en a une de trop), TypeScript refuse de compiler cette ligne. Les témoins
// ne peuvent donc jamais dériver silencieusement des types réels ; la comparaison à l'exécution
// (Object.keys) devient alors un vrai test, pas une liste recopiée à la main qui pourrait
// oublier le prochain champ ajouté.

type ChampsLusCoach = keyof Extract<InformationsCompte, { profil: 'coach' }>;
const champsLusCoach: Record<ChampsLusCoach, true> = {
  profil: true,
  prenom: true,
  nom: true,
  discipline: true,
  titreCourt: true,
  bio: true,
  communeBaseInsee: true,
  formats: true,
  parcoursTexte: true,
  langues: true,
  dateNaissance: true,
};

type ChampsEcritsCoach = keyof Extract<ModificationsInformations, { profil: 'coach' }>;
const champsEcritsCoach: Record<ChampsEcritsCoach, true> = {
  profil: true,
  prenom: true,
  nom: true,
  titreCourt: true,
  bio: true,
  communeBaseInsee: true,
  formats: true,
  parcoursTexte: true,
  langues: true,
};

// `profil` : discriminant de l'union, pas une donnée. `dateNaissance` : colonne de `comptes`,
// hors GRANT UPDATE, porte la règle des 18 ans — jamais éditable par construction.
// `discipline` : décision produit P1.14, liste figée, lecture seule tant qu'aucun écran de
// changement de discipline n'existe.
const EXCEPTIONS_LECTURE_SEULE_COACH = ['profil', 'dateNaissance', 'discipline'];

type ChampsLusClient = keyof Extract<InformationsCompte, { profil: 'client' }>;
const champsLusClient: Record<ChampsLusClient, true> = {
  profil: true,
  prenom: true,
  nom: true,
  communeInsee: true,
  dateNaissance: true,
};

type ChampsEcritsClient = keyof Extract<ModificationsInformations, { profil: 'client' }>;
const champsEcritsClient: Record<ChampsEcritsClient, true> = {
  profil: true,
  prenom: true,
  nom: true,
  communeInsee: true,
};

const EXCEPTIONS_LECTURE_SEULE_CLIENT = ['profil', 'dateNaissance'];

// Champs de ResultatCoachRecherche (ce que rechercher_coachs() rend, 0023) qui NE sont PAS des
// colonnes de ProfilCoach — identifiants et champs d'Offre, hors sujet ici — ou qui sont des
// exceptions déjà justifiées plus haut (discipline) ou ailleurs (photoUrl : aucun bucket
// Supabase Storage, docs/dette.md — absent de l'écran entier, pas seulement en lecture seule).
// Un simple type, pas un témoin à l'exécution (rien ici n'a besoin d'être lu en `Object.keys`) —
// mais l'exhaustivité tient quand même : un nouveau champ sur ResultatCoachRecherche que
// personne n'ajoute ici tombe automatiquement dans `ChampsRechercheAVerifier` plus bas, et casse
// la compilation du témoin qui en dérive tant qu'il n'est pas classé d'un côté ou de l'autre.
type ChampsRechercheHorsPerimetre =
  'offreId' | 'coachId' | 'titre' | 'prixCentimes' | 'discipline' | 'photoUrl';

type ChampsRechercheAVerifier = Exclude<keyof ResultatCoachRecherche, ChampsRechercheHorsPerimetre>;
const champsRechercheAVerifier: Record<ChampsRechercheAVerifier, true> = {
  prenom: true,
  nom: true,
  titreCourt: true,
  communeBaseInsee: true,
  formats: true,
};

describe('tout champ lu par un écran ou par rechercher_coachs() est écrit par un formulaire', () => {
  it('profil coach : InformationsCompte (lu) ⊆ ModificationsInformations (écrit), hors lecture seule documentée', () => {
    const lus = Object.keys(champsLusCoach).filter(
      (c) => !EXCEPTIONS_LECTURE_SEULE_COACH.includes(c),
    );
    const ecrits = Object.keys(champsEcritsCoach);
    const manquants = lus.filter((c) => !ecrits.includes(c));
    expect(manquants).toEqual([]);
  });

  it('profil client : InformationsCompte (lu) ⊆ ModificationsInformations (écrit), hors lecture seule documentée', () => {
    const lus = Object.keys(champsLusClient).filter(
      (c) => !EXCEPTIONS_LECTURE_SEULE_CLIENT.includes(c),
    );
    const ecrits = Object.keys(champsEcritsClient);
    const manquants = lus.filter((c) => !ecrits.includes(c));
    expect(manquants).toEqual([]);
  });

  it('rechercher_coachs() : tout champ de ProfilCoach qu’elle rend est écrit par le formulaire coach', () => {
    const lusParLaRecherche = Object.keys(champsRechercheAVerifier);
    const ecrits = Object.keys(champsEcritsCoach);
    const manquants = lusParLaRecherche.filter((c) => !ecrits.includes(c));
    expect(manquants).toEqual([]);
  });
});
