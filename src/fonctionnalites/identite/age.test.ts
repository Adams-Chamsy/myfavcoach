import { AGE_MINIMUM_ANNEES, calculerAge, estMajeur, formatDateISO } from './age';

describe('calculerAge / estMajeur', () => {
  // Critère 1 de docs/ecrans/L1-02-creation-compte.md : "Une date de naissance à 17 ans et
  // 364 jours est refusée ; à 18 ans exactement, acceptée. Deux tests, aux bornes."
  it('refuse 17 ans et 364 jours', () => {
    const aujourdHui = new Date(2026, 8, 3); // 3 septembre 2026 (mois 0-indexé)
    const dateNaissance = new Date(2008, 8, 4); // né la veille de son 18e anniversaire
    expect(calculerAge(dateNaissance, aujourdHui)).toBe(17);
    expect(estMajeur(dateNaissance, aujourdHui)).toBe(false);
  });

  it('accepte 18 ans exactement, jour pour jour', () => {
    const aujourdHui = new Date(2026, 8, 3);
    const dateNaissance = new Date(2008, 8, 3); // anniversaire aujourd'hui même
    expect(calculerAge(dateNaissance, aujourdHui)).toBe(AGE_MINIMUM_ANNEES);
    expect(estMajeur(dateNaissance, aujourdHui)).toBe(true);
  });

  it('refuse un nourrisson, accepte une personne largement majeure', () => {
    const aujourdHui = new Date(2026, 8, 3);
    expect(estMajeur(new Date(2026, 0, 1), aujourdHui)).toBe(false);
    expect(estMajeur(new Date(1980, 0, 1), aujourdHui)).toBe(true);
  });
});

describe('formatDateISO', () => {
  // Jamais toISOString() (voir le commentaire de age.ts) : ce test prouve l'absence du piège
  // en construisant une Date locale dont le jour UTC serait différent si l'implémentation
  // passait par toISOString() sur un fuseau en avance sur UTC.
  it('sérialise en AAAA-MM-JJ à partir des composants locaux, sans décalage UTC', () => {
    expect(formatDateISO(new Date(2008, 8, 3))).toBe('2008-09-03');
    expect(formatDateISO(new Date(2000, 0, 1))).toBe('2000-01-01');
  });

  it('capitonne le mois et le jour sur deux chiffres', () => {
    expect(formatDateISO(new Date(2005, 2, 9))).toBe('2005-03-09');
  });
});
