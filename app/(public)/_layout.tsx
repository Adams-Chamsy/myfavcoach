import { Redirect, Slot, useSegments } from 'expo-router';

import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { determinerDestination } from '@/fonctionnalites/identite/garde';

// Règle 7 (docs/prompts/L1.md, P1.10) : "une route de (public) atteinte avec une session
// valide → renvoi vers l'espace actif." Un seul endroit CALCULE la destination
// (determinerDestination, garde.ts) ; celui-ci et app/index.tsx sont les deux seuls endroits
// qui l'APPELLENT — jamais une troisième logique de redirection écrite ailleurs.
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
  const segments = useSegments();
  const { chargement: chargementSession, session } = useSession();
  const { chargement: chargementDonnees, profils } = useDonnees();

  const routeExemptee = segments[segments.length - 1] === DERNIER_SEGMENT_EXEMPTE;
  const sessionValide = Boolean(session && session.emailVerifie);

  if (!routeExemptee && !chargementSession && !chargementDonnees && sessionValide) {
    return <Redirect href={determinerDestination(session, profils)} />;
  }

  return <Slot />;
}
