import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth, type FauxPortAuth } from '@/services/auth/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import Connexion from './connexion';

const mockRemplacer = jest.fn();
const mockPousser = jest.fn();
let mockParams: { email?: string } = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRemplacer, push: mockPousser }),
  useLocalSearchParams: () => mockParams,
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function rendreConnexion(port: FauxPortAuth) {
  return render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={port}>
          <Connexion />
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

async function tenterConnexion(email: string, motDePasse: string) {
  await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), email);
  await fireEvent.changeText(screen.getByLabelText('Mot de passe'), motDePasse);
  await fireEvent.press(screen.getByText('Se connecter'));
}

describe('Connexion (docs/ecrans/L1-04-connexion.md)', () => {
  beforeEach(() => {
    mockParams = {};
    jest.clearAllMocks();
  });

  // Critère 1 : adresse inconnue et mot de passe faux produisent EXACTEMENT la même chaîne —
  // comparaison stricte des deux rendus, pas une lecture à l'œil.
  it('affiche le même message, mot pour mot, pour une adresse inconnue et pour un mauvais mot de passe', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'le-bon-mot-de-passe', '2000-01-01');
    port.verifierEmailPourTest('camille@exemple.fr');

    await rendreConnexion(port);
    await tenterConnexion('inconnue@exemple.fr', 'nimporte-quoi');
    const messageAdresseInconnue = screen.getByText('Adresse ou mot de passe incorrect.').props
      .children;

    await rendreConnexion(port);
    await tenterConnexion('camille@exemple.fr', 'mauvais-mot-de-passe');
    const messageMauvaisMotDePasse = screen.getByText('Adresse ou mot de passe incorrect.').props
      .children;

    expect(messageAdresseInconnue).toBe(messageMauvaisMotDePasse);
    expect(messageAdresseInconnue).toBe('Adresse ou mot de passe incorrect.');
  });

  // Critère 3 : un compte non vérifié qui se connecte arrive sur L1-03, jamais sur une erreur.
  it('un compte non vérifié qui se connecte arrive sur la vérification, pas sur une erreur', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'le-bon-mot-de-passe', '2000-01-01');
    // Jamais verifierEmailPourTest ici : le compte reste non vérifié.

    await rendreConnexion(port);
    await tenterConnexion('camille@exemple.fr', 'le-bon-mot-de-passe');

    expect(mockRemplacer).toHaveBeenCalledWith('/(public)/verification?email=camille%40exemple.fr');
    expect(screen.queryByText('Adresse ou mot de passe incorrect.')).toBeNull();
  });

  it('une connexion réussie renvoie vers "/", qui calcule seul la vraie destination', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'le-bon-mot-de-passe', '2000-01-01');
    port.verifierEmailPourTest('camille@exemple.fr');

    await rendreConnexion(port);
    await tenterConnexion('camille@exemple.fr', 'le-bon-mot-de-passe');

    // Depuis P1.10 : jamais determinerDestination(session) ici (la vraie destination dépend
    // aussi des profils serveur) — "/" (app/index.tsx) attend les deux fournisseurs, testé
    // exhaustivement par app/index.test.tsx et src/test/routage/redirections.test.ts.
    expect(mockRemplacer).toHaveBeenCalledWith('/');
  });

  // docs/ecrans/L1-04, États : "Après trois échecs consécutifs... ajoute... Tu peux
  // réinitialiser ton mot de passe." — une aide, jamais avant le troisième échec.
  it('propose de réinitialiser le mot de passe seulement après trois échecs, pas avant', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'le-bon-mot-de-passe', '2000-01-01');
    port.verifierEmailPourTest('camille@exemple.fr');
    await rendreConnexion(port);

    await tenterConnexion('camille@exemple.fr', 'mauvais-1');
    expect(screen.queryByText('Tu peux réinitialiser ton mot de passe.')).toBeNull();

    await tenterConnexion('camille@exemple.fr', 'mauvais-2');
    expect(screen.queryByText('Tu peux réinitialiser ton mot de passe.')).toBeNull();

    await tenterConnexion('camille@exemple.fr', 'mauvais-3');
    expect(screen.getByText('Tu peux réinitialiser ton mot de passe.')).toBeTruthy();
  });

  it('le bouton "Se connecter" est désactivé tant que les deux champs ne sont pas remplis', async () => {
    await rendreConnexion(creerFauxPortAuth());

    expect(screen.getByText('Se connecter').parent?.props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'un-mot-de-passe');

    expect(screen.getByText('Se connecter').parent?.props.accessibilityState.disabled).toBe(false);
  });

  it('« Mot de passe oublié » emmène vers l’écran dédié, avec l’adresse déjà saisie transmise', async () => {
    await rendreConnexion(creerFauxPortAuth());

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.press(screen.getByText('Mot de passe oublié'));

    expect(mockPousser).toHaveBeenCalledWith(
      '/(public)/mot-de-passe-oublie?email=camille%40exemple.fr',
    );
  });

  it('« Créer un compte » emmène vers l’inscription', async () => {
    await rendreConnexion(creerFauxPortAuth());

    await fireEvent.press(screen.getByText('Créer un compte'));

    expect(mockPousser).toHaveBeenCalledWith('/(public)/inscription');
  });

  // Critère 6 : le lecteur d'écran annonce le message d'échec à son apparition.
  it("annonce le message d'échec au lecteur d'écran", async () => {
    const espion = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});

    await rendreConnexion(creerFauxPortAuth());
    await tenterConnexion('inconnue@exemple.fr', 'nimporte-quoi');

    expect(espion).toHaveBeenCalledWith('Adresse ou mot de passe incorrect.');
    espion.mockRestore();
  });
});
