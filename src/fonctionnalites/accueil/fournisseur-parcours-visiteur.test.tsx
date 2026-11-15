import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { PortAccueil } from '@/services/accueil/port';
import { FournisseurParcoursVisiteur, useParcoursVisiteur } from './fournisseur-parcours-visiteur';

const COACH = '11111111-2222-4333-8444-555555555555';
function creerPort(): PortAccueil {
  return {
    lire: jest.fn().mockResolvedValue({ marqueVue: false, retourCoach: null }),
    marquerOuvertureVue: jest.fn().mockResolvedValue(undefined),
    enregistrerRetour: jest.fn().mockResolvedValue(undefined),
  };
}
function rendre(port: PortAccueil) {
  return renderHook(useParcoursVisiteur, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <FournisseurParcoursVisiteur port={port}>{children}</FournisseurParcoursVisiteur>
    ),
  });
}

describe('préférences de présentation non bloquantes', () => {
  afterEach(() => jest.useRealTimers());
  it('une lecture qui ne répond pas ne bloque pas l’application', async () => {
    jest.useFakeTimers();
    const port = creerPort();
    port.lire = () => new Promise(() => {});
    const { result } = await rendre(port);
    await act(() => jest.advanceTimersByTimeAsync(800));
    expect(result.current.chargement).toBe(false);
    expect(result.current.marqueVue).toBe(true);
  });
  it('une panne du stockage conserve un parcours utilisable en mémoire', async () => {
    const port = creerPort();
    port.lire = jest.fn().mockRejectedValue(new Error('indisponible'));
    port.enregistrerRetour = jest.fn().mockRejectedValue(new Error('indisponible'));
    const { result } = await rendre(port);
    await waitFor(() => expect(result.current.chargement).toBe(false));
    await act(() => result.current.retenirCoach(COACH));
    expect(result.current.retourCoach?.coachId).toBe(COACH);
    await act(() => result.current.oublierRetour());
    expect(result.current.retourCoach).toBeNull();
  });
  it('la lecture tardive ne remplace pas le profil choisi pendant le chargement', async () => {
    let finir!: (valeur: Awaited<ReturnType<PortAccueil['lire']>>) => void;
    const port = creerPort();
    port.lire = () =>
      new Promise((resolve) => {
        finir = resolve;
      });
    const { result } = await rendre(port);
    await act(() => result.current.retenirCoach(COACH));
    await act(() => finir({ marqueVue: false, retourCoach: null }));
    expect(result.current.retourCoach?.coachId).toBe(COACH);
  });
  it('une fois la signature terminée, les ouvertures suivantes sont mémorisées', async () => {
    const port = creerPort();
    const { result } = await rendre(port);
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.marqueVue).toBe(false);
    await act(() => result.current.terminerOuverture());
    expect(result.current.marqueVue).toBe(true);
    await waitFor(() => expect(port.marquerOuvertureVue).toHaveBeenCalledTimes(1));
  });
  it('annuler après une écriture lente ne restaure jamais l’ancien retour', async () => {
    let finir!: () => void;
    const valeurs: unknown[] = [];
    let nombre = 0;
    const port = creerPort();
    port.enregistrerRetour = async (retour) => {
      valeurs.push(retour);
      nombre++;
      if (nombre === 1)
        await new Promise<void>((resolve) => {
          finir = resolve;
        });
    };
    const { result } = await rendre(port);
    await waitFor(() => expect(result.current.chargement).toBe(false));
    await act(() => result.current.retenirCoach(COACH));
    await act(() => result.current.oublierRetour());
    expect(result.current.retourCoach).toBeNull();
    await act(() => finir());
    await waitFor(() => expect(valeurs).toHaveLength(2));
    expect(valeurs[1]).toBeNull();
  });
});
