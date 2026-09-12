import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { VERSION_CONSENTEMENT_SANTE } from '@/fonctionnalites/identite/consentement-sante';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import Confidentialite from './confidentialite';

const mockRetour = jest.fn();

// Mock nu : l'écran n'utilise d'expo-router que useRouter().back. Chaque fireEvent est `await`é
// (CLAUDE.md §8 — l'écran monte trois Modale, gestionnaires asynchrones).
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRetour, canGoBack: () => true }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const LABEL_SWITCH = 'Enregistrer mes données de santé';
const LABEL_EFFACER = 'Effacer mes mesures enregistrées';
const LABEL_SWITCH_COMMUNICATIONS = 'Nouveautés et conseils';

async function rendre(
  consentement: { accorde: boolean; version: string | null },
  communications: { accorde: boolean; version: string | null } = { accorde: false, version: null },
) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(etatProfilsParDefaut({ clientExiste: true }));
  portDonnees.definirConsentementSantePourTest(consentement);
  portDonnees.definirConsentementCommunicationsPourTest(communications);
  portDonnees.definirHistoriqueConsentementsPourTest([]);

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <Confidentialite />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(screen.queryByLabelText(LABEL_SWITCH)).toBeTruthy());
  return { portDonnees };
}

describe('Confidentialité (docs/ecrans/L1-09-mes-informations.md, « Confidentialité »)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 7 : le texte exact accepté et sa version datée sont affichés.
  it('affiche le texte de consentement et sa version datée', async () => {
    await rendre({ accorde: true, version: VERSION_CONSENTEMENT_SANTE });

    expect(
      screen.getByText(/J.accepte que My fav Coach enregistre mes données de santé/),
    ).toBeTruthy();
    expect(screen.getByText('Version du 04/09/2026')).toBeTruthy();
  });

  // L2-02 (C-04) : les notifications restent au lot L10, absentes ici — mais communications
  // commerciales EST désormais légitime sur cet écran (correction de L2-02), donc plus dans
  // cette liste d'exclusion.
  it('n’affiche aucun réglage de notifications (L10, pas encore construit)', async () => {
    await rendre({ accorde: true, version: VERSION_CONSENTEMENT_SANTE });

    const rendu = JSON.stringify(screen.toJSON()).toLowerCase();
    expect(rendu).not.toContain('notification');
  });

  // L2-02, critère 7 : aucun troisième interrupteur (« rappels de séance », ou toute autre
  // préférence de notification) — défaut trouvé dans une version antérieure de la maquette.
  it('n’affiche qu’un seul autre interrupteur que celui de santé (pas de « rappels de séance »)', async () => {
    await rendre({ accorde: true, version: VERSION_CONSENTEMENT_SANTE });

    expect(screen.queryByLabelText(/rappel/i)).toBeNull();
    expect(screen.getByLabelText(LABEL_SWITCH)).toBeTruthy();
    expect(screen.getByLabelText(LABEL_SWITCH_COMMUNICATIONS)).toBeTruthy();
  });

  // L2-02, critère 6 : effet immédiat par interrupteur, jamais de bouton « Enregistrer ».
  it('n’affiche aucun bouton « Enregistrer »', async () => {
    await rendre({ accorde: true, version: VERSION_CONSENTEMENT_SANTE });
    expect(screen.queryByText('Enregistrer')).toBeNull();
  });

  // L2-02 : accorder OU retirer le consentement communications est immédiat, sans modale —
  // contrairement au bloc santé, une seule conséquence (plus de courriel), déjà dite par
  // l'intitulé.
  it('communications commerciales : accorder et retirer sont tous deux immédiats, sans modale, journal en ajout seul', async () => {
    const { portDonnees } = await rendre(
      { accorde: true, version: VERSION_CONSENTEMENT_SANTE },
      { accorde: false, version: null },
    );
    const espion = jest.spyOn(portDonnees, 'enregistrerConsentementCommunications');

    await fireEvent(screen.getByLabelText(LABEL_SWITCH_COMMUNICATIONS), 'valueChange', true);
    await waitFor(() => expect(espion).toHaveBeenCalledWith(true, expect.any(String)));
    expect(screen.queryByText('Retirer ton consentement ?')).toBeNull();

    await fireEvent(screen.getByLabelText(LABEL_SWITCH_COMMUNICATIONS), 'valueChange', false);
    await waitFor(() => expect(espion).toHaveBeenCalledWith(false, expect.any(String)));
    // Aucune modale de conséquences déclenchée par ce second appel non plus.
    expect(screen.queryByText('Retirer ton consentement ?')).toBeNull();
  });

  // L2-02 : « Historique de mes décisions » ouvre le journal en lecture.
  it('« Historique de mes décisions » affiche le journal du compte courant', async () => {
    const { portDonnees } = await rendre({ accorde: true, version: VERSION_CONSENTEMENT_SANTE });
    portDonnees.definirHistoriqueConsentementsPourTest([
      {
        type: 'donneesSante',
        accorde: true,
        version: VERSION_CONSENTEMENT_SANTE,
        horodatage: '2026-09-04T10:00:00.000Z',
      },
    ]);

    await fireEvent.press(screen.getByText('Historique de mes décisions'));

    await waitFor(() => expect(screen.getByText(/donneesSante/)).toBeTruthy());
  });

  it('accorder le consentement est immédiat, sans modale', async () => {
    const { portDonnees } = await rendre({ accorde: false, version: null });
    const espion = jest.spyOn(portDonnees, 'enregistrerConsentementSante');

    await fireEvent(screen.getByLabelText(LABEL_SWITCH), 'valueChange', true);

    await waitFor(() => expect(espion).toHaveBeenCalledWith(true, VERSION_CONSENTEMENT_SANTE));
    expect(screen.queryByText('Retirer ton consentement ?')).toBeNull();
  });

  // Retrait : Modale de confirmation énonçant les DEUX conséquences, port appelé seulement
  // après confirmation.
  it('retirer le consentement demande confirmation, avec les deux conséquences', async () => {
    const { portDonnees } = await rendre({
      accorde: true,
      version: VERSION_CONSENTEMENT_SANTE,
    });
    const espion = jest.spyOn(portDonnees, 'enregistrerConsentementSante');

    await fireEvent(screen.getByLabelText(LABEL_SWITCH), 'valueChange', false);

    await waitFor(() => expect(screen.queryByText('Retirer ton consentement ?')).toBeTruthy());
    expect(
      screen.getByText(/ne seront plus enregistrées.*déjà enregistrées restent/s),
    ).toBeTruthy();
    expect(espion).not.toHaveBeenCalled();
  });

  it('retrait annulé : le consentement reste accordé', async () => {
    const { portDonnees } = await rendre({
      accorde: true,
      version: VERSION_CONSENTEMENT_SANTE,
    });
    const espion = jest.spyOn(portDonnees, 'enregistrerConsentementSante');

    await fireEvent(screen.getByLabelText(LABEL_SWITCH), 'valueChange', false);
    await waitFor(() => expect(screen.queryByText('Retirer ton consentement ?')).toBeTruthy());
    await fireEvent.press(screen.getByText('Annuler'));

    expect(espion).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(LABEL_EFFACER)).toBeNull();
  });

  it('retrait confirmé : le port enregistre accorde=false et la ligne d’effacement apparaît', async () => {
    const { portDonnees } = await rendre({
      accorde: true,
      version: VERSION_CONSENTEMENT_SANTE,
    });
    const espion = jest.spyOn(portDonnees, 'enregistrerConsentementSante');

    await fireEvent(screen.getByLabelText(LABEL_SWITCH), 'valueChange', false);
    await waitFor(() => expect(screen.queryByText('Retirer ton consentement ?')).toBeTruthy());
    await fireEvent.press(screen.getByText('Retirer'));

    await waitFor(() => expect(espion).toHaveBeenCalledWith(false, VERSION_CONSENTEMENT_SANTE));
    await waitFor(() => expect(screen.queryByLabelText(LABEL_EFFACER)).toBeTruthy());
  });

  // Effacement : double confirmation, irréversible.
  it('effacer les mesures exige deux confirmations avant d’appeler le port', async () => {
    const { portDonnees } = await rendre({ accorde: false, version: VERSION_CONSENTEMENT_SANTE });
    const espion = jest.spyOn(portDonnees, 'effacerMesuresCorporelles');

    await fireEvent.press(screen.getByLabelText(LABEL_EFFACER));
    await waitFor(() =>
      expect(screen.queryByText('Effacer tes mesures enregistrées ?')).toBeTruthy(),
    );
    expect(espion).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Continuer'));
    await waitFor(() => expect(screen.queryByText('Confirmer l’effacement')).toBeTruthy());
    expect(espion).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Effacer'));
    await waitFor(() => expect(espion).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText('Tes mesures enregistrées ont été effacées.')).toBeTruthy(),
    );
  });

  it('effacement abandonné à la première confirmation : le port n’est pas appelé', async () => {
    const { portDonnees } = await rendre({ accorde: false, version: VERSION_CONSENTEMENT_SANTE });
    const espion = jest.spyOn(portDonnees, 'effacerMesuresCorporelles');

    await fireEvent.press(screen.getByLabelText(LABEL_EFFACER));
    await waitFor(() =>
      expect(screen.queryByText('Effacer tes mesures enregistrées ?')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText('Annuler'));

    expect(espion).not.toHaveBeenCalled();
  });

  it('le bouton retour appelle router.back()', async () => {
    await rendre({ accorde: true, version: VERSION_CONSENTEMENT_SANTE });
    await fireEvent.press(screen.getByLabelText('Retour'));
    expect(mockRetour).toHaveBeenCalledTimes(1);
  });
});
