import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, type FauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import OnboardingIdentite from './1-identite';

const mockRetour = jest.fn();
const mockPousser = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRetour, push: mockPousser, canGoBack: () => true }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

// FournisseurDonnees a besoin d'une session vérifiée (useSession()) pour lire quoi que ce soit
// — même logique que src/fonctionnalites/identite/fournisseur-donnees.test.tsx.
async function rendreEcran(port: FauxPortDonnees) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  return render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={port}>
            <OnboardingIdentite />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('OnboardingIdentite (docs/ecrans/L1-05-onboarding-client.md, étape 1/4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 1 : "Le prénom vide bloque l'étape 1".
  it('le bouton Continuer est désactivé tant que le prénom est vide', async () => {
    await rendreEcran(creerFauxPortDonnees());

    expect(screen.getByText('Continuer').parent?.props.accessibilityState?.disabled).toBe(true);
  });

  it("aucun lien « Passer » à l'étape 1", async () => {
    await rendreEcran(creerFauxPortDonnees());

    expect(screen.queryByText('Passer')).toBeNull();
  });

  it('un prénom valide crée le profil client et avance à l’étape 2', async () => {
    const port = creerFauxPortDonnees();
    await rendreEcran(port);

    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Camille');
    await fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/2-objectifs'));
    expect((await port.lireProfilOnboarding()).prenom).toBe('Camille');
  });

  it('nom vide est transmis tel quel (facultatif, jamais bloquant)', async () => {
    const port = creerFauxPortDonnees();
    await rendreEcran(port);

    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Camille');
    await fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(mockPousser).toHaveBeenCalled());
    expect((await port.lireProfilOnboarding()).nom).toBeNull();
  });

  // États, "Erreur" : "l'étape n'avance pas et rien n'est perdu".
  it('un échec du serveur affiche une erreur et ne navigue pas', async () => {
    const port = creerFauxPortDonnees();
    port.echouerProchaineEcriturePourTest('On a un souci de notre côté.');
    await rendreEcran(port);

    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Camille');
    await fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(screen.getByText('On a un souci de notre côté.')).toBeTruthy());
    expect(mockPousser).not.toHaveBeenCalled();
    // La saisie n'est pas perdue.
    expect(screen.getByLabelText('Prénom').props.value).toBe('Camille');
  });

  it('le bouton retour appelle router.back()', async () => {
    await rendreEcran(creerFauxPortDonnees());

    await fireEvent.press(screen.getByLabelText('Retour'));

    expect(mockRetour).toHaveBeenCalledTimes(1);
  });

  // Reprise via le bouton retour (P1.11) : un profil peut déjà exister, la saisie déjà
  // enregistrée doit réapparaître, pas des champs vides.
  it('pré-remplit prénom et nom depuis un profil déjà créé (retour depuis l’étape 2)', async () => {
    const port = creerFauxPortDonnees();
    await port.creerProfilClient('Camille', 'Dupont');
    await rendreEcran(port);

    await waitFor(() => expect(screen.getByLabelText('Prénom').props.value).toBe('Camille'));
    expect(screen.getByLabelText('Nom').props.value).toBe('Dupont');
  });
});
