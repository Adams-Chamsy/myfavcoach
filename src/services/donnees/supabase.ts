import { supabase } from '@/services/supabase/client';
import type {
  EtatProfils,
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

// Toutes les écritures de ce fichier visent UNIQUEMENT la ligne profils_client du compte
// appelant. profils_client_update_espace_client (0002_politiques.sql) restreint déjà chaque
// UPDATE à `compte_id = auth.uid()` : un appel sans filtre explicite ne touche donc jamais
// qu'au plus une ligne, la bonne — même choix que lireEtatProfils plus bas (déjà en place
// depuis P1.10), jamais un `.eq('compte_id', ...)` redondant qui obligerait à connaître son
// propre identifiant pour rien.
//
// creerProfilClient est la SEULE exception : profils_client_insert_espace_client EXIGE que la
// ligne insérée porte déjà `compte_id = auth.uid()` (une politique INSERT ne peut pas deviner
// une valeur absente de la requête) — d'où le seul appel de ce fichier à
// supabase.auth.getSession() (lecture locale, jamais un aller-retour réseau contrairement à
// getUser()).
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
    // renvoyer QUE la ligne de l'appelant, ou aucune.
    const [{ data: profilActif, error: erreurProfilActif }, client, coach] = await Promise.all([
      supabase.rpc('profil_actif_courant'),
      supabase.from('profils_client').select('id, onboarding_etape').limit(1),
      supabase.from('profils_coach').select('id').limit(1),
    ]);

    if (erreurProfilActif) throw erreurProfilActif;
    if (client.error) throw client.error;
    if (coach.error) throw coach.error;

    const ligneClient = client.data?.[0] as { id: string; onboarding_etape: number } | undefined;

    return {
      profilActif: profilActif as ProfilActif,
      clientExiste: ligneClient != null,
      clientOnboardingEtape: ligneClient?.onboarding_etape ?? null,
      coachExiste: (coach.data?.length ?? 0) > 0,
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
    const { error } = await supabase.from('profils_client').insert({
      compte_id: compteId,
      prenom,
      nom: nom === '' ? null : nom,
      onboarding_etape: 2,
    });
    if (error) return echec(error);
    return { succes: true };
  },

  async enregistrerObjectifsEtRythme(objectifs, rythme) {
    const { error } = await supabase
      .from('profils_client')
      .update({ objectifs, rythme_hebdo: rythme, onboarding_etape: 3 });
    if (error) return echec(error);
    return { succes: true };
  },

  async enregistrerPointDeDepart({
    consentementAccorde,
    versionConsentement,
    poidsDepartGrammes,
    poidsCibleGrammes,
  }) {
    if (consentementAccorde) {
      // Le consentement DOIT être écrit avant le poids : le déclencheur de
      // 0004_proteger_donnees_sante.sql refuse toute écriture de poids sans une ligne
      // consentements_courants(type='donneesSante', accorde=true) déjà présente.
      const compteId = await compteIdCourant();
      const { error: erreurConsentement } = await supabase.from('consentements').insert({
        compte_id: compteId,
        type: 'donneesSante',
        accorde: true,
        version: versionConsentement,
        origine: 'onboarding_client',
      });
      if (erreurConsentement) return echec(erreurConsentement);
    }

    const { error } = await supabase.from('profils_client').update({
      onboarding_etape: 4,
      ...(consentementAccorde && poidsDepartGrammes !== undefined
        ? { poids_depart_grammes: poidsDepartGrammes }
        : {}),
      ...(consentementAccorde && poidsCibleGrammes !== undefined
        ? { poids_cible_grammes: poidsCibleGrammes }
        : {}),
    });
    if (error) return echec(error);
    return { succes: true };
  },

  async terminerOnboarding() {
    const { error } = await supabase.from('profils_client').update({ onboarding_etape: 5 });
    if (error) return echec(error);
    return { succes: true };
  },
} satisfies PortDonnees;
