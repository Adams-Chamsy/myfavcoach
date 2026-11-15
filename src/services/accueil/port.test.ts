import { estIdentifiantCoach, lireRetourCoach } from './port';

const COACH = '11111111-2222-4333-8444-555555555555';
const MAINTENANT = 10_000_000;

describe('destination de reprise publique bornée (fiche L1-01a)', () => {
  it.each(['https://exemple.fr', '/(compte)/confidentialite', '../compte', 'coach-1', '', null])(
    'refuse une destination qui ne soit pas un UUID : %s',
    (valeur) => {
      expect(estIdentifiantCoach(valeur)).toBe(false);
    },
  );
  it('accepte un profil public récent et ne conserve que son identifiant et sa date', () => {
    expect(
      lireRetourCoach(
        JSON.stringify({ coachId: COACH, creeLe: MAINTENANT - 1, url: 'https://exemple.fr' }),
        MAINTENANT,
      ),
    ).toEqual({ coachId: COACH, creeLe: MAINTENANT - 1 });
  });
  it.each([
    null,
    '{',
    '{}',
    '[]',
    JSON.stringify({ coachId: COACH, creeLe: 0 }),
    JSON.stringify({ coachId: COACH, creeLe: MAINTENANT + 1 }),
    JSON.stringify({ coachId: '/(compte)/moi', creeLe: MAINTENANT }),
  ])('ignore un contexte absent, mal formé ou périmé : %s', (brut) => {
    expect(lireRetourCoach(brut, MAINTENANT)).toBeNull();
  });
});
