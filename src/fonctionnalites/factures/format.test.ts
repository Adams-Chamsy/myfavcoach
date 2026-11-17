import { dateCourte, dateLongue, euros, eurosCourts } from './format';

// Écriture française des montants et des dates (L5). Trouvé dans le navigateur le 17 novembre
// 2026 : le rappel de commission écrivait « jusqu'au 1 février ».
describe('format des factures et des revenus', () => {
  it('le premier du mois s’écrit « 1er », les autres jours en chiffres', () => {
    expect(dateCourte('2027-02-01')).toBe('1er février');
    expect(dateLongue('2027-02-01')).toBe('1er février 2027');
    expect(dateCourte('2026-12-11')).toBe('11 décembre');
    expect(dateLongue('2026-11-18T10:00:00.000Z')).toBe('18 novembre 2026');
  });

  it('les montants : deux décimales, sauf en version courte quand ils sont ronds', () => {
    expect(euros(13230)).toBe('132,30 €');
    expect(eurosCourts(14700)).toBe('147 €');
    expect(eurosCourts(13230)).toBe('132,30 €');
  });
});
