import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth, type FauxPortAuth } from '@/services/auth/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import NouveauMotDePasse from './nouveau-mot-de-passe';

const mockRemplacer = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRemplacer }),
}));

let mockUrlInitiale: string | null = null;
let mockEcouteursUrl: ((evenement: { url: string }) => void)[] = [];
jest.mock('expo-linking', () => ({
  getInitialURL: () => Promise.resolve(mockUrlInitiale),
  addEventListener: (_type: string, gestionnaire: (evenement: { url: string }) => void) => {
    mockEcouteursUrl.push(gestionnaire);
    return { remove: jest.fn() };
  },
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function rendreEcran(port: FauxPortAuth) {
  return render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={port}>
          <NouveauMotDePasse />
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('NouveauMotDePasse (docs/ecrans/L1-04-connexion.md)', () => {
  beforeEach(() => {
    mockUrlInitiale = null;
    mockEcouteursUrl = [];
    jest.clearAllMocks();
  });

  it("affiche une attente tant qu'aucun lien n'est reçu, jamais le formulaire avant", async () => {
    await rendreEcran(creerFauxPortAuth());

    expect(screen.getByText('On prépare ton lien…')).toBeTruthy();
    expect(screen.queryByLabelText('Nouveau mot de passe')).toBeNull();
  });

  it('un lien reçu à chaud établit la session et affiche le formulaire', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    const lien = port.lienVerificationPourTest('camille@exemple.fr');

    await rendreEcran(port);
    await act(async () => {
      mockEcouteursUrl.forEach((gestionnaire) => gestionnaire({ url: lien }));
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Nouveau mot de passe')).toBeTruthy();
    expect(screen.queryByText('On prépare ton lien…')).toBeNull();
  });

  it('un lien reçu au démarrage à froid (getInitialURL) établit aussi la session', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    mockUrlInitiale = port.lienVerificationPourTest('camille@exemple.fr');

    await act(async () => {
      await rendreEcran(port);
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Nouveau mot de passe')).toBeTruthy();
  });

  // Critère 3 : un lien expiré affiche le message dédié et propose un renvoi.
  it('un lien expiré affiche "Ce lien a expiré" et propose de le renvoyer', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    const lien = port.lienVerificationPourTest('camille@exemple.fr');
    port.expirerLienPourTest('camille@exemple.fr');

    await rendreEcran(port);
    await act(async () => {
      mockEcouteursUrl.forEach((gestionnaire) => gestionnaire({ url: lien }));
      await Promise.resolve();
    });

    expect(screen.getByText('Ce lien a expiré')).toBeTruthy();
    await fireEvent.press(screen.getByText('M’en renvoyer un'));
    expect(mockRemplacer).toHaveBeenCalledWith('/(public)/mot-de-passe-oublie');
  });

  it('refuse un mot de passe de moins de 10 caractères', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    const lien = port.lienVerificationPourTest('camille@exemple.fr');
    await rendreEcran(port);
    await act(async () => {
      mockEcouteursUrl.forEach((gestionnaire) => gestionnaire({ url: lien }));
      await Promise.resolve();
    });

    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), 'court');
    await fireEvent.press(screen.getByText('Valider'));

    expect(screen.getByText('Il faut au moins 10 caractères.')).toBeTruthy();
  });

  it('refuse un mot de passe de 73 caractères sans jamais appeler le port', async () => {
    const port = creerFauxPortAuth();
    const espionChangement = jest.spyOn(port, 'changerMotDePasse');
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    const lien = port.lienVerificationPourTest('camille@exemple.fr');
    await rendreEcran(port);
    await act(async () => {
      mockEcouteursUrl.forEach((gestionnaire) => gestionnaire({ url: lien }));
      await Promise.resolve();
    });

    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), 'x'.repeat(73));
    await fireEvent.press(screen.getByText('Valider'));

    expect(screen.getByText('72 caractères au maximum.')).toBeTruthy();
    expect(espionChangement).not.toHaveBeenCalled();
  });

  // docs/ecrans/L1-04 : "l'utilisateur arrive dans son espace, connecté." Depuis P1.10, jamais
  // determinerDestination(session) directement ici — "/" (app/index.tsx) attend session ET
  // profils avant de trancher, testé exhaustivement ailleurs (app/index.test.tsx,
  // src/test/routage/redirections.test.ts).
  it('un changement réussi renvoie vers "/", qui calcule seul la vraie destination', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    const lien = port.lienVerificationPourTest('camille@exemple.fr');
    await rendreEcran(port);
    await act(async () => {
      mockEcouteursUrl.forEach((gestionnaire) => gestionnaire({ url: lien }));
      await Promise.resolve();
    });

    await fireEvent.changeText(
      screen.getByLabelText('Nouveau mot de passe'),
      'un-tout-nouveau-mot-de-passe',
    );
    await fireEvent.press(screen.getByText('Valider'));

    expect(mockRemplacer).toHaveBeenCalledWith('/');
  });

  it('le bouton Valider reste désactivé tant que le champ est vide', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    const lien = port.lienVerificationPourTest('camille@exemple.fr');
    await rendreEcran(port);
    await act(async () => {
      mockEcouteursUrl.forEach((gestionnaire) => gestionnaire({ url: lien }));
      await Promise.resolve();
    });

    expect(screen.getByText('Valider').parent?.props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(
      screen.getByLabelText('Nouveau mot de passe'),
      'un-mot-de-passe-valide',
    );

    expect(screen.getByText('Valider').parent?.props.accessibilityState.disabled).toBe(false);
  });
});
