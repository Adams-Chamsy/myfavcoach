import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth, type FauxPortAuth } from '@/services/auth/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import Inscription from './inscription';

const mockPousser = jest.fn();
const mockRetour = jest.fn();
let mockParams: { email?: string } = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPousser, back: mockRetour }),
  useLocalSearchParams: () => mockParams,
}));

// Mêmes métriques que src/test/accessibilite.test.tsx : useSafeAreaInsets() plante sans elles
// sous Jest (aucune mesure native ne se déclenche).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function rendreInscription(port: FauxPortAuth) {
  return render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={port}>
          <Inscription />
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('Inscription (docs/ecrans/L1-02-creation-compte.md)', () => {
  const osOriginal = Platform.OS;

  beforeEach(() => {
    mockParams = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    Platform.OS = osOriginal;
  });

  // Les critères 1 (bornes des 18 ans) et 2 (refus par la base réelle) sont couverts ailleurs :
  // src/fonctionnalites/identite/age.test.ts pour le calcul, src/test/rls.banc.ts ("l'insertion
  // d'un compte de moins de 18 ans est refusée par le déclencheur") pour la base. Ce fichier ne
  // les reproduit pas.

  // Critère 6 : "Le bouton reste inactif tant qu'un des trois champs est vide, et l'inactivité
  // est visible autrement que par la couleur" — accessibilityState.disabled, pas seulement une
  // teinte.
  it('le bouton "Créer mon compte" est desactive tant que les champs ne sont pas tous remplis', async () => {
    await rendreInscription(creerFauxPortAuth());

    const bouton = screen.getByText('Créer mon compte');
    expect(bouton.parent?.props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'mot-de-passe-long');

    expect(screen.getByText('Créer mon compte').parent?.props.accessibilityState.disabled).toBe(
      false,
    );
  });

  // Critère 3 : un mot de passe de 73 caractères est refusé par l'écran, jamais transmis ni
  // tronqué en silence.
  it('refuse un mot de passe de 73 caractères sans jamais appeler le port', async () => {
    const port = creerFauxPortAuth();
    const inscrireEspionne = jest.spyOn(port, 'inscrire');
    await rendreInscription(port);

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'x'.repeat(73));
    await fireEvent.press(screen.getByText('Créer mon compte'));

    expect(screen.getByText('72 caractères au maximum.')).toBeTruthy();
    expect(inscrireEspionne).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe de moins de 10 caractères', async () => {
    await rendreInscription(creerFauxPortAuth());

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'court1');
    await fireEvent.press(screen.getByText('Créer mon compte'));

    expect(screen.getByText('Il faut au moins 10 caractères.')).toBeTruthy();
  });

  // Critère 5 : le message d'erreur d'un champ est relié au champ pour le lecteur d'écran —
  // repris de la composition déjà prouvée par src/composants/champ.test.tsx, vérifié ici avec
  // le VRAI message de cette fiche (docs/ecrans/L1-02, tableau des messages).
  it('relie le message de format e-mail au champ, à la sortie du champ, jamais pendant la frappe', async () => {
    await rendreInscription(creerFauxPortAuth());

    const champEmail = screen.getByLabelText('Adresse e-mail');
    await fireEvent.changeText(champEmail, 'pas-une-adresse');
    // Pendant la frappe : aucun message.
    expect(screen.queryByText('Cette adresse ne ressemble pas à une adresse e-mail.')).toBeNull();

    await fireEvent(champEmail, 'blur');

    expect(screen.getByText('Cette adresse ne ressemble pas à une adresse e-mail.')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Adresse e-mail, erreur : Cette adresse ne ressemble pas à une adresse e-mail.',
      ),
    ).toBeTruthy();
  });

  // Critère 4 : une adresse déjà utilisée mène au même écran suivant, avec le même texte,
  // qu'une adresse nouvelle — comparé en observant l'appel de navigation, identique dans les
  // deux cas (aucune énumération de comptes, docs/ecrans/L1-02, "Règles").
  it('mène au même écran suivant pour une adresse nouvelle et une adresse déjà inscrite', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'mot-de-passe-existant', '2000-01-01');

    await rendreInscription(port);
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'un-autre-mot-de-passe');
    await fireEvent.press(screen.getByText('Créer mon compte'));

    expect(mockPousser).toHaveBeenCalledWith('/(public)/verification?email=camille%40exemple.fr');

    mockPousser.mockClear();

    await rendreInscription(creerFauxPortAuth());
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'un-autre-mot-de-passe');
    await fireEvent.press(screen.getByText('Créer mon compte'));

    expect(mockPousser).toHaveBeenCalledWith('/(public)/verification?email=camille%40exemple.fr');
  });

  // Critère 8 : aucune trace du mot de passe en sortie de journalisation — interception de
  // console, sur tout le cycle (frappe, appui, échec réseau, succès).
  it('ne journalise jamais le mot de passe, y compris sur un échec réseau', async () => {
    const journalise = ['log', 'warn', 'error', 'info', 'debug'] as const;
    const espions = journalise.map((methode) => jest.spyOn(console, methode).mockImplementation());

    const port = creerFauxPortAuth();
    jest.spyOn(port, 'inscrire').mockResolvedValue({
      succes: false,
      erreur: { code: 'reseau', message: 'Pas de connexion. Réessaie.' },
    });
    await rendreInscription(port);

    const motDePasseSecret = 'un-secret-jamais-journalise';
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), motDePasseSecret);
    await fireEvent.press(screen.getByText('Créer mon compte'));

    expect(screen.getByText('Pas de connexion. Ta saisie est gardée, réessaie.')).toBeTruthy();

    for (const espion of espions) {
      for (const appel of espion.mock.calls) {
        expect(JSON.stringify(appel)).not.toContain(motDePasseSecret);
      }
      espion.mockRestore();
    }
  });

  it('sur Android, un appui sur le champ date ouvre le sélecteur natif', async () => {
    Platform.OS = 'android';
    await rendreInscription(creerFauxPortAuth());

    expect(screen.queryByTestId('selecteur-date-naissance')).toBeNull();
    await fireEvent.press(screen.getByTestId('ouvrir-selecteur-date-naissance'));
    expect(screen.getByTestId('selecteur-date-naissance')).toBeTruthy();
  });

  it('sur iOS, le sélecteur de date natif est affiché directement', async () => {
    Platform.OS = 'ios';
    await rendreInscription(creerFauxPortAuth());

    expect(screen.getByTestId('selecteur-date-naissance')).toBeTruthy();
  });

  // Défaut ouvert sur l'année en cours moins 25 ans (docs/ecrans/L1-02, tableau) : donc déjà
  // majeur par défaut, sans qu'aucune interaction avec le sélecteur ne soit nécessaire.
  it('propose une date de naissance par défaut déjà majeure', async () => {
    Platform.OS = 'ios';
    await rendreInscription(creerFauxPortAuth());

    // Le nœud hôte du sélecteur (composant natif) reçoit "date" en millisecondes, pas "value"
    // en objet Date — c'est le composant JS englobant (@react-native-community/datetimepicker)
    // qui fait la conversion, jamais exposée telle quelle sous Jest.
    const picker = screen.getByTestId('selecteur-date-naissance');
    const valeur = new Date(picker.props.date as number);
    const aujourdHui = new Date();
    expect(aujourdHui.getFullYear() - valeur.getFullYear()).toBe(25);
  });
});
