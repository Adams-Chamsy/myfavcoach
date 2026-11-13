import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import type { ResultatConstat } from '@/services/donnees/port';
import { libellesInterditsTrouves, type NoeudHote } from '@/test/libelles-interdits';
import { FournisseurTheme } from '@/theme/fournisseur';
import {
  CONSTATS_MAX,
  EcranPaiement,
  INTERVALLE_CONSTAT_MS,
  type ModePaiement,
} from './ecran-paiement';
import type { IntentionEnCours } from './intention-en-cours';

// docs/ecrans/L4-04b-recapitulatif-paiement.md (P4.6b). Données : src/fixtures/demonstration.ts
// (Yannick Berthaud, « Suivi complet », 49 €/mois). Chaque test nomme la ligne de la fiche qu'il
// prouve.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const URL_PAGE = 'https://paiement.exemple/page-test';

function intentionEnCours(creeeLe = Date.now()): IntentionEnCours {
  return {
    intention: {
      issue: 'creee',
      intentionId: 'intention-1',
      recapitulatif: {
        prixCentimes: 4900,
        totalCentimes: 4900,
        prochainPrelevementLe: '2026-12-11',
        jourPrelevement: 11,
      },
      urlPaiement: URL_PAGE,
      moyensAcceptes: ['carte', 'sepa'],
    },
    offre: { id: 'offre-1', titre: 'Suivi complet' },
    coach: {
      id: 'coach-yannick',
      prenom: 'Yannick',
      nom: 'Berthaud',
      discipline: 'préparation physique',
    },
    creeeLe,
  };
}

async function rendre(
  constats: ResultatConstat | ResultatConstat[],
  mode: ModePaiement = { type: 'recapitulatif', enCours: intentionEnCours() },
) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirReponseConstatPourTest(constats);
  const rappels = {
    ouvrirPage: jest.fn(async () => {}),
    onAbonne: jest.fn(),
    onVoirAbonnements: jest.fn(),
    onRevenirProfil: jest.fn(),
    onRienAConstater: jest.fn(),
  };
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <EcranPaiement
              mode={mode}
              onRetour={() => {}}
              onOuvrirConditions={() => {}}
              {...rappels}
            />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  return { portDonnees, ...rappels };
}

describe('L4-04b · Récapitulatif et paiement', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  // Contenu, « Récapitulatif » ; critère 1 : rien n'est calculé par l'écran, tout vient du serveur.
  it('le récapitulatif affiche ce que le serveur a rendu : prix, total, jour et date du prochain prélèvement', async () => {
    await rendre({ issue: 'sans_reponse' });

    expect(screen.getByText('Suivi complet')).toBeTruthy();
    expect(screen.getByText('Yannick Berthaud · préparation physique')).toBeTruthy();
    expect(screen.getByText('Abonnement mensuel')).toBeTruthy();
    expect(screen.getByText('À payer aujourd’hui')).toBeTruthy();
    expect(screen.getAllByText('49,00 €')).toHaveLength(2);
    expect(
      screen.getByText('Puis le 11 de chaque mois · prochain prélèvement le 11 décembre 2026'),
    ).toBeTruthy();
    expect(screen.getByText('Carte bancaire ou prélèvement SEPA')).toBeTruthy();
    expect(
      screen.getByText('Tu choisiras sur la page de paiement sécurisée de notre prestataire.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Payer 49,00 €' })).toBeTruthy();
  });

  // Critère 8 : l'emplacement de l'information sur la rétractation existe, vide.
  it('l’emplacement de la rétractation existe et ne contient aucun texte', async () => {
    await rendre({ issue: 'sans_reponse' });
    const emplacement = screen.getByTestId('emplacement-retractation');
    expect(emplacement.children).toHaveLength(0);
  });

  // Critère 7 : aucun code promo, aucun moyen de paiement « enregistré ».
  it('aucun code promo, aucun moyen de paiement enregistré', async () => {
    await rendre({ issue: 'sans_reponse' });
    expect(screen.queryByText(/code promo/i)).toBeNull();
    expect(screen.queryByText(/••••|Ajouter une carte/)).toBeNull();
  });

  // Critère 4 et Règles, « Idempotence » : un double appui sur « Payer » rouvre la même page,
  // jamais une seconde session. Critère 5 : au retour, l'écran ne conclut que par le constat.
  it('« Payer » ouvre la page une seule fois sur un double appui ; à la fermeture, le constat décide', async () => {
    const { ouvrirPage, onAbonne, portDonnees } = await rendre({
      issue: 'constat',
      etat: 'abonne',
      statutAbonnement: 'actif',
    });

    const payer = screen.getByRole('button', { name: 'Payer 49,00 €' });
    await fireEvent.press(payer);
    await fireEvent.press(payer);

    await waitFor(() => expect(onAbonne).toHaveBeenCalledTimes(1));
    expect(ouvrirPage).toHaveBeenCalledTimes(1);
    expect(ouvrirPage).toHaveBeenCalledWith(URL_PAGE);
    expect(portDonnees.lireNombreConstatsPourTest()).toBe(1);
    expect(portDonnees.lireDemandesIntentionPourTest()).toEqual([]);
  });

  // « Retour sans confirmation », `non_terminee` : bandeau, et « Reprendre le paiement » rouvre la
  // MÊME page, jamais une nouvelle.
  it('page quittée avant la fin : bandeau « rien n’a été débité », et la même page se rouvre', async () => {
    const { ouvrirPage, portDonnees } = await rendre({
      issue: 'constat',
      etat: 'non_terminee',
      urlPaiement: URL_PAGE,
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Payer 49,00 €' }));
    await waitFor(() =>
      expect(screen.queryByText('Paiement non terminé. Rien n’a été débité.')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre le paiement' }));

    await waitFor(() => expect(ouvrirPage).toHaveBeenCalledTimes(2));
    expect(ouvrirPage).toHaveBeenLastCalledWith(URL_PAGE);
    expect(portDonnees.lireDemandesIntentionPourTest()).toEqual([]);
  });

  // `expiree` : même bandeau ; « Payer » demande une NOUVELLE intention (nouvelle clé).
  it('page expirée : « Payer » demande une nouvelle intention, jamais la page périmée', async () => {
    const { ouvrirPage, portDonnees } = await rendre({ issue: 'constat', etat: 'expiree' });

    await fireEvent.press(screen.getByRole('button', { name: 'Payer 49,00 €' }));
    await waitFor(() =>
      expect(screen.queryByText('Paiement non terminé. Rien n’a été débité.')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Payer 49,00 €' }));

    await waitFor(() => expect(portDonnees.lireDemandesIntentionPourTest()).toHaveLength(1));
    expect(portDonnees.lireDemandesIntentionPourTest()[0]?.offreId).toBe('offre-1');
    expect(ouvrirPage).toHaveBeenCalledTimes(1);
  });

  // Page expirée par le temps (30 minutes, docs/api.md §7) : même règle, sans ouvrir la page.
  it('intention créée il y a plus de 30 minutes : « Payer » redemande une intention au lieu d’ouvrir', async () => {
    const { ouvrirPage, portDonnees } = await rendre(
      { issue: 'sans_reponse' },
      { type: 'recapitulatif', enCours: intentionEnCours(Date.now() - 31 * 60 * 1000) },
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Payer 49,00 €' }));

    await waitFor(() => expect(portDonnees.lireDemandesIntentionPourTest()).toHaveLength(1));
    expect(ouvrirPage).not.toHaveBeenCalled();
  });

  // `paiement_recu` : attente bornée (un constat toutes les 2 s, dix au plus), puis « Tu n'as
  // rien à refaire » ; JAMAIS « Payer » quand le prestataire a constaté un paiement (critère 6).
  it('paiement reçu sans confirmation : dix constats au plus, puis « rien à refaire », jamais « Payer »', async () => {
    jest.useFakeTimers();
    const { portDonnees, onVoirAbonnements } = await rendre({
      issue: 'constat',
      etat: 'paiement_recu',
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Payer 49,00 €' }));
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Ton paiement est bien arrivé chez notre prestataire. On finalise ton abonnement…',
        ),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: /^Payer/ })).toBeNull();

    for (let i = 0; i < CONSTATS_MAX + 2; i++) {
      await act(async () => {
        jest.advanceTimersByTime(INTERVALLE_CONSTAT_MS);
      });
    }

    await waitFor(() => expect(screen.queryByText(/Tu n’as rien à refaire/)).toBeTruthy());
    expect(portDonnees.lireNombreConstatsPourTest()).toBe(CONSTATS_MAX);
    expect(screen.queryByRole('button', { name: /^Payer/ })).toBeNull();
    expect(screen.queryByText(/Réessayer le paiement/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Voir mes abonnements' }));
    expect(onVoirAbonnements).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Revenir au profil de Yannick' })).toBeTruthy();
  });

  // Erreur réseau au constat : même attente bornée, puis « Vérifier à nouveau » — jamais « Payer ».
  it('constat impossible (réseau) : attente bornée, puis « Vérifier à nouveau », jamais « Payer »', async () => {
    jest.useFakeTimers();
    await rendre({ issue: 'sans_reponse' });

    await fireEvent.press(screen.getByRole('button', { name: 'Payer 49,00 €' }));
    await waitFor(() =>
      expect(screen.queryByText('Impossible de vérifier pour l’instant.')).toBeTruthy(),
    );
    for (let i = 0; i < CONSTATS_MAX + 2; i++) {
      await act(async () => {
        jest.advanceTimersByTime(INTERVALLE_CONSTAT_MS);
      });
    }

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Vérifier à nouveau' })).toBeTruthy(),
    );
    expect(
      screen.getByText(
        'On n’arrive pas à vérifier ton paiement pour l’instant. Si tu as payé, ton abonnement apparaîtra dans ton compte.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Payer/ })).toBeNull();
  });

  // Constat `souscription_impossible` (docs/api.md §7 : payé, mais le coach écarté entre-temps).
  // Texte validé par le développeur le 13 novembre 2026 ; la promesse de remboursement est
  // rattachée à la dette de l'alerte sur les anomalies (docs/dette.md) : rien ne la déclenche
  // encore. Jamais « Payer ».
  it('souscription impossible : le paiement est arrivé, le suivi ne démarre pas, remboursement ; jamais « Payer »', async () => {
    await rendre({ issue: 'constat', etat: 'souscription_impossible' });

    await fireEvent.press(screen.getByRole('button', { name: 'Payer 49,00 €' }));

    await waitFor(() =>
      expect(
        screen.queryByText(
          'Ton paiement est bien arrivé, mais ce suivi ne peut pas démarrer. Tu seras remboursé.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: /^Payer/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Revenir au profil de Yannick' })).toBeTruthy();
  });

  // Retour sur web : l'écran constate dès son ouverture, avec le seul identifiant ; un 404
  // (intention d'un autre, inexistante) ne dit rien : retour à l'accueil client.
  it('retour sur web : constat immédiat ; une intention qui n’est pas la sienne ne dit rien', async () => {
    const { onRienAConstater, portDonnees } = await rendre(
      {
        issue: 'refusee',
        refus: { code: 'intention_introuvable', title: 'Introuvable', detail: 'x' },
      },
      { type: 'retour', intentionId: 'intention-d-un-autre' },
    );

    await waitFor(() => expect(onRienAConstater).toHaveBeenCalledTimes(1));
    expect(portDonnees.lireNombreConstatsPourTest()).toBe(1);
  });

  // Critère 9 : libellés interdits (docs/domaine.md §2), textes rendus et libellés lus.
  it('libellés interdits : aucun dans les textes rendus ni les libellés d’accessibilité', async () => {
    await rendre({ issue: 'sans_reponse' });
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([]);
  });
});
