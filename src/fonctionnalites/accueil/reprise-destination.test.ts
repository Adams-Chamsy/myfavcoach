import { determinerDestination } from '@/fonctionnalites/identite/garde';
import type { SessionAuth } from '@/services/auth/port';
import { etatProfilsParDefaut } from '@/services/donnees/faux';

const COACH = '11111111-2222-4333-8444-555555555555';
const session: SessionAuth = {
  compteId: 'compte-1',
  email: 'camille@exemple.fr',
  emailVerifie: true,
  jetonAcces: 'test',
  jetonRafraichissement: 'test',
  intentionCoach: false,
};
const retour = () => ({ coachId: COACH, creeLe: Date.now() });

describe('reprise après authentification sans contourner l’onboarding', () => {
  it('retrouve le profil quand le client a terminé son onboarding', () => {
    expect(
      determinerDestination(
        session,
        etatProfilsParDefaut({
          profilActif: 'client',
          clientExiste: true,
          clientOnboardingEtape: 5,
        }),
        retour(),
      ),
    ).toBe(`/(public)/profil/${COACH}`);
  });
  it('conserve l’étape inachevée avant de reprendre un profil', () => {
    expect(
      determinerDestination(
        session,
        etatProfilsParDefaut({
          profilActif: 'client',
          clientExiste: true,
          clientOnboardingEtape: 3,
        }),
        retour(),
      ),
    ).toBe('/(onboarding)/3-poids');
  });
  it('ne bascule pas silencieusement un coach dans l’espace client', () => {
    expect(
      determinerDestination(
        session,
        etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true }),
        retour(),
      ),
    ).toBe('/(coach)/(tabs)/pilotage');
  });
  it('ignore un retour périmé et ne fait pas du profil une autorisation', () => {
    const profils = etatProfilsParDefaut({
      profilActif: 'client',
      clientExiste: true,
      clientOnboardingEtape: 5,
    });
    expect(determinerDestination(session, profils, { coachId: COACH, creeLe: 0 })).toBe(
      '/(client)/(tabs)/accueil',
    );
    expect(determinerDestination(null, profils, retour())).toBe('/(public)');
    expect(determinerDestination({ ...session, emailVerifie: false }, profils, retour())).toBe(
      '/(public)/verification',
    );
  });
});
