import { centimesDepuisSaisieEuros, saisieEurosDepuisCentimes } from './prix';

describe('conversion prix euros <-> centimes (docs/ecrans/L2-15, règle 4)', () => {
  it.each([
    ['49', 4900],
    ['49,90', 4990],
    ['49.90', 4990],
    ['49,9', 4990],
    [' 49,90 ', 4990],
    ['49 ,90', 4990], // espace insécable avant la virgule
    ['0', 0],
    ['500', 50000],
  ])('convertit "%s" en %d centimes', (saisie, attendu) => {
    expect(centimesDepuisSaisieEuros(saisie)).toBe(attendu);
  });

  it.each(['', '   ', 'abc', '49,999', '-10', '10,5,5'])(
    'refuse la saisie invalide "%s" (null, jamais une exception)',
    (saisie) => {
      expect(centimesDepuisSaisieEuros(saisie)).toBeNull();
    },
  );

  it('reconvertit des centimes en saisie euros, virgule fr-FR', () => {
    expect(saisieEurosDepuisCentimes(4990)).toBe('49,90');
    expect(saisieEurosDepuisCentimes(50000)).toBe('500,00');
    expect(saisieEurosDepuisCentimes(1000)).toBe('10,00');
  });
});
