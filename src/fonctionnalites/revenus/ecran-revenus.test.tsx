import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import {
  revenusDemonstration,
  soldeDemonstration,
  versementsDemonstration,
} from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { Identification, Solde } from '@/services/donnees/port';
import {
  libellesInterditsTrouves,
  type NoeudHote,
  textesLisibles,
} from '@/test/libelles-interdits';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranRevenus } from './ecran-revenus';

// docs/ecrans/L5-13-revenus.md. Données : src/fixtures/demonstration.ts (maquette 13, août 2026).
// Chaque test nomme la ligne de la fiche qu'il prouve.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};
type FauxPort = ReturnType<typeof creerFauxPortDonnees>;
const EN_REGLE: Identification = {
  compteVersement: 'operationnel',
  identiteFiscaleComplete: true,
  peutPublier: true,
};

async function rendre(regler: (port: FauxPort) => void = () => {}) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('nadia@exemple.fr', 'bon-mot-de-passe', '1990-01-01');
  portAuth.verifierEmailPourTest('nadia@exemple.fr');
  await portAuth.connecter('nadia@exemple.fr', 'bon-mot-de-passe');
  const port = creerFauxPortDonnees();
  port.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true, clientExiste: false }),
  );
  port.definirIdentificationPourTest(EN_REGLE);
  port.definirSoldePourTest({ ...soldeDemonstration });
  port.definirVersementsPourTest(versementsDemonstration.map((v) => ({ ...v })));
  port.definirRevenusPourTest(revenusDemonstration.map((r) => ({ ...r })));
  regler(port);
  const onOuvrirFacturation = jest.fn();
  const onOuvrirFactures = jest.fn();
  const ouvrirPage = jest.fn(async () => {});
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={port}>
            <EcranRevenus
              onOuvrirFacturation={onOuvrirFacturation}
              onOuvrirFactures={onOuvrirFactures}
              ouvrirPage={ouvrirPage}
            />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  return { port, onOuvrirFacturation, onOuvrirFactures, ouvrirPage };
}

describe('L5-13 · Revenus', () => {
  // Contenu 2 à 6 ; critère 1 (tout du serveur) ; corrections 1 à 3 (critère 5).
  it('le mois, le net, le détail, le solde et les virements, tels que le serveur les rend', async () => {
    await rendre();
    await waitFor(() => expect(screen.queryByText('Net des ventes du mois')).toBeTruthy());
    expect(screen.getByText('Août 2026')).toBeTruthy();
    expect(screen.getAllByText('2 696,00 €').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('28 abonnements')).toBeTruthy();
    expect(screen.getByText('3 020,00 €')).toBeTruthy();
    expect(screen.getByText('Commission plateforme')).toBeTruthy();
    expect(screen.getByText('−324,00 €')).toBeTruthy();
    expect(screen.getByText('Prochain transfert prévu le 5 septembre')).toBeTruthy();
    expect(screen.getByText('Transféré à Stripe')).toBeTruthy();
    expect(screen.getByText('En cours')).toBeTruthy();
    const tout = textesLisibles(screen.container as unknown as NoeudHote).join(' ');
    expect(tout).not.toMatch(/séance|à l’unité|CIC|••|10 %/i);
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([]);
  });

  // Contenu 3 : six mois, une seule phrase pour le lecteur d'écran.
  it('l’histogramme se lit en une phrase, du plus ancien au plus récent', async () => {
    await rendre();
    await waitFor(() =>
      expect(
        screen.queryByLabelText(/^Net des ventes des six derniers mois : mars 1 132,00 €/),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText(/août 2 696,00 €$/)).toBeTruthy();
  });

  // Contenu 1 ; critère 2 : un coach pas en règle voit quoi faire, et peut le faire.
  it('pas en règle : les informations de facturation, puis l’inscription chez le prestataire', async () => {
    const { onOuvrirFacturation, ouvrirPage, port } = await rendre((p) => {
      p.definirIdentificationPourTest({
        compteVersement: 'a_completer',
        identiteFiscaleComplete: false,
        peutPublier: false,
      });
      p.definirLienIdentificationPourTest({ issue: 'ok', url: 'https://inscription.exemple/1' });
    });
    await waitFor(() => expect(screen.queryByText('Ce qu’il te reste à faire')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Renseigner' }));
    expect(onOuvrirFacturation).toHaveBeenCalled();
    const lectures = jest.spyOn(port, 'lireIdentification');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer mon inscription' }));
    await waitFor(() => expect(ouvrirPage).toHaveBeenCalledWith('https://inscription.exemple/1'));
    // Au retour de la page, l'état se relit.
    await waitFor(() => expect(lectures).toHaveBeenCalled());
  });

  it.each([
    [
      'en_verification',
      'Notre prestataire vérifie tes informations. Rien à faire de ton côté.',
      null,
    ],
    [
      'restreint',
      'Notre prestataire a bloqué ton compte de versement. Ouvre ton inscription pour voir ce qu’il te demande.',
      'Ouvrir mon inscription',
    ],
  ] as const)('compte %s : la phrase de la fiche', async (etat, phrase, bouton) => {
    await rendre((p) =>
      p.definirIdentificationPourTest({
        compteVersement: etat,
        identiteFiscaleComplete: true,
        peutPublier: false,
      }),
    );
    await waitFor(() => expect(screen.queryByText(phrase)).toBeTruthy());
    if (bouton) expect(screen.getByRole('button', { name: bouton })).toBeTruthy();
    else expect(screen.queryByText(/inscription$/)).toBeNull();
  });

  // Règles, virement immédiat : inactif avec sa raison tant qu'une condition manque (critère 3).
  it.each<[string, Partial<Solde>, string]>([
    ['solde sous 20 €', { soldeCentimes: 1900 }, 'Un virement part à partir de 20 € de solde.'],
    ['un versement en route', { versementEnCours: true }, 'Un virement est déjà en route.'],
    [
      'compte non opérationnel',
      { compteOperationnel: false },
      'Termine d’abord ton inscription auprès de notre prestataire de paiement.',
    ],
  ])('%s : « Virement immédiat » inactif, avec sa raison', async (_cas, solde, raison) => {
    await rendre((p) => p.definirSoldePourTest({ ...soldeDemonstration, ...solde }));
    await waitFor(() => expect(screen.queryByText(raison)).toBeTruthy());
    const bouton = screen.getByRole('button', { name: new RegExp(`^Virement immédiat`) });
    expect(bouton.props.accessibilityState).toMatchObject({ disabled: true });
  });

  // Règles : la confirmation dit le montant, puis l'état rendu, et l'écran relit.
  it.each([
    ['verse', 'Montant transféré sur ton compte Stripe.'],
    ['en_cours', 'Transfert vers Stripe en cours.'],
  ] as const)(
    'virement immédiat : affiche le montant, puis l’état %s et relit le solde',
    async (statut, message) => {
      const { port } = await rendre((p) =>
        p.definirReponseVersementPourTest({ issue: 'ok', statut }),
      );
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Virement immédiat · 1 €' })).toBeTruthy(),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Virement immédiat · 1 €' }));
      await waitFor(() => expect(screen.queryByText('Virer 2 695,00 € maintenant ?')).toBeTruthy());
      const lectures = jest.spyOn(port, 'lireSolde');
      await fireEvent.press(screen.getByRole('button', { name: 'Virer' }));
      expect(await screen.findByText(message)).toBeTruthy();
      expect(port.lireDemandesVersementPourTest()).toBe(1);
      expect(lectures).toHaveBeenCalled();
    },
  );

  it('virement reporté (fonds pas encore disponibles) : « Ton virement partira demain. »', async () => {
    await rendre((p) => p.definirReponseVersementPourTest({ issue: 'ok', statut: 'prevu' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Virement immédiat · 1 €' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Virement immédiat · 1 €' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Virer' }));
    await waitFor(() => expect(screen.queryByText('Ton virement partira demain.')).toBeTruthy());
  });

  it('refus du serveur : son titre et son détail, tels quels', async () => {
    await rendre((p) =>
      p.definirReponseVersementPourTest({
        issue: 'refusee',
        refus: {
          code: 'solde_insuffisant',
          title: 'Titre du serveur',
          detail: 'Détail du serveur.',
        },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Virement immédiat · 1 €' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Virement immédiat · 1 €' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Virer' }));
    await waitFor(() => expect(screen.queryByText('Titre du serveur')).toBeTruthy());
    expect(screen.getByText('Détail du serveur.')).toBeTruthy();
  });

  // Contenu 6 : la date d'un virement en français — « 1er » le premier du mois.
  it('un virement versé le 1er du mois : « 1er octobre »', async () => {
    await rendre((p) =>
      p.definirVersementsPourTest([
        { ...versementsDemonstration[0], verseLe: '2026-10-01T06:00:05.000Z' },
      ]),
    );
    await waitFor(() => expect(screen.queryByText('1er octobre')).toBeTruthy());
  });

  it('aucun virement : « Aucun virement pour l’instant. » ; « Mes factures » ouvre les factures', async () => {
    const { onOuvrirFactures } = await rendre((p) => p.definirVersementsPourTest([]));
    await waitFor(() => expect(screen.queryByText('Aucun virement pour l’instant.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Mes factures' }));
    expect(onOuvrirFactures).toHaveBeenCalled();
  });

  it('lecture en échec : l’erreur de repli et « Réessayer », qui relit', async () => {
    await rendre((p) => {
      jest.spyOn(p, 'lireSolde').mockRejectedValueOnce(new Error('panne'));
    });
    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.queryByText('Net des ventes du mois')).toBeTruthy());
  });
});
