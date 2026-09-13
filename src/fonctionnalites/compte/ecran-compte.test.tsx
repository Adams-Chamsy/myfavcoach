import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { EtatProfils } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import MoiClient from '../../../app/(client)/(tabs)/moi';
import MoiCoach from '../../../app/(coach)/(tabs)/moi';
import { EcranCompte } from './ecran-compte';

const mockPousser = jest.fn();
const mockRemplacer = jest.fn();
const mockRetour = jest.fn();

// Spread du vrai module (comme src/test/accessibilite.test.tsx) : EcranCompte rend
// FeuilleBascule → FeuilleBasse, dont la chaîne de dépendances casse si expo-router est
// remplacé par un objet nu. Seul useRouter est réécrit.
jest.mock('expo-router', () => {
  const reel = jest.requireActual('expo-router');
  return {
    ...reel,
    useRouter: () => ({
      push: mockPousser,
      replace: mockRemplacer,
      back: mockRetour,
      canGoBack: () => true,
    }),
  };
});

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

// FournisseurDonnees ne lit le port qu'avec une session vérifiée ET connectée — même montage
// que app/(onboarding)/1-identite.test.tsx. On attend systématiquement le premier rendu réel
// (waitFor) plutôt que findBy*, qui s'est montré instable avec ce montage à providers.
async function rendreEcran(surcharges: Partial<EtatProfils> = {}) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({
      profilActif: 'client',
      clientExiste: true,
      clientOnboardingEtape: 5,
      identiteActive: { prenom: 'Camille', nom: 'Dupré' },
      ...surcharges,
    }),
  );

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <EcranCompte />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  // Le premier contenu réel (l'en-tête d'identité) prouve que la lecture des profils a abouti
  // et que les squelettes ont laissé place à l'écran.
  await waitFor(() => expect(screen.queryByText('Camille Dupré')).toBeTruthy());
  return { portAuth };
}

describe('EcranCompte (docs/ecrans/L1-07-compte-reglages.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 1 : l'écran affiche le bon profil (identité active + adresse du compte).
  it('affiche le prénom, le nom et l’adresse e-mail du profil actif', async () => {
    await rendreEcran();

    expect(screen.getByText('Camille Dupré')).toBeTruthy();
    expect(screen.getByText('camille@exemple.fr')).toBeTruthy();
  });

  it('les deux routes « moi » réexportent le même écran', () => {
    expect(MoiCoach).toBe(MoiClient);
    expect(MoiClient).toBe(EcranCompte);
  });

  // Critère 2 : chaque ligne ouvre réellement sa destination, aucune ligne inerte.
  it.each([
    ['Mes informations', '/(compte)/informations'],
    ['Adresse e-mail et mot de passe', '/(compte)/identifiants'],
    ['Mes autorisations', '/(compte)/confidentialite'],
    ['Documents contractuels', '/(compte)/documents'],
    ['Exporter mes données', '/(compte)/export'],
  ])('la ligne « %s » ouvre %s', async (libelle, route) => {
    await rendreEcran();

    fireEvent.press(screen.getByLabelText(libelle));

    expect(mockPousser).toHaveBeenCalledWith(route);
  });

  // Critère 3 : « Devenir coach » sans profil coach, « Passer en espace coach » avec.
  it('le bloc encre affiche « Devenir coach » quand il n’y a pas de profil coach', async () => {
    await rendreEcran({ coachExiste: false });

    expect(screen.getByText('Devenir coach')).toBeTruthy();
    expect(screen.queryByText('Passer en espace coach')).toBeNull();
  });

  it('le bloc encre affiche « Passer en espace coach » quand le profil coach existe', async () => {
    await rendreEcran({ coachExiste: true });

    expect(screen.getByText('Passer en espace coach')).toBeTruthy();
    expect(screen.queryByText('Devenir coach')).toBeNull();
  });

  // Critère 3 (suite) : presser le bloc OUVRE la feuille de bascule, jamais une bascule directe
  // ni une navigation vers L1-08.
  it('presser le bloc encre ouvre la feuille de bascule, sans naviguer', async () => {
    await rendreEcran({ coachExiste: false });

    fireEvent.press(screen.getByLabelText('Devenir coach'));

    await waitFor(() => expect(screen.queryByText('Espace client')).toBeTruthy());
    expect(mockPousser).not.toHaveBeenCalled();
    expect(mockRemplacer).not.toHaveBeenCalled();
  });

  // Critère 6 : l'avatar ouvre la feuille de bascule, avec un libellé accessible dédié.
  it('l’avatar ouvre la feuille de bascule et porte le libellé « …, changer d’espace »', async () => {
    await rendreEcran();

    fireEvent.press(screen.getByLabelText("Camille Dupré, changer d'espace"));

    await waitFor(() => expect(screen.queryByText('Espace client')).toBeTruthy());
  });

  // Critère 4 : la déconnexion demande confirmation avant d'agir.
  it('la déconnexion demande confirmation avant d’appeler le port', async () => {
    const { portAuth } = await rendreEcran();
    const espionDeconnexion = jest.spyOn(portAuth, 'deconnecter');

    fireEvent.press(screen.getByLabelText('Se déconnecter'));

    await waitFor(() => expect(screen.queryByText('Se déconnecter ?')).toBeTruthy());
    expect(espionDeconnexion).not.toHaveBeenCalled();
  });

  // Critères 4 et 5 : confirmée, elle appelle port.deconnecter() (qui réussit même hors ligne,
  // garanti par le port) puis renvoie sur l'écran de bienvenue (L1-01).
  it('confirmée, la déconnexion appelle le port puis renvoie sur (public)', async () => {
    const { portAuth } = await rendreEcran();
    const espionDeconnexion = jest.spyOn(portAuth, 'deconnecter');

    fireEvent.press(screen.getByLabelText('Se déconnecter'));
    await waitFor(() => expect(screen.queryByText('Se déconnecter ?')).toBeTruthy());
    // Modale ouverte : le fond (dont le déclencheur) est masqué du lecteur d'écran, le seul
    // « Se déconnecter » encore visible est le bouton destructeur de la modale.
    fireEvent.press(screen.getByText('Se déconnecter'));

    await waitFor(() => expect(espionDeconnexion).toHaveBeenCalledTimes(1));
    expect(mockRemplacer).toHaveBeenCalledWith('/(public)');
  });

  // Critère 7 : l'action de déconnexion est annoncée comme destructrice au lecteur d'écran.
  it('la ligne de déconnexion porte un accessibilityHint sur sa conséquence', async () => {
    await rendreEcran();

    expect(screen.getByLabelText('Se déconnecter').props.accessibilityHint).toContain(
      'reconnecter',
    );
  });

  // Critère 9 : aucune chaîne des lots L4 ou L10 dans le rendu — ces deux-là restent loin.
  it('n’affiche aucune fonctionnalité des lots L4 ou L10', async () => {
    await rendreEcran();

    const rendu = JSON.stringify(screen.toJSON()).toLowerCase();
    for (const interdit of ['abonnement', 'notification']) {
      expect(rendu).not.toContain(interdit);
    }
  });

  // Critère 9 (suite), INVERSÉE comme annoncé par son propre commentaire d'origine (P1.13) :
  // « supprimer mon compte » devait apparaître dès que C-03 construirait l'écran de suppression
  // — c'est fait (P2.12, L2-01). La retirer au lieu de l'inverser aurait fait disparaître la
  // couverture au moment exact où elle commence à servir (docs/prompts/L1.md, tableau des faux
  // verts, 3ᵉ ligne).
  it('affiche désormais « Supprimer mon compte », qui ouvre L2-01', async () => {
    await rendreEcran();

    fireEvent.press(screen.getByLabelText('Supprimer mon compte'));

    expect(mockPousser).toHaveBeenCalledWith('/(compte)/suppression');
  });
});
