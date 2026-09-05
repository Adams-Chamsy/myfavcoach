import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { objectifsOnboarding, rythmesOnboarding } from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, type FauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import OnboardingObjectifs from './2-objectifs';

const mockRetour = jest.fn();
const mockPousser = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRetour, push: mockPousser, canGoBack: () => true }),
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
            <OnboardingObjectifs />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('OnboardingObjectifs (docs/ecrans/L1-05-onboarding-client.md, étape 2/4 — écran 22)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 6.
  it('affiche les 8 objectifs et les 3 rythmes de src/fixtures/demonstration.ts', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    for (const objectif of objectifsOnboarding) {
      expect(screen.getByText(objectif.libelle)).toBeTruthy();
    }
    for (const rythme of rythmesOnboarding) {
      expect(screen.getByText(rythme.libelle)).toBeTruthy();
    }
  });

  // Critère 7 : "Le bouton de l'étape 2 affiche le nombre exact de sélections et se désactive
  // à zéro."
  it('le bouton affiche le nombre de sélections et se désactive à zéro', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    expect(screen.getByText('Continuer · 0 objectif')).toBeTruthy();
    expect(
      screen.getByText('Continuer · 0 objectif').parent?.props.accessibilityState?.disabled,
    ).toBe(true);

    await fireEvent.press(screen.getByText(objectifsOnboarding[0].libelle));
    expect(screen.getByText('Continuer · 1 objectif')).toBeTruthy();

    await fireEvent.press(screen.getByText(objectifsOnboarding[1].libelle));
    expect(screen.getByText('Continuer · 2 objectifs')).toBeTruthy();
  });

  it('un objectif pressé deux fois revient désélectionné', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    const chip = screen.getByText(objectifsOnboarding[0].libelle);
    await fireEvent.press(chip);
    expect(screen.getByText('Continuer · 1 objectif')).toBeTruthy();
    await fireEvent.press(chip);
    expect(screen.getByText('Continuer · 0 objectif')).toBeTruthy();
  });

  it('le rythme est exclusif : en choisir un second désélectionne le premier', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);
    await fireEvent.press(screen.getByText(objectifsOnboarding[0].libelle));

    await fireEvent.press(screen.getByText(rythmesOnboarding[0].libelle));
    await fireEvent.press(screen.getByText('Continuer · 1 objectif'));
    await waitFor(() => expect(mockPousser).toHaveBeenCalled());
    expect((await port.lireProfilOnboarding()).rythme).toBe(rythmesOnboarding[0].cle);
  });

  it('« Passer » enregistre un profil sans objectif ni rythme et avance à l’étape 3', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    await fireEvent.press(screen.getByText('Passer'));

    await waitFor(() => expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/3-poids'));
    expect(await port.lireProfilOnboarding()).toMatchObject({ objectifs: [], rythme: null });
  });

  // Reprise via le bouton retour depuis l'étape 3 (P1.11) : relit un choix déjà enregistré.
  it('pré-remplit objectifs et rythme déjà enregistrés (retour depuis l’étape 3)', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await port.enregistrerObjectifsEtRythme(
      [objectifsOnboarding[0].cle, objectifsOnboarding[2].cle],
      rythmesOnboarding[2].cle,
    );
    await rendreEcran(port);

    await waitFor(() => expect(screen.getByText('Continuer · 2 objectifs')).toBeTruthy());
  });

  it('un échec du serveur affiche une erreur et ne navigue pas', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    port.echouerProchaineEcriturePourTest('On a un souci de notre côté.');
    await rendreEcran(port);

    await fireEvent.press(screen.getByText(objectifsOnboarding[0].libelle));
    await fireEvent.press(screen.getByText('Continuer · 1 objectif'));

    await waitFor(() => expect(screen.getByText('On a un souci de notre côté.')).toBeTruthy());
    expect(mockPousser).not.toHaveBeenCalled();
  });
});
