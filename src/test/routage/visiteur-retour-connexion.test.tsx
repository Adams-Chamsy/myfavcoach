import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Share } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { FournisseurTheme } from '@/theme/fournisseur';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { GardeAdressesPrivees } from '@/fonctionnalites/identite/garde-adresses-privees';
import { FournisseurParcoursVisiteur } from '@/fonctionnalites/accueil/fournisseur-parcours-visiteur';
import { ConsommationRetourCoach } from '@/fonctionnalites/accueil/reprise-profil';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { PortAccueil } from '@/services/accueil/port';

const COACH = '11111111-2222-4333-8444-555555555555';
const METRIQUES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};
afterEach(() => jest.useRealTimers());

// Fiche L1-01a : ce que l’on retrouve derrière la connexion ne peut pas se prouver en
// montant les écrans seuls. Le test appuie sur les vrais boutons, garde et pile comprises.
it.each(['recherche', 'lien', 'lien indisponible'] as const)(
  'parcours visiteur depuis %s : accès au profil ou retour à la découverte',
  async (entree) => {
    const auth = creerFauxPortAuth();
    await auth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
    auth.verifierEmailPourTest('camille@exemple.fr');
    await auth.deconnecter();
    const donnees = creerFauxPortDonnees();
    donnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ profilActif: 'client', clientExiste: true, clientOnboardingEtape: 5 }),
    );
    const lireOffres = jest.spyOn(donnees, 'lireOffresPublieesDeCoach');
    const recherche = jest.fn(() => ({
      resultats: [
        {
          offreId: 'offre-suivi',
          coachId: COACH,
          prenom: 'Nadia',
          nom: 'Belkacem',
          photoUrl: null,
          discipline: 'cybersécurité',
          titreCourt: 'Sécurité offensive',
          communeBaseInsee: null,
          formats: ['visio'],
          titre: 'Suivi complet',
          prixCentimes: 4900,
        },
      ],
      totalResultats: 1,
    }));
    donnees.definirRechercheCoachsPourTest(recherche);
    donnees.definirProfilsCoachPublicsPourTest({
      [COACH]: {
        id: COACH,
        prenom: 'Nadia',
        nom: 'Belkacem',
        photoUrl: null,
        discipline: 'Cybersécurité',
        titreCourt: 'Sécurité offensive',
        bio: null,
        verifiee: true,
        verifieeDepuisLe: null,
        parcoursTexte: null,
        langues: [],
      },
    });
    donnees.definirOffresPubliquesPourTest({
      [COACH]: [
        {
          id: 'offre-suivi',
          titre: 'Suivi complet',
          description: null,
          prixCentimes: 4900,
          benefices: [],
          engagementHumain: ['ajustement hebdomadaire'],
          estMiseEnAvant: false,
          publieeLe: '2026-09-01T00:00:00.000Z',
          retireeLe: null,
        },
      ],
    });
    const preferences: PortAccueil = {
      lire: async () => ({ marqueVue: true, retourCoach: null }),
      marquerOuvertureVue: async () => {},
      enregistrerRetour: jest.fn().mockResolvedValue(undefined),
    };
    function Racine() {
      return (
        <SafeAreaProvider initialMetrics={METRIQUES}>
          <FournisseurTheme>
            <FournisseurSession port={auth}>
              <FournisseurDonnees port={donnees}>
                <FournisseurParcoursVisiteur port={preferences}>
                  <GardeAdressesPrivees />
                  <ConsommationRetourCoach />
                  <Stack screenOptions={{ headerShown: false }} />
                </FournisseurParcoursVisiteur>
              </FournisseurDonnees>
            </FournisseurSession>
          </FournisseurTheme>
        </SafeAreaProvider>
      );
    }
    const urlInitiale = {
      recherche: '/(public)',
      lien: `/profil/${COACH}`,
      'lien indisponible': '/profil/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    }[entree];
    const rendu = await renderRouter(
      { appDir: './app', overrides: { _layout: Racine } },
      { initialUrl: urlInitiale },
    );
    await act(() => jest.runAllTimersAsync());
    if (entree === 'lien indisponible') {
      await waitFor(() => expect(screen.queryByText('Profil introuvable')).toBeTruthy());
      expect(screen.queryByRole('button', { name: 'Partager le profil' })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Découvrir les coachs' }));
      await act(() => jest.runAllTimersAsync());
      await waitFor(() => expect(rendu.getPathname()).toBe('/decouvrir'));
      return;
    }
    if (entree === 'recherche') {
      await fireEvent.press(screen.getByText('Découvrir les coachs'));
      await act(() => jest.runAllTimersAsync());
      await waitFor(() =>
        expect(screen.queryByLabelText('Voir le profil de Nadia Belkacem')).toBeTruthy(),
      );
      await fireEvent.press(screen.getByLabelText('Voir le profil de Nadia Belkacem'));
      await act(() => jest.runAllTimersAsync());
      await waitFor(() => expect(rendu.getPathname()).toBe(`/profil/${COACH}`));
    }
    await waitFor(() => expect(screen.queryByText('Suivi complet')).toBeTruthy());
    const partager = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    try {
      await fireEvent.press(screen.getByRole('button', { name: 'Partager le profil' }));
      expect(partager).toHaveBeenCalledWith({
        message: `Découvre Nadia Belkacem sur MyFavCoach : https://myfavcoach.fr/profil/${COACH}`,
      });
    } finally {
      partager.mockRestore();
    }
    await fireEvent.press(screen.getByText('S’abonner · 49 €/mois'));
    await act(() => jest.runAllTimersAsync());
    await waitFor(() => expect(screen.queryByText('Content de te revoir.')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'bon-mot-de-passe');
    await fireEvent.press(screen.getByText('Se connecter'));
    await act(() => jest.runAllTimersAsync());
    await waitFor(() => expect(rendu.getPathname()).toBe(`/profil/${COACH}`));
    expect(screen.queryByText('Suivi complet')).toBeTruthy();
    expect(lireOffres).toHaveBeenCalledTimes(2);
    expect(preferences.enregistrerRetour).toHaveBeenCalledWith(null);
    await fireEvent.press(screen.getByLabelText('Retour aux résultats'));
    await act(() => jest.runAllTimersAsync());
    await waitFor(() => expect(rendu.getPathname()).toBe('/decouvrir'));
    expect(recherche).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Voir le profil de Nadia Belkacem')).toBeTruthy();
  },
);
