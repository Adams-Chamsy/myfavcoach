import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import ProfilCoachPublicEcran from './[id]';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'coach-1' }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

describe('L2-12 · Profil coach public', () => {
  // Critère 1 : accessible SANS session — pas connecté du tout, pas seulement "connecté sans
  // abonnement". creerFauxPortAuth() sans inscrire/connecter : aucune session ne se résout
  // jamais, comme un visiteur `anon` réel.
  it('affiche le profil et l’offre publiée sans aucune session (anon)', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirProfilsCoachPublicsPourTest({
      'coach-1': {
        id: 'coach-1',
        prenom: 'Nadia',
        nom: 'Belkacem',
        photoUrl: null,
        discipline: 'Cybersécurité',
        titreCourt: 'Sécurité offensive',
        bio: 'Dix ans d’expérience.',
        verifiee: true,
        verifieeDepuisLe: '2026-03-01T00:00:00.000Z',
        parcoursTexte: null,
        langues: [],
      },
    });
    portDonnees.definirOffresPubliquesPourTest({
      'coach-1': [
        {
          id: 'o1',
          titre: 'Suivi complet',
          description: null,
          prixCentimes: 4900,
          benefices: ['Programme personnalisé'],
          engagementHumain: ['ajustement hebdomadaire'],
          estMiseEnAvant: true,
          publieeLe: '2026-09-01T00:00:00.000Z',
          retireeLe: null,
        },
      ],
    });

    render(
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <FournisseurSession port={creerFauxPortAuth()}>
            <FournisseurDonnees port={portDonnees}>
              <ProfilCoachPublicEcran />
            </FournisseurDonnees>
          </FournisseurSession>
        </FournisseurTheme>
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(screen.getByText('Nadia Belkacem')).toBeTruthy());
    expect(screen.getByText('Vérifié')).toBeTruthy();
    expect(screen.getByText('Vérifié depuis le 01/03/2026')).toBeTruthy();
    expect(screen.getByText('Suivi complet')).toBeTruthy();
    expect(screen.getByText('LE PLUS CHOISI')).toBeTruthy();
  });

  it('profil introuvable : état vide, jamais une exception', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirProfilsCoachPublicsPourTest({});

    render(
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <FournisseurSession port={creerFauxPortAuth()}>
            <FournisseurDonnees port={portDonnees}>
              <ProfilCoachPublicEcran />
            </FournisseurDonnees>
          </FournisseurSession>
        </FournisseurTheme>
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(screen.getByText('Profil introuvable')).toBeTruthy());
  });

  // docs/domaine.md §5.1, révisé le 12 septembre 2026 : plus de badge « Nouveau », dans aucun
  // des trois cas — celui-ci (0 avis) est le seul atteignable en production (aucune table
  // `avis` au jalon 1, voir le commentaire au-dessus de OngletAvis).
  it('onglet Avis, 0 avis réel : état vide honnête, jamais de badge « Nouveau »', async () => {
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirProfilsCoachPublicsPourTest({
      'coach-1': {
        id: 'coach-1',
        prenom: 'Nadia',
        nom: 'Belkacem',
        photoUrl: null,
        discipline: 'Cybersécurité',
        titreCourt: 'Sécurité offensive',
        bio: 'Dix ans d’expérience.',
        verifiee: true,
        verifieeDepuisLe: '2026-03-01T00:00:00.000Z',
        parcoursTexte: null,
        langues: [],
      },
    });
    portDonnees.definirOffresPubliquesPourTest({ 'coach-1': [] });

    render(
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <FournisseurSession port={creerFauxPortAuth()}>
            <FournisseurDonnees port={portDonnees}>
              <ProfilCoachPublicEcran />
            </FournisseurDonnees>
          </FournisseurSession>
        </FournisseurTheme>
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(screen.getByText('Nadia Belkacem')).toBeTruthy());
    await fireEvent.press(screen.getByText('Avis'));
    await waitFor(() => expect(screen.queryByText('Aucun avis pour l’instant')).toBeTruthy());
    expect(screen.queryByText('Nouveau')).toBeNull();
  });
});
