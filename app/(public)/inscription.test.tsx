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

// Joue le geste de confirmation réel d'une date, quelle que soit la plateforme de la passe en
// cours : ouvre le déclencheur, déplace le sélecteur natif (host node, prop "valueChange" —
// voir le commentaire de choisirDateNaissance ci-dessous pour pourquoi), puis appuie sur
// "Valider la date" SEULEMENT sur iOS (le style "spinner" n'a pas de bouton de confirmation
// natif, contrairement au dialogue Android dont "valueChange" ne se déclenche que sur OK).
async function choisirDateNaissance(date: Date) {
  await fireEvent.press(screen.getByTestId('ouvrir-selecteur-date-naissance'));
  const selecteur = screen.getByTestId('selecteur-date-naissance');
  // fireEvent(instance, 'valueChange', event, date) : le nœud hôte du sélecteur n'expose que
  // son propre "onChange" interne (traduit depuis le natif), mais la résolution d'événement de
  // react-native-testing-library remonte jusqu'au composant JS englobant pour trouver la prop
  // "onValueChange" qu'on lui a réellement passée — vérifié en instrumentant l'arbre rendu.
  await fireEvent(selecteur, 'valueChange', {}, date);
  if (Platform.OS !== 'android') {
    await fireEvent.press(screen.getByText('Valider la date'));
  }
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

  // Critère 6, et le défaut trouvé après coup (docs/dette.md, dateNaissance) : le bouton ne
  // doit JAMAIS s'activer sur la seule foi d'une valeur par défaut jamais choisie. Remplir les
  // deux AUTRES champs ne suffit pas : la date doit être CONFIRMÉE par un geste explicite.
  it("reste desactive avec l'e-mail et le mot de passe remplis mais la date jamais confirmee", async () => {
    await rendreInscription(creerFauxPortAuth());

    const bouton = screen.getByText('Créer mon compte');
    expect(bouton.parent?.props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'mot-de-passe-long');

    expect(screen.getByText('Créer mon compte').parent?.props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it("s'active une fois les trois champs remplis, la date de naissance comprise", async () => {
    await rendreInscription(creerFauxPortAuth());

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'mot-de-passe-long');
    await choisirDateNaissance(new Date(2000, 0, 1));

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
    await choisirDateNaissance(new Date(2000, 0, 1));
    await fireEvent.press(screen.getByText('Créer mon compte'));

    expect(screen.getByText('72 caractères au maximum.')).toBeTruthy();
    expect(inscrireEspionne).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe de moins de 10 caractères', async () => {
    await rendreInscription(creerFauxPortAuth());

    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'court1');
    await choisirDateNaissance(new Date(2000, 0, 1));
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
    await choisirDateNaissance(new Date(2000, 0, 1));
    await fireEvent.press(screen.getByText('Créer mon compte'));

    expect(mockPousser).toHaveBeenCalledWith('/(public)/verification?email=camille%40exemple.fr');

    mockPousser.mockClear();

    await rendreInscription(creerFauxPortAuth());
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'un-autre-mot-de-passe');
    await choisirDateNaissance(new Date(2000, 0, 1));
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
    await choisirDateNaissance(new Date(2000, 0, 1));
    await fireEvent.press(screen.getByText('Créer mon compte'));

    expect(screen.getByText('Pas de connexion. Ta saisie est gardée, réessaie.')).toBeTruthy();

    for (const espion of espions) {
      for (const appel of espion.mock.calls) {
        expect(JSON.stringify(appel)).not.toContain(motDePasseSecret);
      }
      espion.mockRestore();
    }
  });

  // N'affiche JAMAIS une date "déjà là" — corollaire du défaut trouvé sur le champ qui porte
  // la règle des 18 ans (docs/dette.md).
  it("n'affiche aucune date au premier rendu, un texte invite explicitement à en choisir une", async () => {
    await rendreInscription(creerFauxPortAuth());

    expect(screen.getByText('Choisir ta date de naissance')).toBeTruthy();
    expect(screen.getByLabelText('Date de naissance, choisir ta date de naissance')).toBeTruthy();
    // Le sélecteur natif lui-même n'est monté qu'à l'ouverture, jamais avant.
    expect(screen.queryByTestId('selecteur-date-naissance')).toBeNull();
  });

  it('sur Android, un appui sur le champ date ouvre le dialogue natif, qui confirme directement au choix', async () => {
    Platform.OS = 'android';
    await rendreInscription(creerFauxPortAuth());

    expect(screen.queryByTestId('selecteur-date-naissance')).toBeNull();
    await fireEvent.press(screen.getByTestId('ouvrir-selecteur-date-naissance'));
    const selecteur = screen.getByTestId('selecteur-date-naissance');

    await fireEvent(selecteur, 'valueChange', {}, new Date(2000, 0, 1));

    // Android n'a pas de bouton "Valider la date" : le dialogue natif a déjà ses propres
    // boutons OK/Annuler, "valueChange" EST la confirmation.
    expect(screen.queryByText('Valider la date')).toBeNull();
    expect(screen.getByText('1 janvier 2000')).toBeTruthy();
    expect(screen.queryByTestId('selecteur-date-naissance')).toBeNull(); // dialogue refermé
  });

  // Le vrai défaut trouvé après coup : le style "spinner" iOS n'a aucun geste de confirmation
  // propre — le premier déplacement, seul, ne doit RIEN confirmer.
  it('sur iOS, déplacer le sélecteur seul ne confirme rien : il faut appuyer sur Valider', async () => {
    Platform.OS = 'ios';
    await rendreInscription(creerFauxPortAuth());

    await fireEvent.press(screen.getByTestId('ouvrir-selecteur-date-naissance'));
    const selecteur = screen.getByTestId('selecteur-date-naissance');
    await fireEvent(selecteur, 'valueChange', {}, new Date(2000, 0, 1));

    // Toujours affiché comme non choisi : le déplacement seul n'a rien confirmé.
    expect(screen.getByText('Choisir ta date de naissance')).toBeTruthy();

    await fireEvent.press(screen.getByText('Valider la date'));

    expect(screen.getByText('1 janvier 2000')).toBeTruthy();
    expect(screen.queryByTestId('selecteur-date-naissance')).toBeNull(); // sélecteur replié
  });

  // La trouvaille de cette session : @react-native-community/datetimepicker n'a aucune
  // implémentation web (voir docs/backend.md) — un repli SILENCIEUX y laisserait le bouton
  // inactif sans explication. Le repli doit être visible, jamais transparent.
  it("sur web, affiche un message explicite plutôt qu'un sélecteur absent en silence", async () => {
    Platform.OS = 'web';
    await rendreInscription(creerFauxPortAuth());

    expect(
      screen.getByText(
        'Le sélecteur de date n’est pas disponible depuis un navigateur. Utilise l’application mobile pour créer ton compte.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('ouvrir-selecteur-date-naissance')).toBeNull();
    expect(screen.queryByTestId('selecteur-date-naissance')).toBeNull();

    // Remplir les deux autres champs ne suffit pas non plus ici : sur web, l'inscription ne
    // peut structurellement pas aboutir, le bouton doit rester honnêtement inactif.
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'mot-de-passe-long');
    expect(screen.getByText('Créer mon compte').parent?.props.accessibilityState.disabled).toBe(
      true,
    );
  });

  // L2-03 (C-06) : les liens CGU/confidentialité ouvrent désormais la surface publique du
  // lecteur de document, sans session — auparavant des liens morts.
  it('les liens CGU et confidentialité ouvrent la surface publique du lecteur de document', async () => {
    await rendreInscription(creerFauxPortAuth());

    await fireEvent.press(screen.getByText('CGU'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/documents/cgu');

    await fireEvent.press(screen.getByText('politique de confidentialité'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/documents/confidentialite');
  });
});
