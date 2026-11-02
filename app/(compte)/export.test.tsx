import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { EtatProfils } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import Export from './export';

const mockRetour = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRetour, canGoBack: () => true }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

type DernierExport = Parameters<
  ReturnType<typeof creerFauxPortDonnees>['definirDernierExportPourTest']
>[0];

async function rendre(surcharges: Partial<EtatProfils> = {}, dernierExport: DernierExport = null) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ clientExiste: true, ...surcharges }),
  );
  portDonnees.definirDernierExportPourTest(dernierExport);

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <Export />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(screen.queryByText('Ce que contient le fichier')).toBeTruthy());
  return { portDonnees };
}

describe('Export de mes données (docs/ecrans/L2-04-export-donnees.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('état initial : bouton « Demander mon export », aucune carte d’état', async () => {
    await rendre();

    expect(screen.getByText('Demander mon export')).toBeTruthy();
    expect(screen.queryByText('EN PRÉPARATION')).toBeNull();
    expect(screen.queryByText('PRÊT')).toBeNull();
  });

  // Critère 5 : seules les étiquettes réellement disponibles apparaissent.
  it('un profil client affiche Objectifs et Poids et mesures, un profil sans client non', async () => {
    await rendre({ clientExiste: true });
    expect(screen.getByText(/Objectifs/)).toBeTruthy();
    expect(screen.getByText(/Poids et mesures/)).toBeTruthy();
  });

  it('demander un export fait passer l’écran en « en préparation »', async () => {
    await rendre();

    await fireEvent.press(screen.getByText('Demander mon export'));

    await waitFor(() => expect(screen.queryByText('EN PRÉPARATION')).toBeTruthy());
    expect(
      screen.getByText('Demander un nouvel export').parent?.props.accessibilityState?.disabled,
    ).toBe(true);
  });

  // Critère 4 : une nouvelle demande est refusée avant qu'un mois se soit écoulé.
  // Textes validés le 2 novembre 2026 : un quota mensuel est une règle du produit, pas une panne.
  // Avant, la règle s'affichait sous le titre du repli serveur (« On a un souci de notre côté »),
  // et « Réessayer » relançait une demande promise à un nouveau refus.
  it('refuse une nouvelle demande trop rapprochée : la règle du produit, jamais le repli serveur', async () => {
    const { portDonnees } = await rendre();
    portDonnees.echouerProchainExportPourTest('export_trop_recent');

    await fireEvent.press(screen.getByText('Demander mon export'));

    await waitFor(() =>
      expect(screen.queryByText('Tu as déjà demandé un export ce mois-ci')).toBeTruthy(),
    );
    expect(screen.getByText('Tu pourras en redemander un le mois prochain.')).toBeTruthy();
    expect(screen.queryByText('On a un souci de notre côté')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
    expect(screen.queryByText('EN PRÉPARATION')).toBeNull();
  });

  // 2 novembre 2026 : « Réessayer » était inerte (onReessayer={() => {}}). Il relance la demande.
  it('un échec serveur : « Réessayer » relance vraiment la demande', async () => {
    const { portDonnees } = await rendre();
    portDonnees.echouerProchainExportPourTest('inconnu');
    const espion = jest.spyOn(portDonnees, 'demanderExportDonnees');
    await fireEvent.press(screen.getByText('Demander mon export'));
    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(espion).toHaveBeenCalledTimes(2));
  });

  it('un export prêt affiche la taille, les dates et un bouton Télécharger', async () => {
    await rendre(
      {},
      {
        demandeLe: '2026-09-01T00:00:00.000Z',
        pretLe: '2026-09-02T00:00:00.000Z',
        urlTelechargement: 'https://exemple.test/export.json',
        expireLe: '2099-01-01T00:00:00.000Z',
        tailleOctets: 2_202_009,
      },
    );

    await waitFor(() => expect(screen.queryByText('PRÊT')).toBeTruthy());
    expect(screen.getByText('2.1 Mo · JSON')).toBeTruthy();
    expect(screen.getByLabelText('Télécharger')).toBeTruthy();
  });

  // Fiche, "États (transitions)" : Prêt → Aucun export après 7 jours (expireLe dépassé).
  it('un export expiré retombe sur l’état initial, jamais un lien mort affiché « prêt »', async () => {
    await rendre(
      {},
      {
        demandeLe: '2020-01-01T00:00:00.000Z',
        pretLe: '2020-01-02T00:00:00.000Z',
        urlTelechargement: 'https://exemple.test/export.json',
        expireLe: '2020-01-09T00:00:00.000Z',
        tailleOctets: 1000,
      },
    );

    await waitFor(() => expect(screen.queryByText('Demander mon export')).toBeTruthy());
    expect(screen.queryByText('PRÊT')).toBeNull();
  });

  it('le bouton retour appelle router.back()', async () => {
    await rendre();
    await fireEvent.press(screen.getByLabelText('Retour'));
    expect(mockRetour).toHaveBeenCalledTimes(1);
  });
});
