import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranCreationOffre } from './ecran-creation-offre';

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function rendre() {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('coach@mfc.test', 'un-mot-de-passe-suffisant', '1990-01-01');
  portAuth.verifierEmailPourTest('coach@mfc.test');
  await portAuth.connecter('coach@mfc.test', 'un-mot-de-passe-suffisant');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ coachExiste: true, profilActif: 'coach' }),
  );

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <EcranCreationOffre />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('Titre')).toBeTruthy());
  return { portDonnees };
}

async function remplirBrouillonComplet() {
  await fireEvent.changeText(screen.getByLabelText('Titre'), 'Suivi complet');
  await fireEvent.changeText(screen.getByLabelText('Prix mensuel (€)'), '49,90');
  const champBenefice = screen.getByPlaceholderText('Ajouter une ligne');
  for (const b of ['Programme personnalisé', 'Suivi hebdomadaire', 'Réponses sous 24h']) {
    await fireEvent.changeText(champBenefice, b);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
  }
}

describe('L2-15 · Créer et publier une offre', () => {
  it('un coach non vérifié peut enregistrer un brouillon complet ; la publication échoue avec le texte exact de coach_non_verifie', async () => {
    const { portDonnees } = await rendre();
    await remplirBrouillonComplet();
    await fireEvent.press(screen.getByRole('button', { name: 'ajustement hebdomadaire' }));

    // Enregistrer un brouillon complet fonctionne même sans être vérifié (docs/domaine.md §4.2).
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await portDonnees.lireMesOffres()).toHaveLength(1);

    portDonnees.echouerProchainePublicationPourTest('coach_non_verifie');
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() =>
      expect(
        screen.getByText('Ton identité doit être vérifiée avant de publier une offre.'),
      ).toBeTruthy(),
    );
  });

  it('une offre sans engagement humain ne se publie pas : texte exact engagement_humain_requis', async () => {
    const { portDonnees } = await rendre();
    await remplirBrouillonComplet();

    // Le faux port n'impose pas la règle serveur elle-même (engagement_humain_requis vient de
    // publier_offre, 0008_politiques_offres.sql, déjà prouvé au banc RLS) — ce test-ci vérifie
    // que l'ÉCRAN affiche le texte exact quand le serveur refuse pour cette raison.
    portDonnees.echouerProchainePublicationPourTest('engagement_humain_requis');
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() =>
      expect(screen.getByText('Choisis au moins un engagement humain.')).toBeTruthy(),
    );
  });

  it('le retrait appelle retirerOffre, jamais une suppression : l’offre reste modifiable', async () => {
    await rendre();
    await remplirBrouillonComplet();
    await fireEvent.press(screen.getByRole('button', { name: 'ajustement hebdomadaire' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retirer' })).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Retirer' }));
    await waitFor(() =>
      expect(
        screen.getByText('Cette offre n’est plus en vente. Tes abonnés en cours gardent l’accès.'),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText('Titre').props.value).toBe('Suivi complet');
  });
});
