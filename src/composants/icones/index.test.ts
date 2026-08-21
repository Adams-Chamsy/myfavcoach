import { icones } from './index';

// Liste ecrite en dur, dans l'ordre de docs/design-system.md §5 : si ce test echoue apres
// une modification de la fiche, c'est la fiche (ou l'extraction) qu'il faut regarder, pas
// ce test qu'il faut faire passer en le modifiant a la legere.
const NOMS_ATTENDUS = [
  'accueil',
  'recherche',
  'seance',
  'message',
  'agenda',
  'pilotage',
  'carte',
  'clients',
  'profil',
  'ajouter',
  'valide',
  'fermer',
  'retour',
  'suivant',
  'deplier',
  'filtres',
  'lecture',
  'pause',
  'vocal',
  'visio',
  'raccrocher',
  'notification',
  'favori',
  'note',
  'securite',
  'document',
  'duree',
  'information',
  'alerte',
  'modifier',
  'reordonner',
  'virement',
  'hors-ligne',
  'reessayer',
  'reglages',
  'plus',
];

describe('dictionnaire des icones', () => {
  it('contient exactement les 36 noms attendus', () => {
    expect(NOMS_ATTENDUS).toHaveLength(36);
    expect(Object.keys(icones).sort()).toEqual([...NOMS_ATTENDUS].sort());
  });

  it('associe chaque nom a un composant', () => {
    for (const nom of NOMS_ATTENDUS) {
      expect(typeof icones[nom as keyof typeof icones]).toBe('function');
    }
  });
});
