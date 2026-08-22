import { render } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import LayoutRacine from './_layout';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

const useFontsMock = useFonts as jest.MockedFunction<typeof useFonts>;

describe('LayoutRacine (docs/ecrans/L0-04-demarrage.md)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Critere 4 : "chargement des polices simulé en échec : l'application démarre, l'écran s'affiche."
  it('demarre quand meme si le chargement des polices echoue, avec la police systeme en repli', async () => {
    // L'incident est journalise (docs/ecrans/L0-04-demarrage.md, regle) : console.error attendu
    // ici, on le tait pour garder la sortie du test lisible.
    const erreurTue = jest.spyOn(console, 'error').mockImplementation(() => {});
    useFontsMock.mockReturnValue([false, new Error('echec de test')]);

    const { toJSON } = await render(<LayoutRacine />);

    expect(toJSON()).not.toBeNull();
    expect(erreurTue).toHaveBeenCalledTimes(1);
    erreurTue.mockRestore();
  });

  it('rend son arbre normalement une fois les polices chargees avec succes', async () => {
    useFontsMock.mockReturnValue([true, null]);

    const { toJSON } = await render(<LayoutRacine />);

    expect(toJSON()).not.toBeNull();
  });

  // Tant que ni le succes ni l'echec ne sont resolus, l'ecran de lancement natif reste seul
  // visible (docs/ecrans/L0-04-demarrage.md, critere 1) : rien n'est rendu cote JS.
  it('ne rend rien tant que les polices ne sont ni chargees ni en echec (ecran natif visible)', async () => {
    useFontsMock.mockReturnValue([false, null]);

    const { toJSON } = await render(<LayoutRacine />);

    expect(toJSON()).toBeNull();
  });
});
