import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth, type FauxPortAuth } from '@/services/auth/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import MotDePasseOublie from './mot-de-passe-oublie';

let mockParams: { email?: string } = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
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
          <MotDePasseOublie />
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

const MESSAGE_CONFIRMATION = 'Si un compte existe avec cette adresse, le lien est parti.';

describe('MotDePasseOublie (docs/ecrans/L1-04-connexion.md)', () => {
  beforeEach(() => {
    mockParams = {};
  });

  // Critère 2 : le même écran de confirmation pour une adresse existante et pour une adresse
  // inventée — comparaison stricte de deux rendus, pas une lecture à l'œil.
  it('affiche le même message, mot pour mot, pour une adresse existante et pour une adresse inventée', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');

    await rendreEcran(port);
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.press(screen.getByText('Envoyer le lien'));
    const messageAdresseExistante = screen.getByText(MESSAGE_CONFIRMATION).props.children;

    await rendreEcran(creerFauxPortAuth());
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'inventee@exemple.fr');
    await fireEvent.press(screen.getByText('Envoyer le lien'));
    const messageAdresseInventee = screen.getByText(MESSAGE_CONFIRMATION).props.children;

    expect(messageAdresseExistante).toBe(messageAdresseInventee);
    expect(messageAdresseExistante).toBe(MESSAGE_CONFIRMATION);
  });

  it('reprend l’adresse transmise en paramètre (venant de Connexion)', async () => {
    mockParams = { email: 'camille@exemple.fr' };

    await rendreEcran(creerFauxPortAuth());

    expect(screen.getByLabelText('Adresse e-mail').props.value).toBe('camille@exemple.fr');
  });

  it('le bouton reste désactivé tant que le champ est vide', async () => {
    await rendreEcran(creerFauxPortAuth());

    expect(screen.getByText('Envoyer le lien').parent?.props.accessibilityState.disabled).toBe(
      true,
    );

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');

    expect(screen.getByText('Envoyer le lien').parent?.props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('un échec réseau affiche le bandeau générique, jamais le message de confirmation', async () => {
    const port = creerFauxPortAuth();
    jest.spyOn(port, 'demanderReinitialisation').mockResolvedValue({
      succes: false,
      erreur: { code: 'reseau', message: 'Pas de connexion. Réessaie.' },
    });
    await rendreEcran(port);

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.press(screen.getByText('Envoyer le lien'));

    expect(screen.getByText('Pas de connexion. Réessaie.')).toBeTruthy();
    expect(screen.queryByText(MESSAGE_CONFIRMATION)).toBeNull();
  });
});
