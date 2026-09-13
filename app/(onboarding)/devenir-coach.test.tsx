import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import {
  DISCIPLINES_FIGEES,
  creerFauxPortDonnees,
  etatProfilsParDefaut,
} from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import DevenirCoach from './devenir-coach';

const mockRemplacer = jest.fn();
const mockRetour = jest.fn();
const mockPousser = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRemplacer,
    push: mockPousser,
    back: mockRetour,
    canGoBack: () => true,
  }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const TELEPHONE = '06 12 34 56 78';

async function rendre(options: { avecProfilClient?: boolean } = {}) {
  const avecProfilClient = options.avecProfilClient ?? true;

  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({
      profilActif: 'client',
      clientExiste: avecProfilClient,
      identiteActive: avecProfilClient
        ? { prenom: 'Camille', nom: 'Dupré' }
        : { prenom: '', nom: null },
    }),
  );

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <DevenirCoach />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(screen.queryByText('Ouvre ton espace coach.')).toBeTruthy());
  // Les disciplines viennent désormais de port.lireDisciplines() (0020), résolu de façon
  // asynchrone même contre le faux port — attendre une puce avant d'interagir, sinon les tests
  // qui pressent un libellé de discipline courent devant le rendu (CLAUDE.md §8).
  await waitFor(() => expect(screen.queryByText('Yoga')).toBeTruthy());
  return { portDonnees };
}

function boutonDesactive() {
  return screen.getByText('Ouvrir mon espace coach').parent?.props.accessibilityState?.disabled;
}

describe('DevenirCoach (docs/ecrans/L1-08-activation-espace-coach.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 1 : l'écran s'ouvre — les deux champs et le bouton sont là.
  it('affiche la discipline (liste figée), le téléphone et le bouton d’ouverture', async () => {
    await rendre();

    for (const discipline of DISCIPLINES_FIGEES) {
      expect(screen.getByText(discipline.libelle)).toBeTruthy();
    }
    expect(screen.getByLabelText('Téléphone')).toBeTruthy();
    expect(screen.getByText('Ouvrir mon espace coach')).toBeTruthy();
    // Pas de saisie libre : aucun champ « discipline », aucune option « autre ».
    expect(screen.queryByLabelText('Discipline')).toBeNull();
    expect(screen.queryByText('Autre')).toBeNull();
  });

  // Critère 6 : prénom et nom repris du profil client, sans nouvelle saisie.
  it('reprend le prénom et le nom du profil client sans les redemander', async () => {
    const { portDonnees } = await rendre({ avecProfilClient: true });
    const espion = jest.spyOn(portDonnees, 'creerProfilCoach');

    expect(screen.queryByLabelText('Prénom')).toBeNull();
    expect(screen.queryByLabelText('Nom')).toBeNull();

    await fireEvent.press(screen.getByText('Yoga'));
    await fireEvent.changeText(screen.getByLabelText('Téléphone'), TELEPHONE);
    await waitFor(() => expect(boutonDesactive()).toBe(false));
    await fireEvent.press(screen.getByText('Ouvrir mon espace coach'));

    await waitFor(() =>
      expect(espion).toHaveBeenCalledWith(
        expect.objectContaining({ prenom: 'Camille', nom: 'Dupré', discipline: 'yoga' }),
      ),
    );
  });

  it('demande prénom et nom quand aucun profil client n’existe', async () => {
    await rendre({ avecProfilClient: false });

    expect(screen.getByLabelText('Prénom')).toBeTruthy();
    expect(screen.getByLabelText('Nom')).toBeTruthy();
  });

  it('le bouton reste inactif tant que discipline et téléphone valide ne sont pas renseignés', async () => {
    await rendre();

    expect(boutonDesactive()).toBe(true);

    await fireEvent.press(screen.getByText('Cybersécurité'));
    expect(boutonDesactive()).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Téléphone'), 'pas-un-numero');
    expect(boutonDesactive()).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Téléphone'), TELEPHONE);
    await waitFor(() => expect(boutonDesactive()).toBe(false));
  });

  // Critère 2 (côté écran) : après succès, rafraîchit l'état puis enchaîne sur l'étape 2/4
  // (L2-05, docs/prompts/L2.md P2.8) — plus directement sur le pilotage depuis ce lot.
  it('une validation réussie rafraîchit l’état et enchaîne sur l’étape 2/4 (profil)', async () => {
    const { portDonnees } = await rendre();

    await fireEvent.press(screen.getByText('Préparation physique'));
    await fireEvent.changeText(screen.getByLabelText('Téléphone'), TELEPHONE);
    await waitFor(() => expect(boutonDesactive()).toBe(false));
    await fireEvent.press(screen.getByText('Ouvrir mon espace coach'));

    await waitFor(() =>
      expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/devenir-coach-profil'),
    );
    const etat = await portDonnees.lireEtatProfils();
    expect(etat.coachExiste).toBe(true);
    expect(etat.profilActif).toBe('coach');
  });

  // Critère 3 : une erreur serveur ne laisse aucun profil à moitié, bandeau, saisie conservée.
  it('un échec serveur affiche l’erreur, ne navigue pas et conserve la saisie', async () => {
    const { portDonnees } = await rendre();
    portDonnees.echouerProchaineEcriturePourTest('On a un souci de notre côté.');

    await fireEvent.press(screen.getByText('Cuisine et alimentation du quotidien'));
    await fireEvent.changeText(screen.getByLabelText('Téléphone'), TELEPHONE);
    await waitFor(() => expect(boutonDesactive()).toBe(false));
    await fireEvent.press(screen.getByText('Ouvrir mon espace coach'));

    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté.')).toBeTruthy());
    expect(mockRemplacer).not.toHaveBeenCalled();
    expect((await portDonnees.lireEtatProfils()).coachExiste).toBe(false);
    // La saisie n'est pas perdue : le bouton est encore prêt à réessayer.
    expect(boutonDesactive()).toBe(false);
  });

  // Critère 7 : aucun module de paiement importé, aucune lecture d'une clé publiable, dans
  // l'arbre de cet écran. Le mot du prestataire de paiement n'est pas écrit ici — le balayage
  // dépôt-large de src/test/secrets-interdits.test.ts le proscrit partout — donc ce contrôle est
  // POSITIF : la liste des modules importés est close, et rien ne lit `process.env` /
  // `EXPO_PUBLIC_*`. Un SDK de paiement ajouté ici casserait la liste.
  it('n’importe que des modules attendus et ne lit aucune variable d’environnement', () => {
    const source = readFileSync(join(__dirname, 'devenir-coach.tsx'), 'utf8');
    const modulesImportes = [...source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map(
      (correspondance) => correspondance[1],
    );

    const AUTORISES = new Set([
      'expo-router',
      'react',
      'react-native',
      'react-native-safe-area-context',
      '@/composants/bouton',
      '@/composants/champ',
      '@/composants/chip',
      '@/composants/etats/etat-erreur',
      '@/composants/etats/textes',
      '@/composants/icones',
      '@/fonctionnalites/identite/entete-onboarding',
      '@/fonctionnalites/identite/fournisseur-donnees',
      '@/services/donnees/port',
      '@/theme/fournisseur',
    ]);
    expect(modulesImportes.filter((nom) => !AUTORISES.has(nom))).toEqual([]);
    expect(source).not.toMatch(/process\.env|EXPO_PUBLIC_/);
  });
});
