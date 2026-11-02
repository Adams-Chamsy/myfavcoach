import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import ChoixOffreEcran from '../../app/(client)/souscription/[coachId]';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// La VRAIE route 04a (pas l'écran seul) : c'est elle qui décide que le paiement n'est pas encore
// ouvert, tant que P4.6b n'existe pas (2 novembre 2026). Retirer ce test avec la mention, à P4.6b.
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ coachId: 'coach-yannick' }),
  useRouter: () => ({
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    canGoBack: () => true,
  }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

it('la route 04a désactive « Continuer » et dit que le paiement n’est pas encore ouvert', async () => {
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirProfilsCoachPublicsPourTest({
    'coach-yannick': {
      id: 'coach-yannick',
      prenom: 'Yannick',
      nom: 'Berthaud',
      photoUrl: null,
      discipline: 'préparation physique',
      titreCourt: null,
      bio: null,
      verifiee: true,
      verifieeDepuisLe: null,
      parcoursTexte: null,
      langues: [],
    },
  });
  portDonnees.definirOffresPubliquesPourTest({
    'coach-yannick': [
      {
        id: 'offre-1',
        titre: 'Suivi complet',
        description: null,
        prixCentimes: 4900,
        benefices: ['A', 'B', 'C'],
        engagementHumain: ['bilan_mensuel'],
        estMiseEnAvant: false,
        publieeLe: '2026-10-01T10:00:00Z',
        retireeLe: null,
      },
    ],
  });
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={creerFauxPortAuth()}>
          <FournisseurDonnees port={portDonnees}>
            <ChoixOffreEcran />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  await waitFor(() =>
    expect(
      screen.queryByText("Le paiement n'est pas encore ouvert dans l'application."),
    ).toBeTruthy(),
  );
  expect(
    screen.getByRole('button', { name: /^Continuer/ }).props.accessibilityState?.disabled,
  ).toBe(true);
});
