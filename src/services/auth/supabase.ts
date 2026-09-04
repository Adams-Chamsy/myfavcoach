import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type AuthError,
  type Session as SessionSupabaseJs,
} from '@supabase/supabase-js';

import { supabase } from '@/services/supabase/client';
import type { ErreurAuth, PortAuth, SessionAuth } from './port';

// Liens profonds déclarés dans supabase/config.toml (additional_redirect_urls) : une entrée
// dans cette liste AUTORISE la cible, elle ne la CHOISIT pas — sans `emailRedirectTo`/
// `redirectTo` explicite sur l'appel qui envoie le courriel, GoTrue retombe sur `site_url`
// (`http://127.0.0.1:3000`), jamais sur le lien profond. Trouvé à P1.9 en écrivant
// demanderReinitialisation : inscrire() et renvoyerVerification() avaient le même trou depuis
// P1.8, jamais remarqué faute d'avoir lu un vrai courriel de test (voir docs/dette.md, la zone
// déjà marquée NON VÉRIFIÉE sur `etablirSessionDepuisLien`).
const LIEN_VERIFICATION_EMAIL = 'myfavcoach://auth/rappel';
const LIEN_REINITIALISATION_MOT_DE_PASSE = 'myfavcoach://auth/mot-de-passe';

function versSessionAuth(session: SessionSupabaseJs): SessionAuth {
  return {
    compteId: session.user.id,
    email: session.user.email ?? '',
    emailVerifie: session.user.email_confirmed_at != null,
    jetonAcces: session.access_token,
    jetonRafraichissement: session.refresh_token,
  };
}

// Traduit une erreur supabase-js vers le vocabulaire fermé de docs/ecrans/L1-02 et L1-04.
// Une seule zone d'incertitude, signalée à P1.5 (src/test/rls.banc.ts, commentaire sur le
// déclencheur des 18 ans) : on ne sait pas si GoTrue relaie le message du déclencheur
// (0001_creer_identite.sql, "reserve aux majeurs") ou le remplace par un message générique
// ('unexpected_failure', code documenté par @supabase/auth-js pour toute erreur serveur
// imprévue — une exception de déclencheur en fait clairement partie). NON VÉRIFIÉ : on
// cherche donc la trace du message du déclencheur en plus du code générique, et à défaut on
// retombe sur 'serveur' plutôt que de risquer l'inverse (classer une vraie panne serveur comme
// "moins de 18 ans"). Si cette hypothèse est fausse, l'écran affichera le message générique au
// lieu du message dédié — pas de faille de sécurité, juste moins précis. Voir docs/dette.md :
// à lever quand l'écran L1-02 sera testé sur un vrai appareil, avec une vraie tentative
// mineure contre le projet de développement.
function traduireErreur(erreurBrute: unknown): ErreurAuth {
  if (isAuthRetryableFetchError(erreurBrute)) {
    return { code: 'reseau', message: 'Pas de connexion. Réessaie.' };
  }

  if (isAuthApiError(erreurBrute)) {
    const auth = erreurBrute as AuthError;
    if (auth.code === 'invalid_credentials') {
      return { code: 'identifiants_invalides', message: 'Adresse ou mot de passe incorrect.' };
    }
    if (auth.code === 'over_request_rate_limit' || auth.code === 'over_email_send_rate_limit') {
      return { code: 'limite_debit', message: 'Trop d’essais. Réessaie dans quelques minutes.' };
    }
    // docs/ecrans/L1-03-verification-email.md : "un lien expiré ou déjà utilisé".
    if (auth.code === 'otp_expired') {
      return { code: 'lien_expire', message: 'Ce lien a expiré.' };
    }
    // Zone NON VÉRIFIÉE — voir le commentaire de fonction ci-dessus.
    if (auth.code === 'unexpected_failure' && /majeur/i.test(auth.message)) {
      return { code: 'age_insuffisant', message: 'My fav Coach est réservé aux majeurs.' };
    }
  }

  return { code: 'serveur', message: 'On a un souci de notre côté. Ce n’est pas toi.' };
}

export const portAuthSupabase: PortAuth = {
  async inscrire(email, motDePasse, dateNaissance) {
    const { error } = await supabase.auth.signUp({
      email,
      password: motDePasse,
      options: { data: { dateNaissance }, emailRedirectTo: LIEN_VERIFICATION_EMAIL },
    });
    if (error) return { succes: false, erreur: traduireErreur(error) };
    return { succes: true };
  },

  async connecter(email, motDePasse) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (error) {
      if (isAuthApiError(error) && error.code === 'email_not_confirmed') {
        return { type: 'email_non_verifie' };
      }
      return { type: 'echec', erreur: traduireErreur(error) };
    }
    return { type: 'connecte', session: versSessionAuth(data.session) };
  },

  async deconnecter() {
    await supabase.auth.signOut();
  },

  async renvoyerVerification(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: LIEN_VERIFICATION_EMAIL },
    });
    if (error) return { succes: false, erreur: traduireErreur(error) };
    return { succes: true };
  },

  async demanderReinitialisation(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: LIEN_REINITIALISATION_MOT_DE_PASSE,
    });
    if (error) return { succes: false, erreur: traduireErreur(error) };
    return { succes: true };
  },

  async changerMotDePasse(nouveauMotDePasse) {
    const { error } = await supabase.auth.updateUser({ password: nouveauMotDePasse });
    if (error) return { succes: false, erreur: traduireErreur(error) };
    // docs/ecrans/L1-04-connexion.md : "toutes les autres sessions du compte sont fermées."
    // scope 'others' ne ferme JAMAIS la session courante (aucun évènement SIGNED_OUT émis pour
    // elle, d'après la documentation d'auth-js) — seule celle-ci doit survivre, l'utilisateur
    // venant justement de s'authentifier via le lien de récupération pour arriver ici.
    // Best-effort : le mot de passe est déjà changé avec succès à ce stade, un échec de
    // révocation des autres sessions ne doit pas transformer ce succès en échec.
    await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
    return { succes: true };
  },

  async changerEmail(nouvelEmail) {
    const { error } = await supabase.auth.updateUser({ email: nouvelEmail });
    if (error) return { succes: false, erreur: traduireErreur(error) };
    return { succes: true };
  },

  async sessionCourante() {
    const { data } = await supabase.auth.getSession();
    return data.session ? versSessionAuth(data.session) : null;
  },

  surChangementDeSession(ecouteur) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evenement, session) => {
      ecouteur(session ? versSessionAuth(session) : null);
    });
    return () => subscription.unsubscribe();
  },

  // Zone NON VÉRIFIÉE sur un vrai appareil (docs/ecrans/L1-03-verification-email.md, critère 2 :
  // "deux essais manuels sur appareil" — la fiche elle-même prévoit qu'aucun autre moyen ne
  // prouve ceci). @supabase/supabase-js v2 utilise le flux PKCE par défaut (aucun `flowType`
  // n'est fixé dans src/services/supabase/client.ts) : le lien de confirmation devrait donc
  // porter `?code=...`, échangé ici contre une session. Si le projet utilise en réalité le flux
  // implicite (jetons dans le FRAGMENT `#access_token=...&refresh_token=...`), ce code échouera
  // silencieusement — voir docs/dette.md.
  async etablirSessionDepuisLien(url) {
    const code = new URL(url).searchParams.get('code');
    if (!code) {
      return {
        succes: false,
        erreur: { code: 'serveur', message: 'On a un souci de notre côté. Ce n’est pas toi.' },
      };
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { succes: false, erreur: traduireErreur(error) };
    return { succes: true };
  },
} satisfies PortAuth;
