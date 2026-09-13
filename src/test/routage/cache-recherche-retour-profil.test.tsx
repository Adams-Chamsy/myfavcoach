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
// Stack racine ne démonte jamais un écran recouvert par un push) : FAUX à la première écriture
// de ce test — il rougissait, et révélait un défaut plus profond que celui redouté : ce n'était
// pas Explorer qui rejouait le bruit, c'était le retour arrière qui n'atterrissait même pas sur
// Explorer. app/(client)/_layout.tsx portait directement le Tabs (expo-router/js-tabs) ET
// coach/[id] au même niveau — Tabs ne retient que DEUX emplacements dans son historique (le tout
// premier onglet visité et l'entrée courante), jamais une vraie pile, donc pousser coach/[id]
// depuis un onglet remplaçait l'onglet actif au lieu de s'empiler dessus.
//
// Corrigé le 13 septembre 2026 : app/(client)/_layout.tsx est maintenant un Stack nu, les cinq
// onglets vivent dans app/(client)/(tabs)/_layout.tsx (groupe invisible dans l'URL), coach/[id]
// reste ici en écran FRÈRE de ce groupe — un push vers coach/[id] s'empile donc par-dessus
// l'ENTIER groupe de Tabs, jamais à travers lui. Ce test est désormais vert pour de vrai, jamais
// réécrit pour qu'il passe : la structure de route a changé, pas les assertions.
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
    routeur.push('/(client)/(tabs)/explorer');
  }, [routeur]);
  return null;
}

// renderRouter() force des minuteurs Jest factices sans jamais les retirer lui-même — sans ce
// retrait explicite, ils fuient vers d'autres fichiers de test exécutés dans le même worker
// Jest (leçon de P1.11, répétée à chaque fichier qui utilise renderRouter).
afterEach(() => {
  jest.useRealTimers();
});

it('retour depuis un profil coach : aucun nouvel appel à rechercherCoachs, la liste affichée ne bouge pas', async () => {
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
  // bascule d'espace), puis rejoint Explorer par un vrai push : partir directement sur Explorer
  // construit un historique de pile différent de celui d'un vrai parcours (trouvé en écrivant ce
  // test) — jamais représentatif de ce qu'un utilisateur vit.
  const rendu = renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        '(client)/(tabs)/accueil': AccueilPousseVersExplorer,
      },
    },
    { initialUrl: '/(client)/(tabs)/accueil' },
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
