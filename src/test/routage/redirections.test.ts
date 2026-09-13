import type { SessionAuth } from '@/services/auth/port';
import { etatProfilsParDefaut } from '@/services/donnees/faux';
import type { EtatProfils } from '@/services/donnees/port';
import { determinerDestination } from '@/fonctionnalites/identite/garde';

function sessionVerifiee(): SessionAuth {
  return {
    compteId: 'compte-1',
    email: 'camille@exemple.fr',
    emailVerifie: true,
    jetonAcces: 'jeton-acces',
    jetonRafraichissement: 'jeton-rafraichissement',
  };
}

// docs/prompts/L1.md, P1.10 : sept règles de redirection. Les règles 3 et 4 (aucun profil du
// tout / onboarding client non terminé), fusionnées à P1.10 faute de valeur terminale
// d'onboarding_etape, sont défusionnées ici — P1.11 fixe cette valeur (voir garde.ts,
// ROUTE_PAR_ETAPE) : sept scénarios distincts, plus les replis de sécurité.
describe('determinerDestination (docs/prompts/L1.md, P1.10 + P1.11)', () => {
  // Règle 1.
  it('sans session, mène à l’espace public', () => {
    expect(determinerDestination(null, null)).toBe('/(public)');
  });

  // Règle 2.
  it('avec une session non vérifiée, mène à la vérification — quels que soient les profils', () => {
    const session: SessionAuth = { ...sessionVerifiee(), emailVerifie: false };
    expect(determinerDestination(session, null)).toBe('/(public)/verification');
  });

  // Règle 3.
  it('session vérifiée, aucun profil client du tout : mène à l’étape 1 de l’onboarding', () => {
    const profils: EtatProfils = etatProfilsParDefaut({
      profilActif: 'client',
      clientExiste: false,
      clientOnboardingEtape: null,
      coachExiste: false,
    });
    expect(determinerDestination(sessionVerifiee(), profils)).toBe('/(onboarding)/1-identite');
  });

  it('session vérifiée, profils jamais chargés (null) : même repli que "aucun profil du tout", jamais un espace accordé sans preuve', () => {
    expect(determinerDestination(sessionVerifiee(), null)).toBe('/(client)/(tabs)/accueil');
  });

  // Règle 4 : un profil client existe, mais onboarding_etape n'a pas dépassé 4 — une valeur
  // par étape non terminée.
  describe('onboarding client non terminé', () => {
    it.each([
      [2, '/(onboarding)/2-objectifs'],
      [3, '/(onboarding)/3-poids'],
      [4, '/(onboarding)/4-cest-parti'],
    ])('onboarding_etape=%d mène à %s', (etape, route) => {
      const profils: EtatProfils = etatProfilsParDefaut({
        profilActif: 'client',
        clientExiste: true,
        clientOnboardingEtape: etape,
        coachExiste: false,
      });
      expect(determinerDestination(sessionVerifiee(), profils)).toBe(route);
    });
  });

  // Règle 5.
  it('profil actif client ET onboarding terminé (étape > 4) : mène à l’espace client', () => {
    const profils: EtatProfils = etatProfilsParDefaut({
      profilActif: 'client',
      clientExiste: true,
      clientOnboardingEtape: 5,
      coachExiste: false,
    });
    expect(determinerDestination(sessionVerifiee(), profils)).toBe('/(client)/(tabs)/accueil');
  });

  // Règle 6.
  it('profil actif coach ET le profil coach existe réellement : mène à l’espace coach', () => {
    const profils: EtatProfils = etatProfilsParDefaut({
      profilActif: 'coach',
      clientExiste: false,
      clientOnboardingEtape: null,
      coachExiste: true,
    });
    expect(determinerDestination(sessionVerifiee(), profils)).toBe('/(coach)/(tabs)/pilotage');
  });

  // profilActif='coach' sans profil coach réel ne devrait jamais arriver en pratique
  // (basculer_profil vérifie l'existence avant de basculer, 0002_politiques.sql), mais si ça
  // arrivait quand même (donnée incohérente, panne), le repli reste sûr : jamais un espace
  // coach sans preuve positive. Pas une des sept règles (aucune ne couvre ce cas côté coach) —
  // L1-08 (activation espace coach) n'est pas construit, voir garde.ts.
  it('profil actif coach SANS que le profil coach existe : ne fait pas confiance, replie sur la destination provisoire', () => {
    const profils: EtatProfils = etatProfilsParDefaut({
      profilActif: 'coach',
      clientExiste: false,
      clientOnboardingEtape: null,
      coachExiste: false,
    });
    expect(determinerDestination(sessionVerifiee(), profils)).toBe('/(client)/(tabs)/accueil');
  });

  // Règle 7 (une route de (public) atteinte avec une session valide → renvoi vers l'espace
  // actif) n'est PAS un septième cas de cette fonction : c'est le MÊME calcul, appelé depuis un
  // second endroit (app/(public)/_layout.tsx), pas une règle supplémentaire à coder ici. Voir
  // app/(public)/_layout-garde.test.tsx pour la preuve de ce second appel — nommé avec un tiret,
  // jamais "_layout.test.tsx" (expo-router le lirait comme un second layout de la même route,
  // voir docs/dette.md).
});
