import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import type {
  ParametresRecherche,
  ResultatCoachRecherche,
  ResultatRecherche,
} from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import { CorpsExplorer } from './explorer';

const mockPousser = jest.fn();
const mockRetour = jest.fn();
// Spread du vrai module (comme ecran-compte.test.tsx) : FeuilleBasse en dépend.
jest.mock('expo-router', () => {
  const reel = jest.requireActual('expo-router');
  return {
    ...reel,
    useRouter: () => ({ push: mockPousser, back: mockRetour, canGoBack: () => true }),
  };
});

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function coach(surcharges: Partial<ResultatCoachRecherche> = {}): ResultatCoachRecherche {
  return {
    offreId: 'o1',
    coachId: 'c1',
    prenom: 'Nadia',
    nom: 'Belkacem',
    photoUrl: null,
    discipline: 'cybersécurité',
    titreCourt: 'Sécurité offensive',
    communeBaseInsee: null,
    formats: ['presentiel'],
    titre: 'Suivi mensuel',
    prixCentimes: 3900,
    ...surcharges,
  };
}

// CorpsExplorer ne lit jamais `profils` (voir accueil.test.tsx pour ce cas-là) : `port` seul
// suffit, présent dans le contexte même sans session (fournisseur-donnees.tsx). Pas besoin
// d'inscrire/vérifier/connecter un compte ici.
async function rendre(gestionnaire: (parametres: ParametresRecherche) => ResultatRecherche) {
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirRechercheCoachsPourTest(gestionnaire);

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={creerFauxPortAuth()}>
          <FournisseurDonnees port={portDonnees}>
            <CorpsExplorer />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(screen.queryByText('Pertinence')).toBeTruthy());
  return { portDonnees };
}

describe('Explorer (docs/ecrans/L3-02-recherche-filtres.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère : aucune note, aucun avis, aucun badge « Nouveau » dans les résultats.
  it('affiche les résultats sans aucune note, avis ni badge « Nouveau »', async () => {
    await rendre(() => ({ resultats: [coach()], totalResultats: 1 }));
    await waitFor(() => expect(screen.queryByText('Nadia Belkacem')).toBeTruthy());
    expect(screen.getByText('Vérifié')).toBeTruthy();
    expect(screen.queryByText(/4,9|★|avis/i)).toBeNull();
    expect(screen.queryByText('Nouveau')).toBeNull();
    expect(screen.queryByText('Me prévenir')).toBeNull();
  });

  // Le total vient du champ rendu par la fonction (totalResultats), jamais recompté côté
  // client : ici la fonction annonce 7 alors qu'un seul résultat est rendu (page 1 tronquée).
  it('affiche le total exact rendu par la fonction, jamais un calcul côté client', async () => {
    await rendre(() => ({ resultats: [coach()], totalResultats: 7 }));
    await waitFor(() => expect(screen.queryByText('7 coachs')).toBeTruthy());
  });

  it('« Tout effacer » réinitialise les filtres et relance une recherche sans eux', async () => {
    const gestionnaire = jest.fn((parametres: ParametresRecherche) => ({
      resultats: [coach()],
      totalResultats: 1,
    }));
    await rendre(gestionnaire);

    // Un filtre de commune, posé directement dans l'état (le brouillon de la feuille n'est pas
    // testé ici, seulement le bouton « Tout effacer » lui-même) : passe par la feuille de filtres
    // réelle, commune « Lyon » (COMMUNES_FIGEES).
    await fireEvent.press(screen.getByLabelText('Filtres'));
    await waitFor(() => expect(screen.queryByText('Lyon')).toBeTruthy());
    await fireEvent.press(screen.getByText('Lyon'));
    await fireEvent.press(screen.getByText('Appliquer'));

    await waitFor(() => expect(screen.queryByText('Tout effacer')).toBeTruthy());
    gestionnaire.mockClear();
    await fireEvent.press(screen.getByText('Tout effacer'));

    await waitFor(() => expect(screen.queryByText('Tout effacer')).toBeNull());
    expect(gestionnaire).toHaveBeenCalledWith(
      expect.objectContaining({ communeInsee: null, format: null, discipline: null }),
    );
  });

  // L3-03 : état vide honnête, avec le bouton de relâchement du format quand un second appel
  // réel (format visio autorisé) trouve des résultats.
  it('état vide, format présentiel actif : propose « Ouvrir aux coachs en visio · N résultats »', async () => {
    const gestionnaire = jest.fn((parametres: ParametresRecherche): ResultatRecherche => {
      if (parametres.format === 'presentiel') return { resultats: [], totalResultats: 0 };
      return { resultats: [coach({ formats: ['visio'] })], totalResultats: 4 };
    });
    await rendre(gestionnaire);

    await fireEvent.press(screen.getByLabelText('Filtres'));
    await waitFor(() => expect(screen.queryByText('En présentiel')).toBeTruthy());
    await fireEvent.press(screen.getByText('En présentiel'));
    await fireEvent.press(screen.getByText('Appliquer'));

    await waitFor(() =>
      expect(screen.queryByText('Ouvrir aux coachs en visio · 4 résultats')).toBeTruthy(),
    );
    expect(screen.getByText('Proches de ta recherche')).toBeTruthy();

    await fireEvent.press(screen.getByText('Ouvrir aux coachs en visio · 4 résultats'));
    await waitFor(() => expect(screen.queryByText('4 coachs')).toBeTruthy());
  });

  // Sans résultat relâché disponible (totalRelaches à 0), aucune invention de bouton ni de total.
  it('état vide sans relâchement possible : ni bouton, ni total inventés', async () => {
    await rendre(() => ({ resultats: [], totalResultats: 0 }));
    await waitFor(() => expect(screen.queryByText(/Personne en/)).toBeTruthy());
    expect(screen.queryByText(/Ouvrir aux coachs en visio/)).toBeNull();
    expect(screen.queryByText('Proches de ta recherche')).toBeNull();
  });

  // Plafond/pagination : « Voir plus » apparaît seulement tant que resultats.length < total,
  // et charge la page suivante via le même mécanisme rechercherCoachs (decalage).
  it('« Voir plus » charge la page suivante via rechercherCoachs', async () => {
    const gestionnaire = jest.fn((parametres: ParametresRecherche): ResultatRecherche => {
      if ((parametres.decalage ?? 0) > 0) {
        return {
          resultats: [coach({ offreId: 'o2', prenom: 'Farid', nom: 'Aziz' })],
          totalResultats: 2,
        };
      }
      return { resultats: [coach()], totalResultats: 2 };
    });
    await rendre(gestionnaire);

    await waitFor(() => expect(screen.queryByText('Voir plus')).toBeTruthy());
    await fireEvent.press(screen.getByText('Voir plus'));

    await waitFor(() => expect(screen.queryByText('Farid Aziz')).toBeTruthy());
    expect(screen.queryByText('Voir plus')).toBeNull();
  });
});
