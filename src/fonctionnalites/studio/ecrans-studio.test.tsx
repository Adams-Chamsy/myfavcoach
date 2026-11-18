import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranBibliotheque } from './ecran-bibliotheque';
import { EcranProgramme } from './ecran-programme';
import { EcranProgrammes } from './ecran-programmes';
import { EcranSeance } from './ecran-seance';

// docs/ecrans/L6-11-studio.md. Le faux port applique les règles du serveur en mémoire ; chaque
// test nomme la ligne de la fiche qu'il prouve.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};
type FauxPort = ReturnType<typeof creerFauxPortDonnees>;

async function rendre(element: ReactElement, port: FauxPort) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('yannick@exemple.fr', 'bon-mot-de-passe', '1985-01-01');
  portAuth.verifierEmailPourTest('yannick@exemple.fr');
  await portAuth.connecter('yannick@exemple.fr', 'bon-mot-de-passe');
  port.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true, clientExiste: false }),
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

// Un programme avec une séance, prêt à publier.
async function programmeAvecSeance(port: FauxPort): Promise<{ programme: string; seance: string }> {
  const programme = await port.creerProgramme();
  if (programme.issue !== 'ok') throw new Error('préparation');
  await port.modifierProgramme(programme.valeur, 'Remise en route', 8);
  const seance = await port.ajouterSeance(programme.valeur, 3);
  if (seance.issue !== 'ok') throw new Error('préparation');
  await port.modifierSeance(seance.valeur, {
    titre: 'Bas du corps · découverte',
    dureeMinutes: 42,
    jourRelatif: 3,
  });
  return { programme: programme.valeur, seance: seance.valeur };
}

describe('L6-11 · Studio', () => {
  it('ouvre les exercices d’un brouillon en aperçu sans le publier ni l’affecter', async () => {
    const port = creerFauxPortDonnees();
    const { programme, seance } = await programmeAvecSeance(port);
    await port.ajouterExercice(seance, {
      nom: 'Squat',
      series: 3,
      repetitions: 8,
      chargeGrammes: 12500,
      consigne: 'Garde les talons au sol.',
    });
    const lireExercices = jest.spyOn(port, 'lireExercices');
    await rendre(
      <EcranProgramme programmeId={programme} onRetour={jest.fn()} onOuvrirSeance={jest.fn()} />,
      port,
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Aperçu client' }));
    expect(await screen.findByText('Remise en route')).toBeTruthy();
    expect(lireExercices).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Semaine 1, jour 3 · Bas du corps · découverte' }),
    );
    expect(await screen.findByText('Squat')).toBeTruthy();
    expect(screen.getByText('3 séries · 8 rép. · 12,5 kg')).toBeTruthy();
    expect(screen.getByText('Garde les talons au sol.')).toBeTruthy();
    expect(lireExercices).toHaveBeenCalledWith(seance);
    expect(port.lireProgrammesPourTest()).toMatchObject([
      { statut: 'brouillon', abonnesEnCours: 0 },
    ]);

    await fireEvent.press(screen.getByRole('button', { name: 'Toutes les séances' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Revenir au programme' }));
    expect(await screen.findByRole('button', { name: 'Publier' })).toBeTruthy();
  });

  it('« Mes programmes » vide : la phrase, et « Nouveau programme » crée un brouillon qu’il ouvre', async () => {
    const port = creerFauxPortDonnees();
    const onOuvrirProgramme = jest.fn();
    await rendre(
      <EcranProgrammes
        onRetour={jest.fn()}
        onOuvrirProgramme={onOuvrirProgramme}
        onOuvrirBibliotheque={jest.fn()}
      />,
      port,
    );
    await waitFor(() => expect(screen.queryByText('Aucun programme pour l’instant.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Nouveau programme' }));
    await waitFor(() => expect(onOuvrirProgramme).toHaveBeenCalledWith('programme-1'));
    expect(port.lireProgrammesPourTest()).toMatchObject([{ statut: 'brouillon', titre: '' }]);
  });

  it('Entrées : arrivé par « Nouvelle séance », la phrase qui dit de choisir un programme ; une ligne par programme, avec son statut', async () => {
    const port = creerFauxPortDonnees();
    await programmeAvecSeance(port);
    await rendre(
      <EcranProgrammes
        choixPourSeance
        onRetour={jest.fn()}
        onOuvrirProgramme={jest.fn()}
        onOuvrirBibliotheque={jest.fn()}
      />,
      port,
    );
    await waitFor(() =>
      expect(screen.queryByText('Une séance s’ajoute dans un programme. Choisis-le.')).toBeTruthy(),
    );
    expect(screen.getByText('Remise en route')).toBeTruthy();
    expect(screen.getByText('8 semaines · 1 séance · Brouillon')).toBeTruthy();
  });

  it('Un programme : les semaines, la séance à son jour, « Ajouter une séance » l’ouvre ; publier sans séance est refusé avec son texte', async () => {
    const port = creerFauxPortDonnees();
    const vide = await port.creerProgramme();
    if (vide.issue !== 'ok') throw new Error('préparation');
    const onOuvrirSeance = jest.fn();
    await rendre(
      <EcranProgramme
        programmeId={vide.valeur}
        onRetour={jest.fn()}
        onOuvrirSeance={onOuvrirSeance}
      />,
      port,
    );
    await waitFor(() => expect(screen.queryByText('Semaine 4')).toBeTruthy());
    expect(screen.getByText('BROUILLON')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(screen.queryByText('Ce programme est vide')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une séance en semaine 2' }));
    await waitFor(() => expect(onOuvrirSeance).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Séance sans titre')).toBeTruthy());
  });

  it('Publier, puis « Revenir en édition » refusé tant qu’un abonné est en cours ; affecter à un abonné', async () => {
    const port = creerFauxPortDonnees();
    const { programme } = await programmeAvecSeance(port);
    port.definirAbonnesAffectablesPourTest([
      { profilClientId: 'client-sophie', prenom: 'Sophie', initialeNom: 'L' },
    ]);
    port.definirMesClientsPourTest({
      clients: [
        {
          profilClientId: 'client-sophie',
          prenom: 'Sophie',
          nom: 'Lambert',
          offre: 'Suivi complet',
          statut: 'actif',
          badge: 'a_jour',
          badgeN: null,
          semaine: 1,
          semaineEnCours: { lundi: '2026-11-16', faites: 0, prevues: 0 },
          programmeEnCours: false,
          pauseJusquLe: null,
          finAccesLe: null,
        },
      ],
      compteurs: { tous: 1, aRelancer: 0, nouveaux: 0, anciens: 0 },
    });
    await rendre(
      <EcranProgramme programmeId={programme} onRetour={jest.fn()} onOuvrirSeance={jest.fn()} />,
      port,
    );
    await waitFor(() => expect(screen.queryByText('Bas du corps · découverte')).toBeTruthy());
    expect(screen.getByText('Mer')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(screen.queryByText('PUBLIÉ')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Affecter à un abonné' }));
    await waitFor(() => expect(screen.queryByText('Sophie Lambert')).toBeTruthy());
    await fireEvent.press(screen.getByText('Sophie Lambert'));
    await fireEvent.press(screen.getByRole('button', { name: 'Affecter' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Programme affecté. Ses séances apparaissent dans son application.'),
      ).toBeTruthy(),
    );
    expect(port.lireProgrammesPourTest()[0]?.abonnesEnCours).toBe(1);
  });

  it('« Revenir en édition » avec un abonné en cours : le refus du serveur', async () => {
    const port = creerFauxPortDonnees();
    const { programme } = await programmeAvecSeance(port);
    await port.publierProgramme(programme);
    await port.affecterProgramme(programme, 'client-sophie', '2026-11-18');
    await rendre(
      <EcranProgramme programmeId={programme} onRetour={jest.fn()} onOuvrirSeance={jest.fn()} />,
      port,
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Revenir en édition' })).toBeTruthy(),
    );
    expect(screen.getByText('1 séance · 1 abonné en cours')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Revenir en édition' }));
    await waitFor(() =>
      expect(screen.queryByText('Des abonnés suivent ce programme')).toBeTruthy(),
    );
  });

  // Trouvé dans le navigateur : le titre s'enregistre en quittant le champ ; toucher aussitôt une
  // durée, pendant cet enregistrement, ne doit pas perdre le geste.
  it('Un programme : taper un titre puis toucher une durée enregistre les deux', async () => {
    const port = creerFauxPortDonnees();
    const cree = await port.creerProgramme();
    if (cree.issue !== 'ok') throw new Error('préparation');
    const original = port.modifierProgramme.bind(port);
    let libererPremier: () => void = () => {};
    const appels = jest.spyOn(port, 'modifierProgramme').mockImplementationOnce(
      (...args) =>
        new Promise((resoudre) => {
          libererPremier = () => void original(...args).then(resoudre);
        }),
    );
    await rendre(
      <EcranProgramme programmeId={cree.valeur} onRetour={jest.fn()} onOuvrirSeance={jest.fn()} />,
      port,
    );
    await waitFor(() => expect(screen.queryByLabelText('Titre')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Titre'), 'Remise en route');
    await fireEvent(screen.getByLabelText('Titre'), 'blur');
    await fireEvent.press(screen.getByText('2'));
    libererPremier();
    await waitFor(() => expect(appels).toHaveBeenCalledTimes(2));
    expect(appels).toHaveBeenLastCalledWith(cree.valeur, 'Remise en route', 2);
    await waitFor(() =>
      expect(port.lireProgrammesPourTest()[0]).toMatchObject({
        titre: 'Remise en route',
        dureeSemaines: 2,
      }),
    );
  });

  it('Règles : un coach non vérifié ne publie pas', async () => {
    const port = creerFauxPortDonnees();
    const { programme } = await programmeAvecSeance(port);
    port.definirCoachVerifiePourTest(false);
    await rendre(
      <EcranProgramme programmeId={programme} onRetour={jest.fn()} onOuvrirSeance={jest.fn()} />,
      port,
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Publier' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() =>
      expect(screen.queryByText('Ton identité n’est pas encore vérifiée')).toBeTruthy(),
    );
  });

  it('Une séance : titre, durée et jour enregistrés ; un exercice ajouté avec son média, monté, supprimé', async () => {
    const port = creerFauxPortDonnees();
    const { programme, seance } = await programmeAvecSeance(port);
    await port.deposerMedia({
      uri: 'file://demo.mp4',
      nom: 'squat.mp4',
      typeMime: 'video/mp4',
      poidsOctets: 2_000_000,
    });
    await port.ajouterExercice(seance, {
      nom: 'Échauffement',
      series: null,
      repetitions: null,
      chargeGrammes: null,
      consigne: '',
    });
    await rendre(
      <EcranSeance programmeId={programme} seanceId={seance} onRetour={jest.fn()} />,
      port,
    );
    await waitFor(() => expect(screen.queryByText('Semaine 1 · Mer')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    await fireEvent.changeText(screen.getByLabelText('Nom'), 'Squat gobelet');
    await fireEvent.changeText(screen.getByLabelText('Séries'), '3');
    await fireEvent.changeText(screen.getByLabelText('Répétitions'), '12');
    await fireEvent.changeText(screen.getByLabelText('Charge (kg)'), '12,5');
    await fireEvent.press(screen.getByText('squat.mp4'));
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(screen.queryByText('3 × 12 · 12,5 kg')).toBeTruthy());
    expect(screen.getByText('Vidéo · squat.mp4')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Monter Squat gobelet' }));
    await waitFor(async () =>
      expect((await port.lireExercices(seance)).map((e) => e.nom)).toEqual([
        'Squat gobelet',
        'Échauffement',
      ]),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer Échauffement' }));
    await waitFor(async () =>
      expect((await port.lireExercices(seance)).map((e) => e.nom)).toEqual(['Squat gobelet']),
    );

    await fireEvent.changeText(screen.getByLabelText('Titre'), 'Haut du corps');
    await fireEvent.press(screen.getByText('Ven'));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer la séance' }));
    await waitFor(async () =>
      expect((await port.lireSeancesDuProgramme(programme))[0]).toMatchObject({
        titre: 'Haut du corps',
        jourRelatif: 5,
      }),
    );
  });

  it('Règles : une séance d’un programme publié est en lecture seule', async () => {
    const port = creerFauxPortDonnees();
    const { programme, seance } = await programmeAvecSeance(port);
    await port.publierProgramme(programme);
    await rendre(
      <EcranSeance programmeId={programme} seanceId={seance} onRetour={jest.fn()} />,
      port,
    );
    await waitFor(() =>
      expect(screen.queryByText('Bas du corps · découverte · 42 min')).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: 'Ajouter un exercice' })).toBeNull();
    expect(screen.queryByLabelText('Titre')).toBeNull();
  });

  it('Bibliothèque : vide, puis un média ajouté ; trop lourd ou d’un autre type, refusé avant l’envoi', async () => {
    const port = creerFauxPortDonnees();
    const choix = jest
      .fn()
      .mockResolvedValueOnce({
        uri: 'file://a.png',
        nom: 'gainage.png',
        typeMime: 'image/png',
        poidsOctets: 300_000,
      })
      .mockResolvedValueOnce({
        uri: 'file://b.mp4',
        nom: 'long.mp4',
        typeMime: 'video/mp4',
        poidsOctets: 60 * 1024 * 1024,
      })
      .mockResolvedValueOnce({
        uri: 'file://c.gif',
        nom: 'anim.gif',
        typeMime: 'image/gif',
        poidsOctets: 1000,
      });
    await rendre(<EcranBibliotheque onRetour={jest.fn()} choisirFichier={choix} />, port);
    await waitFor(() => expect(screen.queryByText('Aucun média pour l’instant.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un média' }));
    await waitFor(() => expect(screen.queryByText('gainage.png')).toBeTruthy());
    expect(screen.getByText('Image · 293 Ko')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un média' }));
    await waitFor(() =>
      expect(screen.queryByText('Ce fichier est trop lourd (50 Mo au plus).')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un média' }));
    await waitFor(() =>
      expect(screen.queryByText('Ce type de fichier n’est pas accepté.')).toBeTruthy(),
    );
    expect((await port.lireMesMedias()).length).toBe(1);
  });
});
