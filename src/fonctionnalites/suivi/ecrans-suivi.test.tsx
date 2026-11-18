import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { FicheClient } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranFicheClient } from './fiche-client';
import { ProgressionClient } from './progression-client';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: () => true,
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useFocusEffect: (effet: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(effet, [effet]);
  },
}));
jest.mock('expo-router/react-navigation', () => ({
  ...jest.requireActual('expo-router/react-navigation'),
  usePreventRemove: () => {},
}));

async function rendre(element: ReactElement, port: ReturnType<typeof creerFauxPortDonnees>) {
  const auth = creerFauxPortAuth();
  await auth.inscrire('sophie@exemple.fr', 'bon-mot-de-passe', '1990-01-01');
  auth.verifierEmailPourTest('sophie@exemple.fr');
  await auth.connecter('sophie@exemple.fr', 'bon-mot-de-passe');
  await render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 59, right: 0, bottom: 34, left: 0 },
        frame: { x: 0, y: 0, width: 393, height: 852 },
      }}
    >
      <FournisseurTheme>
        <FournisseurSession port={auth}>
          <FournisseurDonnees port={port}>{element}</FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

it('cache et ne lit jamais les mesures sans consentement', async () => {
  const port = creerFauxPortDonnees();
  port.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'client', clientExiste: true }),
  );
  const lire = jest.spyOn(port, 'lireMesMesures');
  await rendre(<ProgressionClient />, port);
  expect(
    await screen.findByRole('button', { name: 'Mes réglages de confidentialité' }),
  ).toBeTruthy();
  expect(lire).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Ajouter une mesure' })).toBeNull();
});

it('demande confirmation hors seuil et relit la mesure enregistrée', async () => {
  const port = creerFauxPortDonnees();
  port.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'client', clientExiste: true }),
  );
  port.definirConsentementSantePourTest({ accorde: true, version: 'v1' });
  const envoi = jest.spyOn(port, 'enregistrerMesure');
  await rendre(<ProgressionClient />, port);
  await fireEvent.press(await screen.findByRole('button', { name: 'Ajouter une mesure' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Poids' }));
  await fireEvent.changeText(screen.getByLabelText('Poids (kg)'), '15,5');
  await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
  expect(envoi).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmer la mesure' }));
  await waitFor(() => expect(screen.queryByText(/15,5 kg · Mesuré le/)).toBeTruthy());
  expect(envoi).toHaveBeenCalledWith('poids', 15.5, expect.any(String));
});

const FICHE_ANCIENNE: FicheClient = {
  mode: 'ancien',
  profilClientId: 'client-sophie',
  prenom: 'Sophie',
  nom: 'Lambert',
  offre: 'Suivi complet',
  debuteLe: '2026-09-01',
  finAccesLe: '2026-10-01',
  seancesFaites: 1,
  historique: [
    {
      id: 'sp-1',
      titre: 'Renforcement',
      datePrevue: '2026-09-12',
      dureeMinutes: 42,
      statut: 'faite',
      rattrapee: true,
      commentaire: null,
    },
  ],
};

it('présente l’ancien client en lecture seule et laisse le retour accessible', async () => {
  const port = creerFauxPortDonnees();
  port.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true }),
  );
  port.definirFicheClientPourTest(FICHE_ANCIENNE);
  await rendre(<EcranFicheClient clientId="client-sophie" />, port);
  expect(await screen.findByText('Sophie Lambert')).toBeTruthy();
  expect(screen.getByText(/Faite \(rattrapée\)/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Retour' })).toBeTruthy();
  expect(screen.queryByText('Notes privées')).toBeNull();
});

it('le coach enregistre ses notes sur une fiche actuelle', async () => {
  const port = creerFauxPortDonnees();
  port.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true }),
  );
  port.definirFicheClientPourTest({
    ...FICHE_ANCIENNE,
    mode: 'actuel',
    statut: 'actif',
    prixCentimes: 4900,
    badge: 'a_jour',
    badgeN: null,
    derniereSeanceLe: '2026-09-12',
    assiduite: null,
    semaines: [],
    programme: null,
    notes: 'Avant',
  });
  await rendre(<EcranFicheClient clientId="client-sophie" />, port);
  await fireEvent.changeText(await screen.findByLabelText('Tes notes'), 'Après');
  await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
  expect(await screen.findByText('Notes enregistrées.')).toBeTruthy();
  expect(await port.lireFicheClient('client-sophie')).toMatchObject({ notes: 'Après' });
});
