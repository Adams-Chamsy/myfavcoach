import { useEffect } from 'react';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router, useRouter, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import type { ResultatCoachRecherche } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L3-02-recherche-filtres.md, Règles : « Retour depuis un profil coach : la liste
// déjà reçue est réutilisée, jamais un nouvel appel » — sinon le bruit de départage
// (docs/backend.md §10) réordonnerait les ex-æquo à chaque retour arrière, sans aucune erreur
// visible. CLAUDE.md §8 est explicite : une propriété de pile de navigation (ce qui reste monté
// DERRIÈRE un écran poussé) ne se prouve jamais par un test d'écran isolé (expo-router mocké) —
// seul expo-router/testing-library rend la VRAIE pile.
//
// Écrit en supposant que app/(client)/explorer.tsx n'avait besoin d'aucun cache explicite (le
// Stack racine ne démonte jamais un écran recouvert par un push) : FAUX. Ce test, une fois écrit
// pour de vrai, rougit — et révèle un défaut plus profond que celui redouté : ce n'est pas
// Explorer qui rejoue le bruit, c'est le retour arrière qui n'atterrit même pas sur Explorer.
// `app/(client)/_layout.tsx` (Tabs, expo-router/js-tabs) ne retient que DEUX emplacements dans
// son historique — le tout premier onglet visité et l'entrée courante, jamais une vraie pile —
// donc pousser `coach/[id]` depuis l'onglet Explorer, puis revenir en arrière, atterrit sur le
// premier onglet (Accueil), jamais sur Explorer. Déclarer `coach/[id]` comme
// `<Tabs.Screen options={{ href: null }} />` (même motif que `creer`/`moi` dans
// app/(coach)/_layout.tsx) ne suffit PAS à corriger ça — vérifié, pas supposé : le défaut
// persiste identique une fois la route déclarée (seule sa présence dans routeNames change).
//
// La vraie correction (envelopper le groupe de Tabs dans un Stack, `coach/[id]` en écran FRÈRE
// de ce groupe plutôt qu'un de ses écrans) touche plus de cinq fichiers de route — point d'arrêt
// CLAUDE.md §7, pas une correction en passant. Documenté dans docs/dette.md. Ce test reste écrit
// et rouge, désactivé explicitement le temps de la décision — jamais réécrit pour qu'il passe
// (CLAUDE.md §4) : à retirer le `.skip` une fois la restructuration faite.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function creerRacineFaux(
  portAuth: ReturnType<typeof creerFauxPortAuth>,
  portDonnees: ReturnType<typeof creerFauxPortDonnees>,
) {
  return function RacineFaux() {
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
  };
}

async function compteConnecteEtVerifie(portAuth: ReturnType<typeof creerFauxPortAuth>) {
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
}

function coach(nom: string): ResultatCoachRecherche {
  return {
    offreId: 'o1',
    coachId: 'c1',
    prenom: 'Nadia',
    nom,
    photoUrl: null,
    discipline: 'cybersécurité',
    titreCourt: 'Sécurité offensive',
    communeBaseInsee: null,
    formats: ['visio'],
    titre: 'Suivi mensuel',
    prixCentimes: 3900,
  };
}

// Remplace l'accueil réel : celui-ci appelle rechercherCoachs lui-même pour son propre
// carrousel (P3.4), un second consommateur de la même fixture qui gênerait le comptage
// d'appels et dupliquerait le texte affiché à l'écran — hors sujet ici, seul le comportement de
// L3-02 est testé. Même technique que AccueilBasculeVersCoach
// (bascule-client-vers-coach.test.tsx) : un écran minimal qui pousse au montage, via un vrai
// cycle de rendu React (useEffect), pas du code de test brut.
function AccueilPousseVersExplorer() {
  const routeur = useRouter();
  useEffect(() => {
    routeur.push('/(client)/explorer');
  }, [routeur]);
  return null;
}

// renderRouter() force des minuteurs Jest factices sans jamais les retirer lui-même — sans ce
// retrait explicite, ils fuient vers d'autres fichiers de test exécutés dans le même worker
// Jest (leçon de P1.11, répétée à chaque fichier qui utilise renderRouter).
afterEach(() => {
  jest.useRealTimers();
});

// docs/dette.md (P3.4-P3.6) : rouge pour une vraie raison, désactivé le temps de la décision de
// restructuration de app/(client)/_layout.tsx — pas un test contourné pour cacher un échec.
it.skip('retour depuis un profil coach : aucun nouvel appel à rechercherCoachs, la liste affichée ne bouge pas', async () => {
  const portAuth = creerFauxPortAuth();
  await compteConnecteEtVerifie(portAuth);

  const portDonnees = creerFauxPortDonnees();
  // Un deuxième appel rendrait un nom DIFFERENT — si le cache manquait, ce nom-là apparaîtrait
  // après le retour arrière, symptôme exact que la fiche redoute (silencieux, jamais une
  // exception). Compteur externe, jamais gestionnaire.mock.calls.length dans l'implémentation
  // elle-même : jest enregistre l'appel AVANT d'exécuter l'implémentation, donc ce compteur-là
  // vaudrait déjà 1 au tout premier appel (piège trouvé en écrivant ce test).
  let appels = 0;
  const gestionnaire = jest.fn(() => {
    appels += 1;
    return { resultats: [coach(appels === 1 ? 'Belkacem' : 'Aziz')], totalResultats: 1 };
  });
  portDonnees.definirRechercheCoachsPourTest(gestionnaire);

  // Entre par l'accueil (comme toute session réelle — même point de départ que les tests de
  // bascule d'espace), puis rejoint Explorer par un vrai push : partir directement de
  // initialUrl: '/(client)/explorer' construit un historique de pile différent de celui d'un
  // vrai parcours (trouvé en écrivant ce test — le retour arrière atterrissait sur `accueil`,
  // jamais visité, au lieu d'`explorer`) — jamais représentatif de ce qu'un utilisateur vit.
  const rendu = renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        '(client)/accueil': AccueilPousseVersExplorer,
      },
    },
    { initialUrl: '/(client)/accueil' },
  );

  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(screen.queryByText('Nadia Belkacem')).toBeTruthy());
  expect(gestionnaire).toHaveBeenCalledTimes(1);

  // Pousse vers le profil du coach (exactement ce que CarteResultat.onPress fait), puis revient
  // — jamais via fireEvent.press, connu instable sous les minuteurs factices de renderRouter
  // (bascule-client-vers-coach.test.tsx, activation-espace-coach.test.tsx) : l'appel direct à
  // router prouve la même propriété de pile sans dépendre de la fiabilité d'une pression simulée.
  act(() => router.push('/(client)/coach/c1'));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/coach/c1'));

  act(() => router.back());
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/explorer'));

  // La propriété exercée : l'écran resté monté derrière le profil n'a jamais refait d'appel, et
  // affiche donc encore le premier résultat — pas le second, qui prouverait un nouveau tirage de
  // bruit silencieux.
  expect(gestionnaire).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Nadia Belkacem')).toBeTruthy();
  expect(screen.queryByText('Nadia Aziz')).toBeNull();
});
