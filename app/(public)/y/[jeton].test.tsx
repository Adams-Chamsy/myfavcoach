import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import { CorpsArriveeParInvitation } from './[jeton]';

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  const reel = jest.requireActual('expo-router');
  return {
    ...reel,
    useRouter: () => ({ ...reel.useRouter(), push: mockPush }),
  };
});

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

// Critère 1 (fiche) : fonctionne réellement sans session — le port d'auth n'est JAMAIS connecté
// dans ce fichier, contrairement à informations.test.tsx ou invitations.test.tsx. FournisseurSession
// reste nécessaire malgré tout : FournisseurDonnees le lit en interne (useSession()), même pour
// un visiteur anonyme (docs/fonctionnalites/identite/fournisseur-donnees.tsx).
async function rendre(
  jeton: string | undefined,
  portDonnees: ReturnType<typeof creerFauxPortDonnees>,
) {
  const portAuth = creerFauxPortAuth();
  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <CorpsArriveeParInvitation jeton={jeton} />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('Arrivée par invitation (docs/ecrans/L3bis-I02-arrivee-par-invitation.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('un jeton valide affiche le coach, son offre mise en avant, et rien de plus que son profil public', async () => {
    const port = creerFauxPortDonnees();
    port.definirCoachParJetonPourTest({ 'jeton-reel': 'coach-1' });
    port.definirProfilsCoachPublicsPourTest({
      'coach-1': {
        id: 'coach-1',
        prenom: 'Yannick',
        nom: 'Berthaud',
        photoUrl: null,
        discipline: 'Préparation physique',
        titreCourt: 'Coaching perf',
        bio: 'Dix ans.',
        verifiee: true,
        verifieeDepuisLe: '2026-03-01T00:00:00.000Z',
        parcoursTexte: null,
        langues: [],
      },
    });
    port.definirOffresPubliquesPourTest({
      'coach-1': [
        {
          id: 'offre-1',
          titre: 'Suivi complet',
          description: null,
          prixCentimes: 4900,
          benefices: [],
          engagementHumain: [],
          estMiseEnAvant: true,
          publieeLe: '2026-01-01T00:00:00.000Z',
          retireeLe: null,
        },
      ],
    });

    await rendre('jeton-reel', port);

    await waitFor(() =>
      expect(screen.queryByText("Yannick t'invite à te suivre ici")).toBeTruthy(),
    );
    expect(screen.getByText('Suivi complet')).toBeTruthy();
    expect(screen.getByText(/49 €/)).toBeTruthy();
    // Rien d'autre que prénom/nom/offre (déjà publics) : ni bio, ni discipline, ni langues ne
    // sont des données NOUVELLES exposées par ce chemin précis — non affichées ici (critère 2).
    expect(screen.queryByText('Dix ans.')).toBeNull();
  });

  it('un jeton absent des métadonnées de route affiche un état honnête, jamais une page blanche', async () => {
    const port = creerFauxPortDonnees();
    await rendre(undefined, port);

    await waitFor(() => expect(screen.queryByText("Ce lien n'est plus valide")).toBeTruthy());
  });

  it('un jeton qui ne résout à rien se comporte exactement comme un jeton absent', async () => {
    const port = creerFauxPortDonnees();
    port.definirCoachParJetonPourTest({}); // aucune entrée : toute résolution rend null.

    await rendre('jeton-invente', port);

    await waitFor(() => expect(screen.queryByText("Ce lien n'est plus valide")).toBeTruthy());
  });

  it('un coach sans offre publiée affiche un état vide dédié, jamais une erreur', async () => {
    const port = creerFauxPortDonnees();
    port.definirCoachParJetonPourTest({ 'jeton-sans-offre': 'coach-2' });
    port.definirProfilsCoachPublicsPourTest({
      'coach-2': {
        id: 'coach-2',
        prenom: 'Farid',
        nom: 'Aziz',
        photoUrl: null,
        discipline: 'Nutrition',
        titreCourt: null,
        bio: null,
        verifiee: true,
        verifieeDepuisLe: '2026-03-01T00:00:00.000Z',
        parcoursTexte: null,
        langues: [],
      },
    });
    port.definirOffresPubliquesPourTest({ 'coach-2': [] });

    await rendre('jeton-sans-offre', port);

    await waitFor(() => expect(screen.queryByText("Rien à proposer pour l'instant")).toBeTruthy());
  });

  it('« Créer mon compte » porte le jeton jusqu’à l’inscription', async () => {
    const port = creerFauxPortDonnees();
    port.definirCoachParJetonPourTest({ 'jeton-inscription': 'coach-3' });
    port.definirProfilsCoachPublicsPourTest({
      'coach-3': {
        id: 'coach-3',
        prenom: 'Nadia',
        nom: 'Belkacem',
        photoUrl: null,
        discipline: 'Cybersécurité',
        titreCourt: null,
        bio: null,
        verifiee: true,
        verifieeDepuisLe: '2026-03-01T00:00:00.000Z',
        parcoursTexte: null,
        langues: [],
      },
    });
    port.definirOffresPubliquesPourTest({ 'coach-3': [] });

    await rendre('jeton-inscription', port);
    await waitFor(() => expect(screen.queryByText('Créer mon compte')).toBeTruthy());

    await fireEvent.press(screen.getByText('Créer mon compte'));

    expect(mockPush).toHaveBeenCalledWith('/(public)/inscription?jeton=jeton-inscription');
  });

  it('« Voir son profil d’abord » ouvre le même écran public que la recherche', async () => {
    const port = creerFauxPortDonnees();
    port.definirCoachParJetonPourTest({ 'jeton-profil': 'coach-4' });
    port.definirProfilsCoachPublicsPourTest({
      'coach-4': {
        id: 'coach-4',
        prenom: 'Marc',
        nom: 'Toure',
        photoUrl: null,
        discipline: 'Yoga',
        titreCourt: null,
        bio: null,
        verifiee: true,
        verifieeDepuisLe: '2026-03-01T00:00:00.000Z',
        parcoursTexte: null,
        langues: [],
      },
    });
    port.definirOffresPubliquesPourTest({ 'coach-4': [] });

    await rendre('jeton-profil', port);
    await waitFor(() => expect(screen.queryByText("Voir son profil d'abord")).toBeTruthy());

    await fireEvent.press(screen.getByText("Voir son profil d'abord"));

    expect(mockPush).toHaveBeenCalledWith('/(client)/coach/coach-4');
  });
});
