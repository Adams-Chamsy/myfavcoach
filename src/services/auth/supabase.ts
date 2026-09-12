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
// docs/ecrans/L1-09-mes-informations.md (P1.13c) : GoTrue envoie deux courriels à la demande de
// changement d'adresse (ancienne + nouvelle), tous deux avec ce lien. Déclaré dans
// supabase/config.toml (additional_redirect_urls) — les deux ensemble sont nécessaires.
const LIEN_CHANGEMENT_ADRESSE = 'myfavcoach://auth/adresse';

// Version du texte de consentement CGU accepté à l'inscription (docs/domaine.md §3.12 : "un
// consentement sans version est un consentement inutilisable"). Aucun texte CGU réel n'existe
// encore (lot L2 (C-06), docs/dette.md) : cette version date le mécanisme actuel — la phrase
// implicite d'app/(public)/inscription.tsx ("En créant ton compte, tu acceptes les CGU...") —
// pas un document juridique rédigé. À faire avancer avec la vraie rédaction en L2 (C-06),
// jamais à bumper pour un autre motif.
//
// DUPLIQUÉE dans src/fonctionnalites/identite/documents-legaux.ts (même valeur, volontairement
// pas importée d'ici : un adaptateur ne s'importe jamais depuis un écran, CLAUDE.md §2) — les
// deux copies DOIVENT rester identiques à la main tant qu'aucune n'est unifiée, voir le
// commentaire de ce fichier et docs/dette.md. Exportée UNIQUEMENT pour que
// src/test/version-cgu-synchronisee.test.ts puisse comparer les deux valeurs et échouer si
// elles divergent — jamais pour qu'un écran l'importe (aucun écran ne le fait, un écran lit
// documents-legaux.ts).
export const VERSION_CGU_ACCEPTEE = '2026-09-04';

// Rendu STRUCTUREL, pas seulement documenté : deux trous (inscrire, renvoyerVerification)
// avaient déjà échappé à une relecture avant d'être trouvés à P1.9. Les QUATRE appels du SDK
// qui envoient un courriel avec un lien passent maintenant OBLIGATOIREMENT par l'une des quatre
// fonctions d'enveloppe (envoyerCourrielInscription, renvoyerCourrielVerification,
// envoyerCourrielReinitialisation, envoyerCourrielChangementAdresse) — le lien profond est
// câblé DANS la fonction, jamais un paramètre qu'un appelant pourrait omettre.
// src/test/redirection-courriels-obligatoire.test.ts vérifie qu'aucun appel direct à
// signUp/resend/resetPasswordForEmail, ni aucun updateUser({ email ... }), ne subsiste ailleurs
// dans ce fichier : la garantie est mécanique, pas une consigne à se rappeler au prochain appel.
//
// Le 4ᵉ cas (updateUser({ email }), "email updates sends a confirmation link to both the user's
// current and new email" — node_modules/@supabase/auth-js/dist/main/GoTrueClient.d.ts) a été
// câblé à P1.13c : la route de destination existe désormais (myfavcoach://auth/adresse, déclaré
// dans supabase/config.toml), l'écran L1-09 l'utilise.
function envoyerCourrielInscription(
  email: string,
  motDePasse: string,
  dateNaissance: string,
): ReturnType<typeof supabase.auth.signUp> {
  return supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      // Clés en snake_case : creer_compte_depuis_auth (0001_creer_identite.sql) les lit dans
      // raw_user_meta_data avec ces noms exacts. Un objet camelCase ({ dateNaissance }) est
      // silencieusement stocké tel quel dans les métadonnées JSON — la lecture snake_case du
      // déclencheur ne le trouve jamais, et l'inscription réelle échouait donc toujours (500
      // "Database error saving new user", jamais vu en test faute d'un test contre le vrai
      // serveur). Trouvé en préparant P1.11, cgu_version_acceptee manquant EN PLUS.
      data: { date_naissance: dateNaissance, cgu_version_acceptee: VERSION_CGU_ACCEPTEE },
      emailRedirectTo: LIEN_VERIFICATION_EMAIL,
    },
  });
}

function renvoyerCourrielVerification(email: string): ReturnType<typeof supabase.auth.resend> {
  return supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: LIEN_VERIFICATION_EMAIL },
  });
}

function envoyerCourrielReinitialisation(
  email: string,
): ReturnType<typeof supabase.auth.resetPasswordForEmail> {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: LIEN_REINITIALISATION_MOT_DE_PASSE,
  });
}

// Quatrième appel du SDK qui envoie un courriel avec un lien (voir le commentaire sur
// envoyerCourrielInscription) : updateUser({ email }) envoie une confirmation à l'ancienne ET à
// la nouvelle adresse. Comme les trois autres, le lien profond est câblé ici, jamais laissé à
// un appelant. src/test/redirection-courriels-obligatoire.test.ts vérifie qu'aucun
// updateUser({ email ... }) ne subsiste ailleurs dans ce fichier.
function envoyerCourrielChangementAdresse(
  nouvelEmail: string,
): ReturnType<typeof supabase.auth.updateUser> {
  return supabase.auth.updateUser(
    { email: nouvelEmail },
    { emailRedirectTo: LIEN_CHANGEMENT_ADRESSE },
  );
}

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
    const { error } = await envoyerCourrielInscription(email, motDePasse, dateNaissance);
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

  // scope 'local' — jamais le défaut ('global') : un bouton "Se déconnecter" ordinaire ne doit
  // fermer QUE cet appareil, pas révoquer toutes les autres sessions de la personne (c'est
  // exactement ce que fait 'global', prouvé à P1.9 avec scope 'others' — le même mécanisme).
  // Trouvé en balayant les appels d'authentification à P1.10.
  //
  // "Réussit même hors ligne" (docs/prompts/L1.md, P1.10) : vérifié en direct, pas supposé — un
  // appel réseau simulé en échec pendant signOut() ne fait PAS remonter d'exception (signOut()
  // rend toujours { error }, ne rejette jamais) ET la session locale est bien effacée malgré
  // l'échec distant (testé avec un vrai compte, /auth/v1/logout intercepté pour échouer). Rien
  // à ajouter ici pour ça : le SDK le fait déjà, correctement, une fois le scope corrigé.
  async deconnecter() {
    await supabase.auth.signOut({ scope: 'local' });
  },

  async renvoyerVerification(email) {
    const { error } = await renvoyerCourrielVerification(email);
    if (error) return { succes: false, erreur: traduireErreur(error) };
    return { succes: true };
  },

  async demanderReinitialisation(email) {
    const { error } = await envoyerCourrielReinitialisation(email);
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

  // CÂBLÉ à P1.13c (docs/ecrans/L1-09) : passe par envoyerCourrielChangementAdresse, qui porte
  // le lien profond myfavcoach://auth/adresse (déclaré dans supabase/config.toml). GoTrue
  // envoie une confirmation à l'ANCIENNE et à la NOUVELLE adresse ; tant que les deux liens ne
  // sont pas suivis, auth.users.email ne change pas (lireAdresseEnAttente ci-dessous rend
  // l'adresse cible entre-temps).
  async changerEmail(nouvelEmail) {
    const { error } = await envoyerCourrielChangementAdresse(nouvelEmail);
    if (error) return { succes: false, erreur: traduireErreur(error) };
    return { succes: true };
  },

  // auth.users.new_email : renseigné par GoTrue pendant un changement d'adresse non encore
  // confirmé sur les deux liens, vide sinon. getUser() fait un aller-retour réseau (contrairement
  // à getSession()) — nécessaire ici, la session locale ne porte pas new_email.
  async lireAdresseEnAttente() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.new_email ?? null;
  },

  async changerMotDePasseConnecte(actuel, nouveau) {
    // Vérifie le mot de passe ACTUEL avant tout : docs/ecrans/L1-09 le liste comme un champ
    // obligatoire, sa raison d'être est qu'un téléphone brièvement déverrouillé ne suffise pas.
    // signInWithPassword réémet une session pour le MÊME compte (aucune rupture pour
    // l'utilisateur) et renvoie invalid_credentials si `actuel` est faux.
    const { data: donneesSession } = await supabase.auth.getSession();
    const email = donneesSession.session?.user.email;
    if (!email) {
      throw new Error(
        'changerMotDePasseConnecte appelé sans session active : erreur de l’appelant.',
      );
    }
    const verification = await supabase.auth.signInWithPassword({ email, password: actuel });
    if (verification.error) {
      return { succes: false, erreur: traduireErreur(verification.error) };
    }

    const { error } = await supabase.auth.updateUser({ password: nouveau });
    if (error) return { succes: false, erreur: traduireErreur(error) };

    // Ferme toutes les AUTRES sessions, jamais celle-ci (même mécanisme et même raison que
    // changerMotDePasse ci-dessus) ; best-effort, le mot de passe est déjà changé.
    await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
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
