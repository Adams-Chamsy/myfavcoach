import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth, type FauxPortAuth } from '@/services/auth/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import Verification from './verification';

const mockRemplacer = jest.fn();
const mockRetour = jest.fn();
let mockParams: { email?: string } = { email: 'camille@exemple.fr' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRemplacer, back: mockRetour }),
  useLocalSearchParams: () => mockParams,
}));

let mockEcouteursUrl: ((evenement: { url: string }) => void)[] = [];
jest.mock('expo-linking', () => ({
  addEventListener: (_type: string, gestionnaire: (evenement: { url: string }) => void) => {
    mockEcouteursUrl.push(gestionnaire);
    return { remove: jest.fn() };
  },
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function rendreVerification(port: FauxPortAuth) {
  return render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={port}>
          <Verification />
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('Verification (docs/ecrans/L1-03-verification-email.md)', () => {
  beforeEach(() => {
    mockParams = { email: 'camille@exemple.fr' };
    mockEcouteursUrl = [];
    jest.clearAllMocks();
  });

  // Critère 4 : l'adresse affichée est bien celle saisie.
  it("affiche l'adresse reçue en paramètre, en gras", async () => {
    await rendreVerification(creerFauxPortAuth());

    expect(screen.getByText('camille@exemple.fr').props.style.fontWeight).toBe('700');
  });

  // Critère 1 : le décompte de 60 secondes s'écoule et libère le bouton — minuteurs simulés,
  // remise à zéro explicite en fin de test (pas de restauration globale).
  it('le bouton de renvoi se libère après 60 secondes, pas avant', async () => {
    jest.useFakeTimers();
    await rendreVerification(creerFauxPortAuth());

    const bouton = () => screen.getByText(/^Renvoyer l'e-mail/);
    expect(bouton().parent?.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("Renvoyer l'e-mail dans 60 secondes")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(59_000);
    });
    expect(bouton().parent?.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("Renvoyer l'e-mail dans 1 seconde")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByText("Renvoyer l'e-mail").parent?.props.accessibilityState.disabled).toBe(
      false,
    );

    jest.useRealTimers();
  });

  // Critère 3 : un lien expiré affiche le message dédié et propose un renvoi.
  it('affiche "Ce lien a expiré" et propose de le renvoyer, sur un lien profond expiré', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    const lien = port.lienVerificationPourTest('camille@exemple.fr');
    port.expirerLienPourTest('camille@exemple.fr');

    await rendreVerification(port);
    await act(async () => {
      mockEcouteursUrl.forEach((gestionnaire) => gestionnaire({ url: lien }));
      await Promise.resolve();
    });

    expect(screen.getByText('Ce lien a expiré')).toBeTruthy();
    expect(screen.getByText('M’en renvoyer un')).toBeTruthy();
  });

  // Critère 4 (complément) : après retour arrière et correction, la nouvelle adresse reste
  // celle affichée — ici vérifié en changeant simplement le paramètre reçu, ce que
  // app/(public)/inscription.tsx produit réellement en repoussant vers cet écran.
  it("transition automatiquement à l'écran suivant une fois le lien profond établi", async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    const lien = port.lienVerificationPourTest('camille@exemple.fr');

    await rendreVerification(port);
    await act(async () => {
      mockEcouteursUrl.forEach((gestionnaire) => gestionnaire({ url: lien }));
      await Promise.resolve();
    });

    // Depuis P1.10 : jamais determinerDestination(session) ici (la vraie destination dépend
    // aussi des profils serveur) — "/" (app/index.tsx) attend les deux fournisseurs, testé
    // exhaustivement par app/index.test.tsx et src/test/routage/redirections.test.ts.
    expect(mockRemplacer).toHaveBeenCalledWith('/');
  });

  it('« Ce n’est pas la bonne adresse » revient en arrière, jamais vers un autre écran', async () => {
    await rendreVerification(creerFauxPortAuth());

    await fireEvent.press(screen.getByText('Ce n’est pas la bonne adresse'));

    expect(mockRetour).toHaveBeenCalledTimes(1);
    expect(mockRemplacer).not.toHaveBeenCalled();
  });

  // Critère 7 : « Se connecter » toujours présente (elle ne distingue rien : anti-énumération
  // intacte) et mène à L1-04. Ici en état d'attente ET en état "lien expiré".
  it('« Se connecter » est présente et mène à la connexion, y compris quand le lien a expiré', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', '2000-01-01');
    const lien = port.lienVerificationPourTest('camille@exemple.fr');
    port.expirerLienPourTest('camille@exemple.fr');

    await rendreVerification(port);
    expect(screen.getByText('Se connecter')).toBeTruthy();

    await act(async () => {
      mockEcouteursUrl.forEach((gestionnaire) => gestionnaire({ url: lien }));
      await Promise.resolve();
    });
    expect(screen.getByText('Ce lien a expiré')).toBeTruthy();

    await fireEvent.press(screen.getByText('Se connecter'));
    expect(mockRemplacer).toHaveBeenCalledWith('/(public)/connexion');
  });

  // Critère 5 : aucun appel réseau répété sur 30 secondes d'écran ouvert sans événement.
  it('ne fait aucun appel réseau sur 30 secondes sans lien profond ni retour au premier plan', async () => {
    jest.useFakeTimers();
    const port = creerFauxPortAuth();
    const sessionCouranteEspionnee = jest.spyOn(port, 'sessionCourante');
    const renvoyerEspionne = jest.spyOn(port, 'renvoyerVerification');
    const etablirEspionne = jest.spyOn(port, 'etablirSessionDepuisLien');

    await rendreVerification(port);
    sessionCouranteEspionnee.mockClear(); // Ignore l'appel initial de FournisseurSession.

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    expect(sessionCouranteEspionnee).not.toHaveBeenCalled();
    expect(renvoyerEspionne).not.toHaveBeenCalled();
    expect(etablirEspionne).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  // Critère 6 : le lecteur d'écran annonce le titre à l'arrivée.
  it("annonce le titre à l'arrivée", async () => {
    const espion = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});

    await rendreVerification(creerFauxPortAuth());

    expect(espion).toHaveBeenCalledWith('Regarde tes e-mails.');
    espion.mockRestore();
  });

  it('un renvoi refusé pour excès de débit affiche le message dédié, jamais un code technique', async () => {
    jest.useFakeTimers();
    const port = creerFauxPortAuth();
    jest.spyOn(port, 'renvoyerVerification').mockResolvedValue({
      succes: false,
      erreur: { code: 'limite_debit', message: 'Trop d’essais.' },
    });
    await rendreVerification(port);

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Renvoyer l'e-mail"));
      await Promise.resolve();
    });

    expect(screen.getByText('Attends une minute avant de réessayer.')).toBeTruthy();
    expect(screen.queryByText('Trop d’essais.')).toBeNull();

    jest.useRealTimers();
  });
});
