// Nom avec un tiret, jamais "_layout.test.tsx" : même piège qu'app/_layout-racine.test.tsx
// (expo-router lirait "_layout.test.tsx" comme un second layout de la même route et
// planterait au démarrage — voir son commentaire complet et docs/dette.md).
import { render, screen } from '@testing-library/react-native';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth, type FauxPortAuth } from '@/services/auth/faux';
import {
  creerFauxPortDonnees,
  etatProfilsParDefaut,
  type FauxPortDonnees,
} from '@/services/donnees/faux';
import LayoutPublic from './_layout';

const mockRemplacer = jest.fn();
let mockSegments: string[] = ['(public)', 'connexion'];

jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  Redirect: ({ href }: { href: string }) => {
    mockRemplacer(href);
    return null;
  },
  Slot: () => {
    // require() ici, jamais un import en tête de fichier : une référence hors-portée dans une
    // factory jest.mock() lève à la transformation (voir src/composants/bouton.test.tsx et
    // consorts pour ce même motif établi).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text>écran public affiché</Text>;
  },
}));

const MAJEUR = '2000-01-01';

function rendre(portAuth: FauxPortAuth, portDonnees: FauxPortDonnees) {
  return render(
    <FournisseurSession port={portAuth}>
      <FournisseurDonnees port={portDonnees}>
        <LayoutPublic />
      </FournisseurDonnees>
    </FournisseurSession>,
  );
}

describe('app/(public)/_layout.tsx — règle 7 (docs/prompts/L1.md, P1.10)', () => {
  beforeEach(() => {
    mockSegments = ['(public)', 'connexion'];
    jest.clearAllMocks();
  });

  it('sans session, affiche la route publique normalement', async () => {
    await rendre(creerFauxPortAuth(), creerFauxPortDonnees());

    expect(screen.getByText('écran public affiché')).toBeTruthy();
    expect(mockRemplacer).not.toHaveBeenCalled();
  });

  it('avec une session vérifiée, redirige vers l’espace actif plutôt que d’afficher la route publique', async () => {
    const portAuth = creerFauxPortAuth();
    await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
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

    await rendre(portAuth, portDonnees);

    expect(mockRemplacer).toHaveBeenCalledWith('/(client)/(tabs)/accueil');
    expect(screen.queryByText('écran public affiché')).toBeNull();
  });

  it('avec une session vérifiée mais sur nouveau-mot-de-passe, n’expulse jamais l’écran', async () => {
    mockSegments = ['(public)', 'nouveau-mot-de-passe'];
    const portAuth = creerFauxPortAuth();
    await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    portAuth.verifierEmailPourTest('camille@exemple.fr');
    await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

    await rendre(portAuth, creerFauxPortDonnees());

    expect(mockRemplacer).not.toHaveBeenCalled();
    expect(screen.getByText('écran public affiché')).toBeTruthy();
  });
});
