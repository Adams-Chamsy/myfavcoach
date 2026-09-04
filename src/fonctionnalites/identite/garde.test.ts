import type { SessionAuth } from '@/services/auth/port';
import { determinerDestination } from './garde';

function sessionVerifiee(): SessionAuth {
  return {
    compteId: 'compte-1',
    email: 'camille@exemple.fr',
    emailVerifie: true,
    jetonAcces: 'jeton-acces',
    jetonRafraichissement: 'jeton-rafraichissement',
  };
}

describe('determinerDestination', () => {
  it('sans session, mène à l’espace public', () => {
    expect(determinerDestination(null)).toBe('/(public)');
  });

  it('avec une session non vérifiée, mène à la vérification', () => {
    const session: SessionAuth = { ...sessionVerifiee(), emailVerifie: false };
    expect(determinerDestination(session)).toBe('/(public)/verification');
  });

  // Provisoire, assumé — voir le commentaire de garde.ts et docs/dette.md : aucun profil n'est
  // connu tant que src/services/donnees/ n'existe pas, à lever par P1.11.
  it('avec une session vérifiée, mène provisoirement à (client)/accueil', () => {
    expect(determinerDestination(sessionVerifiee())).toBe('/(client)/accueil');
  });
});
