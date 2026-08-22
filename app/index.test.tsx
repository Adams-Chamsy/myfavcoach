import { act, render, screen, waitFor } from '@testing-library/react-native';

import { lireSession } from '@/services/trousseau/trousseau';
import { FournisseurTheme } from '@/theme/fournisseur';
import Index from './index';

jest.mock('@/services/trousseau/trousseau');

// Redirect a besoin d'un contexte de navigation reel : remplace par un marqueur lisible en
// test, seule la cible (href) nous interesse ici, pas la navigation elle-meme. require() plutot
// qu'un import en tete de fichier : le factory de jest.mock() ne peut pas referencer une
// variable hors de sa portee (elle est hoistee au-dessus des imports), sauf via require()
// appele a l'interieur du factory lui-meme.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- voir commentaire ci-dessus
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirection">{href}</Text>,
  };
});

const lireSessionMock = lireSession as jest.MockedFunction<typeof lireSession>;

async function rendreIndex() {
  return render(
    <FournisseurTheme>
      <Index />
    </FournisseurTheme>,
  );
}

describe('Index (docs/ecrans/L0-04-demarrage.md)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Critere 2 : "sans jeton... avec un jeton client... avec un jeton coach... trois tests".
  describe('redirection selon la session lue dans le trousseau', () => {
    it("renvoie vers l'espace public sans jeton", async () => {
      lireSessionMock.mockResolvedValue({ jeton: null, profilActif: null });
      await rendreIndex();

      await waitFor(() => {
        expect(screen.getByTestId('redirection').props.children).toBe('/(public)/accueil');
      });
    });

    it("renvoie vers l'accueil client avec un jeton et profilActif client", async () => {
      lireSessionMock.mockResolvedValue({ jeton: 'x', profilActif: 'client' });
      await rendreIndex();

      await waitFor(() => {
        expect(screen.getByTestId('redirection').props.children).toBe('/(client)/accueil');
      });
    });

    it('renvoie vers le pilotage coach avec un jeton et profilActif coach', async () => {
      lireSessionMock.mockResolvedValue({ jeton: 'x', profilActif: 'coach' });
      await rendreIndex();

      await waitFor(() => {
        expect(screen.getByTestId('redirection').props.children).toBe('/(coach)/pilotage');
      });
    });
  });

  // Critere 5 : "chargement simulé à 4 secondes : la phrase « On prépare ton espace » apparaît.
  // À 11 secondes : EtatErreur."
  describe('delais de secours quand la lecture du trousseau traine', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('affiche "On prépare ton espace" après 4 secondes simulées', async () => {
      // Ne resout jamais dans la fenetre du test : simule un chargement qui traine.
      lireSessionMock.mockReturnValue(new Promise(() => {}));
      await rendreIndex();

      expect(screen.queryByText('On prépare ton espace')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(4000);
      });

      expect(screen.getByText('On prépare ton espace')).toBeTruthy();
    });

    it('bascule sur EtatErreur après 11 secondes simulées', async () => {
      lireSessionMock.mockReturnValue(new Promise(() => {}));
      await rendreIndex();

      await act(async () => {
        jest.advanceTimersByTime(11000);
      });

      expect(screen.getByText('Ça prend plus de temps que prévu')).toBeTruthy();
      expect(screen.getByText('Réessayer')).toBeTruthy();
    });
  });
});
