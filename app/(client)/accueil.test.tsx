import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import Accueil from './accueil';

const mockPousser = jest.fn();
// Spread du vrai module (comme ecran-compte.test.tsx) : FeuilleBascule → FeuilleBasse dépend
// de la vraie chaîne expo-router. Seul useRouter est réécrit.
jest.mock('expo-router', () => {
  const reel = jest.requireActual('expo-router');
  return {
    ...reel,
    useRouter: () => ({ push: mockPousser }),
  };
});

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

// FournisseurDonnees ne lit le port qu'avec une session vérifiée ET connectée (voir
// ecran-compte.test.tsx) : un simple creerFauxPortAuth() sans session laisse `profils` à
// `null` pour toujours, et « Salut Camille » ne s'affiche jamais.
async function rendre() {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({
      profilActif: 'client',
      clientExiste: true,
      identiteActive: { prenom: 'Camille', nom: 'Dupré' },
    }),
  );
  portDonnees.definirRechercheCoachsPourTest(() => ({
    resultats: [
      {
        offreId: 'o1',
        coachId: 'c1',
        prenom: 'Nadia',
        nom: 'Belkacem',
        photoUrl: null,
        discipline: 'cybersécurité',
        titreCourt: 'Sécurité offensive',
        communeBaseInsee: null,
        formats: ['visio'],
        titre: 'Suivi mensuel',
        prixCentimes: 3900,
      },
    ],
    totalResultats: 1,
  }));

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <Accueil />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(screen.queryByText('Salut Camille')).toBeTruthy());
  return { portDonnees };
}

describe('Accueil (docs/ecrans/L3-01-accueil-decouverte.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 1 : aucune note, aucun avis, aucun badge « Nouveau ».
  it('affiche le carrousel « Coachs pour toi » sans aucune note ni avis', async () => {
    await rendre();
    await waitFor(() => expect(screen.queryByText('Nadia Belkacem')).toBeTruthy());
    expect(screen.queryByText(/4,9|★|avis/i)).toBeNull();
    expect(screen.queryByText('Nouveau')).toBeNull();
  });

  // Critère 4 : le carrousel vient de la fonction de recherche réelle, jamais d'une fixture
  // codée en dur — la carte affiche exactement ce que le gestionnaire de test a renvoyé.
  it('affiche le prix et la discipline tels que rendus par rechercherCoachs', async () => {
    await rendre();
    await waitFor(() => expect(screen.queryByText('39 €/mois')).toBeTruthy());
    expect(screen.getByText('cybersécurité')).toBeTruthy();
    expect(screen.getByText('Sécurité offensive')).toBeTruthy();
  });

  // Critère 3 : un appui sur la barre de recherche ouvre L3-02, sans filtre.
  it('un appui sur la barre de recherche ouvre l’explorateur sans filtre', async () => {
    await rendre();
    await fireEvent.press(screen.getByLabelText('Rechercher un coach'));
    expect(mockPousser).toHaveBeenCalledWith('/(client)/explorer');
  });

  // Critère 3 : un appui sur une puce de discipline ouvre L3-02 pré-filtrée.
  it('un appui sur une puce de discipline ouvre l’explorateur pré-filtré', async () => {
    await rendre();
    await waitFor(() => expect(screen.queryByText('Yoga')).toBeTruthy());
    await fireEvent.press(screen.getByText('Yoga'));
    expect(mockPousser).toHaveBeenCalledWith({
      pathname: '/(client)/explorer',
      params: { discipline: 'yoga' },
    });
  });

  // Critère 2 : aucun bloc « séance du jour » ni « reprendre un programme » — dépendance L6
  // absente, rien à afficher plutôt qu'une invention.
  it('n’affiche aucun bloc « séance du jour » ni « reprendre un programme »', async () => {
    await rendre();
    expect(screen.queryByText(/séance du jour/i)).toBeNull();
    expect(screen.queryByText(/reprends/i)).toBeNull();
  });
});
