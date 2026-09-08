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
  // bascule-coach-vers-client.test.tsx — ici, useRouter() est mocké : ce test prouve seulement
  // que la bascule DEMANDE le bon href, pas ce qui se passe ensuite dans la pile.
  it('depuis l’espace client, la bascule vers coach demande /(coach)/pilotage', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ profilActif: 'client', coachExiste: true }),
    );

    await rendreFeuille(portDonnees);
    await waitFor(() => expect(screen.getByLabelText('Espace coach')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Espace coach'));

    await waitFor(() => expect(mockRemplacer).toHaveBeenCalledWith('/(coach)/pilotage'));
  });

  it('depuis l’espace coach, la bascule vers client demande /(client)/accueil', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true }),
    );

    await rendreFeuille(portDonnees);
    await waitFor(() => expect(screen.getByLabelText('Espace client')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Espace client'));

    await waitFor(() => expect(mockRemplacer).toHaveBeenCalledWith('/(client)/accueil'));
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
