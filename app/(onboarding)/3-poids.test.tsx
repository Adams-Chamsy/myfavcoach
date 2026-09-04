import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, type FauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import OnboardingPoids from './3-poids';

const mockRetour = jest.fn();
const mockPousser = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRetour, push: mockPousser }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function rendreEcran(port: FauxPortDonnees) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  return render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={port}>
            <OnboardingPoids />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('OnboardingPoids (docs/ecrans/L1-05-onboarding-client.md, étape 3/4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 3 : "Interrupteur de consentement décoché : les deux champs de poids n'acceptent
  // aucune saisie, et leur inertie est perceptible autrement que par la couleur."
  it('les champs de poids sont désactivés tant que le consentement est décoché', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    expect(screen.getByLabelText('Poids actuel (kg)').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Poids visé (kg)').props.accessibilityState.disabled).toBe(true);
  });

  it("cocher l'interrupteur active les champs de poids", async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    await fireEvent(
      screen.getByLabelText("J'accepte l'enregistrement de mes données de santé"),
      'valueChange',
      true,
    );

    expect(screen.getByLabelText('Poids actuel (kg)').props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('le bouton Continuer est toujours actif, sans aucune saisie', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    expect(screen.getByText('Continuer').parent?.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('avec consentement et poids saisis, enregistre en grammes et avance à l’étape 4', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    await fireEvent(
      screen.getByLabelText("J'accepte l'enregistrement de mes données de santé"),
      'valueChange',
      true,
    );
    await fireEvent.changeText(screen.getByLabelText('Poids actuel (kg)'), '70,5');
    await fireEvent.changeText(screen.getByLabelText('Poids visé (kg)'), '65');
    await fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/4-cest-parti'));
    expect(await port.lireProfilOnboarding()).toMatchObject({
      poidsDepartGrammes: 70500,
      poidsCibleGrammes: 65000,
    });
  });

  it('sans consentement, Continuer avance sans enregistrer de poids', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    await fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/4-cest-parti'));
    expect(await port.lireProfilOnboarding()).toMatchObject({
      poidsDepartGrammes: null,
      poidsCibleGrammes: null,
    });
  });

  it("« Passer » ignore l'état du formulaire, même si l'interrupteur a été touché", async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    await fireEvent(
      screen.getByLabelText("J'accepte l'enregistrement de mes données de santé"),
      'valueChange',
      true,
    );
    await fireEvent.changeText(screen.getByLabelText('Poids actuel (kg)'), '70');
    await fireEvent.press(screen.getByText('Passer'));

    await waitFor(() => expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/4-cest-parti'));
    expect(await port.lireProfilOnboarding()).toMatchObject({ poidsDepartGrammes: null });
  });

  it('un échec du serveur affiche une erreur et ne navigue pas', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    port.echouerProchaineEcriturePourTest('On a un souci de notre côté.');
    await rendreEcran(port);

    await fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(screen.getByText('On a un souci de notre côté.')).toBeTruthy());
    expect(mockPousser).not.toHaveBeenCalled();
  });
});
