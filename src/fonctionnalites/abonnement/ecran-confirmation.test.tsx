import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { detailAbonnementDemonstration } from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import type { DetailAbonnement } from '@/services/donnees/port';
import {
  libellesInterditsTrouves,
  type NoeudHote,
  textesLisibles,
} from '@/test/libelles-interdits';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranConfirmation, phraseEngagement } from './ecran-confirmation';

// docs/ecrans/L4-04c-confirmation-abonnement.md (P4.7). Données : src/fixtures/demonstration.ts
// (detailAbonnementDemonstration : Yannick Berthaud, « Suivi complet », 49 €, carte •••• 4242,
// prochain prélèvement le 18 décembre). Chaque test nomme la ligne de la fiche qu'il prouve.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const CARTE: DetailAbonnement = { ...detailAbonnementDemonstration };

async function rendre(detail: DetailAbonnement | null, saboter?: (port: FauxPort) => void) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();
  if (detail) portDonnees.definirDetailAbonnementPourTest({ [detail.id]: detail });
  saboter?.(portDonnees);
  const onVoirProfil = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <EcranConfirmation
              abonnementId={detail?.id ?? 'abonnement-demonstration'}
              onVoirProfil={onVoirProfil}
            />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  return { onVoirProfil, portDonnees };
}
type FauxPort = ReturnType<typeof creerFauxPortDonnees>;

describe('L4-04c · Confirmation d’abonnement', () => {
  // Critère 1 : « Payé aujourd'hui », le montant du serveur, le prochain prélèvement, les 4
  // derniers chiffres. Titre et sous-titre de la variante carte (Contenu).
  it('carte : « C’est parti avec Yannick », l’engagement de l’offre, payé aujourd’hui, prochain prélèvement, carte •••• 4242', async () => {
    const { onVoirProfil } = await rendre(CARTE);
    await waitFor(() => expect(screen.queryByText('C’est parti avec Yannick')).toBeTruthy());
    expect(screen.getByText('Ajustement hebdomadaire, visio mensuelle.')).toBeTruthy();
    expect(screen.getByText('Suivi complet')).toBeTruthy();
    expect(screen.getByText('Yannick Berthaud · Lyon')).toBeTruthy();
    expect(screen.getByText('Payé aujourd’hui')).toBeTruthy();
    expect(screen.getByText('49,00 €')).toBeTruthy();
    expect(screen.getByText('Prochain prélèvement')).toBeTruthy();
    expect(screen.getByText('18 décembre')).toBeTruthy();
    expect(screen.getByText('Carte')).toBeTruthy();
    expect(screen.getByText('•••• 4242')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Voir le profil de Yannick' }));
    expect(onVoirProfil).toHaveBeenCalledWith('coach-yannick');
  });

  // Critère 2 : SEPA, jamais « Payé » tant que le prélèvement n'est pas confirmé ; « Prélèvement
  // en cours » à la place ; « Prélèvement SEPA · IBAN •••• {4 derniers} ».
  it('SEPA en attente de confirmation : « Ta demande est enregistrée », prélèvement en cours, IBAN •••• 2606, jamais « Payé »', async () => {
    await rendre({
      ...CARTE,
      statut: 'en_attente_confirmation',
      moyen: 'sepa',
      moyenDerniersChiffres: '2606',
      derniereFactureMontantCentimes: null,
      derniereFacturePayeeLe: null,
    });
    await waitFor(() => expect(screen.queryByText('Ta demande est enregistrée')).toBeTruthy());
    expect(
      screen.getByText(
        'Ton prélèvement de 49,00 € est en cours auprès de ta banque. Ton suivi avec Yannick commence dès qu’elle l’a confirmé.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Prélèvement en cours')).toBeTruthy();
    expect(screen.getByText('Prélèvement SEPA')).toBeTruthy();
    expect(screen.getByText('IBAN •••• 2606')).toBeTruthy();
    expect(screen.queryByText(/Payé/)).toBeNull();
  });

  // Règles : la variante vient de l'ÉTAT, la ligne du moyen suit le moyen — un SEPA déjà
  // confirmé lit « Payé aujourd'hui » avec sa ligne « Prélèvement SEPA ».
  it('SEPA confirmé (actif) : variante payée, ligne « Prélèvement SEPA »', async () => {
    await rendre({ ...CARTE, moyen: 'sepa', moyenDerniersChiffres: '2606' });
    await waitFor(() => expect(screen.queryByText('C’est parti avec Yannick')).toBeTruthy());
    expect(screen.getByText('Payé aujourd’hui')).toBeTruthy();
    expect(screen.getByText('Prélèvement SEPA')).toBeTruthy();
  });

  // Critère 4 : la phrase de résiliation est au-dessus du récapitulatif.
  it('la phrase de résiliation précède « Payé aujourd’hui » dans l’ordre de lecture', async () => {
    await rendre(CARTE);
    await waitFor(() => expect(screen.queryByText('Payé aujourd’hui')).toBeTruthy());
    const textes = textesLisibles(screen.container as unknown as NoeudHote);
    const resiliation = textes.findIndex((t) =>
      t.includes('Tu peux arrêter quand tu veux, l’arrêt prend effet à la fin du mois payé.'),
    );
    const paye = textes.findIndex((t) => t.includes('Payé aujourd’hui'));
    expect(resiliation).toBeGreaterThanOrEqual(0);
    expect(resiliation).toBeLessThan(paye);
  });

  // Critère 3 : aucune formulation genrée, aucune promesse de délai du coach, ni facture, ni
  // questionnaire santé à L4 ; critère 6 : libellés interdits.
  it('aucun pronom genré, aucune promesse, aucune mention de facture ni de santé, aucun libellé interdit', async () => {
    await rendre(CARTE);
    await waitFor(() => expect(screen.queryByText('C’est parti avec Yannick')).toBeTruthy());
    const racine = screen.container as unknown as NoeudHote;
    const tout = textesLisibles(racine).join(' ');
    expect(tout).not.toMatch(/suivie? par|Il a été|Elle a été|48 h|facture|santé/i);
    expect(libellesInterditsTrouves(racine)).toEqual([]);
  });

  // États : erreur de lecture → état d'erreur générique (L0-03) avec « Réessayer », jamais un
  // faux succès ; « Réessayer » relit.
  it('lecture en échec : l’erreur de repli et « Réessayer », qui relit', async () => {
    const { portDonnees } = await rendre(CARTE, (port) => {
      jest.spyOn(port, 'lireDetailAbonnement').mockRejectedValueOnce(new Error('panne'));
    });
    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());
    expect(screen.queryByText(/C’est parti/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.queryByText('C’est parti avec Yannick')).toBeTruthy());
    expect(portDonnees.lireDetailAbonnement).toHaveBeenCalledTimes(2);
  });

  it('phraseEngagement : première lettre en capitale, virgules, point final ; vide sans engagement', () => {
    expect(phraseEngagement(['ajustement hebdomadaire', 'visio mensuelle'])).toBe(
      'Ajustement hebdomadaire, visio mensuelle.',
    );
    expect(phraseEngagement([])).toBeNull();
  });
});
