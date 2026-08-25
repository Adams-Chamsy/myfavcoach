// jest.resetModules() avant chaque require('./client') : le module est ré-évalué a neuf,
// donc le garde-fou de tete de fichier (exigerVariable) s'execute a nouveau avec les valeurs
// de process.env du moment.
describe('client Supabase — garde-fou de démarrage', () => {
  const urlOriginale = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const cleOriginale = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = urlOriginale;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = cleOriginale;
    jest.resetModules();
  });

  it("s'arrête avec un message nommant EXPO_PUBLIC_SUPABASE_URL quand elle manque", () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'cle-anon-test';

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- un import statique serait charge et mis en cache avant jest.resetModules() ci-dessus ; il faut require() ici, apres la mutation de process.env, pour re-evaluer le garde-fou a neuf.
    expect(() => require('./client')).toThrow('EXPO_PUBLIC_SUPABASE_URL');
  });

  it("s'arrête avec un message nommant EXPO_PUBLIC_SUPABASE_ANON_KEY quand elle manque", () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- voir la premiere occurrence ci-dessus
    expect(() => require('./client')).toThrow('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('ne repose pas sur une chaîne vide en repli silencieux : aucune variable manquante ne passe', () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- voir la premiere occurrence ci-dessus
    expect(() => require('./client')).toThrow(Error);
  });

  it('construit le client sans erreur quand les deux variables sont présentes', () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'cle-anon-test';

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- voir la premiere occurrence ci-dessus
    expect(() => require('./client')).not.toThrow();
  });
});
