import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import type { Offre, ResultatIntention } from '@/services/donnees/port';
import { libellesInterditsTrouves, type NoeudHote } from '@/test/libelles-interdits';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranChoixOffre } from './ecran-choix-offre';

// docs/ecrans/L4-04a-choix-offre.md. Données : src/fixtures/demonstration.ts (Yannick
// Berthaud, « Suivi complet », 49 €/mois, mise en avant) ; l'engagement humain reprend les
// catégories de docs/domaine.md §3.3 que la maquette décrit (« réajusté chaque semaine, 1 visio
// par mois »). La seconde offre n'existe que pour exercer la sélection.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const SUIVI_COMPLET: Offre = {
  id: 'offre-suivi',
  titre: 'Suivi complet',
  description: null,
  prixCentimes: 4900,
  benefices: [],
  engagementHumain: ['ajustement hebdomadaire', 'visio mensuelle'],
  estMiseEnAvant: true,
  publieeLe: '2026-01-01T00:00:00.000Z',
  retireeLe: null,
};
const SECONDE_OFFRE: Offre = {
  ...SUIVI_COMPLET,
  id: 'offre-seconde',
  titre: 'Seconde formule',
  prixCentimes: 3900,
  engagementHumain: ['messagerie avec délai de réponse annoncé'],
  estMiseEnAvant: false,
};

const CREEE: ResultatIntention = {
  issue: 'creee',
  intentionId: 'intention-1',
  recapitulatif: {
    prixCentimes: 4900,
    totalCentimes: 4900,
    prochainPrelevementLe: '2026-12-01',
    jourPrelevement: 1,
  },
  urlPaiement: 'https://paiement.exemple/session-fictive',
  moyensAcceptes: ['carte', 'sepa'],
};

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function rendre(offres: Offre[] = [SUIVI_COMPLET, SECONDE_OFFRE]) {
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirProfilsCoachPublicsPourTest({
    'coach-yannick': {
      id: 'coach-yannick',
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
  portDonnees.definirOffresPubliquesPourTest({ 'coach-yannick': offres });
  const onIntentionCreee = jest.fn();
  const onRetour = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={creerFauxPortAuth()}>
          <FournisseurDonnees port={portDonnees}>
            <EcranChoixOffre
              coachId="coach-yannick"
              onRetour={onRetour}
              onIntentionCreee={onIntentionCreee}
            />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.queryByText('S’abonner à Yannick')).toBeTruthy());
  return { portDonnees, onIntentionCreee, onRetour };
}

describe('L4-04a · Choix de l’offre', () => {
  it('affiche le titre, l’étape, les offres publiées avec leur engagement humain, sans jour de prélèvement', async () => {
    await rendre();
    expect(screen.queryByText('Étape 1 sur 2')).toBeTruthy();
    expect(screen.queryByText('Quelle formule te ressemble ?')).toBeTruthy();
    expect(screen.queryByText('Suivi complet')).toBeTruthy();
    expect(screen.queryByText('49 €/mois')).toBeTruthy();
    expect(screen.queryByText('ajustement hebdomadaire · visio mensuelle')).toBeTruthy();
    expect(screen.queryByText('LE PLUS CHOISI')).toBeTruthy();
    expect(
      screen.queryByText(
        'Sans engagement de durée : tu peux arrêter quand tu veux, l’arrêt prend effet à la fin du mois payé.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText('Premier prélèvement aujourd’hui, puis une fois par mois.'),
    ).toBeTruthy();
    // Corrections de la maquette (fiche, Règles 1, 2, 4).
    expect(screen.queryByText(/Programme seul/)).toBeNull();
    expect(screen.queryByText(/abonnés sur 10/)).toBeNull();
    expect(screen.queryByText(/de chaque mois/)).toBeNull();
  });

  it('présélectionne l’offre mise en avant ; la sélection s’annonce par son état, et change le bouton', async () => {
    await rendre([SECONDE_OFFRE, SUIVI_COMPLET]);
    const suivi = screen.getByRole('radio', { name: /Suivi complet/ });
    const seconde = screen.getByRole('radio', { name: /Seconde formule/ });
    expect(suivi.props.accessibilityState).toMatchObject({ selected: true });
    expect(seconde.props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.queryByRole('button', { name: 'Continuer · 49 €/mois' })).toBeTruthy();
    await fireEvent.press(seconde);
    expect(
      screen.getByRole('radio', { name: /Seconde formule/ }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.queryByRole('button', { name: 'Continuer · 39 €/mois' })).toBeTruthy();
  });

  it('sans offre mise en avant, la première est présélectionnée', async () => {
    await rendre([SECONDE_OFFRE, { ...SUIVI_COMPLET, estMiseEnAvant: false }]);
    expect(
      screen.getByRole('radio', { name: /Seconde formule/ }).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it('« Continuer » demande l’intention pour l’offre choisie, avec une clé d’idempotence', async () => {
    const { portDonnees, onIntentionCreee } = await rendre();
    portDonnees.definirReponseIntentionPourTest(CREEE);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer · 49 €/mois' }));
    // P4.6b : avec l'intention, ce que 04b nomme dans son récapitulatif (le serveur ne le rend pas).
    await waitFor(() =>
      expect(onIntentionCreee).toHaveBeenCalledWith(CREEE, {
        offre: { id: 'offre-suivi', titre: 'Suivi complet' },
        coach: {
          id: 'coach-yannick',
          prenom: 'Yannick',
          nom: 'Berthaud',
          discipline: 'préparation physique',
        },
      }),
    );
    const demandes = portDonnees.lireDemandesIntentionPourTest();
    expect(demandes).toHaveLength(1);
    expect(demandes[0].offreId).toBe('offre-suivi');
    expect(demandes[0].cleIdempotence).toMatch(FORMAT_UUID);
  });

  it('un double appui sur « Continuer » ne produit qu’une seule demande', async () => {
    const { portDonnees } = await rendre();
    let repondre: (r: ResultatIntention) => void = () => {};
    portDonnees.definirReponseIntentionPourTest(
      () =>
        new Promise<ResultatIntention>((r) => {
          repondre = r;
        }),
    );
    const bouton = screen.getByRole('button', { name: 'Continuer · 49 €/mois' });
    // Les deux appuis dans le MÊME tour, avant tout nouveau rendu : un vrai double appui rapide.
    // Deux `await fireEvent.press` successifs laisseraient le bouton se désactiver entre les
    // deux, et le test passerait sans le verrou synchrone de l'écran (vérifié par une casse).
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });
    expect(portDonnees.lireDemandesIntentionPourTest()).toHaveLength(1);
    repondre(CREEE);
  });

  it('un refus du serveur s’affiche tel quel (title, detail), sans texte de l’écran', async () => {
    const { portDonnees, onIntentionCreee } = await rendre();
    portDonnees.definirReponseIntentionPourTest({
      issue: 'refusee',
      refus: {
        code: 'deja_abonne',
        title: 'Tu as déjà un abonnement avec ce coach',
        detail: 'Rien n’a été débité. Tu le retrouves dans ton compte, rubrique Mes abonnements.',
      },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer · 49 €/mois' }));
    await waitFor(() =>
      expect(screen.queryByText('Tu as déjà un abonnement avec ce coach')).toBeTruthy(),
    );
    expect(
      screen.queryByText(
        'Rien n’a été débité. Tu le retrouves dans ton compte, rubrique Mes abonnements.',
      ),
    ).toBeTruthy();
    expect(onIntentionCreee).not.toHaveBeenCalled();
    // Le bouton est réactivé : un nouvel appui fait une nouvelle demande, avec une NOUVELLE clé
    // (le serveur a répondu : la demande précédente est close).
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer · 49 €/mois' }));
    const demandes = portDonnees.lireDemandesIntentionPourTest();
    expect(demandes).toHaveLength(2);
    expect(demandes[1].cleIdempotence).not.toBe(demandes[0].cleIdempotence);
  });

  it('offre devenue indisponible : le refus du serveur s’affiche, et la liste est relue', async () => {
    const { portDonnees } = await rendre();
    portDonnees.definirReponseIntentionPourTest({
      issue: 'refusee',
      refus: {
        code: 'offre_indisponible',
        title: 'Cette formule n’est plus proposée',
        detail: 'Le coach l’a retirée entre-temps. Regarde ses autres formules sur son profil.',
      },
    });
    portDonnees.definirOffresPubliquesPourTest({ 'coach-yannick': [SECONDE_OFFRE] });
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer · 49 €/mois' }));
    await waitFor(() =>
      expect(screen.queryByText('Cette formule n’est plus proposée')).toBeTruthy(),
    );
    await waitFor(() => expect(screen.queryByText('Suivi complet')).toBeNull());
    expect(screen.queryByText('Seconde formule')).toBeTruthy();
  });

  it('aucune réponse (réseau) : le seul texte de l’écran, et le nouvel essai garde la même clé', async () => {
    const { portDonnees } = await rendre();
    portDonnees.definirReponseIntentionPourTest({ issue: 'sans_reponse' });
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer · 49 €/mois' }));
    await waitFor(() => expect(screen.queryByText('Pas de connexion. Réessaie.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer · 49 €/mois' }));
    const demandes = portDonnees.lireDemandesIntentionPourTest();
    expect(demandes).toHaveLength(2);
    expect(demandes[1].cleIdempotence).toBe(demandes[0].cleIdempotence);
  });

  it('aucune offre publiée : état vide honnête, aucun bouton « Continuer »', async () => {
    await rendre([]);
    expect(screen.queryByText('Yannick n’a pas d’offre ouverte pour le moment.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Continuer/ })).toBeNull();
  });

  it('le bouton retour ramène au profil', async () => {
    const { onRetour } = await rendre();
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(onRetour).toHaveBeenCalledTimes(1);
  });

  it('libellés interdits (docs/domaine.md §2) : aucun dans les textes rendus ni les libellés d’accessibilité', async () => {
    await rendre();
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([]);
  });
});
