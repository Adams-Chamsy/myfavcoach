import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { creerFauxPortAuth } from '@/services/auth/faux';
import type { PortAuth, SessionAuth } from '@/services/auth/port';
import { FournisseurSession, useSession } from './fournisseur-session';

const MAJEUR = '2000-01-01';

function envelopper(port: PortAuth) {
  return function Enveloppe({ children }: { children: ReactNode }) {
    return <FournisseurSession port={port}>{children}</FournisseurSession>;
  };
}

describe('useSession', () => {
  it('leve une erreur explicite hors de FournisseurSession', async () => {
    const consoleErreur = jest.spyOn(console, 'error').mockImplementation(() => {});

    function ComposantSonde() {
      useSession();
      return null;
    }

    await expect(render(<ComposantSonde />)).rejects.toThrow(
      'useSession doit être appelé à l’intérieur de <FournisseurSession>.',
    );

    consoleErreur.mockRestore();
  });

  it('commence en chargement, puis rend null sans session', async () => {
    const port = creerFauxPortAuth();
    const { result } = await renderHook(() => useSession(), { wrapper: envelopper(port) });

    await waitFor(() => {
      expect(result.current.chargement).toBe(false);
    });
    expect(result.current.session).toBeNull();
  });

  it('rend la session déjà active au montage', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    port.verifierEmailPourTest('camille@exemple.fr');
    const connexion = await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');
    if (connexion.type !== 'connecte') throw new Error('préparation du test invalide');

    const { result } = await renderHook(() => useSession(), { wrapper: envelopper(port) });

    await waitFor(() => {
      expect(result.current.chargement).toBe(false);
    });
    expect(result.current.session?.email).toBe('camille@exemple.fr');
  });

  it('se met à jour quand le port notifie une connexion puis une déconnexion', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    port.verifierEmailPourTest('camille@exemple.fr');

    const { result } = await renderHook(() => useSession(), { wrapper: envelopper(port) });
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.session).toBeNull();

    await act(async () => {
      await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');
    });
    expect(result.current.session?.email).toBe('camille@exemple.fr');

    await act(async () => {
      await port.deconnecter();
    });
    expect(result.current.session).toBeNull();
  });

  it('se désabonne du port au démontage', async () => {
    const desabonner = jest.fn();
    const portControle: PortAuth = {
      inscrire: jest.fn(),
      connecter: jest.fn(),
      deconnecter: jest.fn(),
      renvoyerVerification: jest.fn(),
      demanderReinitialisation: jest.fn(),
      changerMotDePasse: jest.fn(),
      changerEmail: jest.fn(),
      sessionCourante: jest.fn().mockResolvedValue(null satisfies SessionAuth | null),
      surChangementDeSession: jest.fn().mockReturnValue(desabonner),
      etablirSessionDepuisLien: jest.fn(),
    };

    const { result, unmount } = await renderHook(() => useSession(), {
      wrapper: envelopper(portControle),
    });
    await waitFor(() => expect(result.current.chargement).toBe(false));

    await unmount();

    expect(desabonner).toHaveBeenCalledTimes(1);
  });

  // Sans ce repli, un sessionCourante() qui rejette bloquerait indéfiniment le démarrage à
  // froid (app/index.tsx) sur l'écran d'attente : chargement doit se résoudre quand même.
  it('un sessionCourante() qui rejette résout quand même chargement, avec session null', async () => {
    const portControle: PortAuth = {
      inscrire: jest.fn(),
      connecter: jest.fn(),
      deconnecter: jest.fn(),
      renvoyerVerification: jest.fn(),
      demanderReinitialisation: jest.fn(),
      changerMotDePasse: jest.fn(),
      changerEmail: jest.fn(),
      sessionCourante: jest.fn().mockRejectedValue(new Error('lecture impossible')),
      surChangementDeSession: jest.fn().mockReturnValue(() => {}),
      etablirSessionDepuisLien: jest.fn(),
    };

    const { result } = await renderHook(() => useSession(), { wrapper: envelopper(portControle) });

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.session).toBeNull();
  });
});
