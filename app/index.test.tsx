import { act, render, screen, waitFor } from '@testing-library/react-native';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { PortAuth, SessionAuth } from '@/services/auth/port';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { EtatProfils, PortDonnees } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import Index from './index';

// Redirect a besoin d'un contexte de navigation reel : remplace par un marqueur lisible en
// test, seule la cible (href) nous interesse ici, pas la navigation elle-meme. require() plutot
// qu'un import en tete de fichier : le factory de jest.mock() ne peut pas referencer une
// variable hors de sa portee (elle est hoistee au-dessus des imports), sauf via require()
// appele a l'interieur du factory lui-meme.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- voir commentaire ci-dessus
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirection">{href}</Text>,
  };
});

// Port entierement controle : chaque test decide precisement quand (et si) sessionCourante()
// repond, ce qu'un faux port normal (creerFauxPortAuth) ne permet pas de retarder a la main.
function creerPortControle(
  sessionCourante: PortAuth['sessionCourante'] = jest.fn().mockResolvedValue(null),
): PortAuth {
  return {
    inscrire: jest.fn(),
    connecter: jest.fn(),
    deconnecter: jest.fn(),
    renvoyerVerification: jest.fn(),
    demanderReinitialisation: jest.fn(),
    changerMotDePasse: jest.fn(),
    changerEmail: jest.fn(),
    sessionCourante,
    surChangementDeSession: jest.fn().mockReturnValue(() => {}),
    etablirSessionDepuisLien: jest.fn(),
  };
}

async function rendreIndex(port: PortAuth, portDonnees: PortDonnees = creerFauxPortDonnees()) {
  return render(
    <FournisseurTheme>
      <FournisseurSession port={port}>
        <FournisseurDonnees port={portDonnees}>
          <Index />
        </FournisseurDonnees>
      </FournisseurSession>
    </FournisseurTheme>,
  );
}

function sessionNonVerifiee(): SessionAuth {
  return {
    compteId: 'compte-1',
    email: 'camille@exemple.fr',
    emailVerifie: false,
    jetonAcces: 'jeton-acces',
    jetonRafraichissement: 'jeton-rafraichissement',
  };
}

describe('Index (docs/ecrans/L0-04-demarrage.md)', () => {
  // Critere 2 (adapte a P1.8) : la redirection vient de useSession(), restaurée depuis le
  // stockage chiffré du client Supabase — plus du trousseau (supprimé, src/services/auth/
  // port.ts). Les règles de determinerDestination elles-mêmes sont testées exhaustivement par
  // src/test/routage/redirections.test.ts ; ce describe-ci vérifie seulement que cet écran les
  // relaie correctement, avec des exemples représentatifs, pas tous les cas.
  describe('redirection selon la session restaurée', () => {
    it("renvoie vers l'espace public sans session", async () => {
      await rendreIndex(creerPortControle(jest.fn().mockResolvedValue(null)));

      await waitFor(() => {
        expect(screen.getByTestId('redirection').props.children).toBe('/(public)');
      });
    });

    it('renvoie vers la vérification avec une session non vérifiée', async () => {
      await rendreIndex(creerPortControle(jest.fn().mockResolvedValue(sessionNonVerifiee())));

      await waitFor(() => {
        expect(screen.getByTestId('redirection').props.children).toBe('/(public)/verification');
      });
    });

    it('renvoie vers (client)/accueil avec une session vérifiée et un profil client réel, onboarding terminé', async () => {
      const session: SessionAuth = { ...sessionNonVerifiee(), emailVerifie: true };
      const profils: EtatProfils = etatProfilsParDefaut({
        profilActif: 'client',
        clientExiste: true,
        clientOnboardingEtape: 5,
        coachExiste: false,
      });
      const portDonnees = creerFauxPortDonnees();
      portDonnees.definirEtatProfilsPourTest(profils);

      await rendreIndex(creerPortControle(jest.fn().mockResolvedValue(session)), portDonnees);

      await waitFor(() => {
        expect(screen.getByTestId('redirection').props.children).toBe('/(client)/accueil');
      });
    });

    // P1.10 : le profil actif vient du serveur (src/services/donnees/), pas seulement de la
    // session — cette destination n'existait pas avant P1.10 (garde.ts ne connaissait aucun
    // profil coach).
    it('renvoie vers (coach)/pilotage avec une session vérifiée et un profil coach réel', async () => {
      const session: SessionAuth = { ...sessionNonVerifiee(), emailVerifie: true };
      const profils: EtatProfils = etatProfilsParDefaut({
        profilActif: 'coach',
        clientExiste: false,
        clientOnboardingEtape: null,
        coachExiste: true,
      });
      const portDonnees = creerFauxPortDonnees();
      portDonnees.definirEtatProfilsPourTest(profils);

      await rendreIndex(creerPortControle(jest.fn().mockResolvedValue(session)), portDonnees);

      await waitFor(() => {
        expect(screen.getByTestId('redirection').props.children).toBe('/(coach)/pilotage');
      });
    });

    it("renvoie vers l'étape 1 de l'onboarding avec une session vérifiée mais aucun profil réel", async () => {
      const session: SessionAuth = { ...sessionNonVerifiee(), emailVerifie: true };
      await rendreIndex(creerPortControle(jest.fn().mockResolvedValue(session)));

      await waitFor(() => {
        expect(screen.getByTestId('redirection').props.children).toBe('/(onboarding)/1-identite');
      });
    });
  });

  // P1.10 : la destination dépend maintenant de DEUX fournisseurs, pas seulement de la
  // session — sans cette garde, un utilisateur avec un profil coach verrait un éclair de
  // "(client)/accueil" (le repli par défaut) avant la vraie destination une fois les profils
  // arrivés, exactement le bug que la garde équivalente sur useSession() évitait déjà.
  it('ne redirige nulle part tant que les profils (useDonnees) n’ont pas répondu, même si la session a déjà répondu', async () => {
    const session: SessionAuth = { ...sessionNonVerifiee(), emailVerifie: true };
    let resoudreProfils!: (etat: EtatProfils) => void;
    const enAttente = new Promise<EtatProfils>((resolve) => {
      resoudreProfils = resolve;
    });
    const portDonnees: PortDonnees = {
      lireEtatProfils: jest.fn().mockReturnValue(enAttente),
      lireProfilOnboarding: jest.fn(),
      creerProfilClient: jest.fn(),
      enregistrerObjectifsEtRythme: jest.fn(),
      enregistrerPointDeDepart: jest.fn(),
      terminerOnboarding: jest.fn(),
      basculerProfil: jest.fn(),
    };

    await rendreIndex(creerPortControle(jest.fn().mockResolvedValue(session)), portDonnees);

    expect(screen.queryByTestId('redirection')).toBeNull();

    await act(async () => {
      resoudreProfils(
        etatProfilsParDefaut({
          profilActif: 'coach',
          clientExiste: false,
          clientOnboardingEtape: null,
          coachExiste: true,
        }),
      );
      await enAttente;
    });

    await waitFor(() => {
      expect(screen.getByTestId('redirection').props.children).toBe('/(coach)/pilotage');
    });
  });

  // Trouvé en préparant P1.8 : l'ancienne lecture du trousseau (synchrone en pratique, jamais
  // "en attente") ne pouvait pas révéler ce bug. sessionCourante(), elle, est réellement
  // asynchrone — sans garde, l'écran redirigerait vers l'espace public par défaut avant de
  // savoir qu'une session existe, un éclair d'écran public avant l'espace réel de l'utilisateur.
  it("ne redirige nulle part tant que sessionCourante n'a pas répondu", async () => {
    let resoudre!: (session: SessionAuth | null) => void;
    const enAttente = new Promise<SessionAuth | null>((resolve) => {
      resoudre = resolve;
    });

    await rendreIndex(creerPortControle(jest.fn().mockReturnValue(enAttente)));

    expect(screen.queryByTestId('redirection')).toBeNull();

    await act(async () => {
      resoudre(null);
      await enAttente;
    });

    await waitFor(() => {
      expect(screen.getByTestId('redirection').props.children).toBe('/(public)');
    });
  });

  // Critere 5 : "chargement simulé à 4 secondes : la phrase « On prépare ton espace » apparaît.
  // À 11 secondes : EtatErreur."
  describe('delais de secours quand la restauration de session traine', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('affiche "On prépare ton espace" après 4 secondes simulées', async () => {
      // Ne resout jamais dans la fenetre du test : simule une restauration qui traine.
      await rendreIndex(creerPortControle(jest.fn().mockReturnValue(new Promise(() => {}))));

      expect(screen.queryByText('On prépare ton espace')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(4000);
      });

      expect(screen.getByText('On prépare ton espace')).toBeTruthy();
    });

    it('bascule sur EtatErreur après 11 secondes simulées', async () => {
      await rendreIndex(creerPortControle(jest.fn().mockReturnValue(new Promise(() => {}))));

      await act(async () => {
        jest.advanceTimersByTime(11000);
      });

      expect(screen.getByText('Ça prend plus de temps que prévu')).toBeTruthy();
      expect(screen.getByText('Réessayer')).toBeTruthy();
    });
  });
});
