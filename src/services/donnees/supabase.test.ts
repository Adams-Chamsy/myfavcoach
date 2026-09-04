import { supabase } from '@/services/supabase/client';
import { portDonneesSupabase } from './supabase';

// Doublure du client réel, même principe que src/services/auth/supabase.test.ts : ce test
// vérifie la COMPOSITION de portDonneesSupabase (trois appels, un seul résultat), pas le
// client Supabase lui-même (déjà testé par src/services/supabase/client.test.ts).
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

function tableAvecResultat(donnees: unknown[] | null, erreur: unknown = null) {
  return { select: () => ({ limit: () => Promise.resolve({ data: donnees, error: erreur }) }) };
}

const supabaseMock = supabase as unknown as {
  rpc: jest.Mock;
  from: jest.Mock;
};

describe('portDonneesSupabase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('compose profilActif et les deux existences en un seul EtatProfils', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'client', error: null });
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'profils_client') return tableAvecResultat([{ id: 'p-client' }]);
      if (table === 'profils_coach') return tableAvecResultat([]);
      throw new Error(`table inattendue dans ce test : ${table}`);
    });

    const resultat = await portDonneesSupabase.lireEtatProfils();

    expect(resultat).toEqual({ profilActif: 'client', clientExiste: true, coachExiste: false });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('profil_actif_courant');
  });

  it('un compte sans aucun profil rend clientExiste et coachExiste à false', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'client', error: null });
    supabaseMock.from.mockImplementation(() => tableAvecResultat([]));

    const resultat = await portDonneesSupabase.lireEtatProfils();

    expect(resultat).toEqual({ profilActif: 'client', clientExiste: false, coachExiste: false });
  });

  it('relance une erreur RPC plutôt que de la faire disparaître en silence', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: new Error('panne RPC') });
    supabaseMock.from.mockImplementation(() => tableAvecResultat([]));

    await expect(portDonneesSupabase.lireEtatProfils()).rejects.toThrow('panne RPC');
  });

  it('relance une erreur de lecture profils_client', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'client', error: null });
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'profils_client') return tableAvecResultat(null, new Error('panne REST'));
      return tableAvecResultat([]);
    });

    await expect(portDonneesSupabase.lireEtatProfils()).rejects.toThrow('panne REST');
  });
});
