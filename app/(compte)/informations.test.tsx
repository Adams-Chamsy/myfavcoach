import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { InformationsCompte } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import Informations from './informations';

const mockRetour = jest.fn();

// Spread du vrai module + stubs : l'écran rend Modale (garde de sortie) et appelle
// useNavigation().addListener('beforeRemove', …), qui lève hors d'un vrai conteneur de
// navigation. Le comportement de pile (garde de sortie, retour propre) est couvert par
// informations.routage.test.tsx avec renderRouter — ici, rendu isolé (CLAUDE.md §8).
jest.mock('expo-router', () => {
  const reel = jest.requireActual('expo-router');
  return {
    ...reel,
    useRouter: () => ({ ...reel.useRouter(), back: mockRetour, canGoBack: () => true }),
    useNavigation: () => ({ addListener: () => () => {}, dispatch: () => {} }),
  };
});

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const INFO_CLIENT: InformationsCompte = {
  profil: 'client',
  prenom: 'Camille',
  nom: 'Dupré',
  communeInsee: null,
  dateNaissance: '2000-01-01',
};

const INFO_COACH: InformationsCompte = {
  profil: 'coach',
  prenom: 'Yannick',
  nom: 'Berthaud',
  discipline: 'préparation physique',
  titreCourt: 'Coaching perf',
  bio: '',
  communeBaseInsee: null,
  formats: [],
  parcoursTexte: '',
  langues: [],
  dateNaissance: '1990-05-02',
};

async function rendre(info: InformationsCompte) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({
      profilActif: info.profil,
      clientExiste: info.profil === 'client',
      coachExiste: info.profil === 'coach',
      identiteActive: { prenom: info.prenom, nom: info.nom ?? null },
    }),
  );
  portDonnees.definirInformationsPourTest(info);

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <Informations />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(screen.queryByLabelText('Prénom')).toBeTruthy());
  return { portDonnees };
}

function boutonEnregistrerDesactive() {
  return screen.getByText('Enregistrer').parent?.props.accessibilityState?.disabled;
}

describe('Informations (docs/ecrans/L1-09-mes-informations.md, « Mes informations »)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Critère 2 : bouton inactif à l'ouverture, actif à la première modification réelle, inactif
  // de nouveau si on remet la valeur d'origine.
  it('le bouton Enregistrer suit l’état « modifié » du formulaire, retour à l’origine compris', async () => {
    await rendre(INFO_CLIENT);

    expect(boutonEnregistrerDesactive()).toBe(true);

    fireEvent.changeText(screen.getByLabelText('Prénom'), 'Camillette');
    await waitFor(() => expect(boutonEnregistrerDesactive()).toBe(false));

    fireEvent.changeText(screen.getByLabelText('Prénom'), 'Camille');
    await waitFor(() => expect(boutonEnregistrerDesactive()).toBe(true));
  });

  // Critère 3 : la date de naissance n'est pas modifiable — aucun champ éditable dans l'arbre.
  it('la date de naissance est affichée en texte, jamais dans un champ', async () => {
    await rendre(INFO_CLIENT);

    expect(screen.getByText('Date de naissance')).toBeTruthy();
    expect(screen.getByText('01/01/2000')).toBeTruthy();
    expect(screen.getByText('Pour la modifier, écris-nous.')).toBeTruthy();
    // Pas de TextInput qui porte cette valeur.
    expect(screen.queryByDisplayValue('01/01/2000')).toBeNull();
  });

  // Direction produit P1.13b : discipline en lecture seule, même traitement que la date de
  // naissance, en attendant la liste figée de P1.14.
  it('côté coach : prénom, nom, titre court et bio éditables ; discipline en lecture seule', async () => {
    await rendre(INFO_COACH);

    expect(screen.getByLabelText('Prénom')).toBeTruthy();
    expect(screen.getByLabelText('Nom')).toBeTruthy();
    expect(screen.getByLabelText('Titre court')).toBeTruthy();
    expect(screen.getByLabelText('Bio')).toBeTruthy();

    expect(screen.getByText('Discipline')).toBeTruthy();
    expect(screen.getByText('préparation physique')).toBeTruthy();
    expect(screen.queryByDisplayValue('préparation physique')).toBeNull();
    // Une mention « écris-nous » pour la discipline, une pour la date de naissance.
    expect(screen.getAllByText('Pour la modifier, écris-nous.')).toHaveLength(2);
  });

  // Révision du 13 septembre 2026 (docs/dette.md) : commune, formats, parcours et langues
  // rejoignent le formulaire — sans eux rechercher_coachs() (L3) ne peut rien filtrer ni classer
  // pour un vrai coach. Langues suit le même mécanisme fermé que Discipline (P1.14), jamais un
  // texte libre.
  it('côté coach : commune, parcours, formats et langues sont éditables et activent Enregistrer', async () => {
    const { portDonnees } = await rendre(INFO_COACH);

    expect(boutonEnregistrerDesactive()).toBe(true);

    await fireEvent.press(screen.getByText('Lyon')); // commune de base
    await fireEvent.changeText(screen.getByLabelText('Parcours'), 'Dix ans de terrain.');
    await fireEvent.press(screen.getByText('En visio'));
    await fireEvent.press(screen.getByText('Anglais'));
    await waitFor(() => expect(boutonEnregistrerDesactive()).toBe(false));

    await fireEvent.press(screen.getByText('Enregistrer'));

    await waitFor(async () => {
      const info = await portDonnees.lireInformations();
      if (info.profil !== 'coach') throw new Error('profil coach attendu');
      expect(info.communeBaseInsee).toBe('69123');
      expect(info.parcoursTexte).toBe('Dix ans de terrain.');
      expect(info.formats).toEqual(['visio']);
      expect(info.langues).toEqual(['anglais']);
    });
  });

  // Décocher puis recocher la même langue ne doit jamais laisser le bouton actif : c'est un
  // ENSEMBLE, pas une liste ordonnée (voir le commentaire d'`empreinte` dans informations.tsx).
  it('décocher puis recocher la même langue repasse Enregistrer à inactif', async () => {
    await rendre({ ...INFO_COACH, langues: ['français'] });

    await fireEvent.press(screen.getByText('Français')); // décoche
    await waitFor(() => expect(boutonEnregistrerDesactive()).toBe(false));

    await fireEvent.press(screen.getByText('Français')); // recoche
    await waitFor(() => expect(boutonEnregistrerDesactive()).toBe(true));
  });

  it('côté client : la commune est éditable et active Enregistrer', async () => {
    const { portDonnees } = await rendre(INFO_CLIENT);

    await fireEvent.press(screen.getByText('Bordeaux'));
    await waitFor(() => expect(boutonEnregistrerDesactive()).toBe(false));

    await fireEvent.press(screen.getByText('Enregistrer'));

    await waitFor(async () => {
      const info = await portDonnees.lireInformations();
      if (info.profil !== 'client') throw new Error('profil client attendu');
      expect(info.communeInsee).toBe('33063');
    });
  });

  // États, « Erreur » : bandeau, saisie conservée, aucune valeur écrasée.
  it('un échec d’enregistrement affiche l’erreur et conserve la saisie', async () => {
    const { portDonnees } = await rendre(INFO_CLIENT);
    portDonnees.echouerProchaineEcriturePourTest('On a un souci de notre côté.');

    fireEvent.changeText(screen.getByLabelText('Prénom'), 'Camillette');
    await waitFor(() => expect(boutonEnregistrerDesactive()).toBe(false));
    await fireEvent.press(screen.getByText('Enregistrer'));

    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté.')).toBeTruthy());
    expect(screen.getByLabelText('Prénom').props.value).toBe('Camillette');
  });

  it('un enregistrement réussi écrit par le port et rend le bouton inactif', async () => {
    const { portDonnees } = await rendre(INFO_CLIENT);

    fireEvent.changeText(screen.getByLabelText('Prénom'), 'Camillette');
    await waitFor(() => expect(boutonEnregistrerDesactive()).toBe(false));
    await fireEvent.press(screen.getByText('Enregistrer'));

    await waitFor(async () =>
      expect((await portDonnees.lireInformations()).prenom).toBe('Camillette'),
    );
    await waitFor(() => expect(boutonEnregistrerDesactive()).toBe(true));
  });

  it('le bouton retour appelle router.back()', async () => {
    await rendre(INFO_CLIENT);

    fireEvent.press(screen.getByLabelText('Retour'));

    expect(mockRetour).toHaveBeenCalledTimes(1);
  });
});
