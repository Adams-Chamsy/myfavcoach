import { echeanceQuaranteHuitHeuresOuvrees } from './echeance-verification';

describe('échéance 48 h ouvrées (L2-09)', () => {
  it('ajoute 48 h pleines quand aucun week-end ne s’intercale', () => {
    // Lundi 10h -> mercredi 10h, aucun week-end traversé.
    const echeance = echeanceQuaranteHuitHeuresOuvrees('2026-09-07T10:00:00.000Z');
    expect(echeance.toISOString()).toBe('2026-09-09T10:00:00.000Z');
  });

  it('saute le week-end : un dépôt le vendredi repousse l’échéance de deux jours', () => {
    // Vendredi 10h : 48 h ouvrées sautent samedi/dimanche -> mardi 10h.
    const echeance = echeanceQuaranteHuitHeuresOuvrees('2026-09-11T10:00:00.000Z');
    expect(echeance.toISOString()).toBe('2026-09-15T10:00:00.000Z');
  });
});
