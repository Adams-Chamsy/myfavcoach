import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import type { AvisDuCoach, AvisPublic, EtatMonAvis } from '@/services/donnees/port';
import { libellesInterditsTrouves, type NoeudHote } from '@/test/libelles-interdits';
import { FournisseurTheme } from '@/theme/fournisseur';
import { OngletAvis } from './onglet-avis';

// docs/ecrans/L2-13-avis.md (onglet Avis) et docs/ecrans/L4-27a-depot-avis.md (27b, état de
// l'onglet). Données : src/fixtures/demonstration.ts (l'avis de Sophie Lambert sur Yannick,
// 5 étoiles) ; les autres avis n'existent que pour exercer les seuils. Maquettes : 27 et 27b.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const SOPHIE: AvisPublic = {
  id: 'avis-sophie',
  prenom: 'Sophie',
  initialeNom: 'L',
  dureeSuiviMois: 3,
  note: 5,
  etiquettes: ['ecoute', 'programme_adapte'],
  texte:
    'Trois mois et je ne rate plus une séance. Il ajuste dès que je bloque, et il ne me sort jamais le discours "no pain no gain".',
};
const MARC: AvisPublic = {
  id: 'avis-marc',
  prenom: 'Marc',
  initialeNom: 'T',
  dureeSuiviMois: 7,
  note: 4,
  etiquettes: ['reactivite'],
  texte: null,
};

function avisDuCoach(avis: AvisPublic[], moyenne: number | null = null): AvisDuCoach {
  return {
    avis,
    synthese: {
      nombre: avis.length,
      moyenne,
      distribution: [0, 0, 0, 1, avis.length - 1],
      etiquettesPortees: [...new Set(avis.flatMap((a) => a.etiquettes))],
    },
  };
}

async function rendre(
  avis: AvisDuCoach,
  monAvis: EtatMonAvis = { etat: 'aucun' },
  connecte = true,
) {
  const portAuth = creerFauxPortAuth();
  if (connecte) {
    await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
    portAuth.verifierEmailPourTest('camille@exemple.fr');
    await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  }
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirAvisDuCoachPourTest({ 'coach-yannick': avis });
  portDonnees.definirMonAvisPourTest({ 'coach-yannick': monAvis });
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <OngletAvis coachId="coach-yannick" prenom="Yannick" />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('L2-13 · Onglet Avis, et 27b', () => {
  // L2-13, critère 1 : à 0 avis, état vide honnête, ni note ni compteur.
  it('0 avis : l’état vide, ni note ni compteur', async () => {
    await rendre(avisDuCoach([]));
    await waitFor(() => expect(screen.queryByText('Aucun avis pour l’instant')).toBeTruthy());
    expect(screen.queryByText(/avis$/)).toBeNull();
  });

  // L2-13, critère 6 : entre 1 et 4 avis, les avis un par un, sans moyenne. Contenu : auteur
  // (prénom + initiale), durée de suivi (jamais une date), note, étiquettes, texte s'il existe.
  it('1 à 4 avis : chaque avis, sans moyenne ; durée de suivi, jamais une date', async () => {
    await rendre(avisDuCoach([SOPHIE, MARC]));

    await waitFor(() => expect(screen.queryByText('Sophie L.')).toBeTruthy());
    expect(screen.getByText('3 mois de suivi')).toBeTruthy();
    expect(screen.getByText('5 sur 5')).toBeTruthy();
    expect(screen.getAllByText('Écoute').length).toBeGreaterThan(0);
    expect(screen.getByText(SOPHIE.texte as string)).toBeTruthy();
    expect(screen.getByText('Marc T.')).toBeTruthy();
    expect(screen.getByText('7 mois de suivi')).toBeTruthy();
    expect(screen.queryByText(/^\d,\d$/)).toBeNull();
    expect(screen.queryByText(/\d+ avis$/)).toBeNull();
  });

  // L2-13, critère 6 : à 5 avis ou plus (moyenne rendue par le serveur), moyenne et nombre.
  it('5 avis ou plus : la moyenne du serveur, au dixième, et le nombre d’avis', async () => {
    const cinq = [
      SOPHIE,
      MARC,
      { ...MARC, id: 'a3' },
      { ...MARC, id: 'a4' },
      { ...MARC, id: 'a5' },
    ];
    await rendre(avisDuCoach(cinq, 4.2));

    await waitFor(() => expect(screen.queryByText('4,2')).toBeTruthy());
    expect(screen.getByText('5 avis')).toBeTruthy();
  });

  // L2-13, critère 7 : le filtre ne montre que les étiquettes réellement portées.
  it('filtre : « Tous » et les seules étiquettes portées ; choisir une étiquette filtre la liste', async () => {
    await rendre(avisDuCoach([SOPHIE, MARC]));
    await waitFor(() => expect(screen.queryByText('Sophie L.')).toBeTruthy());

    expect(screen.getByRole('button', { name: 'Tous' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réactivité' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ponctualité' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Réactivité' }));

    await waitFor(() => expect(screen.queryByText('Sophie L.')).toBeNull());
    expect(screen.getByText('Marc T.')).toBeTruthy();
  });

  // 27b : abonné pas encore éligible — encart « Encore {n} jours » (n du serveur), la liste
  // sous « Ce que disent les autres », et « Donner mon avis » inactif, qui dit pourquoi.
  it('27b : « Encore 12 jours », la liste, et un bouton inactif qui dit pourquoi', async () => {
    await rendre(avisDuCoach([MARC]), { etat: 'pas_encore', joursRestants: 12 });

    await waitFor(() => expect(screen.queryByText('Encore 12 jours')).toBeTruthy());
    expect(
      screen.getByText(
        'Tu pourras donner ton avis après 30 jours de suivi. Le temps de savoir ce que tu en penses vraiment.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Ce que disent les autres')).toBeTruthy();
    const bouton = screen.getByRole('button', { name: 'Donner mon avis, possible dans 12 jours' });
    expect(bouton.props.accessibilityState?.disabled).toBe(true);
  });

  // 27a, Contenu (27b) : en pause, impayé… avec 30 jours de suivi : même encart, sans compte à
  // rebours.
  it('suivi interrompu : l’encart sans compte à rebours, bouton inactif', async () => {
    await rendre(avisDuCoach([MARC]), { etat: 'suivi_interrompu' });

    await waitFor(() =>
      expect(
        screen.queryByText('Tu pourras donner ton avis quand ton suivi aura repris.'),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/^Encore/)).toBeNull();
    const bouton = screen.getByRole('button', { name: /^Donner mon avis/ });
    expect(bouton.props.accessibilityState?.disabled).toBe(true);
  });

  // Lecteur sans abonnement chez ce coach (et anon) : ni encart ni bouton, seulement la liste.
  it('lecteur sans abonnement, et visiteur sans session : la liste seule', async () => {
    await rendre(avisDuCoach([MARC]), { etat: 'aucun' }, false);
    await waitFor(() => expect(screen.queryByText('Marc T.')).toBeTruthy());
    expect(screen.queryByText(/Donner mon avis/)).toBeNull();
    expect(screen.queryByText('Ce que disent les autres')).toBeNull();
  });

  it('libellés interdits : aucun dans les textes rendus ni les libellés d’accessibilité', async () => {
    await rendre(avisDuCoach([SOPHIE, MARC]), { etat: 'pas_encore', joursRestants: 12 });
    await waitFor(() => expect(screen.queryByText('Sophie L.')).toBeTruthy());
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([]);
  });
});
