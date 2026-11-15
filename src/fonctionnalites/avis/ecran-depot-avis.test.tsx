import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import type { EtatMonAvis } from '@/services/donnees/port';
import {
  libellesInterditsTrouves,
  type NoeudHote,
  textesLisibles,
} from '@/test/libelles-interdits';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranDepotAvis } from './ecran-depot-avis';

// docs/ecrans/L4-27a-depot-avis.md (P4.9b). Données : src/fixtures/demonstration.ts par le faux
// port (Yannick Berthaud, les huit étiquettes figées). Chaque test nomme la ligne de la fiche
// qu'il prouve.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const COACH = 'coach-yannick';
type FauxPort = ReturnType<typeof creerFauxPortDonnees>;

async function rendre(monAvis: EtatMonAvis, regler?: (port: FauxPort) => void) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirProfilsCoachPublicsPourTest({
    [COACH]: {
      id: COACH,
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
  portDonnees.definirMonAvisPourTest({ [COACH]: monAvis });
  regler?.(portDonnees);
  const onRetour = jest.fn();
  const onEnregistre = jest.fn();
  const onRienADeposer = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <EcranDepotAvis
              coachId={COACH}
              onRetour={onRetour}
              onEnregistre={onEnregistre}
              onRienADeposer={onRienADeposer}
            />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  return { portDonnees, onRetour, onEnregistre, onRienADeposer };
}

const POSSIBLE: EtatMonAvis = { etat: 'possible', dureeSuiviMois: 4 };
// Le faux port ne répond rien par défaut (`sans_reponse`) : un succès se règle explicitement.
const accepter = (port: FauxPort) =>
  port.definirReponseAvisPourTest({ issue: 'enregistre', avisId: 'avis-1' });

describe('L4-27a · Déposer ou modifier un avis', () => {
  // Contenu : en-tête, carte du coach, « Suivi depuis {durée} » (correction 1), les trois blocs,
  // l'encart qui annonce prénom, initiale du nom et durée (correction 2, critère 5).
  it('dépôt : « Ton avis », le coach, « Suivi depuis 4 mois », les trois blocs et l’encart de publication', async () => {
    await rendre(POSSIBLE);
    await waitFor(() => expect(screen.queryByText('Ton avis')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('Yannick Berthaud')).toBeTruthy());
    expect(screen.getByText('Suivi depuis 4 mois')).toBeTruthy();
    expect(screen.getByText('Comment ça se passe ?')).toBeTruthy();
    expect(screen.getByText('Ce qui caractérise Yannick')).toBeTruthy();
    expect(screen.getByText('0 sur 3')).toBeTruthy();
    expect(screen.getByLabelText('Raconte, si tu veux')).toBeTruthy();
    expect(screen.getByText('Facultatif')).toBeTruthy();
    expect(screen.getByText('0 / 600')).toBeTruthy();
    expect(
      screen.getByText(
        'Ton avis sera public sur le profil de Yannick, signé de ton prénom, de l’initiale de ton nom et de la durée de ton suivi. Tu peux le modifier pendant 14 jours, puis il se fige.',
      ),
    ).toBeTruthy();
  });

  // Contenu, « Comment ça se passe ? » : chaque étoile libellée « {n} sur 5, {mot} », et le mot
  // de la note choisie sous les étoiles (échelle tranchée le 28 septembre 2026, correction 4).
  it.each([
    [1, 'Décevant'],
    [2, 'Mitigé'],
    [3, 'Correct'],
    [4, 'Très bien'],
    [5, 'Excellent'],
  ])('note %i : étoile libellée et mot « %s » affiché', async (n, mot) => {
    await rendre(POSSIBLE);
    await waitFor(() => expect(screen.queryByLabelText(`${n} sur 5, ${mot}`)).toBeTruthy());
    await fireEvent.press(screen.getByLabelText(`${n} sur 5, ${mot}`));
    await waitFor(() => expect(screen.queryByText(mot)).toBeTruthy());
    expect(screen.getByLabelText(`${n} sur 5, ${mot}`).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  // États : « Publier » inactif tant qu'aucune note n'est choisie ; critère 1 : un dépôt avec une
  // note seule, sans texte ni étiquette, part tel quel.
  it('« Publier mon avis » est inactif sans note ; avec une note seule, le dépôt part sans texte ni étiquette', async () => {
    const { portDonnees, onEnregistre } = await rendre(POSSIBLE, accepter);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Publier mon avis' })).toBeTruthy(),
    );
    expect(
      screen.getByRole('button', { name: 'Publier mon avis' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByLabelText('4 sur 5, Très bien'));
    await fireEvent.press(screen.getByRole('button', { name: 'Publier mon avis' }));
    await waitFor(() => expect(onEnregistre).toHaveBeenCalled());
    expect(portDonnees.lireEcrituresAvisPourTest()).toEqual([
      { operation: 'depot', coachId: COACH, saisie: { note: 4, etiquettes: [], texte: null } },
    ]);
  });

  // Contenu, étiquettes : les huit, compteur « {n} sur 3 », la quatrième refusée avec un message.
  it('étiquettes : les huit proposées, le compteur suit, la quatrième est refusée avec un message', async () => {
    const { portDonnees } = await rendre(POSSIBLE);
    await waitFor(() => expect(screen.queryByText('Écoute')).toBeTruthy());
    for (const libelle of [
      'Écoute',
      'Clarté des explications',
      'Ponctualité',
      'Exigence',
      'Programme adapté',
      'Réactivité',
      'Encouragement',
      'Professionnalisme',
    ]) {
      expect(screen.getByText(libelle)).toBeTruthy();
    }
    await fireEvent.press(screen.getByText('Écoute'));
    await fireEvent.press(screen.getByText('Exigence'));
    await waitFor(() => expect(screen.queryByText('2 sur 3')).toBeTruthy());
    await fireEvent.press(screen.getByText('Réactivité'));
    await fireEvent.press(screen.getByText('Ponctualité'));
    await waitFor(() =>
      expect(
        screen.queryByText('Trois étiquettes au plus. Retires-en une pour en choisir une autre.'),
      ).toBeTruthy(),
    );
    expect(screen.getByText('3 sur 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('5 sur 5, Excellent'));
    await fireEvent.press(screen.getByRole('button', { name: 'Publier mon avis' }));
    await waitFor(() => expect(portDonnees.lireEcrituresAvisPourTest()).toHaveLength(1));
    expect(portDonnees.lireEcrituresAvisPourTest()[0]?.saisie.etiquettes).toEqual([
      'ecoute',
      'exigence',
      'reactivite',
    ]);
  });

  // Contenu, texte : facultatif, 600 caractères au plus, compteur « {n} / 600 ».
  it('texte : le compteur suit la saisie, la limite de 600 est posée sur le champ, le texte part avec l’avis', async () => {
    const { portDonnees } = await rendre(POSSIBLE);
    await waitFor(() => expect(screen.queryByLabelText('Raconte, si tu veux')).toBeTruthy());
    const champ = screen.getByLabelText('Raconte, si tu veux');
    expect(champ.props.maxLength).toBe(600);
    await fireEvent.changeText(champ, '  Il adapte vraiment le programme.  ');
    await waitFor(() => expect(screen.queryByText('36 / 600')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('5 sur 5, Excellent'));
    await fireEvent.press(screen.getByRole('button', { name: 'Publier mon avis' }));
    await waitFor(() => expect(portDonnees.lireEcrituresAvisPourTest()).toHaveLength(1));
    expect(portDonnees.lireEcrituresAvisPourTest()[0]?.saisie.texte).toBe(
      'Il adapte vraiment le programme.',
    );
  });

  // États, modification (≤ 14 j) : champs pré-remplis depuis l'avis existant, relu du serveur ;
  // pied « Enregistrer les modifications » ; l'écriture est une modification, pas un dépôt.
  it('modification : champs pré-remplis, « Enregistrer les modifications » envoie une modification', async () => {
    const { portDonnees, onEnregistre } = await rendre(
      {
        etat: 'modifiable',
        dureeSuiviMois: 4,
        avis: {
          note: 4,
          etiquettes: ['ecoute', 'exigence'],
          texte: 'Très à l’écoute.',
          statut: 'publie',
        },
      },
      accepter,
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Enregistrer les modifications' })).toBeTruthy(),
    );
    expect(screen.getByText('Très bien')).toBeTruthy();
    expect(screen.getByText('2 sur 3')).toBeTruthy();
    expect(screen.getByLabelText('Raconte, si tu veux').props.value).toBe('Très à l’écoute.');
    await fireEvent.press(screen.getByLabelText('5 sur 5, Excellent'));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => expect(onEnregistre).toHaveBeenCalled());
    expect(portDonnees.lireEcrituresAvisPourTest()).toEqual([
      {
        operation: 'modification',
        coachId: COACH,
        saisie: { note: 5, etiquettes: ['ecoute', 'exigence'], texte: 'Très à l’écoute.' },
      },
    ]);
  });

  // États, refus serveur : « message rendu tel quel, aucun champ perdu ».
  it('refus du serveur : son titre et son détail tels quels, aucun champ perdu, pas de retour', async () => {
    const { onEnregistre } = await rendre(POSSIBLE, (port) =>
      port.definirReponseAvisPourTest({
        issue: 'refusee',
        refus: {
          code: 'avis_non_eligible',
          title: 'Pas encore possible',
          detail: 'Tu pourras donner ton avis après 30 jours de suivi.',
        },
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText('Raconte, si tu veux')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Raconte, si tu veux'), 'Un texte à garder.');
    await fireEvent.press(screen.getByLabelText('3 sur 5, Correct'));
    await fireEvent.press(screen.getByRole('button', { name: 'Publier mon avis' }));
    await waitFor(() => expect(screen.queryByText('Pas encore possible')).toBeTruthy());
    expect(screen.getByText('Tu pourras donner ton avis après 30 jours de suivi.')).toBeTruthy();
    expect(screen.getByLabelText('Raconte, si tu veux').props.value).toBe('Un texte à garder.');
    expect(screen.getByText('Correct')).toBeTruthy();
    expect(onEnregistre).not.toHaveBeenCalled();
  });

  // Seul cas où l'écran écrit son propre texte : aucune réponse du serveur (même phrase que 04b).
  it('sans réponse : « Pas de connexion. Réessaie. », la saisie reste', async () => {
    await rendre(POSSIBLE, (port) => port.definirReponseAvisPourTest({ issue: 'sans_reponse' }));
    await waitFor(() => expect(screen.queryByLabelText('2 sur 5, Mitigé')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('2 sur 5, Mitigé'));
    await fireEvent.press(screen.getByRole('button', { name: 'Publier mon avis' }));
    await waitFor(() => expect(screen.queryByText('Pas de connexion. Réessaie.')).toBeTruthy());
    expect(screen.getByText('Mitigé')).toBeTruthy();
  });

  // Règles : l'éligibilité est tranchée par le serveur. Un lecteur qui n'est ni éligible ni en
  // modification (pas encore 30 jours, avis figé, aucun suivi) n'a rien à saisir ici.
  it.each<[string, EtatMonAvis]>([
    ['pas encore éligible', { etat: 'pas_encore', joursRestants: 12 }],
    ['aucun suivi', { etat: 'aucun' }],
    ['suivi interrompu', { etat: 'suivi_interrompu' }],
    [
      'avis figé',
      {
        etat: 'fige',
        dureeSuiviMois: 4,
        avis: { note: 4, etiquettes: [], texte: null, statut: 'publie' },
      },
    ],
  ])('%s : rien à déposer, aucune saisie proposée', async (_nom, monAvis) => {
    const { onRienADeposer } = await rendre(monAvis);
    await waitFor(() => expect(onRienADeposer).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Publier mon avis' })).toBeNull();
  });

  // Critère 7 : aucun pronom genré ; critère 8 : libellés interdits.
  it('aucun pronom genré pour le coach, aucun libellé interdit', async () => {
    await rendre(POSSIBLE);
    await waitFor(() => expect(screen.queryByText('Ce qui caractérise Yannick')).toBeTruthy());
    const racine = screen.container as unknown as NoeudHote;
    const tout = textesLisibles(racine).join(' ');
    expect(tout).not.toMatch(/Tu le suis|Tu la suis|le caractérise|la caractérise/i);
    expect(libellesInterditsTrouves(racine)).toEqual([]);
  });

  // États de lecture : l'erreur de repli (L0-03) et « Réessayer », qui relit.
  it('lecture en échec : l’erreur de repli et « Réessayer », qui relit', async () => {
    await rendre(POSSIBLE, (port) => {
      jest.spyOn(port, 'lireMonAvis').mockRejectedValueOnce(new Error('panne'));
    });
    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.queryByText('Suivi depuis 4 mois')).toBeTruthy());
  });
});
