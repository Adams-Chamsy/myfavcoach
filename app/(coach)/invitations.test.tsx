import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import Invitations from './invitations';

const mockRetour = jest.fn();

jest.mock('expo-router', () => {
  const reel = jest.requireActual('expo-router');
  return {
    ...reel,
    useRouter: () => ({ ...reel.useRouter(), back: mockRetour, canGoBack: () => true }),
    useNavigation: () => ({ addListener: () => () => {}, dispatch: () => {} }),
  };
});

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function rendre(portDonnees: ReturnType<typeof creerFauxPortDonnees>) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('yannick@exemple.fr', 'bon-mot-de-passe', '1990-01-01');
  portAuth.verifierEmailPourTest('yannick@exemple.fr');
  await portAuth.connecter('yannick@exemple.fr', 'bon-mot-de-passe');

  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({
      profilActif: 'coach',
      coachExiste: true,
      identiteActive: { prenom: 'Yannick', nom: 'Berthaud' },
    }),
  );

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <Invitations />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  // "Mes invitations" (l'en-tête) est déjà là pendant le chargement (squelettes) : attendre un
  // texte qui n'apparaît qu'une fois les trois lectures terminées, sinon les assertions
  // suivantes tombent avant la fin de la promesse (CLAUDE.md §8, act() hors testing-library).
  await waitFor(() => expect(screen.queryByText('Tes clients actuels')).toBeTruthy());
}

describe('Invitations (docs/ecrans/L3bis-I01-inviter-mes-clients.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
  });

  it('affiche le lien, le compteur « X ont commencé sur Y » (jamais « inscrits »), et la liste', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-de-test-22-caracteres');
    port.definirInvitationsPourTest([
      { id: 'inv-1', statut: 'compte_cree', prenom: 'Inès', initialeNom: 'R', abonneeLe: null },
      {
        id: 'inv-2',
        statut: 'abonnee',
        prenom: 'Camille',
        initialeNom: 'D',
        abonneeLe: '2026-09-12T00:00:00.000Z',
      },
    ]);
    port.definirNombreInvitationsEnAttentePourTest(6);
    await rendre(port);

    expect(screen.getByText(/jeton-de-test-22-caracteres/)).toBeTruthy();
    expect(screen.getByText('2 ont commencé sur 8')).toBeTruthy();
    expect(screen.queryByText(/inscrits/)).toBeNull();

    expect(screen.getByText('Inès R.')).toBeTruthy();
    expect(screen.getByText('Compte créé, pas encore abonnée')).toBeTruthy();
    expect(screen.getByText('Camille D.')).toBeTruthy();
    expect(screen.getByText('Abonnée depuis le 12/09/2026')).toBeTruthy();
    expect(screen.getByText('6 invitations envoyées')).toBeTruthy();
    expect(screen.getByText("Sans réponse pour l'instant")).toBeTruthy();
  });

  it("n'affiche pas la section « Qui a répondu » quand il n'y a rien à montrer", async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-vide');
    await rendre(port);

    expect(screen.queryByText('Qui a répondu')).toBeNull();
  });

  it('« Relancer » n’apparaît que pour un compte créé, jamais pour un abonné', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-relance');
    port.definirInvitationsPourTest([
      { id: 'inv-1', statut: 'compte_cree', prenom: 'Inès', initialeNom: 'R', abonneeLe: null },
      {
        id: 'inv-2',
        statut: 'abonnee',
        prenom: 'Camille',
        initialeNom: 'D',
        abonneeLe: '2026-09-12T00:00:00.000Z',
      },
    ]);
    await rendre(port);

    expect(screen.getAllByText('Relancer')).toHaveLength(1);
  });

  it('le bouton copier place le lien dans le presse-papiers et confirme visuellement', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-copie');
    await rendre(port);

    await fireEvent.press(screen.getByLabelText('Copier le lien'));

    await waitFor(() =>
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining('jeton-copie')),
    );
    await waitFor(() => expect(screen.queryByLabelText('Lien copié')).toBeTruthy());
  });

  it('Partager appelle le partage natif avec le lien', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-partage');
    await rendre(port);

    await fireEvent.press(screen.getByText('Partager'));

    await waitFor(() =>
      expect(Share.share).toHaveBeenCalledWith({
        message: expect.stringContaining('jeton-partage'),
      }),
    );
  });

  it('Régénérer mon lien : la confirmation dit ce qui change et ce qui ne change pas, avant le geste', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('ancien-jeton');
    await rendre(port);

    await fireEvent.press(screen.getByText('Régénérer mon lien'));

    await waitFor(() =>
      expect(
        screen.queryByText(
          "Le lien actuel ne fonctionnera plus, même pour les personnes à qui tu l'as déjà envoyé mais qui n'ont pas encore créé de compte. Les invitations déjà abouties restent inchangées.",
        ),
      ).toBeTruthy(),
    );

    await fireEvent.press(screen.getByText('Régénérer'));

    await waitFor(async () =>
      expect((await port.lireMonJetonInvitation()) === 'ancien-jeton').toBe(false),
    );
    await waitFor(() => expect(screen.queryByText(/ancien-jeton/)).toBeNull());
  });

  it('Ajouter : une confirmation, aucun champ de nom, incrémente le compteur', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-ajout');
    port.definirInvitationsPourTest([
      { id: 'inv-1', statut: 'compte_cree', prenom: 'Inès', initialeNom: 'R', abonneeLe: null },
    ]);
    port.definirNombreInvitationsEnAttentePourTest(0);
    await rendre(port);

    expect(screen.getByText('1 ont commencé sur 1')).toBeTruthy();

    await fireEvent.press(screen.getByText('Ajouter'));
    expect(screen.queryByLabelText(/nom/i)).toBeNull();

    await fireEvent.press(screen.getByText("Confirmer l'ajout"));

    await waitFor(() => expect(screen.queryByText('1 ont commencé sur 2')).toBeTruthy());
  });

  it('désactive le bouton Régénérer pendant l’appel réseau, le réactive à la réponse', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-lent');
    let resoudre!: (valeur: string) => void;
    port.regenererJetonInvitation = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resoudre = resolve;
        }),
    );
    await rendre(port);

    await fireEvent.press(screen.getByText('Régénérer mon lien'));
    // SEULE exception connue à « await chaque fireEvent » (CLAUDE.md §8) : ce press-ci déclenche
    // un gestionnaire qui attend une promesse délibérément jamais résolue avant `resoudre(...)`
    // plus bas — l'attendre ici bloque le test jusqu'au testTimeout global (15 s), pas jusqu'à
    // l'échec propre d'un waitFor. Trouvé en écrivant ce test : combinaison Modale (Reanimated)
    // + port dont l'appel ne se résout jamais dans la même passe.
    fireEvent.press(screen.getByText('Régénérer'));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Régénérer' }).props.accessibilityState?.disabled,
      ).toBe(true),
    );

    resoudre('jeton-frais');

    await waitFor(() => expect(screen.queryByText(/jeton-frais/)).toBeTruthy());
    // La modale se ferme au succès (comportement déjà couvert par le test précédent) : le bouton
    // désactivé disparaît avec elle, rien à réinterroger ici.
  });

  it('désactive le bouton « Confirmer l’ajout » pendant l’appel réseau', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-ajout-lent');
    // « Ajouter » n'existe que si la section « Qui a répondu » est affichée (afficherQuiARepondu) :
    // il faut au moins une invitation existante, comme dans le test « Ajouter » ci-dessus.
    port.definirInvitationsPourTest([
      { id: 'inv-1', statut: 'compte_cree', prenom: 'Inès', initialeNom: 'R', abonneeLe: null },
    ]);
    port.definirNombreInvitationsEnAttentePourTest(0);
    let resoudre!: (valeur: { succes: true }) => void;
    port.ajouterInvitationEnAttente = jest.fn(
      () =>
        new Promise((resolve) => {
          resoudre = resolve;
        }),
    );
    await rendre(port);

    await fireEvent.press(screen.getByText('Ajouter'));
    // Même exception qu'au test précédent : ce press ne se résout jamais avant resoudre(...).
    fireEvent.press(screen.getByText("Confirmer l'ajout"));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: "Confirmer l'ajout" }).props.accessibilityState
          ?.disabled,
      ).toBe(true),
    );

    resoudre({ succes: true });

    await waitFor(() => expect(screen.queryByText(/invitations? envoyée/)).toBeTruthy());
  });

  it('Relancer : un vrai échec de partage affiche un bandeau, une annulation reste silencieuse', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-relance-erreur');
    port.definirInvitationsPourTest([
      { id: 'inv-1', statut: 'compte_cree', prenom: 'Inès', initialeNom: 'R', abonneeLe: null },
    ]);
    await rendre(port);

    // Annulation (react-native, Share.js) : résout avec dismissedAction, ne rejette JAMAIS —
    // aucun bandeau ne doit apparaître.
    jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'dismissedAction' });
    await fireEvent.press(screen.getByText('Relancer'));
    await waitFor(() => expect(Share.share).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('On a un souci de notre côté.')).toBeNull();

    // Vrai échec (module natif indisponible, contenu invalide…) : rejette — bandeau attendu.
    jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('module indisponible'));
    await fireEvent.press(screen.getByText('Relancer'));
    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté.')).toBeTruthy());
  });

  it('le bouton retour appelle router.back()', async () => {
    const port = creerFauxPortDonnees();
    port.definirJetonInvitationPourTest('jeton-retour');
    await rendre(port);

    await fireEvent.press(screen.getByLabelText('Retour'));

    expect(mockRetour).toHaveBeenCalledTimes(1);
  });
});
