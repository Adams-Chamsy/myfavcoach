import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { supabase } from '@/services/supabase/client';
import { portAuthSupabase } from './supabase';

// Doublure du client réel : ce test vérifie la TRADUCTION d'erreur de portAuthSupabase, pas le
// client Supabase lui-même (déjà testé par src/services/supabase/client.test.ts). babel-jest
// hoisse jest.mock() au-dessus des imports au moment de la compilation, quel que soit l'ordre
// écrit ici : le mock est donc bien en place avant que ./supabase ne soit chargé.
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resend: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

const auth = supabase.auth as unknown as Record<string, jest.Mock>;

function sessionSupabaseFausse(compteId = 'compte-1', emailConfirme = true) {
  return {
    access_token: `jeton-acces-${compteId}`,
    refresh_token: `jeton-rafraichissement-${compteId}`,
    user: {
      id: compteId,
      email: 'camille@exemple.fr',
      email_confirmed_at: emailConfirme ? '2026-01-01T00:00:00Z' : null,
    },
  };
}

describe('portAuthSupabase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('inscrire', () => {
    it('succès : aucune erreur remontée', async () => {
      auth.signUp.mockResolvedValue({ data: {}, error: null });

      const resultat = await portAuthSupabase.inscrire(
        'camille@exemple.fr',
        'un-mot-de-passe',
        '2000-01-01',
      );

      expect(resultat).toEqual({ succes: true });
      expect(auth.signUp).toHaveBeenCalledWith({
        email: 'camille@exemple.fr',
        password: 'un-mot-de-passe',
        options: { data: { dateNaissance: '2000-01-01' } },
      });
    });

    // Zone NON VÉRIFIÉE (voir le commentaire de traduireErreur dans ./supabase.ts et
    // docs/dette.md) : hypothèse la plus probable sur ce que GoTrue relaie réellement pour un
    // compte refusé par le déclencheur des 18 ans.
    it("hypothèse non vérifiée : 'unexpected_failure' contenant 'majeur' est traduit en age_insuffisant", async () => {
      auth.signUp.mockResolvedValue({
        data: {},
        error: new AuthApiError(
          'Database error saving new user: My fav Coach est reserve aux majeurs',
          500,
          'unexpected_failure',
        ),
      });

      const resultat = await portAuthSupabase.inscrire(
        'mineur@exemple.fr',
        'un-mot-de-passe',
        '2015-01-01',
      );

      expect(resultat).toEqual({
        succes: false,
        erreur: { code: 'age_insuffisant', message: 'My fav Coach est réservé aux majeurs.' },
      });
    });

    it("un 'unexpected_failure' SANS trace du déclencheur retombe sur 'serveur', jamais sur 'age_insuffisant' par excès de confiance", async () => {
      auth.signUp.mockResolvedValue({
        data: {},
        error: new AuthApiError('Database error saving new user', 500, 'unexpected_failure'),
      });

      const resultat = await portAuthSupabase.inscrire(
        'quelconque@exemple.fr',
        'un-mot-de-passe',
        '2000-01-01',
      );

      expect(resultat).toEqual({
        succes: false,
        erreur: { code: 'serveur', message: 'On a un souci de notre côté. Ce n’est pas toi.' },
      });
    });

    it('panne réseau traduite en reseau', async () => {
      auth.signUp.mockResolvedValue({
        data: {},
        error: new AuthRetryableFetchError('Network request failed', 0),
      });

      const resultat = await portAuthSupabase.inscrire(
        'camille@exemple.fr',
        'un-mot-de-passe',
        '2000-01-01',
      );

      expect(resultat).toEqual({
        succes: false,
        erreur: { code: 'reseau', message: 'Pas de connexion. Réessaie.' },
      });
    });
  });

  describe('connecter', () => {
    it('succès : rend la session traduite', async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: sessionSupabaseFausse('compte-1', true) },
        error: null,
      });

      const resultat = await portAuthSupabase.connecter('camille@exemple.fr', 'bon-mot-de-passe');

      expect(resultat).toEqual({
        type: 'connecte',
        session: {
          compteId: 'compte-1',
          email: 'camille@exemple.fr',
          emailVerifie: true,
          jetonAcces: 'jeton-acces-compte-1',
          jetonRafraichissement: 'jeton-rafraichissement-compte-1',
        },
      });
    });

    it('identifiants invalides : message unique, jamais lequel des deux champs est en cause', async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
      });

      const resultat = await portAuthSupabase.connecter('camille@exemple.fr', 'mauvais');

      expect(resultat).toEqual({
        type: 'echec',
        erreur: { code: 'identifiants_invalides', message: 'Adresse ou mot de passe incorrect.' },
      });
    });

    // docs/ecrans/L1-04-connexion.md : "n'est pas rejeté... arrive sur L1-03", jamais un échec.
    it('email non confirmé : ni succès ni échec, une troisième issue nommée', async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'),
      });

      const resultat = await portAuthSupabase.connecter('camille@exemple.fr', 'bon-mot-de-passe');

      expect(resultat).toEqual({ type: 'email_non_verifie' });
    });

    it('limite de débit traduite', async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'),
      });

      const resultat = await portAuthSupabase.connecter('camille@exemple.fr', 'un-mot-de-passe');

      expect(resultat).toEqual({
        type: 'echec',
        erreur: { code: 'limite_debit', message: 'Trop d’essais. Réessaie dans quelques minutes.' },
      });
    });
  });

  it('deconnecter appelle signOut', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await portAuthSupabase.deconnecter();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('sessionCourante rend null sans session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await portAuthSupabase.sessionCourante()).toBeNull();
  });

  it('sessionCourante traduit la session existante', async () => {
    auth.getSession.mockResolvedValue({ data: { session: sessionSupabaseFausse() } });
    const session = await portAuthSupabase.sessionCourante();
    expect(session?.compteId).toBe('compte-1');
  });

  it('surChangementDeSession relaie les évènements traduits et se désabonne', () => {
    const desabonner = jest.fn();
    auth.onAuthStateChange.mockImplementation((callback: (e: string, s: unknown) => void) => {
      (auth.onAuthStateChange as unknown as { _callback: typeof callback })._callback = callback;
      return { data: { subscription: { unsubscribe: desabonner } } };
    });

    const ecouteur = jest.fn();
    const arreter = portAuthSupabase.surChangementDeSession(ecouteur);

    const callback = (
      auth.onAuthStateChange as unknown as { _callback: (e: string, s: unknown) => void }
    )._callback;
    callback('SIGNED_IN', sessionSupabaseFausse());
    expect(ecouteur).toHaveBeenCalledWith(expect.objectContaining({ compteId: 'compte-1' }));

    callback('SIGNED_OUT', null);
    expect(ecouteur).toHaveBeenLastCalledWith(null);

    arreter();
    expect(desabonner).toHaveBeenCalledTimes(1);
  });
});
