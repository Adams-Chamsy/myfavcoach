import { initiales } from './initiales';

describe('initiales', () => {
  it('prend la premiere lettre des deux premiers mots, en majuscule', () => {
    expect(initiales('Nadia Belkacem')).toBe('NB');
  });

  it('ignore les mots au-dela du deuxieme', () => {
    expect(initiales('Marc Antoine Ferreira')).toBe('MA');
  });

  it('gere un seul mot', () => {
    expect(initiales('Karim')).toBe('K');
  });

  it('ignore les espaces superflus', () => {
    expect(initiales('  Léa   Dumont  ')).toBe('LD');
  });
});
