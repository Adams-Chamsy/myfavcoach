import type { SessionAuth } from '@/services/auth/port';
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

// docs/prompts/L1.md, P1.10 : sept règles de redirection. Les règles 3 et 4 sont FUSIONNÉES ici
// (voir le commentaire de garde.ts) : aucune valeur terminale d'onboarding_etape n'est encore
// fixée (P1.11 non construit), donc "pas de profil du tout" et "onboarding client commencé
// mais pas terminé" ne sont pas distinguables aujourd'hui — un seul test les couvre toutes les
// deux, ce qui laisse six scénarios distincts, pas sept.
describe('determinerDestination (docs/prompts/L1.md, P1.10)', () => {
  // Règle 1.
  it('sans session, mène à l’espace public', () => {
    expect(determinerDestination(null, null)).toBe('/(public)');
  });

  // Règle 2.
  it('avec une session non vérifiée, mène à la vérification — quels que soient les profils', () => {
    const session: SessionAuth = { ...sessionVerifiee(), emailVerifie: false };
    expect(determinerDestination(session, null)).toBe('/(public)/verification');
  });

  // Règles 3+4 fusionnées : aucun profil actif réel, quelle qu'en soit la raison.
  it('session vérifiée, aucun profil réel : mène à la destination provisoire d’onboarding', () => {
    const profils: EtatProfils = { profilActif: 'client', clientExiste: false, coachExiste: false };
    expect(determinerDestination(sessionVerifiee(), profils)).toBe('/(client)/accueil');
  });

  it('session vérifiée, profils jamais chargés (null) : même repli, jamais un espace accordé sans preuve', () => {
    expect(determinerDestination(sessionVerifiee(), null)).toBe('/(client)/accueil');
  });

  // Règle 5.
  it('profil actif client ET le profil client existe réellement : mène à l’espace client', () => {
    const profils: EtatProfils = { profilActif: 'client', clientExiste: true, coachExiste: false };
    expect(determinerDestination(sessionVerifiee(), profils)).toBe('/(client)/accueil');
  });

  // Règle 6.
  it('profil actif coach ET le profil coach existe réellement : mène à l’espace coach', () => {
    const profils: EtatProfils = { profilActif: 'coach', clientExiste: false, coachExiste: true };
    expect(determinerDestination(sessionVerifiee(), profils)).toBe('/(coach)/pilotage');
  });

  // profilActif='coach' sans profil coach réel ne devrait jamais arriver en pratique
  // (basculer_profil vérifie l'existence avant de basculer, 0002_politiques.sql), mais si ça
  // arrivait quand même (donnée incohérente, panne), le repli reste sûr : jamais un espace
  // coach sans preuve positive.
  it('profil actif coach SANS que le profil coach existe : ne fait pas confiance, replie sur la destination provisoire', () => {
    const profils: EtatProfils = { profilActif: 'coach', clientExiste: false, coachExiste: false };
    expect(determinerDestination(sessionVerifiee(), profils)).toBe('/(client)/accueil');
  });

  // Règle 7 (une route de (public) atteinte avec une session valide → renvoi vers l'espace
  // actif) n'est PAS un septième cas de cette fonction : c'est le MÊME calcul, appelé depuis un
  // second endroit (app/(public)/_layout.tsx), pas une règle supplémentaire à coder ici. Voir
  // app/(public)/_layout-garde.test.tsx pour la preuve de ce second appel — nommé avec un tiret,
  // jamais "_layout.test.tsx" (expo-router le lirait comme un second layout de la même route,
  // voir docs/dette.md).
});
