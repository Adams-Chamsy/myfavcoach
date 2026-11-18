import { signInAsync } from 'expo-apple-authentication';
import { openAuthSessionAsync, WebBrowserResultType } from 'expo-web-browser';
import { TextEncoder as Encodeur } from 'node:util';
import { webcrypto } from 'node:crypto';
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
      signInWithOAuth: jest.fn(),
      signInWithIdToken: jest.fn(),
      linkIdentity: jest.fn(),
      signOut: jest.fn(),
      resend: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
  },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  WebBrowserResultType: { CANCEL: 'cancel' },
}));
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { EMAIL: 1 },
  signInAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockResolvedValue('nonce-hache'),
  randomUUID: jest.fn().mockReturnValue('nonce-brut'),
}));
jest.mock('./options-sociales', () => ({ optionsSociales: { google: true, apple: true } }));

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

  describe('connexion sociale', () => {
    const ouvrir = jest.mocked(openAuthSessionAsync);
    const retour = 'myfavcoach://auth/social';
    const autorisation = {
      data: { url: 'https://connexion.example.test', flowId: 'flux-1' },
      error: null,
    };

    beforeEach(() => {
      const restauration: (() => void)[] = [];
      for (const [nom, valeur] of [
        ['crypto', webcrypto],
        ['TextEncoder', Encodeur],
      ] as const) {
        const avant = Object.getOwnPropertyDescriptor(globalThis, nom);
        Object.defineProperty(globalThis, nom, { configurable: true, value: valeur });
        restauration.push(() => {
          if (avant) Object.defineProperty(globalThis, nom, avant);
          else Reflect.deleteProperty(globalThis, nom);
        });
      }
      restaurerGlobals = () => restauration.forEach((restaurer) => restaurer());
      auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
      auth.signInWithOAuth.mockResolvedValue(autorisation);
      auth.linkIdentity.mockResolvedValue(autorisation);
      auth.exchangeCodeForSession.mockResolvedValue({
        data: { session: sessionSupabaseFausse() },
        error: null,
      });
    });

    let restaurerGlobals: () => void;
    afterEach(() => restaurerGlobals());

    it('ouvre Google puis échange seulement le code reçu sur le retour prévu et dans le flux ouvert', async () => {
      ouvrir.mockResolvedValue({ type: 'success', url: retour + '?code=code-google' });
      await expect(portAuthSupabase.connexionSociale('google', 'connexion')).resolves.toBe(
        'reussie',
      );
      expect(auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: retour, skipBrowserRedirect: true },
      });
      expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('code-google', { flowId: 'flux-1' });
    });

    it('une annulation ou un autre retour n’établit aucune session', async () => {
      ouvrir.mockResolvedValueOnce({ type: WebBrowserResultType.CANCEL });
      await expect(portAuthSupabase.connexionSociale('google', 'connexion')).resolves.toBe(
        'annulee',
      );
      ouvrir.mockResolvedValueOnce({ type: 'success', url: 'myfavcoach://auth/autre?code=code' });
      await expect(portAuthSupabase.connexionSociale('google', 'connexion')).resolves.toBe('echec');
      expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('associe Apple à la session ouverte avec un nonce et refuse si le compte a changé', async () => {
      const ouvrirApple = jest.mocked(signInAsync);
      ouvrirApple.mockResolvedValue({ identityToken: 'jeton-apple' } as Awaited<
        ReturnType<typeof signInAsync>
      >);
      auth.linkIdentity.mockResolvedValue({
        data: { session: sessionSupabaseFausse() },
        error: null,
      });
      auth.getSession.mockResolvedValue({
        data: { session: sessionSupabaseFausse() },
        error: null,
      });
      await expect(portAuthSupabase.connexionSociale('apple', 'liaison')).resolves.toBe('reussie');
      expect(ouvrirApple).toHaveBeenCalledWith({ nonce: 'nonce-hache', requestedScopes: [1] });
      expect(auth.linkIdentity).toHaveBeenCalledWith({
        provider: 'apple',
        token: 'jeton-apple',
        nonce: 'nonce-brut',
      });
      expect(auth.signInWithIdToken).not.toHaveBeenCalled();
      auth.linkIdentity.mockClear();
      auth.getSession.mockResolvedValueOnce({
        data: { session: sessionSupabaseFausse() },
        error: null,
      });
      auth.getSession.mockResolvedValueOnce({
        data: { session: sessionSupabaseFausse('autre-compte') },
        error: null,
      });
      await expect(portAuthSupabase.connexionSociale('apple', 'liaison')).resolves.toBe('echec');
      expect(auth.linkIdentity).not.toHaveBeenCalled();
    });
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
      // emailRedirectTo : sans lui, GoTrue retombe sur site_url plutôt que sur le lien profond
      // de vérification — trouvé à P1.9, voir le commentaire en tête de ./supabase.ts.
      expect(auth.signUp).toHaveBeenCalledWith({
        email: 'camille@exemple.fr',
        password: 'un-mot-de-passe',
        options: {
          data: { date_naissance: '2000-01-01', cgu_version_acceptee: '2026-09-04' },
          emailRedirectTo: 'myfavcoach://auth/rappel',
        },
      });
    });

    // D — la porte coach (L1-01) : l'intention part dans les métadonnées d'inscription, comme
    // jeton_invitation (L3bis) — elles survivent à la vérification de l'adresse, et à un
    // changement d'appareil, ce qu'aucune mémoire locale ne ferait.
    it('porte coach : l’intention part dans les métadonnées, en snake_case', async () => {
      auth.signUp.mockResolvedValue({ data: {}, error: null });

      await portAuthSupabase.inscrire(
        'camille@exemple.fr',
        'un-mot-de-passe',
        '2000-01-01',
        undefined,
        true,
      );

      expect(auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            data: expect.objectContaining({ intention_coach: true }),
          }),
        }),
      );
    });

    it('porte coach : la session rend l’intention lue dans les métadonnées du compte', async () => {
      const avecIntention = sessionSupabaseFausse('compte-2', true);
      auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            ...avecIntention,
            user: { ...avecIntention.user, user_metadata: { intention_coach: true } },
          },
        },
        error: null,
      });

      const resultat = await portAuthSupabase.connecter('camille@exemple.fr', 'bon-mot-de-passe');

      expect(resultat.type === 'connecte' && resultat.session.intentionCoach).toBe(true);
    });

    // Zone NON VÉRIFIÉE (voir le commentaire de traduireErreur dans ./supabase.ts et
    // docs/dette.md) : hypothèse la plus probable sur ce que GoTrue relaie réellement pour un
    // compte refusé par le déclencheur des 18 ans.
    it("hypothèse non vérifiée : 'unexpected_failure' contenant 'majeur' est traduit en age_insuffisant", async () => {
      auth.signUp.mockResolvedValue({
        data: {},
        error: new AuthApiError(
          'Database error saving new user: My Fav Coach est reserve aux majeurs',
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
        erreur: { code: 'age_insuffisant', message: 'My Fav Coach est réservé aux majeurs.' },
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
          intentionCoach: false,
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

  // scope 'local', jamais le défaut ('global') : un bouton "Se déconnecter" ordinaire ne doit
  // fermer QUE cet appareil, pas révoquer toutes les autres sessions (P1.10, trouvé en
  // balayant les appels d'authentification).
  it("deconnecter appelle signOut avec scope 'local', jamais le défaut 'global'", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await portAuthSupabase.deconnecter();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
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

  describe('renvoyerVerification', () => {
    it('appelle resend avec le lien profond de vérification', async () => {
      auth.resend.mockResolvedValue({ data: {}, error: null });

      const resultat = await portAuthSupabase.renvoyerVerification('camille@exemple.fr');

      expect(resultat).toEqual({ succes: true });
      expect(auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'camille@exemple.fr',
        options: { emailRedirectTo: 'myfavcoach://auth/rappel' },
      });
    });
  });

  describe('demanderReinitialisation', () => {
    it('appelle resetPasswordForEmail avec le lien profond de réinitialisation', async () => {
      auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const resultat = await portAuthSupabase.demanderReinitialisation('camille@exemple.fr');

      expect(resultat).toEqual({ succes: true });
      expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('camille@exemple.fr', {
        redirectTo: 'myfavcoach://auth/mot-de-passe',
      });
    });
  });

  describe('changerMotDePasse', () => {
    // docs/ecrans/L1-04-connexion.md : "toutes les autres sessions du compte sont fermées."
    it('change le mot de passe puis ferme les autres sessions, jamais la sienne', async () => {
      auth.updateUser.mockResolvedValue({ data: {}, error: null });
      auth.signOut.mockResolvedValue({ error: null });

      const resultat = await portAuthSupabase.changerMotDePasse('un-nouveau-mot-de-passe');

      expect(resultat).toEqual({ succes: true });
      expect(auth.updateUser).toHaveBeenCalledWith({ password: 'un-nouveau-mot-de-passe' });
      expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
    });

    it("n'appelle jamais signOut si le changement de mot de passe échoue", async () => {
      auth.updateUser.mockResolvedValue({
        data: {},
        error: new AuthApiError('Password should be at least 6 characters', 422, 'weak_password'),
      });

      const resultat = await portAuthSupabase.changerMotDePasse('trop-court');

      expect(resultat.succes).toBe(false);
      expect(auth.signOut).not.toHaveBeenCalled();
    });

    // Best-effort (voir le commentaire de ./supabase.ts) : le mot de passe est déjà changé,
    // un échec de révocation des autres sessions ne doit pas transformer le succès en échec.
    it('reste un succès même si la révocation des autres sessions échoue', async () => {
      auth.updateUser.mockResolvedValue({ data: {}, error: null });
      auth.signOut.mockRejectedValue(new Error('panne réseau'));

      const resultat = await portAuthSupabase.changerMotDePasse('un-nouveau-mot-de-passe');

      expect(resultat).toEqual({ succes: true });
    });
  });

  describe('etablirSessionDepuisLien', () => {
    it('succès : extrait le code et échange contre une session', async () => {
      auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

      const resultat = await portAuthSupabase.etablirSessionDepuisLien(
        'myfavcoach://auth/rappel?code=un-code-reel',
      );

      expect(resultat).toEqual({ succes: true });
      expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('un-code-reel');
    });

    it('lien sans code : erreur générique, aucun appel réseau', async () => {
      const resultat = await portAuthSupabase.etablirSessionDepuisLien('myfavcoach://auth/rappel');

      expect(resultat).toEqual({
        succes: false,
        erreur: { code: 'serveur', message: 'On a un souci de notre côté. Ce n’est pas toi.' },
      });
      expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('lien expiré ou déjà utilisé : traduit en lien_expire', async () => {
      auth.exchangeCodeForSession.mockResolvedValue({
        data: {},
        error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
      });

      const resultat = await portAuthSupabase.etablirSessionDepuisLien(
        'myfavcoach://auth/rappel?code=perime',
      );

      expect(resultat).toEqual({
        succes: false,
        erreur: { code: 'lien_expire', message: 'Ce lien a expiré.' },
      });
    });
  });
});
