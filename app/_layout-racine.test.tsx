// Nom volontairement different de "_layout.test.tsx" : expo-router traite tout fichier dont le
// nom commence par le segment exact "_layout" (avant le premier point) comme une variante de
// layout, y compris "_layout.test.tsx" (le point suivant "_layout" est lu comme le separateur
// d'une extension de plateforme, sur le meme mecanisme que "_layout.ios.tsx"). Resultat : deux
// layouts enregistres pour la meme route, et expo-router plante des le demarrage du serveur de
// developpement ("The layouts... conflict on the route"). Ni resolver.blockList (metro.config.js)
// ni le mode production ne protegent de ce cas precis : la construction de l'arbre de routes
// leve avant meme que blockList n'intervienne. Le tiret dans "_layout-racine" evite ce point,
// donc ce declenchement, tout en restant range juste a cote de _layout.tsx et reconnu par Jest
// (".test.tsx"). Voir docs/dette.md.
import { act, render } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import { portAuthSupabase } from '@/services/auth/supabase';
import LayoutRacine from './_layout';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-linking', () => ({ getInitialURL: jest.fn().mockResolvedValue(null) }));
// Jamais le vrai adaptateur ici : src/services/supabase/client.ts exige de vraies variables
// d'environnement (EXPO_PUBLIC_SUPABASE_URL...) à l'évaluation du module, absentes sous Jest
// (jamais chargées depuis .env, voir src/services/supabase/client.test.ts). Ce test vérifie le
// squelette de LayoutRacine (polices, écran natif), pas le port réel — sessionCourante() ne
// doit d'ailleurs jamais être appelée pour de vrai dans un test.
jest.mock('@/services/auth/supabase', () => ({
  portAuthSupabase: {
    sessionCourante: jest.fn().mockResolvedValue(null),
    surChangementDeSession: jest.fn().mockReturnValue(() => {}),
    etablirSessionDepuisLien: jest.fn().mockResolvedValue({ succes: true }),
  },
}));
// Même raison que ci-dessus, pour src/services/donnees/ (P1.10) : portDonneesSupabase importe
// aussi src/services/supabase/client.ts. lireEtatProfils() ne doit jamais être appelée pour de
// vrai ici — sans session (sessionCourante mocké à null ci-dessus), FournisseurDonnees ne
// l'appelle de toute façon jamais.
jest.mock('@/services/donnees/supabase', () => ({
  portDonneesSupabase: {
    lireEtatProfils: jest.fn(),
  },
}));

const useFontsMock = useFonts as jest.MockedFunction<typeof useFonts>;
const getInitialURLMock = Linking.getInitialURL as jest.Mock;

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

  describe('lien profond au démarrage à froid (docs/ecrans/L1-04-connexion.md)', () => {
    it('sur myfavcoach://auth/rappel, échange le code lui-même (comportement L1-03 inchangé)', async () => {
      useFontsMock.mockReturnValue([true, null]);
      getInitialURLMock.mockResolvedValue('myfavcoach://auth/rappel?code=abc');

      await act(async () => {
        await render(<LayoutRacine />);
      });

      expect(portAuthSupabase.etablirSessionDepuisLien).toHaveBeenCalledWith(
        'myfavcoach://auth/rappel?code=abc',
      );
    });

    // Différent du cas ci-dessus, exprès : échanger le code ICI enverrait une session de
    // récupération toute fraîche droit vers garde.ts, qui la confondrait avec une session
    // normale et sauterait l'écran de changement de mot de passe.
    it("sur myfavcoach://auth/mot-de-passe, navigue directement vers l'écran dédié SANS échanger le code", async () => {
      useFontsMock.mockReturnValue([true, null]);
      getInitialURLMock.mockResolvedValue('myfavcoach://auth/mot-de-passe?code=abc');
      const remplacer = jest.spyOn(router, 'replace').mockImplementation(() => {});

      await act(async () => {
        await render(<LayoutRacine />);
      });

      expect(remplacer).toHaveBeenCalledWith('/(public)/nouveau-mot-de-passe');
      expect(portAuthSupabase.etablirSessionDepuisLien).not.toHaveBeenCalled();

      remplacer.mockRestore();
    });
  });
});
