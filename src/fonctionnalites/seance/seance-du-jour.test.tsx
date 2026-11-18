import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { seancesDemonstration } from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { ExerciceDeSeance, StatutSeanceProgrammee } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import { CarteSeanceDuJour } from './carte-seance-du-jour';
import { EcranOngletSeance } from './ecran-onglet-seance';
import { EcranSeanceDuJour } from './ecran-seance-du-jour';

// docs/ecrans/L6-05-seance-du-jour.md. La séance : seancesDemonstration[0] (maquettes, System 01) ;
// ses exercices : ceux de la maquette 05 (« Squat gobelet · 3 × 12 », 12 kg).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};
type FauxPort = ReturnType<typeof creerFauxPortDonnees>;
const DEMO = seancesDemonstration[0]!;
const [PRENOM, NOM] = DEMO.coach.split(' ') as [string, string];
const SQUAT: ExerciceDeSeance = {
  id: 'ex-squat',
  ordre: 1,
  nom: 'Squat gobelet',
  series: 3,
  repetitions: 12,
  chargeGrammes: 12000,
  consigne: '',
  mediaChemin: 'coach/squat.mp4',
  mediaTypeMime: 'video/mp4',
};

function seance(port: FauxPort, statut: StatutSeanceProgrammee = 'a_faire') {
  port.definirSeanceClientPourTest(
    {
      id: 'sp-1',
      titre: DEMO.titre,
      dureeMinutes: DEMO.dureeMinutes,
      datePrevue: '2026-11-17',
      statut,
      demarreeLe: statut === 'en_cours' ? new Date().toISOString() : null,
      rattrapee: false,
      coachPrenom: PRENOM,
      coachNom: NOM,
      nombreExercices: 1,
      duJour: true,
    },
    [SQUAT],
  );
}

async function rendre(element: ReactElement, port: FauxPort) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('sophie@exemple.fr', 'bon-mot-de-passe', '1990-01-01');
  portAuth.verifierEmailPourTest('sophie@exemple.fr');
  await portAuth.connecter('sophie@exemple.fr', 'bon-mot-de-passe');
  port.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'client', clientExiste: true }),
  );
  await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={port}>{element}</FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('L6-05 · Séance du jour', () => {
  it('affiche le planning, la date limite et ouvre seulement la séance à rattraper', async () => {
    const port = creerFauxPortDonnees();
    const onOuvrir = jest.fn();
    const commune = {
      dureeMinutes: 42,
      coachPrenom: PRENOM,
      coachNom: NOM,
    };
    jest.spyOn(port, 'lireMonPlanningSeances').mockResolvedValue([
      {
        ...commune,
        id: 'sp-retard',
        titre: 'Séance à reprendre',
        datePrevue: '2026-11-17',
        aRattraperAvant: '2026-11-24',
      },
      {
        ...commune,
        id: 'sp-future',
        titre: 'Séance de vendredi',
        datePrevue: '2026-11-27',
        aRattraperAvant: null,
      },
    ]);

    await rendre(<EcranOngletSeance onOuvrir={onOuvrir} />, port);

    expect(await screen.findByText('Rattrapable jusqu’au 24 novembre 2026')).toBeTruthy();
    expect(screen.getByText('Séance de vendredi')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Séance de vendredi/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Rattraper Séance à reprendre' }));
    expect(onOuvrir).toHaveBeenCalledWith('sp-retard');
  });

  it('le bloc de l’accueil : titre, exercices, durée, coach ; « Commencer » ouvre la séance', async () => {
    const port = creerFauxPortDonnees();
    seance(port);
    const onOuvrir = jest.fn();
    await rendre(<CarteSeanceDuJour onOuvrir={onOuvrir} />, port);
    await waitFor(() => expect(screen.queryByText('Ta séance du jour')).toBeTruthy());
    expect(screen.getByText(DEMO.titre)).toBeTruthy();
    expect(
      screen.getByText(`1 exercice · ${DEMO.dureeMinutes} min · avec ${DEMO.coach}`),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: `Commencer ${DEMO.titre}` }));
    expect(onOuvrir).toHaveBeenCalledWith('sp-1');
  });

  it('le bloc de l’accueil : aucune séance aujourd’hui, aucune carte', async () => {
    const port = creerFauxPortDonnees();
    const lecture = jest.spyOn(port, 'lireSeancesDuJour');
    await rendre(<CarteSeanceDuJour onOuvrir={jest.fn()} />, port);
    await waitFor(() => expect(lecture).toHaveBeenCalled());
    expect(screen.queryByText('Ta séance du jour')).toBeNull();
  });

  it('l’onglet Séance : la séance du jour ; sans séance, « Aucune séance prévue aujourd’hui. »', async () => {
    const port = creerFauxPortDonnees();
    seance(port);
    await rendre(<EcranOngletSeance onOuvrir={jest.fn()} />, port);
    await waitFor(() => expect(screen.queryByText(DEMO.titre)).toBeTruthy());
    expect(screen.queryByText('Aucune séance prévue aujourd’hui.')).toBeNull();
    screen.unmount();

    await rendre(<EcranOngletSeance onOuvrir={jest.fn()} />, creerFauxPortDonnees());
    await waitFor(() =>
      expect(screen.queryByText('Aucune séance prévue aujourd’hui.')).toBeTruthy(),
    );
  });

  it('critère 1 : commencer, valider une série pré-remplie, terminer avec le ressenti (consentement accordé)', async () => {
    const port = creerFauxPortDonnees();
    seance(port);
    await port.enregistrerConsentementSante(true, 'v1');
    const onTerminee = jest.fn();
    await rendre(
      <EcranSeanceDuJour
        seanceProgrammeeId="sp-1"
        onRetour={jest.fn()}
        onTerminee={onTerminee}
        ouvrirPage={jest.fn()}
      />,
      port,
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Commencer la séance' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Commencer la séance' }));
    await waitFor(() =>
      expect(screen.queryByText('Exercice 1 sur 1 · il te reste ~42 min')).toBeTruthy(),
    );
    expect(screen.getByLabelText('Répétitions, série 1').props.value).toBe('12');
    expect(screen.getByLabelText('Charge (kg), série 1').props.value).toBe('12');
    await fireEvent.changeText(screen.getByLabelText('Répétitions, série 1'), '10');
    await fireEvent.press(screen.getByRole('button', { name: 'Valider la série 1' }));
    await waitFor(() => expect(screen.queryByText('Série 1 · validée')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Terminer la séance' }));
    await waitFor(() =>
      expect(screen.queryByText('Comment s’est passée ta séance ?')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText('7'));
    await fireEvent.changeText(screen.getByLabelText(`Un mot pour ${PRENOM} ?`), 'Dur mais fait.');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(onTerminee).toHaveBeenCalled());
    expect(port.lireSeanceClientPourTest('sp-1')).toMatchObject({
      statut: 'faite',
      ressentiEffort: 7,
      commentaire: 'Dur mais fait.',
      series: [{ exerciceId: 'ex-squat', numero: 1, repetitions: 10, chargeGrammes: 12000 }],
    });
  });

  it('critère 2 : sans consentement santé, aucune question de ressenti ; la séance se termine sans', async () => {
    const port = creerFauxPortDonnees();
    seance(port, 'en_cours');
    await rendre(
      <EcranSeanceDuJour
        seanceProgrammeeId="sp-1"
        onRetour={jest.fn()}
        onTerminee={jest.fn()}
        ouvrirPage={jest.fn()}
      />,
      port,
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Terminer la séance' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Terminer la séance' }));
    await waitFor(() =>
      expect(screen.queryByText('Comment s’est passée ta séance ?')).toBeTruthy(),
    );
    expect(screen.queryByText('Ton ressenti d’effort')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(port.lireSeanceClientPourTest('sp-1')?.statut).toBe('faite'));
    expect(port.lireSeanceClientPourTest('sp-1')?.ressentiEffort).toBeNull();
  });

  it('la démo ouvre l’URL signée du média', async () => {
    const port = creerFauxPortDonnees();
    seance(port, 'en_cours');
    const ouvrirPage = jest.fn(async () => {});
    await rendre(
      <EcranSeanceDuJour
        seanceProgrammeeId="sp-1"
        onRetour={jest.fn()}
        onTerminee={jest.fn()}
        ouvrirPage={ouvrirPage}
      />,
      port,
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Voir la démo de Squat gobelet' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Voir la démo de Squat gobelet' }));
    await waitFor(() =>
      expect(ouvrirPage).toHaveBeenCalledWith('https://medias.exemple/coach/squat.mp4'),
    );
  });

  it('Règles : pas encore le jour, le refus du serveur ; sans accès, la phrase ; introuvable', async () => {
    const port = creerFauxPortDonnees();
    seance(port);
    port.definirRefusStudioPourTest('seance_pas_encore');
    await rendre(
      <EcranSeanceDuJour
        seanceProgrammeeId="sp-1"
        onRetour={jest.fn()}
        onTerminee={jest.fn()}
        ouvrirPage={jest.fn()}
      />,
      port,
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Commencer la séance' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Commencer la séance' }));
    await waitFor(() =>
      expect(screen.queryByText('Cette séance s’ouvre le jour prévu.')).toBeTruthy(),
    );
    screen.unmount();

    const sansAcces = creerFauxPortDonnees();
    jest
      .spyOn(sansAcces, 'lireSeanceProgrammee')
      .mockRejectedValue(new Error('abonnement_sans_acces'));
    await rendre(
      <EcranSeanceDuJour
        seanceProgrammeeId="sp-1"
        onRetour={jest.fn()}
        onTerminee={jest.fn()}
        ouvrirPage={jest.fn()}
      />,
      sansAcces,
    );
    await waitFor(() =>
      expect(screen.queryByText('Ta séance n’est pas accessible pour l’instant.')).toBeTruthy(),
    );
    screen.unmount();

    await rendre(
      <EcranSeanceDuJour
        seanceProgrammeeId="sp-absente"
        onRetour={jest.fn()}
        onTerminee={jest.fn()}
        ouvrirPage={jest.fn()}
      />,
      creerFauxPortDonnees(),
    );
    await waitFor(() => expect(screen.queryByText('Cette séance est introuvable.')).toBeTruthy());
  });
});
