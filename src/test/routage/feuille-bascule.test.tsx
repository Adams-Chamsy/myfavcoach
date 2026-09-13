import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import {
  creerFauxPortDonnees,
  etatProfilsParDefaut,
  type FauxPortDonnees,
} from '@/services/donnees/faux';
import { FournisseurMouvementReduit, FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-06-bascule-espace.md, critères 2, 6, 7, 8 — src/test/routage/ (pas app/, voir
// docs/prompts/L1.md P1.12). Les critères 1 et 5 (vraie navigation, pile réinitialisée) vivent
// dans bascule-client-vers-coach.test.tsx et bascule-coach-vers-client.test.tsx : ils ont
// besoin d'un vrai arbre de routage (renderRouter), pas d'un écran isolé — CLAUDE.md §8.
const mockPousser = jest.fn();
const mockRemplacer = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPousser, replace: mockRemplacer }),
}));

async function compteConnecteEtVerifie() {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  return portAuth;
}

async function rendreFeuille(portDonnees: FauxPortDonnees, mouvementReduit = false) {
  const portAuth = await compteConnecteEtVerifie();
  return render(
    <FournisseurTheme>
      <FournisseurMouvementReduit force={mouvementReduit}>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <FeuilleBascule ouverte onFermer={() => {}}>
              <Text>Contenu écran</Text>
            </FeuilleBascule>
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurMouvementReduit>
    </FournisseurTheme>,
  );
}

describe('FeuilleBascule (docs/ecrans/L1-06-bascule-espace.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 1 (les deux sens). Le critère 5 (l'arbre de l'espace quitté réinitialisé) a besoin
  // d'un vrai routeur (renderRouter) et vit dans bascule-client-vers-coach.test.tsx /
  // bascule-coach-vers-client.test.tsx — ici, useRouter() est mocké : ce test prouve le bon
  // href ET, la feuille restant montée, la FRAÎCHEUR de `profils.profilActif` après bascule.
  //
  // Trouvé sur simulateur (P1.14) : sans relecture d'EtatProfils après la bascule, la coche
  // restait sur l'espace quitté et l'utilisateur ne pouvait plus revenir (la ligne « déjà
  // active » est inerte). Depuis P1.15 la relecture est intégrée à basculerProfil (fournisseur),
  // plus à cet écran — mais l'assertion reste ici : les deux tests renderRouter ne l'ont jamais
  // vue, ils remplacent tout l'écran par une doublure et n'observent que la pile, jamais la
  // feuille rouverte ni `profils.profilActif`. La coche active passe par l'accessibilityLabel
  // (« Espace coach, espace actif »), donc observable.
  it('depuis l’espace client → coach : demande /(coach)/pilotage ET la coche passe sur coach', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ profilActif: 'client', coachExiste: true }),
    );

    await rendreFeuille(portDonnees);
    await waitFor(() => expect(screen.getByLabelText('Espace coach')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Espace coach'));

    await waitFor(() => expect(mockRemplacer).toHaveBeenCalledWith('/(coach)/(tabs)/pilotage'));
    await waitFor(() => expect(screen.getByLabelText('Espace coach, espace actif')).toBeTruthy());
    expect(screen.queryByLabelText('Espace client, espace actif')).toBeNull();
  });

  it('depuis l’espace coach → client : demande /(client)/accueil ET la coche passe sur client', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true }),
    );

    await rendreFeuille(portDonnees);
    await waitFor(() => expect(screen.getByLabelText('Espace client')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Espace client'));

    await waitFor(() => expect(mockRemplacer).toHaveBeenCalledWith('/(client)/(tabs)/accueil'));
    await waitFor(() => expect(screen.getByLabelText('Espace client, espace actif')).toBeTruthy());
    expect(screen.queryByLabelText('Espace coach, espace actif')).toBeNull();
  });

  // Critère 2.
  it('sans profil coach, la deuxième ligne devient "Devenir coach" et mène à L1-08 sans tenter de bascule', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(etatProfilsParDefaut({ coachExiste: false }));
    const espionBascule = jest.spyOn(portDonnees, 'basculerProfil');

    await rendreFeuille(portDonnees);
    await waitFor(() => expect(screen.getByLabelText('Devenir coach')).toBeTruthy());

    expect(screen.queryByLabelText('Espace coach')).toBeNull();

    fireEvent.press(screen.getByLabelText('Devenir coach'));

    expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/devenir-coach');
    expect(espionBascule).not.toHaveBeenCalled();
  });

  // Critère 6.
  it('le compteur d’attente n’est pas rendu quand il vaut 0 — absence du nœud, pas un texte vide', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ coachExiste: true, attentesCoach: 0 }),
    );

    await rendreFeuille(portDonnees);
    await waitFor(() => expect(screen.getByLabelText('Espace coach')).toBeTruthy());

    expect(screen.queryByTestId('pastille-attentes-coach')).toBeNull();
  });

  it('contre-épreuve : le compteur est bien rendu quand il est supérieur à 0 (même code, autre valeur)', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ coachExiste: true, attentesCoach: 3 }),
    );

    await rendreFeuille(portDonnees);
    await waitFor(() => expect(screen.getByTestId('pastille-attentes-coach')).toBeTruthy());

    expect(screen.getByText('3')).toBeTruthy();
  });

  // Critère 7.
  it('marque le contenu d’écran inaccessible au lecteur d’écran quand la feuille est ouverte', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(etatProfilsParDefaut({ coachExiste: true }));

    await rendreFeuille(portDonnees);
    await waitFor(() => expect(screen.getByLabelText('Espace coach')).toBeTruthy());

    const arrierePlan = screen.getByText('Contenu écran', { includeHiddenElements: true }).parent!;
    expect(arrierePlan.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(arrierePlan.props.accessibilityElementsHidden).toBe(true);
  });

  // Critère 8 : FeuilleBasse applique et teste déjà elle-même (feuille-basse.test.tsx,
  // calculerDecalageEntree) le fondu sans translation en mouvement réduit. Ce test prouve
  // seulement que FeuilleBascule RÉUTILISE cette primitive (mêmes testID, même Modal), jamais
  // une animation réécrite ici — CLAUDE.md : "réutilise-la, ne la réécris pas".
  it('délègue entièrement l’ouverture et l’animation à FeuilleBasse, y compris en mouvement réduit', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(etatProfilsParDefaut({ coachExiste: true }));

    await rendreFeuille(portDonnees, true);

    await waitFor(() => expect(screen.getByTestId('feuille-bascule')).toBeTruthy());
    expect(screen.getByTestId('feuille-bascule-feuille')).toBeTruthy();
  });
});
