import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { objectifsOnboarding, rythmesOnboarding } from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, type FauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import OnboardingCestParti from './4-cest-parti';

const mockRetour = jest.fn();
const mockPousser = jest.fn();
const mockRemplacer = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRetour, push: mockPousser, replace: mockRemplacer }),
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
            <OnboardingCestParti />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

async function portRempli(): Promise<FauxPortDonnees> {
  const port = creerFauxPortDonnees();
  await port.creerProfilClient('Camille', 'Dupont');
  await port.enregistrerObjectifsEtRythme(
    [objectifsOnboarding[0].cle, objectifsOnboarding[1].cle],
    rythmesOnboarding[1].cle,
  );
  await port.enregistrerPointDeDepart({
    consentementAccorde: true,
    versionConsentement: '2026-09-04',
    poidsDepartGrammes: 70500,
    poidsCibleGrammes: 65000,
  });
  return port;
}

describe('OnboardingCestParti (docs/ecrans/L1-05-onboarding-client.md, étape 4/4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('affiche le prénom dans le titre de bienvenue', async () => {
    await rendreEcran(await portRempli());

    await waitFor(() => expect(screen.getByText('Bienvenue, Camille.')).toBeTruthy());
  });

  it('affiche le récapitulatif : objectifs, rythme et point de départ', async () => {
    await rendreEcran(await portRempli());

    await waitFor(() => {
      expect(
        screen.getByText(`${objectifsOnboarding[0].libelle}, ${objectifsOnboarding[1].libelle}`),
      ).toBeTruthy();
    });
    expect(screen.getByText(rythmesOnboarding[1].libelle)).toBeTruthy();
    expect(screen.getByText('70,5 kg → 65,0 kg')).toBeTruthy();
  });

  it('« Non renseigné » quand rien n’a été rempli aux étapes 2 et 3', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', '');
    await rendreEcran(port);

    await waitFor(() => expect(screen.getAllByText('Non renseigné').length).toBe(3));
  });

  it('« Modifier » sur objectifs et rythme renvoie à l’étape 2', async () => {
    await rendreEcran(await portRempli());
    await waitFor(() => expect(screen.getAllByText('Modifier').length).toBe(3));

    await fireEvent.press(screen.getAllByText('Modifier')[0]);
    expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/2-objectifs');

    await fireEvent.press(screen.getAllByText('Modifier')[1]);
    expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/2-objectifs');
  });

  it('« Modifier » sur le point de départ renvoie à l’étape 3', async () => {
    await rendreEcran(await portRempli());
    await waitFor(() => expect(screen.getAllByText('Modifier').length).toBe(3));

    await fireEvent.press(screen.getAllByText('Modifier')[2]);

    expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/3-poids');
  });

  it('« Découvrir des coachs » termine l’onboarding et remplace la route par (client)/accueil', async () => {
    const port = await portRempli();
    await rendreEcran(port);
    await waitFor(() => expect(screen.getByText('Bienvenue, Camille.')).toBeTruthy());

    await fireEvent.press(screen.getByText('Découvrir des coachs'));

    await waitFor(() => expect(mockRemplacer).toHaveBeenCalledWith('/(client)/accueil'));
    expect((await port.lireEtatProfils()).clientOnboardingEtape).toBe(5);
  });

  it("aucun lien « Passer » à l'étape 4", async () => {
    await rendreEcran(await portRempli());
    await waitFor(() => expect(screen.getByText('Bienvenue, Camille.')).toBeTruthy());

    expect(screen.queryByText('Passer')).toBeNull();
  });

  it('un échec du serveur affiche une erreur et ne navigue pas', async () => {
    const port = await portRempli();
    port.echouerProchaineEcriturePourTest('On a un souci de notre côté.');
    await rendreEcran(port);
    await waitFor(() => expect(screen.getByText('Bienvenue, Camille.')).toBeTruthy());

    await fireEvent.press(screen.getByText('Découvrir des coachs'));

    await waitFor(() => expect(screen.getByText('On a un souci de notre côté.')).toBeTruthy());
    expect(mockRemplacer).not.toHaveBeenCalled();
  });
});
