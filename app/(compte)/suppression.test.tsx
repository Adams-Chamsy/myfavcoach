import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { EtatProfils, Offre } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import Suppression from './suppression';

const mockPousser = jest.fn();
const mockRemplacer = jest.fn();
const mockRetour = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPousser,
    replace: mockRemplacer,
    back: mockRetour,
    canGoBack: () => true,
  }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const OFFRE_PUBLIEE: Offre = {
  id: 'offre-1',
  titre: 'Suivi hebdomadaire',
  description: null,
  prixCentimes: 4900,
  benefices: [],
  engagementHumain: [],
  estMiseEnAvant: false,
  publieeLe: '2026-01-01T00:00:00.000Z',
  retireeLe: null,
};

async function rendre(surcharges: Partial<EtatProfils> = {}, offres: Offre[] = []) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'client', clientExiste: true, ...surcharges }),
  );
  portDonnees.definirOffresPourTest(offres);

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <Suppression />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  await waitFor(() =>
    expect(screen.queryByLabelText('Écris SUPPRIMER pour confirmer')).toBeTruthy(),
  );
  return { portAuth, portDonnees };
}

describe('Suppression de compte (docs/ecrans/L2-01-suppression-compte.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 2 : le bouton reste inactif tant que le champ ne contient pas exactement SUPPRIMER.
  it('« Supprimer définitivement » reste inactif tant que le champ n’est pas exactement SUPPRIMER', async () => {
    await rendre();

    expect(
      screen.getByText('Supprimer définitivement').parent?.props.accessibilityState?.disabled,
    ).toBe(true);

    await fireEvent.changeText(
      screen.getByLabelText('Écris SUPPRIMER pour confirmer'),
      'supprimer',
    );
    expect(
      screen.getByText('Supprimer définitivement').parent?.props.accessibilityState?.disabled,
    ).toBe(true);

    await fireEvent.changeText(
      screen.getByLabelText('Écris SUPPRIMER pour confirmer'),
      'SUPPRIMER',
    );
    expect(
      screen.getByText('Supprimer définitivement').parent?.props.accessibilityState?.disabled,
    ).toBe(false);
  });

  // Critère 3 : la confirmation appelle DELETE /moi (port), vide la session, ramène sur (public).
  it('confirmée, la suppression appelle le port puis déconnecte et renvoie sur (public)', async () => {
    const { portAuth, portDonnees } = await rendre();
    const espionSuppression = jest.spyOn(portDonnees, 'demanderSuppressionCompte');
    const espionDeconnexion = jest.spyOn(portAuth, 'deconnecter');

    await fireEvent.changeText(
      screen.getByLabelText('Écris SUPPRIMER pour confirmer'),
      'SUPPRIMER',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Dis-nous pourquoi (facultatif)'),
      'Trop cher',
    );
    await fireEvent.press(screen.getByText('Supprimer définitivement'));

    await waitFor(() => expect(espionSuppression).toHaveBeenCalledWith('Trop cher'));
    await waitFor(() => expect(espionDeconnexion).toHaveBeenCalledTimes(1));
    expect(mockRemplacer).toHaveBeenCalledWith('/(public)');
  });

  // Critère 4 : une erreur serveur ne marque pas le compte supprimé, ne vide pas la session.
  it('une erreur serveur affiche un état d’erreur, sans déconnecter ni naviguer', async () => {
    const { portAuth, portDonnees } = await rendre();
    portDonnees.echouerProchaineEcriturePourTest('Erreur de test.');
    const espionDeconnexion = jest.spyOn(portAuth, 'deconnecter');

    await fireEvent.changeText(
      screen.getByLabelText('Écris SUPPRIMER pour confirmer'),
      'SUPPRIMER',
    );
    await fireEvent.press(screen.getByText('Supprimer définitivement'));

    await waitFor(() => expect(screen.queryByText('Erreur de test.')).toBeTruthy());
    expect(espionDeconnexion).not.toHaveBeenCalled();
    expect(mockRemplacer).not.toHaveBeenCalled();
  });

  // Critère 5 : le lien d'export ouvre L2-04 sans déclencher la suppression.
  it('« Exporter mes données d’abord » ouvre L2-04 sans supprimer', async () => {
    const { portDonnees } = await rendre();
    const espionSuppression = jest.spyOn(portDonnees, 'demanderSuppressionCompte');

    await fireEvent.press(screen.getByText('Exporter mes données d’abord'));

    expect(mockPousser).toHaveBeenCalledWith('/(compte)/export');
    expect(espionSuppression).not.toHaveBeenCalled();
  });

  it('aucun bandeau coach côté client', async () => {
    await rendre({ profilActif: 'client' });

    expect(screen.queryByText(/Tes offres sont retirées/)).toBeNull();
  });

  // Fiche, « Si un abonnement est actif » : ce bandeau ne peut jamais se déclencher à ce lot
  // (ABONNEMENT_ACTIF est une constante figée à `false`, aucune table Abonnement n'existe avant
  // L4/L7 — docs/dette.md). Ce test fige le comportement actuel, pas le comportement voulu.
  it('aucun bandeau abonnement côté client (aucune table Abonnement à ce lot)', async () => {
    await rendre({ profilActif: 'client' });

    expect(screen.queryByText(/Ton abonnement est actif/)).toBeNull();
  });

  // Fiche, § « Côté coach » : bandeau si des offres sont publiées.
  it('affiche le bandeau coach quand au moins une offre est publiée', async () => {
    await rendre({ profilActif: 'coach', coachExiste: true }, [OFFRE_PUBLIEE]);

    await waitFor(() => expect(screen.queryByText(/Tes offres sont retirées/)).toBeTruthy());
  });

  it('n’affiche pas le bandeau coach sans offre publiée', async () => {
    await rendre({ profilActif: 'coach', coachExiste: true }, [
      { ...OFFRE_PUBLIEE, publieeLe: null },
    ]);

    expect(screen.queryByText(/Tes offres sont retirées/)).toBeNull();
  });

  it('le bouton retour appelle router.back()', async () => {
    await rendre();
    await fireEvent.press(screen.getByLabelText('Retour'));
    expect(mockRetour).toHaveBeenCalledTimes(1);
  });
});
