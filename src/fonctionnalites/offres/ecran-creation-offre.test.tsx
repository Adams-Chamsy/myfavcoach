import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { DossierVerification } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranCreationOffre } from './ecran-creation-offre';

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

async function rendre(dossier?: DossierVerification, onFermer: () => void = () => {}) {
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
            <EcranCreationOffre onFermer={onFermer} />
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
    portDonnees.echouerProchainePublicationPourTest('engagement_humain_requis');
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() =>
      expect(screen.getByText('Choisis au moins un engagement humain.')).toBeTruthy(),
    );
    expect(dansLaZoneDeDefilement(screen.getByText('Choisis au moins un engagement humain.'))).toBe(
      false,
    );
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
});
