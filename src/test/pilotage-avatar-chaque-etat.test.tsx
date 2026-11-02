import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import Pilotage from '../../app/(coach)/(tabs)/pilotage';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { DossierVerification, Offre } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';

// Défaut trouvé sur iPhone le 2 novembre 2026 : l'avatar qui ouvre la feuille de bascule
// (docs/ecrans/L1-06-bascule-espace.md, première entrée) n'existait que dans UNE des quatre
// branches du pilotage (coach vérifié avec une offre publiée). Un coach non vérifié -- tout coach,
// au début -- ne pouvait ni revenir à l'espace client, ni atteindre l'écran compte (déconnexion,
// suppression du compte). Ce test APPUIE sur l'avatar dans chaque état, comme une personne le
// ferait : il ne construit jamais le geste (CLAUDE.md §8, doublures et chemins).

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const OFFRE_PUBLIEE: Offre = {
  id: 'offre-1',
  titre: 'Suivi complet',
  description: null,
  prixCentimes: 4900,
  benefices: ['A', 'B', 'C'],
  engagementHumain: ['bilan_mensuel'],
  estMiseEnAvant: false,
  publieeLe: '2026-10-01T10:00:00Z',
  retireeLe: null,
};

const DOSSIER = (statut: DossierVerification['statut']): DossierVerification => ({
  statut,
  deposeLe: null,
  motif: null,
});

async function rendre(dossier: DossierVerification, offres: Offre[]) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({
      profilActif: 'coach',
      clientExiste: true,
      clientOnboardingEtape: 5,
      coachExiste: true,
      identiteActive: { prenom: 'Camille', nom: 'Coach' },
    }),
  );
  portDonnees.definirDossierVerificationPourTest(dossier);
  portDonnees.definirOffresPourTest(offres);
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <Pilotage />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

async function appuyerSurLAvatarEtVoirLaFeuille() {
  await waitFor(() => expect(screen.queryByLabelText("Ouvrir la bascule d'espace")).toBeTruthy());
  await fireEvent.press(screen.getByLabelText("Ouvrir la bascule d'espace"));
  await waitFor(() => expect(screen.queryByLabelText('Espace client')).toBeTruthy());
}

describe('pilotage : l’avatar ouvre la bascule dans CHAQUE état du coach (L1-06, entrée 1)', () => {
  it.each([
    ['vérification jamais demandée (absente)', DOSSIER('absente'), []],
    ['dossier en examen', DOSSIER('en_examen'), []],
    ['complément demandé', DOSSIER('complement_demande'), []],
    ['vérifié, aucune offre publiée (premier lancement)', DOSSIER('verifiee'), []],
    ['vérifié, avec une offre publiée', DOSSIER('verifiee'), [OFFRE_PUBLIEE]],
  ] as [string, DossierVerification, Offre[]][])('%s', async (_etat, dossier, offres) => {
    await rendre(dossier, offres);
    await appuyerSurLAvatarEtVoirLaFeuille();
  });
});
