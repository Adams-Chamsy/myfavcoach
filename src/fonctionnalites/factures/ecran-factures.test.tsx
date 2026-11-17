import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { factureDemonstration } from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { FactureDetail, ProfilActif } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranFacture } from './ecran-facture';
import { EcranFactures } from './ecran-factures';

// docs/ecrans/L5-C05-factures-recus.md. Données : src/fixtures/demonstration.ts
// (factureDemonstration : Sophie Lambert chez Yannick Berthaud, 49 €, franchise en base).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};
type FauxPort = ReturnType<typeof creerFauxPortDonnees>;
const DETAIL = { ...factureDemonstration.detail } as FactureDetail;
const RESUME = { ...factureDemonstration.resume };

async function rendre(
  element: React.ReactElement,
  espace: ProfilActif,
  regler: (port: FauxPort) => void = () => {},
) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('sophie@exemple.fr', 'bon-mot-de-passe', '1990-01-01');
  portAuth.verifierEmailPourTest('sophie@exemple.fr');
  await portAuth.connecter('sophie@exemple.fr', 'bon-mot-de-passe');
  const port = creerFauxPortDonnees();
  port.definirEtatProfilsPourTest(
    etatProfilsParDefaut({
      profilActif: espace,
      clientExiste: true,
      coachExiste: espace === 'coach',
    }),
  );
  port.definirFacturesPourTest([RESUME], { [RESUME.id]: DETAIL });
  regler(port);
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={port}>{element}</FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  return { port };
}

describe('L5-C05 · Factures et reçus', () => {
  // Contenu, la liste côté client (critère 1) : libellé, coach, période, montant, payée le.
  it('client : ses factures, sans onglets ni commission ; une ligne ouvre la facture', async () => {
    const onOuvrirFacture = jest.fn();
    await rendre(
      <EcranFactures onRetour={jest.fn()} onOuvrirFacture={onOuvrirFacture} />,
      'client',
    );
    await waitFor(() => expect(screen.queryByText('Suivi complet')).toBeTruthy());
    expect(screen.getByText('Yannick Berthaud · du 18 novembre au 17 décembre')).toBeTruthy();
    expect(screen.getByText('Payée le 18 novembre 2026')).toBeTruthy();
    expect(screen.getByText('49,00 €')).toBeTruthy();
    expect(screen.queryByText('Commission')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Facture 2026-000001/ }));
    expect(onOuvrirFacture).toHaveBeenCalledWith(RESUME.id);
  });

  // Critère 2 : le coach lit ses ventes (avec la commission) et ses factures de commission.
  it('coach : ses ventes avec la commission, et l’onglet Commission', async () => {
    await rendre(
      <EcranFactures onRetour={jest.fn()} onOuvrirFacture={jest.fn()} />,
      'coach',
      (p) => {
        p.definirFacturesPourTest(
          [{ ...RESUME, autrePartie: 'Sophie Lambert', commissionCentimes: 490 }],
          {},
        );
        p.definirFacturesCommissionPourTest([
          {
            id: 'fc-1',
            numero: 'C-2026-000001',
            mois: '2026-11-01',
            montantTtcCentimes: 980,
            nombreLignes: 2,
            emiseLe: '2026-12-01T05:00:00Z',
          },
        ]);
      },
    );
    await waitFor(() =>
      expect(screen.queryByText('Payée le 18 novembre 2026 · commission 4,90 €')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('tab', { name: /Commission/ }));
    await waitFor(() => expect(screen.queryByText('Novembre 2026')).toBeTruthy());
    expect(screen.getByText('Facture n° C-2026-000001 · 2 paiements')).toBeTruthy();
    expect(screen.getByText('9,80 €')).toBeTruthy();
  });

  it('aucune facture : « Aucune facture pour l’instant. »', async () => {
    await rendre(
      <EcranFactures onRetour={jest.fn()} onOuvrirFacture={jest.fn()} />,
      'client',
      (p) => p.definirFacturesPourTest([], {}),
    );
    await waitFor(() => expect(screen.queryByText('Aucune facture pour l’instant.')).toBeTruthy());
  });

  // Critère 3 : les trois cas de montants.
  it('franchise en base : « Total » et la mention de l’article 293 B ; vendeur, client, mandat', async () => {
    await rendre(<EcranFacture factureId={RESUME.id} onRetour={jest.fn()} />, 'client');
    await waitFor(() => expect(screen.queryByText('Facture n° 2026-000001')).toBeTruthy());
    expect(screen.getByText('SIREN 732829320')).toBeTruthy();
    expect(screen.getByText('12 rue des Lilas, 69003 Lyon')).toBeTruthy();
    expect(screen.getByText('Sophie Lambert')).toBeTruthy();
    expect(
      screen.getByText(
        'Facture émise par My Fav Coach au nom et pour le compte de Yannick Berthaud.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('TVA non applicable, art. 293 B du CGI')).toBeTruthy();
    expect(screen.queryByText('Total HT')).toBeNull();
    // Critère 1 : le client ne voit jamais la commission.
    expect(screen.queryByText('Commission de la plateforme')).toBeNull();
  });

  it('assujetti : Total HT, TVA avec son taux, Total TTC, tels que rendus ; le coach voit la commission', async () => {
    await rendre(<EcranFacture factureId={RESUME.id} onRetour={jest.fn()} />, 'coach', (p) =>
      p.definirFacturesPourTest([], {
        [RESUME.id]: {
          ...DETAIL,
          vendeurRegimeTva: 'assujetti',
          vendeurTauxTvaPourMille: 200,
          montantHtCentimes: 4083,
          tvaCentimes: 817,
          commissionCentimes: 490,
        },
      }),
    );
    await waitFor(() => expect(screen.queryByText('Total HT')).toBeTruthy());
    expect(screen.getByText('40,83 €')).toBeTruthy();
    expect(screen.getByText('TVA (20 %)')).toBeTruthy();
    expect(screen.getByText('8,17 €')).toBeTruthy();
    expect(screen.getByText('Total TTC')).toBeTruthy();
    expect(screen.getByText('Commission de la plateforme')).toBeTruthy();
    expect(screen.getByText('4,90 €')).toBeTruthy();
  });

  it('facture de test (sans identité fiscale) : « Total TTC » seul, et la mention de l’absence', async () => {
    await rendre(<EcranFacture factureId={RESUME.id} onRetour={jest.fn()} />, 'client', (p) =>
      p.definirFacturesPourTest([], {
        [RESUME.id]: {
          ...DETAIL,
          vendeurSiren: null,
          vendeurAdresse: null,
          vendeurRegimeTva: null,
          montantHtCentimes: null,
          tvaCentimes: null,
        },
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText('Mentions fiscales du vendeur absentes (facture de test).'),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Total TTC')).toBeTruthy();
    expect(screen.queryByText(/293 B/)).toBeNull();
  });

  // Critère 4 : une facture d'un autre ne s'ouvre pas.
  it('une facture d’un autre (le serveur ne rend rien) : « Cette facture est introuvable. »', async () => {
    await rendre(<EcranFacture factureId="facture-autre" onRetour={jest.fn()} />, 'client');
    await waitFor(() => expect(screen.queryByText('Cette facture est introuvable.')).toBeTruthy());
  });
});
