import { supabase } from '@/services/supabase/client';
import type {
  EtatProfils,
  InformationsCompte,
  PortDonnees,
  ProfilActif,
  ProfilOnboarding,
  ResultatEcriture,
} from './port';

const PROFIL_ONBOARDING_VIDE: ProfilOnboarding = {
  prenom: '',
  nom: null,
  objectifs: [],
  rythme: null,
  poidsDepartGrammes: null,
  poidsCibleGrammes: null,
};

// Toute écriture UPDATE de ce fichier doit porter un `.eq('compte_id', ...)` EXPLICITE — RLS
// scoperait la ligne correctement même sans lui (profils_client_update_espace_client,
// 0002_politiques.sql, restreint déjà chaque UPDATE à `compte_id = auth.uid()`), mais Supabase
// précharge `safeupdate` sur le rôle authenticator (confirmé en direct sur le projet :
// pg_roles.rolconfig → session_preload_libraries=supautils, safeupdate), qui refuse TOUT
// UPDATE/DELETE sans clause WHERE, avant même que RLS s'évalue — erreur Postgres 21000, "UPDATE
// requires a WHERE clause". Trouvé en P1.11, en repérant que l'écran plantait alors que
// src/test/rls.banc.ts (qui filtre toujours ses PATCH) passait au vert : les deux ne
// prouvaient pas la même forme de requête. `lireEtatProfils`/`lireProfilOnboarding`
// (SELECT, jamais concernés par safeupdate) n'ont pas besoin de ce filtre.
//
// compteIdCourant() lit la session locale (jamais un aller-retour réseau, contrairement à
// getUser()) — appelé par CHAQUE méthode d'écriture de ce fichier, y compris creerProfilClient
// (INSERT), où profils_client_insert_espace_client EXIGE que la ligne insérée porte déjà
// `compte_id = auth.uid()` (une politique INSERT ne peut pas deviner une valeur absente de la
// requête).
async function compteIdCourant(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session)
    throw new Error(
      'compteIdCourant : aucune session — le garde a laissé passer un appel sans compte.',
    );
  return data.session.user.id;
}

function echec(erreur: unknown): ResultatEcriture {
  // Pas de traduction par code comme traduireErreur (src/services/auth/supabase.ts) : aucune
  // des quatre écritures de ce fichier n'a de cause d'échec que l'écran doive distinguer
  // (docs/ecrans/L1-05-onboarding-client.md, États : un seul "Erreur" générique, "l'étape
  // n'avance pas et rien n'est perdu") — contrairement à l'authentification (mot de passe
  // erroné, lien expiré...), qui en a plusieurs à afficher différemment.
  return {
    succes: false,
    erreur: 'On a un souci de notre côté. Réessaie dans un instant.',
  };
}

export const portDonneesSupabase: PortDonnees = {
  async lireEtatProfils() {
    // Trois appels, jamais une nouvelle vue/migration pour ce lot : profil_actif_courant() est
    // la fonction SECURITY DEFINER déjà posée par 0002_politiques.sql pour cet usage exact
    // ("Seule source du profil actif... jamais un en-tête falsifiable"). Les deux lectures
    // d'existence s'appuient sur les politiques RLS déjà prouvées par P1.5
    // (profils_client_select_proprietaire, profils_coach_select_proprietaire) : chacune ne peut
    // renvoyer QUE la ligne de l'appelant, ou aucune. prenom/nom ajoutés (L1-06) pour
    // identiteActive ci-dessous — aucun appel réseau supplémentaire, les deux lignes étaient
    // déjà lues.
    const [{ data: profilActif, error: erreurProfilActif }, client, coach] = await Promise.all([
      supabase.rpc('profil_actif_courant'),
      supabase.from('profils_client').select('id, prenom, nom, onboarding_etape').limit(1),
      supabase.from('profils_coach').select('id, prenom, nom').limit(1),
    ]);

    if (erreurProfilActif) throw erreurProfilActif;
    if (client.error) throw client.error;
    if (coach.error) throw coach.error;

    const ligneClient = client.data?.[0] as
      { id: string; prenom: string; nom: string | null; onboarding_etape: number } | undefined;
    const ligneCoach = coach.data?.[0] as
      { id: string; prenom: string; nom: string | null } | undefined;

    // Prénom/nom du profil ACTIF, jamais figé sur le client : profils_coach porte ses propres
    // colonnes prenom/nom (0001_creer_identite.sql), indépendantes de profils_client. Repli sur
    // des chaînes vides si la ligne attendue manque (ne devrait pas arriver : basculer_profil
    // vérifie déjà l'existence avant de changer profilActif) plutôt qu'une exception qui
    // bloquerait tout l'écran pour un champ d'affichage secondaire.
    const ligneIdentite = profilActif === 'coach' ? ligneCoach : ligneClient;

    return {
      profilActif: profilActif as ProfilActif,
      clientExiste: ligneClient != null,
      clientOnboardingEtape: ligneClient?.onboarding_etape ?? null,
      coachExiste: ligneCoach != null,
      identiteActive: { prenom: ligneIdentite?.prenom ?? '', nom: ligneIdentite?.nom ?? null },
      // Toujours 0 à ce lot, jamais calculé : voir le commentaire de EtatProfils (port.ts) et
      // docs/dette.md.
      attentesCoach: 0,
    } satisfies EtatProfils;
  },

  async lireProfilOnboarding() {
    const { data, error } = await supabase
      .from('profils_client')
      .select('prenom, nom, objectifs, rythme_hebdo, poids_depart_grammes, poids_cible_grammes')
      .limit(1);
    if (error) throw error;

    const ligne = data?.[0] as
      | {
          prenom: string;
          nom: string | null;
          objectifs: string[];
          rythme_hebdo: string | null;
          poids_depart_grammes: number | null;
          poids_cible_grammes: number | null;
        }
      | undefined;
    if (!ligne) return PROFIL_ONBOARDING_VIDE;

    return {
      prenom: ligne.prenom,
      nom: ligne.nom,
      objectifs: ligne.objectifs,
      rythme: ligne.rythme_hebdo,
      poidsDepartGrammes: ligne.poids_depart_grammes,
      poidsCibleGrammes: ligne.poids_cible_grammes,
    } satisfies ProfilOnboarding;
  },

  async creerProfilClient(prenom, nom) {
    const compteId = await compteIdCourant();
    const nomNormalise = nom === '' ? null : nom;

    // UPDATE d'abord, jamais un upsert : compte_id n'a AUCUN grant UPDATE (0001_creer_identite.sql,
    // "un profil ne change jamais de propriétaire") — vérifié en direct, un upsert real échoue
    // avec "permission denied for table profils_client" dès qu'il touche compte_id, même à
    // valeur inchangée (le plan d'exécution d'un upsert le réécrit dans les deux branches).
    // 0 ligne affectée = pas encore de profil (première fois) → INSERT. Nécessaire depuis que
    // le bouton retour peut ramener à l'étape 1 après qu'un profil existe déjà (P1.11) : un
    // second INSERT y échouerait sur la contrainte d'unicité de compte_id.
    const miseAJour = await supabase
      .from('profils_client')
      .update({ prenom, nom: nomNormalise, onboarding_etape: 2 })
      .eq('compte_id', compteId)
      .select('id');
    if (miseAJour.error) return echec(miseAJour.error);
    if ((miseAJour.data?.length ?? 0) > 0) return { succes: true };

    const { error } = await supabase.from('profils_client').insert({
      compte_id: compteId,
      prenom,
      nom: nomNormalise,
      onboarding_etape: 2,
    });
    if (error) return echec(error);
    return { succes: true };
  },

  async enregistrerObjectifsEtRythme(objectifs, rythme) {
    const compteId = await compteIdCourant();
    const { error } = await supabase
      .from('profils_client')
      .update({ objectifs, rythme_hebdo: rythme, onboarding_etape: 3 })
      .eq('compte_id', compteId);
    if (error) return echec(error);
    return { succes: true };
  },

  async enregistrerPointDeDepart({
    consentementAccorde,
    versionConsentement,
    poidsDepartGrammes,
    poidsCibleGrammes,
  }) {
    const compteId = await compteIdCourant();

    if (consentementAccorde) {
      // Le consentement DOIT être écrit avant le poids : le déclencheur de
      // 0004_proteger_donnees_sante.sql refuse toute écriture de poids sans une ligne
      // consentements_courants(type='donneesSante', accorde=true) déjà présente.
      const { error: erreurConsentement } = await supabase.from('consentements').insert({
        compte_id: compteId,
        type: 'donneesSante',
        accorde: true,
        version: versionConsentement,
        origine: 'onboarding_client',
      });
      if (erreurConsentement) return echec(erreurConsentement);
    }

    const { error } = await supabase
      .from('profils_client')
      .update({
        onboarding_etape: 4,
        ...(consentementAccorde && poidsDepartGrammes !== undefined
          ? { poids_depart_grammes: poidsDepartGrammes }
          : {}),
        ...(consentementAccorde && poidsCibleGrammes !== undefined
          ? { poids_cible_grammes: poidsCibleGrammes }
          : {}),
      })
      .eq('compte_id', compteId);
    if (error) return echec(error);
    return { succes: true };
  },

  async terminerOnboarding() {
    const compteId = await compteIdCourant();
    const { error } = await supabase
      .from('profils_client')
      .update({ onboarding_etape: 5 })
      .eq('compte_id', compteId);
    if (error) return echec(error);
    return { succes: true };
  },

  // basculer_profil (0002_politiques.sql) revalide elle-même que le profil demandé existe pour
  // ce compte avant d'écrire comptes.profil_actif — cette méthode ne fait que l'appeler et
  // traduire l'échec, jamais de vérification côté application (le port ne décide jamais un
  // droit). Message générique, comme echec() ci-dessus : le message brut de la fonction (utile
  // en développement) n'a aucune raison de fuiter jusqu'à l'écran, qui ne peut de toute façon
  // proposer cette bascule que pour un profil déjà connu comme existant.
  async basculerProfil(profil) {
    const { error } = await supabase.rpc('basculer_profil', { profil });
    if (error) return echec(error);
    return { succes: true };
  },

  // creer_profil_coach (0005_creer_profil_coach.sql) : SECURITY DEFINER, agit sur auth.uid(),
  // insère profils_coach ET passe comptes.profil_actif à 'coach' dans la même transaction.
  // Message générique comme echec() ci-dessus — l'écran n'a qu'un « Erreur » à afficher
  // (fiche L1-08, États). Une contrainte violée (2ᵉ profil coach) comme une panne remontent
  // pareil ici, l'écran ne les distingue pas.
  async creerProfilCoach({ discipline, telephone, prenom, nom }) {
    const { error } = await supabase.rpc('creer_profil_coach', {
      discipline,
      telephone,
      prenom,
      nom,
    });
    if (error) return echec(error);
    return { succes: true };
  },

  async lireInformations() {
    // date_naissance : SELECT accordé sur comptes, RLS comptes_select_soi limite déjà à la
    // ligne de l'appelant. Lecture seule côté écran ET côté serveur (colonne hors GRANT
    // UPDATE, 0001_creer_identite.sql).
    const [{ data: profilActif, error: erreurProfilActif }, compte] = await Promise.all([
      supabase.rpc('profil_actif_courant'),
      supabase.from('comptes').select('date_naissance').limit(1),
    ]);
    if (erreurProfilActif) throw erreurProfilActif;
    if (compte.error) throw compte.error;
    const dateNaissance =
      (compte.data?.[0] as { date_naissance: string } | undefined)?.date_naissance ?? '';

    if (profilActif === 'coach') {
      const { data, error } = await supabase
        .from('profils_coach')
        .select('prenom, nom, discipline, titre_court, bio')
        .limit(1);
      if (error) throw error;
      const ligne = data?.[0] as
        | {
            prenom: string;
            nom: string;
            discipline: string;
            titre_court: string | null;
            bio: string | null;
          }
        | undefined;
      return {
        profil: 'coach',
        prenom: ligne?.prenom ?? '',
        nom: ligne?.nom ?? '',
        discipline: ligne?.discipline ?? '',
        titreCourt: ligne?.titre_court ?? null,
        bio: ligne?.bio ?? null,
        dateNaissance,
      } satisfies InformationsCompte;
    }

    const { data, error } = await supabase.from('profils_client').select('prenom, nom').limit(1);
    if (error) throw error;
    const ligne = data?.[0] as { prenom: string; nom: string | null } | undefined;
    return {
      profil: 'client',
      prenom: ligne?.prenom ?? '',
      nom: ligne?.nom ?? null,
      dateNaissance,
    } satisfies InformationsCompte;
  },

  async enregistrerInformations(modifs) {
    // Filtre `.eq('compte_id', ...)` EXPLICITE obligatoire — voir le commentaire d'en-tête de
    // ce fichier (safeupdate refuse tout UPDATE sans WHERE, avant même RLS). La condition
    // d'espace (`profil_actif_courant() = 'coach'`/'client') est portée par la politique, pas
    // rejouée ici : l'écran n'ouvre ce formulaire que dans l'espace du profil concerné.
    const compteId = await compteIdCourant();

    if (modifs.profil === 'coach') {
      const { error } = await supabase
        .from('profils_coach')
        .update({
          prenom: modifs.prenom,
          nom: modifs.nom,
          titre_court: modifs.titreCourt,
          bio: modifs.bio,
        })
        .eq('compte_id', compteId);
      if (error) return echec(error);
      return { succes: true };
    }

    const { error } = await supabase
      .from('profils_client')
      .update({ prenom: modifs.prenom, nom: modifs.nom === '' ? null : modifs.nom })
      .eq('compte_id', compteId);
    if (error) return echec(error);
    return { succes: true };
  },

  async lireConsentementSante() {
    // Vue consentements_courants (0001_creer_identite.sql) : dernier état par (compte, type),
    // security_invoker donc scopée à l'appelant. Aucune ligne = jamais enregistré.
    const { data, error } = await supabase
      .from('consentements_courants')
      .select('accorde, version')
      .eq('type', 'donneesSante')
      .limit(1);
    if (error) throw error;
    const ligne = data?.[0] as { accorde: boolean; version: string } | undefined;
    return { accorde: ligne?.accorde ?? false, version: ligne?.version ?? null };
  },

  async enregistrerConsentementSante(accorde, version) {
    // Journal d'ajout (docs/domaine.md §3.12) : toujours un INSERT, jamais un UPDATE — un
    // retrait est une nouvelle ligne accorde=false. consentements n'a d'ailleurs aucun GRANT
    // UPDATE (0001_creer_identite.sql). compte_id explicite : la politique INSERT l'exige.
    const compteId = await compteIdCourant();
    const { error } = await supabase.from('consentements').insert({
      compte_id: compteId,
      type: 'donneesSante',
      accorde,
      version,
      origine: 'ecran_confidentialite',
    });
    if (error) return echec(error);
    return { succes: true };
  },

  async effacerMesuresCorporelles() {
    // Remettre les colonnes de poids à NULL : autorisé même consentement retiré — le
    // déclencheur de 0004_proteger_donnees_sante.sql ne bloque que l'écriture d'une valeur NON
    // nulle. Filtre `.eq('compte_id', ...)` explicite obligatoire (safeupdate, voir l'en-tête).
    const compteId = await compteIdCourant();
    const { error } = await supabase
      .from('profils_client')
      .update({ poids_depart_grammes: null, poids_cible_grammes: null })
      .eq('compte_id', compteId);
    if (error) return echec(error);
    return { succes: true };
  },
} satisfies PortDonnees;
