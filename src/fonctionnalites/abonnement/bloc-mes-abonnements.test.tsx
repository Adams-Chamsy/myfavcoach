import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import {
  detailAbonnementImpayeDemonstration,
  detailAbonnementSuspenduDemonstration,
} from '@/fixtures/demonstration';
import type { AbonnementClient, DetailAbonnement } from '@/services/donnees/port';
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

const onRegler = jest.fn();
beforeEach(() => onRegler.mockClear());

async function rendre(
  abonnements: AbonnementClient[],
  details: Record<string, DetailAbonnement> = {},
) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirAbonnementsPourTest(abonnements);
  portDonnees.definirDetailAbonnementPourTest(details);
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <BlocMesAbonnements onRegler={onRegler} />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  return { portDonnees };
}

describe('L4-24b · Mes abonnements', () => {
  // Tableau des états, ligne `impaye` : étiquette, « Ton suivi continue jusqu'au {fin de la
  // période de grâce} » (date du serveur), « Régler » → écran 20 (critères 1 et 4).
  it('impayé : PAIEMENT REFUSÉ, le suivi continue jusqu’à la date du serveur, « Régler » mène à l’écran 20', async () => {
    await rendre([abonnement('impaye')], {
      'abonnement-1': { ...detailAbonnementImpayeDemonstration, id: 'abonnement-1' },
    });
    await waitFor(() => expect(screen.queryByText('PAIEMENT REFUSÉ')).toBeTruthy());
    await waitFor(() =>
      expect(screen.queryByText('Ton suivi continue jusqu’au 24 décembre 2026.')).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: 'Résilier' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mettre en pause' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Régler' }));
    expect(onRegler).toHaveBeenCalledWith('abonnement-1');
  });

  // Tableau des états, ligne `suspendu`.
  it('suspendu : SUSPENDU, « Suivi interrompu. Règle le paiement avant le {date} pour le reprendre. », « Régler »', async () => {
    await rendre([abonnement('suspendu')], {
      'abonnement-1': { ...detailAbonnementSuspenduDemonstration, id: 'abonnement-1' },
    });
    await waitFor(() => expect(screen.queryByText('SUSPENDU')).toBeTruthy());
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Suivi interrompu. Règle le paiement avant le 24 janvier 2027 pour le reprendre.',
        ),
      ).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Régler' }));
    expect(onRegler).toHaveBeenCalledWith('abonnement-1');
  });

  // Critère 5 : aucune date calculée par l'écran — sans détail lisible, pas de ligne datée, mais
  // l'entrée vers l'écran 20 reste (seul chemin vers le changement de moyen, fiche, Raison d'être).
  it('impayé dont le détail ne se lit pas : aucune date inventée, « Régler » reste', async () => {
    await rendre([abonnement('impaye')]);
    await waitFor(() => expect(screen.queryByText('PAIEMENT REFUSÉ')).toBeTruthy());
    expect(screen.queryByText(/Ton suivi continue/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Régler' })).toBeTruthy();
  });

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

  // Tableau des états : `actif` → « Mettre en pause », « Résilier ». Contenu de la feuille :
  // docs/domaine.md §4.3 (2, 4, 6 ou 8 semaines, pas de durée libre ; aucun prélèvement, pas
  // d'accès au programme, place gardée), textes validés par le développeur le 13 novembre 2026.
  it('mettre en pause : la feuille propose 2, 4, 6 ou 8 semaines et dit ce que la pause coupe', async () => {
    await rendre([abonnement('actif')]);
    await waitFor(() => expect(screen.queryByText('ACTIF')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Mettre en pause' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: '2 semaines' })).toBeTruthy());
    for (const duree of ['4 semaines', '6 semaines', '8 semaines']) {
      expect(screen.getByRole('button', { name: duree })).toBeTruthy();
    }
    expect(
      screen.getByText(
        'Aucun prélèvement pendant la pause, et pas d’accès au programme. Ta place chez Yannick est gardée.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Une seule pause par période de 12 mois.')).toBeTruthy();
    // Pas de durée libre au jalon 1 : aucun champ de saisie dans la feuille.
    const racine = screen.container as unknown as NoeudHote;
    expect(racine.queryAll((n) => n.type === 'TextInput')).toEqual([]);
  });

  // La pause se demande en jours, le serveur calcule la date de fin (0059) : l'écran envoie la
  // durée choisie, jamais une date ; puis relit la carte (Règles : « Après chaque action, l'écran
  // relit »).
  it('mettre en pause : rien ne part sans durée choisie ; 4 semaines envoient 28 jours, puis la carte relue est EN PAUSE', async () => {
    const { portDonnees } = await rendre([abonnement('actif')]);
    await waitFor(() => expect(screen.queryByText('ACTIF')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Mettre en pause' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '4 semaines' })).toBeTruthy());

    const confirmer = screen.getByRole('button', { name: 'Mettre en pause' });
    expect(confirmer.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(confirmer);
    expect(portDonnees.lirePausesPourTest()).toEqual([]);

    await fireEvent.press(screen.getByRole('button', { name: '4 semaines' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mettre en pause' }));

    await waitFor(() => expect(screen.queryByText('EN PAUSE')).toBeTruthy());
    expect(portDonnees.lirePausesPourTest()).toEqual([{ abonnementId: 'abonnement-1', jours: 28 }]);
    expect(screen.queryByText(/^En pause jusqu’au /)).toBeTruthy();
  });

  // Critère 3 : « une seconde pause dans les 12 mois affiche le message de
  // pause_deja_utilisee » — avec la date rendue par le serveur, au format des dates du produit,
  // jamais l'ISO telle quelle (texte validé le 13 novembre 2026).
  it('seconde pause dans les 12 mois : le refus dit à partir de quand, en toutes lettres', async () => {
    const { portDonnees } = await rendre([abonnement('actif')]);
    await waitFor(() => expect(screen.queryByText('ACTIF')).toBeTruthy());
    portDonnees.refuserProchainePausePourTest('pause_deja_utilisee', '2027-11-14');

    await fireEvent.press(screen.getByRole('button', { name: 'Mettre en pause' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '2 semaines' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: '2 semaines' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mettre en pause' }));

    await waitFor(() =>
      expect(
        screen.queryByText(
          'Tu as déjà fait une pause ces 12 derniers mois. Tu pourras en refaire une à partir du 14 novembre 2027.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/2027-11-14/)).toBeNull();
    expect(screen.getByText('ACTIF')).toBeTruthy();
  });

  it('libellés interdits : aucun dans les textes rendus ni les libellés d’accessibilité', async () => {
    await rendre([abonnement('actif')]);
    await waitFor(() => expect(screen.queryByText('ACTIF')).toBeTruthy());
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([]);
  });
});
