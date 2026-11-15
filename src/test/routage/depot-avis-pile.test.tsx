import { useEffect, useRef } from 'react';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L4-27a-depot-avis.md, États : « Onglet Avis, abonné éligible : bouton actif » qui
// ouvre 27a, et « 27a, succès : retour à l'onglet Avis, avis visible ». Propriété de pile
// (CLAUDE.md §8) : seul expo-router/testing-library rend la VRAIE pile. Le parcours appuie sur ce
// qu'une personne appuierait : l'onglet « Avis » du profil, « Donner mon avis », une étoile,
// « Publier mon avis ». Un test par fichier (CLAUDE.md §8).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

// Même technique que tunnel-choix-offre.test.tsx : l'accueil pousse le profil une seule fois.
function AccueilPousseVersProfil() {
  const routeur = useRouter();
  const pousse = useRef(false);
  useEffect(() => {
    if (pousse.current) return;
    pousse.current = true;
    routeur.push('/(client)/coach/coach-yannick');
  }, [routeur]);
  return null;
}

afterEach(() => {
  jest.useRealTimers();
});

it('« Donner mon avis » ouvre 27a ; après « Publier mon avis », retour au profil, dont l’onglet Avis a relu', async () => {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({
      profilActif: 'client',
      clientExiste: true,
      clientOnboardingEtape: 5,
      coachExiste: false,
    }),
  );
  portDonnees.definirProfilsCoachPublicsPourTest({
    'coach-yannick': {
      id: 'coach-yannick',
      prenom: 'Yannick',
      nom: 'Berthaud',
      photoUrl: null,
      discipline: 'préparation physique',
      titreCourt: null,
      bio: null,
      verifiee: true,
      verifieeDepuisLe: null,
      parcoursTexte: null,
      langues: [],
    },
  });
  portDonnees.definirMonAvisPourTest({
    'coach-yannick': { etat: 'possible', dureeSuiviMois: 4 },
  });
  portDonnees.definirReponseAvisPourTest({ issue: 'enregistre', avisId: 'avis-1' });

  function RacineFaux() {
    return (
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <FournisseurSession port={portAuth}>
            <FournisseurDonnees port={portDonnees}>
              <Stack screenOptions={{ headerShown: false }} />
            </FournisseurDonnees>
          </FournisseurSession>
        </FournisseurTheme>
      </SafeAreaProvider>
    );
  }

  const rendu = await renderRouter(
    {
      appDir: './app',
      overrides: { _layout: RacineFaux, '(client)/(tabs)/accueil': AccueilPousseVersProfil },
    },
    { initialUrl: '/(client)/(tabs)/accueil' },
  );
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/coach/coach-yannick'));
  await waitFor(() => expect(screen.queryByText('Yannick Berthaud')).toBeTruthy());

  await fireEvent.press(screen.getByRole('tab', { name: 'Avis' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Donner mon avis' })).toBeTruthy(),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Donner mon avis' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/avis/coach-yannick'));
  await waitFor(() => expect(screen.queryByText('Suivi depuis 4 mois')).toBeTruthy());

  // À partir d'ici, chaque lecture des avis est une RELECTURE du profil resté derrière.
  const lectures = jest.spyOn(portDonnees, 'lireAvisDuCoach');
  await fireEvent.press(screen.getByLabelText('5 sur 5, Excellent'));
  await fireEvent.press(screen.getByRole('button', { name: 'Publier mon avis' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/coach/coach-yannick'));
  expect(portDonnees.lireEcrituresAvisPourTest()).toEqual([
    {
      operation: 'depot',
      coachId: 'coach-yannick',
      saisie: { note: 5, etiquettes: [], texte: null },
    },
  ]);
  expect(lectures).toHaveBeenCalledWith('coach-yannick');
});
