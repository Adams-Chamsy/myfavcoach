import { neutraliserConsoleEnProduction } from './journalisation';

describe('neutraliserConsoleEnProduction', () => {
  // Restaure l'objet console réel après chaque cas : les autres suites (et les logs de Jest
  // lui-même) en dépendent.
  let original: Record<string, unknown>;
  beforeEach(() => {
    original = {};
    for (const m of ['log', 'debug', 'info', 'warn', 'error', 'trace'] as const) {
      original[m] = console[m];
    }
  });
  afterEach(() => {
    Object.assign(console, original);
  });

  it('en production, chaque méthode de console devient inerte (rend undefined, n’imprime rien)', () => {
    neutraliserConsoleEnProduction(false);

    for (const m of ['log', 'debug', 'info', 'warn', 'error', 'trace'] as const) {
      expect(typeof console[m]).toBe('function');
      // Un appel qui, avant, aurait pu imprimer un corps de requête (le poids en fait partie).
      expect(console[m]('poids_depart_grammes', 70000)).toBeUndefined();
    }
  });

  it('en développement, console reste intact', () => {
    const espion = jest.fn();
    console.log = espion;

    neutraliserConsoleEnProduction(true);

    console.log('message de développement');
    expect(espion).toHaveBeenCalledWith('message de développement');
  });
});
