import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type AuthError,
  type Session as SessionSupabaseJs,
} from '@supabase/supabase-js';

import { supabase } from '@/services/supabase/client';
import type { ErreurAuth, PortAuth, SessionAuth } from './port';

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
      options: { data: { dateNaissance } },
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
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return { succes: false, erreur: traduireErreur(error) };
    return { succes: true };
  },

  async demanderReinitialisation(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { succes: false, erreur: traduireErreur(error) };
    return { succes: true };
  },

  async changerMotDePasse(nouveauMotDePasse) {
    const { error } = await supabase.auth.updateUser({ password: nouveauMotDePasse });
    if (error) return { succes: false, erreur: traduireErreur(error) };
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
} satisfies PortAuth;
