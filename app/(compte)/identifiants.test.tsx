import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import Identifiants from './identifiants';

const mockRetour = jest.fn();

// Mock nu (comme app/(public)/nouveau-mot-de-passe.test.tsx) : cet écran n'utilise d'expo-router
// que useRouter().back. Chaque fireEvent est `await`é — sans quoi les mises à jour d'état
// asynchrones des gestionnaires ne s'appliquent pas (RTL 14).
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRetour, canGoBack: () => true }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const ADRESSE = 'camille@exemple.fr';
const MOT_DE_PASSE = 'bon-mot-de-passe';
const NOUVEAU_LONG = 'un-nouveau-mot-de-passe-assez-long';

async function rendre(options: { avecChangementEnAttente?: boolean } = {}) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire(ADRESSE, MOT_DE_PASSE, '2000-01-01');
  portAuth.verifierEmailPourTest(ADRESSE);
  await portAuth.connecter(ADRESSE, MOT_DE_PASSE);
  if (options.avecChangementEnAttente) {
    await portAuth.changerEmail('camille-pro@exemple.fr');
  }

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <Identifiants />
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(screen.queryByText('Adresse e-mail et mot de passe')).toBeTruthy());
  return { portAuth };
}

function passeDesactive() {
  return screen.getByText('Changer le mot de passe').parent?.props.accessibilityState?.disabled;
}

describe('Identifiants (docs/ecrans/L1-09, « Adresse e-mail et mot de passe »)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('affiche l’adresse actuelle du compte', async () => {
    await rendre();
    expect(screen.getByText(ADRESSE)).toBeTruthy();
  });

  it('le bouton retour appelle router.back()', async () => {
    await rendre();
    await fireEvent.press(screen.getByLabelText('Retour'));
    expect(mockRetour).toHaveBeenCalledTimes(1);
  });

  // Changement d'adresse : envoi de la demande → état d'attente, avec les deux adresses et le
  // renvoi possible. L'adresse du compte ne change pas (fiche : deux confirmations requises).
  it('envoyer une nouvelle adresse passe en état d’attente, sans changer l’adresse du compte', async () => {
    const { portAuth } = await rendre();

    await fireEvent.changeText(screen.getByLabelText('Nouvelle adresse'), 'camille-pro@exemple.fr');
    await fireEvent.press(screen.getByText('Envoyer la confirmation'));

    await waitFor(() =>
      expect(screen.queryByText('Changement en attente de confirmation')).toBeTruthy(),
    );
    expect(screen.getByText('Renvoyer les courriels')).toBeTruthy();
    expect(screen.getByText(/camille-pro@exemple\.fr/)).toBeTruthy();
    expect((await portAuth.sessionCourante())?.email).toBe(ADRESSE);
    expect(await portAuth.lireAdresseEnAttente()).toBe('camille-pro@exemple.fr');
  });

  it('un changement déjà en attente au montage affiche le bandeau, jamais le champ', async () => {
    await rendre({ avecChangementEnAttente: true });

    expect(screen.getByText('Changement en attente de confirmation')).toBeTruthy();
    expect(screen.queryByLabelText('Nouvelle adresse')).toBeNull();
  });

  it('une adresse mal formée est refusée à l’écran', async () => {
    await rendre();

    await fireEvent.changeText(screen.getByLabelText('Nouvelle adresse'), 'pas-une-adresse');
    await fireEvent.press(screen.getByText('Envoyer la confirmation'));

    await waitFor(() => expect(screen.queryByText('Adresse e-mail incomplète.')).toBeTruthy());
    expect(screen.queryByText('Changement en attente de confirmation')).toBeNull();
  });

  it('le bouton « Changer le mot de passe » reste inactif tant que les deux champs ne sont pas valides', async () => {
    await rendre();

    expect(passeDesactive()).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Mot de passe actuel'), MOT_DE_PASSE);
    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), 'court');
    expect(passeDesactive()).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), NOUVEAU_LONG);
    expect(passeDesactive()).toBe(false);
  });

  it('un nouveau mot de passe trop court est refusé avec le message dédié', async () => {
    await rendre();

    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), 'court');
    await fireEvent(screen.getByLabelText('Nouveau mot de passe'), 'blur');

    await waitFor(() => expect(screen.queryByText('Il faut au moins 10 caractères.')).toBeTruthy());
  });

  it('un nouveau mot de passe trop long est refusé avec le message dédié', async () => {
    await rendre();

    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), 'x'.repeat(73));
    await fireEvent(screen.getByLabelText('Nouveau mot de passe'), 'blur');

    await waitFor(() => expect(screen.queryByText('72 caractères au maximum.')).toBeTruthy());
  });

  it('un mot de passe actuel incorrect affiche « Mot de passe actuel incorrect. »', async () => {
    await rendre();

    await fireEvent.changeText(screen.getByLabelText('Mot de passe actuel'), 'ce-nest-pas-le-bon');
    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), NOUVEAU_LONG);
    await fireEvent.press(screen.getByText('Changer le mot de passe'));

    await waitFor(() => expect(screen.queryByText('Mot de passe actuel incorrect.')).toBeTruthy());
  });

  // Critère 5 : après succès, le message reflète la distinction (autres sessions ne peuvent
  // plus se reconnecter ; jeton d'accès résiduel possible ≤ 1 h), sans promettre de coupure
  // immédiate. Le mécanisme lui-même est prouvé contre la base à P1.9 (rls.banc.ts).
  it('un changement réussi vide les champs et annonce la révocation des autres sessions', async () => {
    const { portAuth } = await rendre();

    await fireEvent.changeText(screen.getByLabelText('Mot de passe actuel'), MOT_DE_PASSE);
    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), NOUVEAU_LONG);
    await fireEvent.press(screen.getByText('Changer le mot de passe'));

    await waitFor(() =>
      expect(screen.queryByText(/ne pourront plus se\s+reconnecter/)).toBeTruthy(),
    );
    expect(screen.getByLabelText('Nouveau mot de passe').props.value).toBe('');
    const connexion = await portAuth.connecter(ADRESSE, NOUVEAU_LONG);
    expect(connexion.type).toBe('connecte');
  });
});
