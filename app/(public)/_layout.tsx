import type { ReactElement } from 'react';
import { RepriseProfil } from '@/fonctionnalites/accueil/reprise-profil';
import { Redirect, Stack, useSegments } from 'expo-router';
import { View } from 'react-native';

import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';

import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { determinerDestination } from '@/fonctionnalites/identite/garde';
import { useParcoursVisiteur } from '@/fonctionnalites/accueil/fournisseur-parcours-visiteur';
import { useTheme } from '@/theme/fournisseur';

// Règle 7 (docs/prompts/L1.md, P1.10) : "une route de (public) atteinte avec une session
// valide → renvoi vers l'espace actif." Un seul endroit CALCULE la destination
// (determinerDestination, garde.ts) ; celui-ci, app/index.tsx et la garde des adresses privées
// (src/fonctionnalites/identite/garde-adresses-privees.tsx, 12 novembre 2026) sont les seuls
// endroits qui l'APPELLENT — jamais une autre logique de redirection écrite ailleurs.
//
// Pendant le chargement (session ou profils), rend les enfants normalement : jamais de
// redirection décidée sur des données pas encore arrivées (même principe que app/index.tsx).
//
// EXCEPTION délibérée, jamais un oubli : app/(public)/nouveau-mot-de-passe.tsx a BESOIN d'une
// session authentifiée — celle établie par le lien de récupération — pour rester atteignable
// le temps de choisir le nouveau mot de passe. Sans cette exception, la règle 7 l'expulserait
// vers l'espace actif AVANT que l'écran ait pu servir à quoi que ce soit, cassant tout le
// parcours "mot de passe oublié" de docs/ecrans/L1-04-connexion.md. useSegments() (pas
// usePathname(), dont le format exact vis-à-vis des groupes n'est pas documenté de façon
// fiable) renvoie les segments de fichier tels qu'écrits, groupe compris — l'usage canonique
// d'Expo Router pour ce genre de garde.
const DERNIER_SEGMENT_EXEMPTE = 'nouveau-mot-de-passe';

export default function LayoutPublic() {
  const theme = useTheme();
  const parcours = useParcoursVisiteur();
  const segments: readonly string[] = useSegments();
  const { chargement: chargementSession, session } = useSession();
  const { chargement: chargementDonnees, profils, erreurLecture, relire } = useDonnees();

  const routeExemptee =
    segments[segments.length - 1] === DERNIER_SEGMENT_EXEMPTE ||
    segments[segments.length - 1] === 'decouvrir' ||
    segments[1] === 'profil' ||
    (segments[1] === 'documents' && profils?.compteACompleter);
  const sessionValide = Boolean(session && session.emailVerifie);
  let redirection: ReactElement | null = null;

  if (
    segments[0] === '(public)' &&
    !routeExemptee &&
    !chargementSession &&
    !chargementDonnees &&
    !parcours.chargement &&
    sessionValide
  ) {
    // Lecture des profils en échec (13 novembre 2026) : l'erreur, aucune redirection — le repli
    // menait à l'onboarding client (docs/dette.md, jeton « émis dans le futur »).
    if (erreurLecture) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: theme.espace[6],
            backgroundColor: theme.couleur.fond.canevas,
          }}
        >
          <EtatErreur
            titre={textesRepliErreur.serveur.titre}
            explication={textesRepliErreur.serveur.explication}
            nombreEchecs={0}
            onReessayer={() => void relire()}
          />
        </View>
      );
    }
    const destination = determinerDestination(session, profils, parcours.retourCoach);
    redirection =
      parcours.retourCoach && destination === `/(public)/profil/${parcours.retourCoach.coachId}` ? (
        <RepriseProfil coachId={parcours.retourCoach.coachId} />
      ) : (
        <Redirect href={destination} />
      );
  }

  // Garder le même navigateur au même emplacement : le démonter à la connexion perdrait
  // les filtres et les résultats. La redirection reste un frère sans remplacer ce Stack.
  return (
    <>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={redirection !== null}
        importantForAccessibility={redirection !== null ? 'no-hide-descendants' : 'auto'}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      {redirection}
    </>
  );
}
