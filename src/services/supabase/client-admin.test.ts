// Le client du back-office (L2-10) : session en mémoire, comme l'application (décidé le 12
// novembre 2026 : « un examinateur lit des pièces d'identité »). Jusque-là, aucun `storage` n'était
// donné à createClient — supabase-js prenait alors le localStorage du navigateur par défaut,
// malgré le commentaire du fichier qui affirmait l'inverse.
const mockCreerClient = jest.fn((..._args: unknown[]) => ({ auth: {} }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreerClient(...args),
}));

type OptionsAuth = {
  storage?: {
    getItem(c: string): Promise<string | null> | string | null;
    setItem(c: string, v: string): Promise<void> | void;
  };
  storageKey?: string;
  persistSession?: boolean;
};

function chargerOptions(): OptionsAuth {
  jest.resetModules();
  mockCreerClient.mockClear();
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ADMIN_ANON_KEY = 'cle-admin-test';
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- doit suivre jest.resetModules()
  require('./client-admin');
  const options = mockCreerClient.mock.calls[0]?.[2] as { auth: OptionsAuth };
  return options.auth;
}

describe('client du back-office : session en mémoire', () => {
  it('reçoit un stockage qui garde la session le temps de la page', async () => {
    const auth = chargerOptions();
    expect(auth.storage).toBeDefined();
    await auth.storage!.setItem('cle', 'session');
    expect(await auth.storage!.getItem('cle')).toBe('session');
  });

  it('n’écrit jamais dans localStorage ni sessionStorage', async () => {
    const espion = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
    const globale = globalThis as { localStorage?: unknown; sessionStorage?: unknown };
    const avant = { l: globale.localStorage, s: globale.sessionStorage };
    globale.localStorage = espion;
    globale.sessionStorage = espion;
    try {
      const auth = chargerOptions();
      await auth.storage!.setItem('cle', 'session');
      await auth.storage!.getItem('cle');
      expect(espion.setItem).not.toHaveBeenCalled();
      expect(espion.getItem).not.toHaveBeenCalled();
    } finally {
      globale.localStorage = avant.l;
      globale.sessionStorage = avant.s;
    }
  });

  // Même projet que l'application, donc même clé de stockage par défaut (« sb-<projet>-auth-token ») :
  // une clé propre évite que les deux clients se répondent l'un à l'autre dans la même page.
  it('a sa propre clé de stockage, distincte de celle de l’application', () => {
    const auth = chargerOptions();
    expect(auth.storageKey).toBeDefined();
    expect(auth.storageKey).not.toMatch(/^sb-/);
  });
});
