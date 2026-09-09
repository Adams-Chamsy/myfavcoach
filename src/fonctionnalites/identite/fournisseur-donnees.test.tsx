import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { creerFauxPortAuth } from '@/services/auth/faux';
import type { PortAuth } from '@/services/auth/port';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { EtatProfils, InformationsCompte, PortDonnees } from '@/services/donnees/port';
import { FournisseurDonnees, useDonnees } from './fournisseur-donnees';
import { FournisseurSession } from './fournisseur-session';

const MAJEUR = '2000-01-01';

function envelopper(portAuth: PortAuth, portDonnees: PortDonnees) {
  return function Enveloppe({ children }: { children: ReactNode }) {
    return (
      <FournisseurSession port={portAuth}>
        <FournisseurDonnees port={portDonnees}>{children}</FournisseurDonnees>
      </FournisseurSession>
    );
  };
}

async function compteConnecteEtVerifie(portAuth: ReturnType<typeof creerFauxPortAuth>) {
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  const connexion = await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  if (connexion.type !== 'connecte') throw new Error('préparation du test invalide');
}

describe('useDonnees', () => {
  it('leve une erreur explicite hors de FournisseurDonnees', async () => {
    const consoleErreur = jest.spyOn(console, 'error').mockImplementation(() => {});

    function ComposantSonde() {
      useDonnees();
      return null;
    }

    await expect(render(<ComposantSonde />)).rejects.toThrow(
      'useDonnees doit être appelé à l’intérieur de <FournisseurDonnees>.',
    );

    consoleErreur.mockRestore();
  });

  // P1.11 : les écrans d'onboarding ont besoin d'écrire (creerProfilClient, etc.), pas
  // seulement de lire — port doit donc être atteignable, même pendant le chargement de la
  // lecture initiale (l'injection du port, elle, est synchrone). Depuis P1.15, `port` est typé
  // PortDonneesLecture : les trois écritures d'EtatProfils n'y sont plus, elles ont leur propre
  // enveloppe sur le contexte (voir le describe plus bas).
  it('expose le port injecté, y compris pendant le chargement', async () => {
    const portAuth = creerFauxPortAuth();
    const portDonnees = creerFauxPortDonnees();

    const { result } = await renderHook(() => useDonnees(), {
      wrapper: envelopper(portAuth, portDonnees),
    });

    expect(result.current.port).toBe(portDonnees);
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.port).toBe(portDonnees);
  });

  // Aucun appel réseau tant qu'aucune session vérifiée n'existe (même discipline que
  // docs/ecrans/L1-03-verification-email.md) : jamais interrogé, profils reste null.
  it('sans session, ne lit jamais le port : profils reste null, chargement se résout', async () => {
    const portAuth = creerFauxPortAuth();
    const portDonnees = creerFauxPortDonnees();
    const espionLecture = jest.spyOn(portDonnees, 'lireEtatProfils');

    const { result } = await renderHook(() => useDonnees(), {
      wrapper: envelopper(portAuth, portDonnees),
    });

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.profils).toBeNull();
    expect(espionLecture).not.toHaveBeenCalled();
  });

  it('avec une session vérifiée, lit et expose les profils', async () => {
    const portAuth = creerFauxPortAuth();
    await compteConnecteEtVerifie(portAuth);
    const portDonnees = creerFauxPortDonnees();
    const etatAttendu: EtatProfils = etatProfilsParDefaut({
      profilActif: 'coach',
      clientExiste: true,
      clientOnboardingEtape: 5,
      coachExiste: true,
    });
    portDonnees.definirEtatProfilsPourTest(etatAttendu);

    const { result } = await renderHook(() => useDonnees(), {
      wrapper: envelopper(portAuth, portDonnees),
    });

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.profils).toEqual(etatAttendu);
  });

  it('une lecture qui échoue résout quand même chargement, avec profils null', async () => {
    const portAuth = creerFauxPortAuth();
    await compteConnecteEtVerifie(portAuth);
    const portDonnees = creerFauxPortDonnees();
    jest.spyOn(portDonnees, 'lireEtatProfils').mockRejectedValue(new Error('panne réseau'));

    const { result } = await renderHook(() => useDonnees(), {
      wrapper: envelopper(portAuth, portDonnees),
    });

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.profils).toBeNull();
  });

  it('ne relit pas au simple rafraîchissement de jeton (même compteId, même emailVerifie)', async () => {
    const portAuth = creerFauxPortAuth();
    await compteConnecteEtVerifie(portAuth);
    const portDonnees = creerFauxPortDonnees();
    const espionLecture = jest.spyOn(portDonnees, 'lireEtatProfils');

    await renderHook(() => useDonnees(), { wrapper: envelopper(portAuth, portDonnees) });
    await waitFor(() => expect(espionLecture).toHaveBeenCalledTimes(1));

    // Simule une notification du port d'auth qui ne change rien de pertinent (même session).
    await act(async () => {
      await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
    });

    expect(espionLecture).toHaveBeenCalledTimes(1);
  });

  // Preuve directe de la course évitée par le calcul dérivé de `etat` (voir le commentaire de
  // fournisseur-donnees.tsx, ResultatLecture) : sans lui, un rendu intermédiaire pourrait
  // annoncer chargement=false avec les profils de l'ANCIEN compte pendant que ceux du nouveau
  // sont encore en vol.
  it('lors du changement de compte, redevient chargement tant que les nouveaux profils ne sont pas arrivés — jamais les profils du compte précédent', async () => {
    const portAuth = creerFauxPortAuth();
    await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    portAuth.verifierEmailPourTest('camille@exemple.fr');
    await portAuth.inscrire('dominique@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    portAuth.verifierEmailPourTest('dominique@exemple.fr');

    const portDonnees = creerFauxPortDonnees();
    let resoudreDeuxiemeLecture: (etat: EtatProfils) => void = () => {};
    const lecture = jest.spyOn(portDonnees, 'lireEtatProfils');
    lecture.mockResolvedValueOnce(
      etatProfilsParDefaut({
        profilActif: 'client',
        clientExiste: true,
        clientOnboardingEtape: 5,
        coachExiste: false,
      }),
    );
    lecture.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resoudreDeuxiemeLecture = resolve;
        }),
    );

    await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
    const { result } = await renderHook(() => useDonnees(), {
      wrapper: envelopper(portAuth, portDonnees),
    });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.profils?.clientExiste).toBe(true);

    await act(async () => {
      await portAuth.deconnecter();
      await portAuth.connecter('dominique@exemple.fr', 'bon-mot-de-passe');
    });

    // La lecture du nouveau compte est encore en vol : jamais false avec les profils de camille.
    expect(result.current.chargement).toBe(true);
    expect(result.current.profils).toBeNull();

    await act(async () => {
      resoudreDeuxiemeLecture(
        etatProfilsParDefaut({
          profilActif: 'coach',
          clientExiste: false,
          clientOnboardingEtape: null,
          coachExiste: true,
        }),
      );
      await Promise.resolve();
    });

    expect(result.current.chargement).toBe(false);
    expect(result.current.profils?.coachExiste).toBe(true);
  });
});

// La règle de P1.15 (CLAUDE.md §8) : les trois écritures qui changent EtatProfils passent par
// le fournisseur, et APRÈS chacune, l'état lu par un consommateur (`profils`) est à jour SANS
// que l'appelant rafraîchisse à la main. Un test par méthode, jamais un seul générique : c'est
// exactement le motif « ça marche pour deux, on oublie la troisième » qui a créé la dette.
describe('les écritures d’EtatProfils rafraîchissent l’état lu, sans rafraîchir à la main', () => {
  it('creerProfilCoach : profils reflète coachExiste + profilActif coach juste après', async () => {
    const portAuth = creerFauxPortAuth();
    await compteConnecteEtVerifie(portAuth);
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ profilActif: 'client', clientExiste: true, coachExiste: false }),
    );

    const { result } = await renderHook(() => useDonnees(), {
      wrapper: envelopper(portAuth, portDonnees),
    });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.profils?.coachExiste).toBe(false);

    await act(async () => {
      const r = await result.current.creerProfilCoach({
        discipline: 'yoga',
        telephone: '0612345678',
        prenom: 'Camille',
        nom: 'Dupré',
      });
      expect(r.succes).toBe(true);
    });

    expect(result.current.profils?.coachExiste).toBe(true);
    expect(result.current.profils?.profilActif).toBe('coach');
  });

  it('basculerProfil : profils reflète le nouveau profil actif juste après', async () => {
    const portAuth = creerFauxPortAuth();
    await compteConnecteEtVerifie(portAuth);
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ profilActif: 'client', clientExiste: true, coachExiste: true }),
    );

    const { result } = await renderHook(() => useDonnees(), {
      wrapper: envelopper(portAuth, portDonnees),
    });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.profils?.profilActif).toBe('client');

    await act(async () => {
      const r = await result.current.basculerProfil('coach');
      expect(r.succes).toBe(true);
    });

    expect(result.current.profils?.profilActif).toBe('coach');
  });

  it('enregistrerInformations : profils.identiteActive reflète le nouveau prénom juste après', async () => {
    const portAuth = creerFauxPortAuth();
    await compteConnecteEtVerifie(portAuth);
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({
        profilActif: 'client',
        clientExiste: true,
        identiteActive: { prenom: 'Ancien', nom: 'Nom' },
      }),
    );
    const infoClient: InformationsCompte = {
      profil: 'client',
      prenom: 'Ancien',
      nom: 'Nom',
      dateNaissance: '2000-01-01',
    };
    portDonnees.definirInformationsPourTest(infoClient);

    const { result } = await renderHook(() => useDonnees(), {
      wrapper: envelopper(portAuth, portDonnees),
    });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.profils?.identiteActive.prenom).toBe('Ancien');

    await act(async () => {
      const r = await result.current.enregistrerInformations({
        profil: 'client',
        prenom: 'Nouveau',
        nom: 'Nom',
      });
      expect(r.succes).toBe(true);
    });

    expect(result.current.profils?.identiteActive.prenom).toBe('Nouveau');
  });

  it('un échec d’écriture ne rafraîchit pas : profils reste sur l’ancienne valeur', async () => {
    const portAuth = creerFauxPortAuth();
    await compteConnecteEtVerifie(portAuth);
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ profilActif: 'client', clientExiste: true, coachExiste: true }),
    );

    const { result } = await renderHook(() => useDonnees(), {
      wrapper: envelopper(portAuth, portDonnees),
    });
    await waitFor(() => expect(result.current.chargement).toBe(false));

    const relecture = jest.spyOn(portDonnees, 'lireEtatProfils');
    portDonnees.echouerProchaineEcriturePourTest('Panne côté serveur.');

    await act(async () => {
      const r = await result.current.basculerProfil('coach');
      expect(r.succes).toBe(false);
    });

    expect(relecture).not.toHaveBeenCalled();
    expect(result.current.profils?.profilActif).toBe('client');
  });
});
