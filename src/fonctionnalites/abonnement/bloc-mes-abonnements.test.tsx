import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import type { AbonnementClient } from '@/services/donnees/port';
import { libellesInterditsTrouves, type NoeudHote } from '@/test/libelles-interdits';
import { FournisseurTheme } from '@/theme/fournisseur';
import { BlocMesAbonnements } from './bloc-mes-abonnements';

// docs/ecrans/L4-24b-mes-abonnements.md. Données : src/fixtures/demonstration.ts (Yannick
// Berthaud, « Suivi complet », 49 €/mois). Chaque test nomme la ligne de la fiche qu'il prouve.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function abonnement(
  statut: AbonnementClient['statut'],
  autres: Partial<AbonnementClient> = {},
): AbonnementClient {
  return {
    id: 'abonnement-1',
    coachPrenom: 'Yannick',
    coachNom: 'Berthaud',
    offreTitre: 'Suivi complet',
    prixFigeCentimes: 4900,
    statut,
    prochainPrelevementLe: '2026-12-03',
    pauseJusquLe: null,
    finAccesLe: null,
    ...autres,
  };
}

async function rendre(abonnements: AbonnementClient[]) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirAbonnementsPourTest(abonnements);
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <BlocMesAbonnements />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  return { portDonnees };
}

describe('L4-24b · Mes abonnements', () => {
  // Règles : « Aucun abonnement : le bloc entier est absent ».
  it('aucun abonnement : le bloc est absent', async () => {
    await rendre([]);
    await waitFor(() => expect(screen.queryByText(/Mes abonnements/)).toBeNull());
  });

  // Contenu : titre de section, carte, prix FIGÉ, étiquette texte, ligne d'information d'actif.
  it('actif : coach, offre et prix figé, étiquette ACTIF, prochain prélèvement, « Résilier »', async () => {
    await rendre([abonnement('actif')]);

    await waitFor(() => expect(screen.queryByText('Mes abonnements · 1')).toBeTruthy());
    expect(screen.getByText('Yannick Berthaud')).toBeTruthy();
    expect(screen.getByText('Suivi complet · 49 €/mois')).toBeTruthy();
    expect(screen.getByText('ACTIF')).toBeTruthy();
    expect(
      screen.getByText(
        'Prochain prélèvement le 3 décembre 2026. Résiliation effective en fin de période, sans frais.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Résilier' })).toBeTruthy();
  });

  // Critère 2 : la date d'effet est dite AVANT la confirmation ; après, l'état relu du serveur.
  it('résilier : la date d’effet avant le geste, puis l’état relu et « Résiliation enregistrée. »', async () => {
    const { portDonnees } = await rendre([abonnement('actif')]);
    await waitFor(() => expect(screen.queryByText('ACTIF')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Résilier' }));
    expect(
      screen.getByText(
        'Ton suivi avec Yannick s’arrête le 3 décembre 2026. Aucun autre prélèvement.',
      ),
    ).toBeTruthy();
    expect(portDonnees.lireTransitionsPourTest()).toEqual([]);
    // La modale ouverte masque la carte au lecteur d'écran : seul son bouton « Résilier » répond.
    await fireEvent.press(screen.getByRole('button', { name: 'Résilier' }));

    await waitFor(() => expect(screen.queryByText('RÉSILIATION PROGRAMMÉE')).toBeTruthy());
    expect(portDonnees.lireTransitionsPourTest()).toEqual([
      { abonnementId: 'abonnement-1', transition: 'resilier' },
    ]);
    expect(screen.getByText('Résiliation enregistrée.')).toBeTruthy();
    expect(screen.getByText('Ton suivi s’arrête le 3 décembre 2026.')).toBeTruthy();
  });

  it('résiliation programmée : « Annuler la résiliation », sans confirmation', async () => {
    const { portDonnees } = await rendre([
      abonnement('resiliation_programmee', { finAccesLe: '2026-12-03' }),
    ]);
    await waitFor(() => expect(screen.queryByText('RÉSILIATION PROGRAMMÉE')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler la résiliation' }));

    await waitFor(() => expect(screen.queryByText('ACTIF')).toBeTruthy());
    expect(portDonnees.lireTransitionsPourTest()).toEqual([
      { abonnementId: 'abonnement-1', transition: 'annuler_resiliation' },
    ]);
  });

  it('en pause : EN PAUSE, « En pause jusqu’au … », « Reprendre »', async () => {
    const { portDonnees } = await rendre([abonnement('en_pause', { pauseJusquLe: '2026-12-03' })]);
    await waitFor(() => expect(screen.queryByText('EN PAUSE')).toBeTruthy());
    expect(screen.getByText('En pause jusqu’au 3 décembre 2026.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre' }));

    await waitFor(() => expect(screen.queryByText('ACTIF')).toBeTruthy());
    expect(portDonnees.lireTransitionsPourTest()).toEqual([
      { abonnementId: 'abonnement-1', transition: 'reprendre' },
    ]);
  });

  it('en attente de confirmation : EN ATTENTE, la ligne de la fiche, aucune action', async () => {
    await rendre([abonnement('en_attente_confirmation')]);
    await waitFor(() => expect(screen.queryByText('EN ATTENTE')).toBeTruthy());
    expect(
      screen.getByText('Ta banque n’a pas encore confirmé le premier prélèvement.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  // `resilie` et `annule` n'apparaissent pas (l'historique relève de C-05, L5).
  it('résilié et annulé n’apparaissent pas', async () => {
    await rendre([abonnement('resilie'), abonnement('annule', { id: 'abonnement-2' })]);
    await waitFor(() => expect(screen.queryByText(/Mes abonnements/)).toBeNull());
  });

  // Règles : « Les refus s'affichent » ; la carte est relue.
  it('refus du serveur : un message, la carte relue, aucun faux état', async () => {
    const { portDonnees } = await rendre([abonnement('en_pause', { pauseJusquLe: '2026-12-03' })]);
    await waitFor(() => expect(screen.queryByText('EN PAUSE')).toBeTruthy());
    portDonnees.refuserProchaineTransitionPourTest('transition_interdite');

    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre' }));

    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());
    expect(screen.getByText('EN PAUSE')).toBeTruthy();
  });

  it('libellés interdits : aucun dans les textes rendus ni les libellés d’accessibilité', async () => {
    await rendre([abonnement('actif')]);
    await waitFor(() => expect(screen.queryByText('ACTIF')).toBeTruthy());
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([]);
  });
});
