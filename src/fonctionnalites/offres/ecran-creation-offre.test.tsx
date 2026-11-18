import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { DossierVerification, Offre } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranCreationOffre } from './ecran-creation-offre';

// A3 (12 novembre 2026) : l'écran monte la garde de sortie existante. Son interaction avec la vraie
// pile est prouvée par src/test/routage/garde-sortie-offre.test.tsx ; ici, on prouve ce que
// l'ÉCRAN lui passe (actif seulement après une modification) et ce qu'il affiche quand une sortie
// est en attente. Double de bibliothèque : useGardeSortie est un module du dépôt, pas une
// bibliothèque — son contrat est le type exporté.
const mockGarde: { actif: boolean[]; sortie: { reprendre: () => void } | null } = {
  actif: [],
  sortie: null,
};
const mockAnnuler = jest.fn();
jest.mock('@/fonctionnalites/navigation/garde-sortie', () => ({
  useGardeSortie: (actif: boolean) => {
    mockGarde.actif.push(actif);
    return { sortieEnAttente: mockGarde.sortie, annulerSortie: mockAnnuler };
  },
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

// Retours à l'écran (docs/ecrans/L2-15-creation-offre-coach.md, ajouté le 2 novembre 2026) :
// un message doit être dans le champ de vision, donc HORS de la zone de défilement.
function dansLaZoneDeDefilement(element: unknown): boolean {
  let noeud = element as { type?: string; parent?: unknown } | null;
  while (noeud) {
    if (noeud.type === 'RCTScrollView') return true;
    noeud = (noeud.parent as typeof noeud) ?? null;
  }
  return false;
}

const VERIFIE: DossierVerification = { statut: 'verifiee', deposeLe: null, motif: null };

function publier() {
  return screen.getByRole('button', { name: 'Publier' });
}

async function rendre(
  dossier?: DossierVerification,
  onFermer: () => void = () => {},
  offreExistante?: Offre,
) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('coach@mfc.test', 'un-mot-de-passe-suffisant', '1990-01-01');
  portAuth.verifierEmailPourTest('coach@mfc.test');
  await portAuth.connecter('coach@mfc.test', 'un-mot-de-passe-suffisant');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ coachExiste: true, profilActif: 'coach' }),
  );
  if (dossier) portDonnees.definirDossierVerificationPourTest(dossier);

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <EcranCreationOffre onFermer={onFermer} offreExistante={offreExistante} />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('Titre')).toBeTruthy());
  return { portDonnees };
}

async function remplirBrouillonComplet() {
  await fireEvent.changeText(screen.getByLabelText('Titre'), 'Suivi complet');
  await fireEvent.changeText(screen.getByLabelText('Prix mensuel (€)'), '49,90');
  const champBenefice = screen.getByPlaceholderText('Ajouter une ligne');
  for (const b of ['Programme personnalisé', 'Suivi hebdomadaire', 'Réponses sous 24h']) {
    await fireEvent.changeText(champBenefice, b);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
  }
}

describe('L2-15 · Créer et publier une offre', () => {
  it('prévisualise les saisies et les centimes sans enregistrer le brouillon', async () => {
    const { portDonnees } = await rendre();
    portDonnees.definirInformationsPourTest({
      profil: 'coach',
      prenom: 'Nadia',
      nom: 'Martin',
      discipline: 'musculation',
      titreCourt: null,
      bio: null,
      communeBaseInsee: null,
      formats: ['visio', 'presentiel'],
      parcoursTexte: null,
      langues: [],
      dateNaissance: '1990-01-01',
    });
    await remplirBrouillonComplet();
    await fireEvent.press(screen.getByRole('button', { name: 'ajustement hebdomadaire' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aperçu client' }));

    expect(await screen.findByText('Suivi complet')).toBeTruthy();
    expect(screen.getByText(/49,90/)).toBeTruthy();
    expect(screen.getByText('Programme personnalisé')).toBeTruthy();
    expect(screen.getByText('ajustement hebdomadaire')).toBeTruthy();
    expect(await screen.findByText('En visio et en présentiel')).toBeTruthy();
    expect(await portDonnees.lireMesOffres()).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Revenir à l’édition' }));
    expect((await screen.findByLabelText('Titre')).props.value).toBe('Suivi complet');
  });

  // Réécrit le 2 novembre 2026 (décision validée la veille, critère 1 révisé de la fiche) :
  // « Publier » est INACTIF pour un coach non vérifié, avec une ligne qui le dit avant tout appui.
  // Avant : le bouton restait actif et menait au refus coach_non_verifie, affiché hors de vue.
  it('un coach non vérifié peut enregistrer un brouillon complet ; « Publier » est inactif et dit pourquoi', async () => {
    const { portDonnees } = await rendre();
    await remplirBrouillonComplet();
    await fireEvent.press(screen.getByRole('button', { name: 'ajustement hebdomadaire' }));

    // Enregistrer un brouillon complet fonctionne même sans être vérifié (docs/domaine.md §4.2).
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await portDonnees.lireMesOffres()).toHaveLength(1);

    await waitFor(() =>
      expect(screen.queryByText('Tu pourras publier une fois ton identité vérifiée.')).toBeTruthy(),
    );
    expect(publier().props.accessibilityState?.disabled).toBe(true);
  });

  it('dossier en examen : « Publier » inactif, « On regarde ton dossier. Tu pourras publier ensuite. »', async () => {
    await rendre({ statut: 'en_examen', deposeLe: '2026-11-01T10:00:00Z', motif: null });
    await remplirBrouillonComplet();
    await waitFor(() =>
      expect(
        screen.queryByText('On regarde ton dossier. Tu pourras publier ensuite.'),
      ).toBeTruthy(),
    );
    expect(publier().props.accessibilityState?.disabled).toBe(true);
  });

  it('« Enregistrer » réussi : « Brouillon enregistré. », dans le champ de vision', async () => {
    await rendre(VERIFIE);
    await fireEvent.changeText(screen.getByLabelText('Titre'), 'Suivi complet');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(screen.queryByText('Brouillon enregistré.')).toBeTruthy());
    expect(dansLaZoneDeDefilement(screen.getByText('Brouillon enregistré.'))).toBe(false);
  });

  it('« Enregistrer » en échec : titre et détail du repli serveur, dans le champ de vision', async () => {
    const { portDonnees } = await rendre(VERIFIE);
    await fireEvent.changeText(screen.getByLabelText('Titre'), 'Suivi complet');
    portDonnees.echouerProchaineEcriturePourTest();
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());
    expect(screen.getByText("Ce n'est pas toi. Réessaie dans un instant.")).toBeTruthy();
    expect(dansLaZoneDeDefilement(screen.getByText('On a un souci de notre côté'))).toBe(false);
    expect(screen.queryByText('Brouillon enregistré.')).toBeNull();
  });

  it('« Publier » inactif nomme le PREMIER manque, dans l’ordre des champs : titre, prix, bénéfices', async () => {
    await rendre(VERIFIE);
    await waitFor(() =>
      expect(screen.queryByText('Donne un titre à ton offre pour publier.')).toBeTruthy(),
    );
    expect(publier().props.accessibilityState?.disabled).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Titre'), 'Suivi complet');
    await fireEvent.changeText(screen.getByLabelText('Prix mensuel (€)'), '5');
    expect(screen.getByText('Choisis un prix entre 10 et 500 €.')).toBeTruthy();
    expect(screen.queryByText('Donne un titre à ton offre pour publier.')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Prix mensuel (€)'), '49');
    expect(screen.getByText('Ajoute encore 3 bénéfices pour publier.')).toBeTruthy();
    const champBenefice = screen.getByPlaceholderText('Ajouter une ligne');
    for (const b of ['Programme', 'Suivi']) {
      await fireEvent.changeText(champBenefice, b);
      await fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    }
    expect(screen.getByText('Ajoute encore 1 bénéfice pour publier.')).toBeTruthy();
    await fireEvent.changeText(champBenefice, 'Réponses');
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.queryByText(/pour publier\.$/)).toBeNull();
    expect(publier().props.accessibilityState?.disabled).toBe(false);
  });

  it('une offre sans engagement humain ne se publie pas : texte exact engagement_humain_requis, dans le champ de vision', async () => {
    const { portDonnees } = await rendre(VERIFIE);
    await remplirBrouillonComplet();

    // Le faux port n'impose pas la règle serveur elle-même (engagement_humain_requis vient de
    // publier_offre, 0008_politiques_offres.sql, déjà prouvé au banc RLS) — ce test-ci vérifie
    // que l'ÉCRAN affiche le texte exact quand le serveur refuse pour cette raison.
    portDonnees.echouerProchainePublicationPourTest({
      issue: 'refusee',
      refus: {
        code: 'engagement_humain_requis',
        title: 'Il manque un engagement humain',
        detail: 'Choisis au moins un engagement humain.',
      },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() =>
      expect(screen.getByText('Choisis au moins un engagement humain.')).toBeTruthy(),
    );
    expect(dansLaZoneDeDefilement(screen.getByText('Choisis au moins un engagement humain.'))).toBe(
      false,
    );
  });

  // docs/api.md §1 et §5 (P4.11) : l'écran affiche le titre ET le détail que le serveur rend,
  // tels quels — il ne choisit plus son libellé à partir du code. Le texte ci-dessous n'existe
  // nulle part dans l'écran : s'il s'affiche, c'est qu'il vient de la réponse.
  it('un refus de publication s’affiche avec le titre et le détail rendus par le serveur, hors de la zone de défilement, et l’offre n’est pas publiée', async () => {
    const { portDonnees } = await rendre(VERIFIE);
    await remplirBrouillonComplet();
    portDonnees.echouerProchainePublicationPourTest({
      issue: 'refusee',
      refus: {
        code: 'termes_interdits',
        title: 'Titre rendu par le serveur',
        detail: 'Détail rendu par le serveur, jamais écrit dans l’écran.',
      },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(screen.queryByText('Titre rendu par le serveur')).toBeTruthy());
    const detail = screen.getByText('Détail rendu par le serveur, jamais écrit dans l’écran.');
    expect(dansLaZoneDeDefilement(detail)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Publier' })).toBeTruthy();
  });

  // Trouvé à la clôture de P4.11 sur la base de dev (15 novembre 2026) : après un refus, le
  // coach corrige son offre et appuie de nouveau sur « Publier ». Ce qui est publié doit être ce
  // qu'il a sous les yeux — jusque-là, le brouillon créé au premier appui était republié tel
  // quel, sans la correction, et le même refus revenait.
  it('après un refus, « Publier » enregistre d’abord la correction : c’est l’offre affichée qui est publiée', async () => {
    const { portDonnees } = await rendre(VERIFIE);
    await remplirBrouillonComplet();
    portDonnees.echouerProchainePublicationPourTest({
      issue: 'refusee',
      refus: { code: 'termes_interdits', title: 'Refus du serveur', detail: 'Reformule.' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(screen.queryByText('Refus du serveur')).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText('Titre'), 'Titre corrigé');
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retirer' })).toBeTruthy());

    const offres = await portDonnees.lireMesOffres();
    expect(offres).toHaveLength(1);
    expect(offres[0]).toMatchObject({ titre: 'Titre corrigé' });
    expect(offres[0]?.publieeLe).not.toBeNull();
    expect(screen.queryByText('Refus du serveur')).toBeNull();
  });

  // Aucune réponse du serveur : le repli (L0-03), jamais un faux succès.
  it('publication sans réponse du serveur : le repli « On a un souci de notre côté », l’offre n’est pas publiée', async () => {
    const { portDonnees } = await rendre(VERIFIE);
    await remplirBrouillonComplet();
    portDonnees.echouerProchainePublicationPourTest({ issue: 'sans_reponse' });
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull();
  });

  it('le retrait appelle retirerOffre, jamais une suppression : l’offre reste modifiable', async () => {
    await rendre(VERIFIE);
    await remplirBrouillonComplet();
    await fireEvent.press(screen.getByRole('button', { name: 'ajustement hebdomadaire' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retirer' })).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Retirer' }));
    await waitFor(() =>
      expect(
        screen.getByText('Cette offre n’est plus en vente. Tes abonnés en cours gardent l’accès.'),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText('Titre').props.value).toBe('Suivi complet');
  });

  // A3 — maquette MyFavCoach-L2_dc.html, bloc « Créer une offre » : en-tête « ✕ · Nouvelle
  // offre · Enregistrer ». Trouvé sur iPhone le 2 novembre 2026 : sans la croix, le seul moyen
  // de quitter l'écran était le geste de retour.
  it('l’en-tête porte la croix « Fermer » et le titre « Nouvelle offre » ; la croix quitte l’écran', async () => {
    const onFermer = jest.fn();
    await rendre(undefined, onFermer);

    expect(screen.getByText('Nouvelle offre')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  // A3, décision du 12 novembre 2026 : fermer une offre modifiée sans enregistrer demande
  // confirmation, avec la garde de sortie existante et sa modale (mêmes textes que « Mes
  // informations », validés en L1).
  it('la garde de sortie ne s’active qu’après une modification non enregistrée', async () => {
    mockGarde.actif = [];
    await rendre();
    expect(mockGarde.actif.at(-1)).toBe(false);

    await fireEvent.changeText(screen.getByLabelText('Titre'), 'Suivi complet');

    expect(mockGarde.actif.at(-1)).toBe(true);
  });

  it('sortie en attente : la modale « Modifications non enregistrées », « Quitter » reprend la sortie', async () => {
    const reprendre = jest.fn();
    try {
      await rendre();
      // Une sortie interceptée par la garde (le « retour » de la croix), puis un rendu.
      mockGarde.sortie = { reprendre };
      await fireEvent.changeText(screen.getByLabelText('Titre'), 'Suivi complet');
      expect(screen.getByText('Modifications non enregistrées')).toBeTruthy();
      expect(screen.getByText('Tu as des modifications non enregistrées.')).toBeTruthy();
      await fireEvent.press(screen.getByText('Quitter'));
      expect(reprendre).toHaveBeenCalledTimes(1);
      await fireEvent.press(screen.getByText('Rester'));
      expect(mockAnnuler).toHaveBeenCalled();
    } finally {
      mockGarde.sortie = null;
    }
  });

  // Titre validé par le développeur le 13 novembre 2026 : « Modifier l'offre » quand l'écran
  // ouvre une offre existante (chemin encore inatteignable : B1, L5 — le titre est prêt).
  it('une offre existante : le titre « Modifier l’offre », pas « Nouvelle offre »', async () => {
    await rendre(VERIFIE, () => {}, {
      id: 'offre-1',
      titre: 'Suivi complet',
      description: null,
      prixCentimes: 4900,
      benefices: ['A', 'B', 'C'],
      engagementHumain: ['bilan_mensuel'],
      estMiseEnAvant: false,
      publieeLe: null,
      retireeLe: null,
    });

    expect(screen.getByText('Modifier l’offre')).toBeTruthy();
    expect(screen.queryByText('Nouvelle offre')).toBeNull();
  });
});
