import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurTheme } from '@/theme/fournisseur';
import { EnteteOnboarding } from './entete-onboarding';

const mockRetour = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRetour }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function rendreEntete(proprietes: Partial<React.ComponentProps<typeof EnteteOnboarding>> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <EnteteOnboarding etape={1} {...proprietes} />
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('EnteteOnboarding (docs/ecrans/L1-05-onboarding-client.md, "Élément commun")', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('le bouton retour appelle router.back()', async () => {
    await rendreEntete();

    await fireEvent.press(screen.getByLabelText('Retour'));

    expect(mockRetour).toHaveBeenCalledTimes(1);
  });

  // Critère 8 : "Le fil d'étapes est annoncé au lecteur d'écran comme « étape 2 sur 4 »".
  it("annonce l'étape courante au lecteur d'écran", async () => {
    await rendreEntete({ etape: 2 });

    expect(screen.getByLabelText('Étape 2 sur 4')).toBeTruthy();
  });

  it("« Passer » n'apparaît pas à l'étape 1 (aucun onPasser fourni)", async () => {
    await rendreEntete({ etape: 1 });

    expect(screen.queryByText('Passer')).toBeNull();
  });

  it("« Passer » apparaît dès qu'onPasser est fourni et l'appelle au tap", async () => {
    const onPasser = jest.fn();
    await rendreEntete({ etape: 2, onPasser });

    await fireEvent.press(screen.getByText('Passer'));

    expect(onPasser).toHaveBeenCalledTimes(1);
  });

  it('desactive désactive le retour et « Passer »', async () => {
    const onPasser = jest.fn();
    await rendreEntete({ etape: 2, onPasser, desactive: true });

    expect(screen.getByLabelText('Retour').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByText('Passer'));
    expect(onPasser).not.toHaveBeenCalled();
  });
});
