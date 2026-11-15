import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import {
  detailAbonnementDemonstration,
  detailAbonnementImpayeDemonstration,
  detailAbonnementSuspenduDemonstration,
} from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import type { DetailAbonnement, MotifBanque } from '@/services/donnees/port';
import {
  libellesInterditsTrouves,
  type NoeudHote,
  textesLisibles,
} from '@/test/libelles-interdits';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranPaiementRefuse } from './ecran-paiement-refuse';

// docs/ecrans/L4-20-paiement-refuse.md (P4.7). Données : src/fixtures/demonstration.ts
// (detailAbonnementImpayeDemonstration : « Suivi complet », 49 €, carte •••• 4218 refusée pour
// « plafond de carte atteint », suivi jusqu'au 24 décembre 2026). Chaque test nomme la ligne de
// la fiche qu'il prouve.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const IMPAYE: DetailAbonnement = { ...detailAbonnementImpayeDemonstration };
type FauxPort = ReturnType<typeof creerFauxPortDonnees>;

async function rendre(
  detail: DetailAbonnement,
  options: { auRetour?: boolean; regler?: (port: FauxPort) => void } = {},
) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirDetailAbonnementPourTest({ [detail.id]: detail });
  options.regler?.(portDonnees);
  const onRetour = jest.fn();
  const onRienARegler = jest.fn();
  const ouvrirPage = jest.fn(async () => {});
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <EcranPaiementRefuse
              abonnementId={detail.id}
              auRetourDeLaPage={options.auRetour ?? false}
              onRetour={onRetour}
              ouvrirPage={ouvrirPage}
              onRienARegler={onRienARegler}
            />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  return { portDonnees, onRetour, onRienARegler, ouvrirPage };
}

// Fiche, « Les six motifs » ; `authentification_echouee` : docs/prompts/L4.md, P4.7 point 2.
const MOTIFS: [MotifBanque, string][] = [
  ['fonds_insuffisants', 'Motif transmis : fonds insuffisants.'],
  ['carte_expiree', 'Motif transmis : carte expirée.'],
  ['opposition', 'Motif transmis : carte en opposition.'],
  ['plafond_atteint', 'Motif transmis : plafond de carte atteint.'],
  [
    'authentification_echouee',
    'Motif transmis : ta banque demande que tu confirmes toi-même le paiement.',
  ],
  ['inconnu', 'Motif transmis : ta banque n’a pas précisé de motif.'],
];

describe('L4-20 · Paiement refusé', () => {
  // Critères 1 et 2 : chaque motif affiche son libellé, et « Rien n'a été débité. » est présent
  // pour chacun des six.
  it.each(MOTIFS)('motif %s : son libellé, et « Rien n’a été débité. »', async (motif, phrase) => {
    await rendre({ ...IMPAYE, dernierEchecMotif: motif });
    await waitFor(() => expect(screen.queryByText('Ta banque a refusé le paiement')).toBeTruthy());
    expect(screen.getByText(phrase)).toBeTruthy();
    expect(screen.getByText('Rien n’a été débité.')).toBeTruthy();
  });

  // Critère 1, seconde moitié : un code que l'écran ne connaît pas n'affiche jamais autre chose
  // que le libellé d'`inconnu` (un motif absent non plus).
  it.each([['code_jamais_vu' as MotifBanque], [null]])(
    'motif hors liste (%s) : le libellé d’« inconnu », jamais un septième',
    async (motif) => {
      await rendre({ ...IMPAYE, dernierEchecMotif: motif });
      await waitFor(() =>
        expect(
          screen.queryByText('Motif transmis : ta banque n’a pas précisé de motif.'),
        ).toBeTruthy(),
      );
      expect(screen.getByText('Rien n’a été débité.')).toBeTruthy();
    },
  );

  // Contenu : en-tête, rappel de l'offre et du montant, moyen tenté et ses 4 derniers chiffres ;
  // critère 3 : « REFUSÉ » est un texte ; critère 5 : la période de grâce vient du serveur.
  it('impayé : en-tête, offre et montant, carte •••• 4218 REFUSÉ, le suivi continue jusqu’à la date du serveur', async () => {
    await rendre(IMPAYE);
    await waitFor(() => expect(screen.queryByText('Paiement refusé')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('Suivi complet')).toBeTruthy());
    expect(screen.getByText('49,00 €')).toBeTruthy();
    expect(screen.getByText('Carte •••• 4218')).toBeTruthy();
    expect(screen.getByText('REFUSÉ')).toBeTruthy();
    expect(screen.getByText('Ton suivi continue jusqu’au 24 décembre 2026.')).toBeTruthy();
    expect(screen.getByText('Tu peux aussi payer par prélèvement SEPA.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Changer de moyen de paiement' })).toBeTruthy();
  });

  // États, `suspendu` : « Suivi interrompu » à la place de la période de grâce.
  it('suspendu : « Suivi interrompu », pas de période de grâce', async () => {
    await rendre({ ...detailAbonnementSuspenduDemonstration });
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Suivi interrompu. Règle le paiement avant le 24 janvier 2027 pour le reprendre.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/Ton suivi continue/)).toBeNull();
  });

  // Contenu : la phrase SEPA « seulement si le moyen refusé était une carte ».
  it('prélèvement SEPA refusé : la ligne du moyen le dit, sans la phrase d’aide SEPA', async () => {
    await rendre({ ...IMPAYE, moyen: 'sepa', moyenDerniersChiffres: '2606' });
    await waitFor(() =>
      expect(screen.queryByText('Prélèvement SEPA · IBAN •••• 2606')).toBeTruthy(),
    );
    expect(screen.queryByText('Tu peux aussi payer par prélèvement SEPA.')).toBeNull();
  });

  // Critère 4 (corrections de la maquette) et critère 6 (libellés interdits) ; Règles : jamais
  // « ton accès sera coupé ».
  it('aucune place gardée, aucun paiement différé, aucun délai SEPA, aucun libellé interdit', async () => {
    await rendre(IMPAYE);
    await waitFor(() => expect(screen.queryByText('Ta banque a refusé le paiement')).toBeTruthy());
    const racine = screen.container as unknown as NoeudHote;
    const tout = textesLisibles(racine).join(' ');
    expect(tout).not.toMatch(/30 minutes|place|plus tard|2 jours|aucun plafond|accès/i);
    expect(libellesInterditsTrouves(racine)).toEqual([]);
  });

  // Règles : « Changer de moyen de paiement » ouvre la page du prestataire ; au retour, relecture
  // de l'abonnement et « Nouveau moyen enregistré, le prochain essai aura lieu le {date} », date
  // servie par le serveur (États).
  it('changer de moyen : la page s’ouvre, puis « Nouveau moyen enregistré » avec la date du serveur', async () => {
    const { portDonnees, ouvrirPage } = await rendre(IMPAYE, {
      regler: (port) => {
        port.definirReponseNouveauMoyenPourTest({
          issue: 'creee',
          urlPaiement: 'https://paiement.exemple/moyen',
        });
        port.definirConstatNouveauMoyenPourTest({
          issue: 'constat',
          etat: 'enregistre',
          prochaineTentativeLe: '2026-12-19',
        });
      },
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Changer de moyen de paiement' })).toBeTruthy(),
    );
    const lectures = jest.spyOn(portDonnees, 'lireDetailAbonnement');
    await fireEvent.press(screen.getByRole('button', { name: 'Changer de moyen de paiement' }));
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Nouveau moyen enregistré, le prochain essai aura lieu le 19 décembre 2026.',
        ),
      ).toBeTruthy(),
    );
    expect(ouvrirPage).toHaveBeenCalledWith('https://paiement.exemple/moyen');
    expect(portDonnees.lireDemandesNouveauMoyenPourTest()).toEqual([IMPAYE.id]);
    expect(lectures).toHaveBeenCalledWith(IMPAYE.id);
  });

  // États, « Moyen de paiement changé » : l'état vient du serveur, donc l'écran le dit aussi à
  // une réouverture — et le nouveau moyen, jamais refusé, ne porte pas « REFUSÉ » (trouvé à la
  // clôture sur la base de dev, 15 novembre 2026 : « Carte •••• 4242 REFUSÉ » après le changement).
  it('rouvert après un changement de moyen : le prochain essai est annoncé, le nouveau moyen n’est pas dit refusé', async () => {
    await rendre({
      ...IMPAYE,
      moyenDerniersChiffres: '4242',
      nouveauMoyenEnregistre: true,
      prochaineTentativeLe: '2026-12-19',
    });
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Nouveau moyen enregistré, le prochain essai aura lieu le 19 décembre 2026.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Carte •••• 4242')).toBeTruthy();
    expect(screen.queryByText('REFUSÉ')).toBeNull();
    // Le refus lui-même reste dit, avec son motif et « Rien n'a été débité. ».
    expect(screen.getByText('Ta banque a refusé le paiement')).toBeTruthy();
    expect(screen.getByText('Rien n’a été débité.')).toBeTruthy();
  });

  // Retour sur web : le constat part à l'ouverture, sans nouvel appui.
  it('au retour de la page sur web : le constat est demandé à l’ouverture', async () => {
    const { ouvrirPage } = await rendre(IMPAYE, {
      auRetour: true,
      regler: (port) =>
        port.definirConstatNouveauMoyenPourTest({
          issue: 'constat',
          etat: 'enregistre',
          prochaineTentativeLe: '2026-12-19',
        }),
    });
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Nouveau moyen enregistré, le prochain essai aura lieu le 19 décembre 2026.',
        ),
      ).toBeTruthy(),
    );
    expect(ouvrirPage).not.toHaveBeenCalled();
  });

  // Page quittée sans rien enregistrer : rien n'est annoncé comme fait, l'action reste.
  it('page quittée sans enregistrer : aucun succès annoncé, l’action reste disponible', async () => {
    await rendre(IMPAYE, {
      regler: (port) => {
        port.definirReponseNouveauMoyenPourTest({
          issue: 'creee',
          urlPaiement: 'https://paiement.exemple/moyen',
        });
        port.definirConstatNouveauMoyenPourTest({
          issue: 'constat',
          etat: 'non_terminee',
          urlPaiement: 'https://paiement.exemple/moyen',
        });
      },
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Changer de moyen de paiement' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Changer de moyen de paiement' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Aucun nouveau moyen n’a été enregistré. Rien n’a été débité.'),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/Nouveau moyen enregistré/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Changer de moyen de paiement' }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  // Règles de 24b reprises ici (docs/api.md §1) : un refus du serveur s'affiche avec son titre et
  // son détail, tels quels.
  it('refus du serveur : son titre et son détail, tels quels', async () => {
    await rendre(IMPAYE, {
      regler: (port) =>
        port.definirReponseNouveauMoyenPourTest({
          issue: 'refusee',
          refus: {
            code: 'changement_moyen_impossible',
            title: 'Pas de changement de moyen de paiement ici',
            detail: 'Il n’est possible qu’après un prélèvement refusé. Rien n’a été débité.',
          },
        }),
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Changer de moyen de paiement' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Changer de moyen de paiement' }));
    await waitFor(() =>
      expect(screen.queryByText('Pas de changement de moyen de paiement ici')).toBeTruthy(),
    );
    expect(
      screen.getByText('Il n’est possible qu’après un prélèvement refusé. Rien n’a été débité.'),
    ).toBeTruthy();
  });

  // Un abonnement à jour n'a rien à régler : jamais un écran de refus affiché pour lui.
  it('abonnement actif : rien à régler, la route est prévenue et aucun refus n’est affiché', async () => {
    const { onRienARegler } = await rendre({ ...detailAbonnementDemonstration });
    await waitFor(() => expect(onRienARegler).toHaveBeenCalled());
    expect(screen.queryByText('Ta banque a refusé le paiement')).toBeNull();
  });

  // États de lecture : l'erreur de repli (L0-03) et « Réessayer », qui relit.
  it('lecture en échec : l’erreur de repli et « Réessayer », qui relit', async () => {
    await rendre(IMPAYE, {
      regler: (port) => {
        jest.spyOn(port, 'lireDetailAbonnement').mockRejectedValueOnce(new Error('panne'));
      },
    });
    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.queryByText('Ta banque a refusé le paiement')).toBeTruthy());
  });

  it('le retour de l’en-tête ramène au compte', async () => {
    const { onRetour } = await rendre(IMPAYE);
    await waitFor(() => expect(screen.queryByText('Paiement refusé')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(onRetour).toHaveBeenCalled();
  });
});
