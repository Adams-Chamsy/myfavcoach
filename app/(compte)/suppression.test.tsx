import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { AbonnementClient, EtatProfils, Offre } from '@/services/donnees/port';
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

// Données : src/fixtures/demonstration.ts (Yannick Berthaud, « Suivi complet », 49 €/mois).
function abonnement(
  statut: AbonnementClient['statut'],
  coachPrenom: string | null = 'Yannick',
): AbonnementClient {
  return {
    id: `abonnement-${statut}-${coachPrenom}`,
    coachPrenom,
    coachNom: 'Berthaud',
    offreTitre: 'Suivi complet',
    prixFigeCentimes: 4900,
    statut,
    prochainPrelevementLe: '2026-12-18',
    pauseJusquLe: null,
    finAccesLe: null,
  };
}

async function rendre(
  surcharges: Partial<EtatProfils> = {},
  offres: Offre[] = [],
  abonnements: AbonnementClient[] = [],
) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'client', clientExiste: true, ...surcharges }),
  );
  portDonnees.definirOffresPourTest(offres);
  portDonnees.definirAbonnementsPourTest(abonnements);

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

  // Retours à l'écran (2 novembre 2026, docs/prompts/defauts-L2-iphone.md, partie B) : un message
  // d'erreur doit être dans le champ de vision, donc HORS de la zone de défilement.
  function dansLaZoneDeDefilement(element: unknown): boolean {
    let noeud = element as { type?: string; parent?: unknown } | null;
    while (noeud) {
      if (noeud.type === 'RCTScrollView') return true;
      noeud = (noeud.parent as typeof noeud) ?? null;
    }
    return false;
  }

  // Critère 4 : une erreur serveur ne marque pas le compte supprimé, ne vide pas la session.
  // Adapté le 2 novembre 2026 : il exigeait que le texte du port soit affiché tel quel. L'écran
  // affiche le repli serveur (titre, détail) hors de la zone de défilement, et « Réessayer »
  // relance vraiment la demande.
  it('une erreur serveur affiche le repli, sans déconnecter ni naviguer ; « Réessayer » relance la demande', async () => {
    const { portAuth, portDonnees } = await rendre();
    portDonnees.echouerProchaineEcriturePourTest();
    const espionSuppression = jest.spyOn(portDonnees, 'demanderSuppressionCompte');
    const espionDeconnexion = jest.spyOn(portAuth, 'deconnecter');

    await fireEvent.changeText(
      screen.getByLabelText('Écris SUPPRIMER pour confirmer'),
      'SUPPRIMER',
    );
    await fireEvent.press(screen.getByText('Supprimer définitivement'));

    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());
    expect(screen.getAllByText(/On a un souci de notre côté/)).toHaveLength(1);
    expect(screen.getByText("Ce n'est pas toi. Réessaie dans un instant.")).toBeTruthy();
    expect(dansLaZoneDeDefilement(screen.getByText('On a un souci de notre côté'))).toBe(false);
    expect(espionDeconnexion).not.toHaveBeenCalled();
    expect(mockRemplacer).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(mockRemplacer).toHaveBeenCalledWith('/(public)'));
    expect(espionSuppression).toHaveBeenCalledTimes(2);
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

  // Fiche, « Si un abonnement est actif (côté client), bandeau conditionnel ». INVERSÉ le
  // 16 novembre 2026 : ce test figeait l'absence du bandeau (« aucune table Abonnement à ce
  // lot »), une constante à `false`. Les abonnements existent depuis L4, et la suppression les
  // résilie réellement (0068) : le bandeau dit vrai.
  it('abonnement actif : « Ton abonnement est actif. Supprimer ton compte résilie ton suivi avec {prénom}. Le mois déjà payé n’est pas remboursé. »', async () => {
    await rendre({ profilActif: 'client' }, [], [abonnement('actif')]);
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Ton abonnement est actif. Supprimer ton compte résilie ton suivi avec Yannick. Le mois déjà payé n’est pas remboursé.',
        ),
      ).toBeTruthy(),
    );
  });

  it('aucun abonnement actif (aucun, ou seulement résilié) : pas de bandeau', async () => {
    await rendre({ profilActif: 'client' }, [], [abonnement('resilie')]);
    expect(screen.queryByText(/abonnement est actif|abonnements sont actifs/)).toBeNull();
  });

  it('plusieurs abonnements actifs : le bandeau les nomme tous', async () => {
    await rendre(
      { profilActif: 'client' },
      [],
      [abonnement('actif'), abonnement('actif', 'Nadia')],
    );
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Tes abonnements sont actifs. Supprimer ton compte résilie tes suivis avec Yannick et Nadia. Le mois déjà payé n’est pas remboursé.',
        ),
      ).toBeTruthy(),
    );
  });

  // Le coach est devenu illisible (profil écarté) : le bandeau reste, sans nom inventé.
  it('abonnement actif dont le coach n’est plus lisible : le bandeau sans prénom', async () => {
    await rendre({ profilActif: 'client' }, [], [abonnement('actif', null)]);
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Ton abonnement est actif. Supprimer ton compte résilie ton suivi. Le mois déjà payé n’est pas remboursé.',
        ),
      ).toBeTruthy(),
    );
  });

  // Règle de cloisonnement (CLAUDE.md §10) : en espace coach, les abonnements du profil client
  // ne se lisent pas, donc pas de bandeau client.
  it('en espace coach : aucun bandeau d’abonnement, et les abonnements ne sont pas lus', async () => {
    const { portDonnees } = await rendre({ profilActif: 'coach', coachExiste: true });
    const lectures = jest.spyOn(portDonnees, 'lireMesAbonnements');
    expect(screen.queryByText(/abonnement est actif/)).toBeNull();
    expect(lectures).not.toHaveBeenCalled();
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
