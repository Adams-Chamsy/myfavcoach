import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranFacturation } from './ecran-facturation';

// docs/ecrans/L5-13-revenus.md, « Formulaire — informations de facturation ». Le SIREN et
// l'adresse sont ceux du jeu de démonstration (factureDemonstration).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};
type FauxPort = ReturnType<typeof creerFauxPortDonnees>;

async function rendre(regler: (port: FauxPort) => void = () => {}) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('yannick@exemple.fr', 'bon-mot-de-passe', '1985-01-01');
  portAuth.verifierEmailPourTest('yannick@exemple.fr');
  await portAuth.connecter('yannick@exemple.fr', 'bon-mot-de-passe');
  const port = creerFauxPortDonnees();
  regler(port);
  const onEnregistre = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={port}>
            <EcranFacturation onRetour={jest.fn()} onEnregistre={onEnregistre} />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  return { port, onEnregistre };
}

describe('L5-13 · Informations de facturation', () => {
  it('« Enregistrer » inactif tant qu’aucun régime n’est choisi ; assujetti : le taux, envoyé en pour mille', async () => {
    const { port, onEnregistre } = await rendre();
    await waitFor(() => expect(screen.queryByLabelText('SIREN')).toBeTruthy());
    expect(
      screen.getByRole('button', { name: 'Enregistrer' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('SIREN'), '732 829 320');
    await fireEvent.changeText(screen.getByLabelText('Adresse'), '12 rue des Lilas');
    await fireEvent.changeText(screen.getByLabelText('Code postal'), '69003');
    await fireEvent.changeText(screen.getByLabelText('Commune'), 'Lyon');
    await fireEvent.press(screen.getByRole('button', { name: 'Assujetti à la TVA' }));
    await fireEvent.changeText(screen.getByLabelText('Taux de TVA (%)'), '5,5');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(onEnregistre).toHaveBeenCalled());
    expect(port.lireIdentitesFiscalesEnregistreesPourTest()).toEqual([
      {
        siren: '732829320',
        adresseLigne: '12 rue des Lilas',
        codePostal: '69003',
        commune: 'Lyon',
        regimeTva: 'assujetti',
        tauxTvaPourMille: 55,
      },
    ]);
  });

  it('pré-rempli avec ce qui est enregistré ; franchise en base : aucun taux envoyé', async () => {
    const { port } = await rendre((p) =>
      p.definirIdentiteFiscalePourTest({
        siren: '732829320',
        adresseLigne: '12 rue des Lilas',
        codePostal: '69003',
        commune: 'Lyon',
        regimeTva: 'franchise_en_base',
        tauxTvaPourMille: null,
      }),
    );
    await waitFor(() => expect(screen.getByLabelText('SIREN').props.value).toBe('732829320'));
    expect(screen.queryByLabelText('Taux de TVA (%)')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(port.lireIdentitesFiscalesEnregistreesPourTest()).toHaveLength(1));
    expect(port.lireIdentitesFiscalesEnregistreesPourTest()[0]?.tauxTvaPourMille).toBeNull();
  });

  it('refus du serveur : son titre et son détail, aucun champ perdu', async () => {
    const { onEnregistre } = await rendre((p) =>
      p.definirReponseIdentiteFiscalePourTest({
        issue: 'refusee',
        refus: { code: 'identite_fiscale_invalide', title: 'Titre du serveur', detail: 'Détail.' },
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText('SIREN')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('SIREN'), '732829321');
    await fireEvent.press(screen.getByRole('button', { name: 'Franchise en base de TVA' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(screen.queryByText('Titre du serveur')).toBeTruthy());
    expect(screen.getByLabelText('SIREN').props.value).toBe('732829321');
    expect(onEnregistre).not.toHaveBeenCalled();
  });
});
