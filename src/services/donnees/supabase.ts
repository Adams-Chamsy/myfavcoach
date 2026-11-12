import { supabase } from '@/services/supabase/client';
import type {
  AvisDuCoach,
  CommuneReference,
  Discipline,
  DossierVerification,
  EtatMonAvis,
  EtatProfils,
  EtiquetteAvis,
  InformationsCompte,
  Invitation,
  Langue,
  MonAvis,
  Offre,
  ParametresRecherche,
  PieceDeposee,
  PortDonnees,
  ProfilActif,
  ProfilCoachPublic,
  ProfilOnboarding,
  RefusServeur,
  ResultatCoachRecherche,
  ResultatConstat,
  ResultatAvis,
  ResultatEcriture,
  ResultatIntention,
  ResultatRecherche,
  SaisieAvis,
  TypePiece,
  AbonnementClient,
  StatutAbonnement,
  TransitionAbonnement,
} from './port';

// L4 : ce que supabase-js rend pour l'appel d'une Edge Function. Une réponse non 2xx arrive en
// `error` (FunctionsHttpError) avec la réponse dans `context` ; une absence de réponse (réseau)
// arrive en `error` sans `context` lisible (FunctionsFetchError, FunctionsRelayError).
type AppelFonction = { data: unknown; error: unknown };

// Le refus du serveur, s'il en porte un AFFICHABLE (docs/api.md §1 : code, title, detail). Une
// réponse d'erreur sans ces trois champs (passerelle, page HTML) n'en est pas un : null.
async function refusDe(erreur: unknown): Promise<RefusServeur | null> {
  const contexte = (erreur as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!contexte || typeof contexte.json !== 'function') return null;
  try {
    const corps = (await contexte.json()) as Partial<RefusServeur> | null;
    if (
      typeof corps?.code === 'string' &&
      typeof corps.title === 'string' &&
      typeof corps.detail === 'string'
    ) {
      return { code: corps.code, title: corps.title, detail: corps.detail };
    }
  } catch {
    // Corps illisible : pas un refus affichable.
  }
  return null;
}

// Avis (P4.9a) : les lignes rendues par 0049, en snake_case.
type LigneAvisPublic = {
  id: string;
  prenom: string;
  initiale_nom: string | null;
  duree_suivi_mois: number;
  note: number;
  etiquettes: string[];
  texte: string | null;
};
type LigneSyntheseAvis = {
  nombre: number;
  moyenne: number | string | null;
  distribution: number[];
  etiquettes_portees: string[];
};
type LigneMonAvis = {
  etat: 'aucun' | 'possible' | 'suivi_interrompu' | 'pas_encore' | 'modifiable' | 'fige';
  jours_restants: number | null;
  note: number | null;
  etiquettes: string[] | null;
  texte: string | null;
  statut: string | null;
};

// Dépôt (POST) ou modification (PATCH) par l'Edge Function `avis`. Une réponse 2xx sans
// identifiant n'est pas un avis enregistré : rien ne permet de le dire à la personne.
async function ecrireAvis(
  methode: 'POST' | 'PATCH',
  coachId: string,
  saisie: SaisieAvis,
): Promise<ResultatAvis> {
  const { data, error } = (await supabase.functions.invoke('avis', {
    method: methode,
    body: { coachId, ...saisie },
  })) as AppelFonction;
  if (error) {
    const refus = await refusDe(error);
    return refus ? { issue: 'refusee', refus } : { issue: 'sans_reponse' };
  }
  const avisId = (data as { avisId?: unknown } | null)?.avisId;
  return estTexte(avisId) ? { issue: 'enregistre', avisId } : { issue: 'sans_reponse' };
}

function estTexte(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && valeur.length > 0;
}

function intentionCreee(data: unknown): ResultatIntention {
  const d = data as Partial<{
    intentionId: unknown;
    urlPaiement: unknown;
    moyensAcceptes: unknown;
    recapitulatif: Partial<Record<string, unknown>>;
  }> | null;
  const r = d?.recapitulatif;
  if (
    !estTexte(d?.intentionId) ||
    !estTexte(d?.urlPaiement) ||
    !Array.isArray(d?.moyensAcceptes) ||
    typeof r?.prixCentimes !== 'number' ||
    typeof r.totalCentimes !== 'number' ||
    !estTexte(r.prochainPrelevementLe) ||
    typeof r.jourPrelevement !== 'number'
  ) {
    return { issue: 'sans_reponse' };
  }
  return {
    issue: 'creee',
    intentionId: d.intentionId,
    recapitulatif: {
      prixCentimes: r.prixCentimes,
      totalCentimes: r.totalCentimes,
      prochainPrelevementLe: r.prochainPrelevementLe,
      jourPrelevement: r.jourPrelevement,
    },
    urlPaiement: d.urlPaiement,
    moyensAcceptes: (d.moyensAcceptes as unknown[]).filter(
      (m): m is 'carte' | 'sepa' => m === 'carte' || m === 'sepa',
    ),
  };
}

function constat(data: unknown): ResultatConstat {
  const d = data as Partial<{
    etat: unknown;
    urlPaiement: unknown;
    abonnement: Partial<{ statut: unknown }>;
  }> | null;
  switch (d?.etat) {
    case 'abonne':
      return estTexte(d.abonnement?.statut)
        ? { issue: 'constat', etat: 'abonne', statutAbonnement: d.abonnement.statut }
        : { issue: 'sans_reponse' };
    case 'non_terminee':
      return estTexte(d.urlPaiement)
        ? { issue: 'constat', etat: 'non_terminee', urlPaiement: d.urlPaiement }
        : { issue: 'sans_reponse' };
    case 'paiement_recu':
    case 'expiree':
    case 'souscription_impossible':
      return { issue: 'constat', etat: d.etat };
    default:
      return { issue: 'sans_reponse' };
  }
}

const COMPARTIMENT_PIECES = 'pieces-verification';

type LigneOffre = {
  id: string;
  titre: string;
  description: string | null;
  prix_centimes: number;
  benefices: string[];
  engagement_humain: string[];
  est_mise_en_avant: boolean;
  publiee_le: string | null;
  retiree_le: string | null;
};

function offreDepuisLigne(ligne: LigneOffre): Offre {
  return {
    id: ligne.id,
    titre: ligne.titre,
    description: ligne.description,
    prixCentimes: ligne.prix_centimes,
    benefices: ligne.benefices,
    engagementHumain: ligne.engagement_humain,
    estMiseEnAvant: ligne.est_mise_en_avant,
    publieeLe: ligne.publiee_le,
    retireeLe: ligne.retiree_le,
  };
}

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

// Le profil coach de l'appelant, DEMANDÉ au serveur (mon_profil_coach_id, 0011 : par
// auth.uid(), security definer). Jamais cherché côté application (docs/backend.md §7) : par
// compte_id, la colonne n'est pas lisible par authenticated sur profils_coach depuis 0008
// (42501) ; par select('id').limit(1), la lecture rend aussi les coachs vérifiés, donc parfois
// le profil d'un autre. Trouvé sur iPhone le 1er novembre 2026. null : aucun profil coach.
async function monProfilCoachId(): Promise<{ id: string | null; erreur: unknown }> {
  const { data, error } = await supabase.rpc('mon_profil_coach_id');
  return { id: (data as string | null) ?? null, erreur: error };
}

// Lecture de 24b : PostgREST rend les relations embarquées comme des objets (clé étrangère
// simple), null si la ligne liée n'est pas lisible (politique de lecture).
type LigneAbonnementClient = {
  id: string;
  prix_fige_centimes: number;
  statut: string;
  prochain_prelevement_le: string | null;
  pause_jusqu_le: string | null;
  fin_acces_le: string | null;
  offres: { titre: string } | null;
  profils_coach: { prenom: string; nom: string } | null;
};

export const portDonneesSupabase: PortDonnees = {
  async lireEtatProfils() {
    // profil_actif_courant() est la fonction SECURITY DEFINER posée par 0002_politiques.sql pour
    // cet usage exact (« Seule source du profil actif... jamais un en-tête falsifiable »).
    //
    // profils_client : sa seule politique de lecture est le propriétaire, la lecture ne peut
    // rendre QUE la ligne de l'appelant. profils_coach, NON : tout coach vérifié y est lisible
    // par tous (profils_coach_select_verifiee, 0008). Jusqu'au 2 novembre 2026, ce commentaire
    // affirmait le contraire et le profil coach se lisait par limit(1) : un compte sans profil
    // coach pouvait recevoir « coach existe » et l'identité d'un autre coach dès qu'un seul
    // coach vérifié existait. Désormais, le serveur désigne le profil (mon_profil_coach_id,
    // docs/backend.md §7), puis on le lit PAR ID (src/test/lecture-profils-coach-designee.test.ts).
    const [{ data: profilActif, error: erreurProfilActif }, client, coachDesigne] =
      await Promise.all([
        supabase.rpc('profil_actif_courant'),
        supabase.from('profils_client').select('id, prenom, nom, onboarding_etape').limit(1),
        monProfilCoachId(),
      ]);

    if (erreurProfilActif) throw erreurProfilActif;
    if (client.error) throw client.error;
    if (coachDesigne.erreur) throw coachDesigne.erreur;
    const coach = coachDesigne.id
      ? await supabase.from('profils_coach').select('id, prenom, nom').eq('id', coachDesigne.id)
      : { data: [], error: null };
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

  // creer_profil_client (0051, option B du 2 novembre 2026) : SECURITY DEFINER, agit sur
  // auth.uid(). Crée le profil client à l'étape 2, ou le met à jour s'il existe déjà (retour à
  // l'étape 1, P1.11), traduit un nom vide en absent, et active l'espace client — dans la même
  // transaction. L'écriture directe dans profils_client est fermée (docs/domaine.md §3.2).
  async creerProfilClient(prenom, nom) {
    const { error } = await supabase.rpc('creer_profil_client', { prenom, nom });
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
      // Le profil désigné par le serveur, lu PAR ID : par limit(1), le formulaire pouvait montrer
      // la bio d'un autre coach (vérifié, donc lisible), puis l'enregistrer comme la sienne.
      // Trouvé au balayage du 2 novembre 2026 (src/test/lecture-profils-coach-designee.test.ts).
      const coach = await monProfilCoachId();
      if (coach.erreur) throw coach.erreur;
      const { data, error } = coach.id
        ? await supabase
            .from('profils_coach')
            .select(
              'prenom, nom, discipline, titre_court, bio, commune_base_insee, formats, parcours_texte, langues',
            )
            .eq('id', coach.id)
        : { data: [], error: null };
      if (error) throw error;
      const ligne = data?.[0] as
        | {
            prenom: string;
            nom: string;
            discipline: string;
            titre_court: string | null;
            bio: string | null;
            commune_base_insee: string | null;
            formats: string[];
            parcours_texte: string | null;
            langues: string[];
          }
        | undefined;
      return {
        profil: 'coach',
        prenom: ligne?.prenom ?? '',
        nom: ligne?.nom ?? '',
        discipline: ligne?.discipline ?? '',
        titreCourt: ligne?.titre_court ?? null,
        bio: ligne?.bio ?? null,
        communeBaseInsee: ligne?.commune_base_insee ?? null,
        formats: ligne?.formats ?? [],
        parcoursTexte: ligne?.parcours_texte ?? null,
        langues: ligne?.langues ?? [],
        dateNaissance,
      } satisfies InformationsCompte;
    }

    const { data, error } = await supabase
      .from('profils_client')
      .select('prenom, nom, commune_insee')
      .limit(1);
    if (error) throw error;
    const ligne = data?.[0] as
      { prenom: string; nom: string | null; commune_insee: string | null } | undefined;
    return {
      profil: 'client',
      prenom: ligne?.prenom ?? '',
      nom: ligne?.nom ?? null,
      communeInsee: ligne?.commune_insee ?? null,
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
      const coach = await monProfilCoachId();
      if (coach.erreur) return echec(coach.erreur);
      if (!coach.id) return echec(new Error('Aucun profil coach pour ce compte.'));
      const { error } = await supabase
        .from('profils_coach')
        .update({
          prenom: modifs.prenom,
          nom: modifs.nom,
          titre_court: modifs.titreCourt,
          bio: modifs.bio,
          commune_base_insee: modifs.communeBaseInsee,
          formats: modifs.formats,
          parcours_texte: modifs.parcoursTexte,
          langues: modifs.langues,
        })
        .eq('id', coach.id);
      if (error) return echec(error);
      return { succes: true };
    }

    const { error } = await supabase
      .from('profils_client')
      .update({
        prenom: modifs.prenom,
        nom: modifs.nom === '' ? null : modifs.nom,
        commune_insee: modifs.communeInsee,
      })
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

  // mon_dossier_verification (0053, A1 du 2 novembre 2026) : le dossier de l'appelant, désigné
  // par auth.uid() côté serveur (docs/backend.md §7). Remplace une lecture de profils_coach ...
  // limit(1), qui pouvait rendre la ligne d'un AUTRE coach (tout coach vérifié est lisible) —
  // même défaut que celui corrigé le même jour pour monProfilCoachId. `deposeLe` est désormais
  // la date de SOUMISSION du dossier (dossier_soumis_le), d'où part le délai de 48 h ouvrées,
  // et non plus la date de la plus ancienne pièce, fausse après un refus.
  //
  // Le motif exact d'une décision n'est lisible nulle part côté application
  // (decisions_verification n'a aucun GRANT, 0015) : L2-09 l'affiche quand le back-office
  // (L2-10) le transmettra par un autre canal — non construit à ce lot, voir le rapport.
  async lireDossierVerification() {
    const { data, error } = await supabase.rpc('mon_dossier_verification');
    if (error) throw error;
    const ligne = (
      data as { statut: DossierVerification['statut']; soumis_le: string | null }[] | null
    )?.[0];
    if (!ligne) return { statut: 'absente', deposeLe: null, motif: null };
    return { statut: ligne.statut, deposeLe: ligne.soumis_le, motif: null };
  },

  async lirePiecesDeposees() {
    const { data, error } = await supabase
      .from('pieces_verification')
      .select('type, depose_le, nom_fichier, taille_octets')
      .order('depose_le', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(
      (ligne: {
        type: string;
        depose_le: string;
        nom_fichier: string | null;
        taille_octets: number | null;
      }): PieceDeposee => ({
        type: ligne.type as TypePiece,
        deposeLe: ligne.depose_le,
        nomFichier: ligne.nom_fichier,
        tailleOctets: ligne.taille_octets,
      }),
    );
  },

  async deposerPieceVerification(type, fichier) {
    const coach = await monProfilCoachId();
    if (coach.erreur) return echec(coach.erreur);
    const coachId = coach.id;
    if (!coachId) return echec(new Error('Aucun profil coach pour ce compte.'));

    const { data: chemin, error: erreurChemin } = await supabase.rpc('nouveau_chemin_stockage');
    if (erreurChemin) return echec(erreurChemin);

    // Le fichier part directement vers Storage (URL signée, docs/api.md §4) : jamais par une
    // route applicative de ce dépôt. `fichier.uri` vient du sélecteur natif (hors périmètre de
    // ce port — voir le rapport de P2.8 sur la dépendance manquante).
    const reponseFichier = await fetch(fichier.uri);
    const contenu = await reponseFichier.blob();
    const { error: erreurEnvoi } = await supabase.storage
      .from(COMPARTIMENT_PIECES)
      .upload(chemin as string, contenu, { contentType: fichier.typeMime });
    if (erreurEnvoi) return echec(erreurEnvoi);

    // Nom et poids (L2-06, 0056/0057) : le poids est celui du contenu réellement envoyé. Le nom,
    // borné à 255 caractères comme la contrainte de 0056 ; jamais journalisé.
    const { error: erreurLigne } = await supabase.from('pieces_verification').insert({
      coach_id: coachId,
      type,
      chemin_stockage: chemin,
      nom_fichier: fichier.nom.trim().slice(0, 255) || null,
      taille_octets: typeof contenu.size === 'number' ? contenu.size : null,
    });
    if (erreurLigne) return echec(erreurLigne);
    return { succes: true };
  },

  async lireMesOffres() {
    const { data, error } = await supabase
      .from('offres')
      .select(
        'id, titre, description, prix_centimes, benefices, engagement_humain, est_mise_en_avant, publiee_le, retiree_le',
      )
      .order('cree_le', { ascending: false });
    if (error) throw error;
    return ((data as LigneOffre[] | null) ?? []).map(offreDepuisLigne);
  },

  async creerOffreBrouillon(modifs) {
    const coach = await monProfilCoachId();
    if (coach.erreur) return echec(coach.erreur) as { succes: false; erreur: string };
    const coachId = coach.id;
    if (!coachId)
      return { succes: false, erreur: 'On a un souci de notre côté. Réessaie dans un instant.' };

    const { data, error } = await supabase
      .from('offres')
      .insert({
        coach_id: coachId,
        titre: modifs.titre,
        description: modifs.description,
        prix_centimes: modifs.prixCentimes,
        benefices: modifs.benefices,
        engagement_humain: modifs.engagementHumain,
        est_mise_en_avant: modifs.estMiseEnAvant,
      })
      .select('id');
    if (error)
      return { succes: false, erreur: 'On a un souci de notre côté. Réessaie dans un instant.' };
    return { succes: true, id: (data?.[0] as { id: string }).id };
  },

  async modifierOffre(id, modifs) {
    const { error } = await supabase
      .from('offres')
      .update({
        titre: modifs.titre,
        description: modifs.description,
        prix_centimes: modifs.prixCentimes,
        benefices: modifs.benefices,
        engagement_humain: modifs.engagementHumain,
        est_mise_en_avant: modifs.estMiseEnAvant,
      })
      .eq('id', id);
    if (error) return echec(error);
    return { succes: true };
  },

  // Textes exacts (docs/ecrans/L2-15-creation-offre-coach.md, Règles) : l'écran les choisit à
  // partir du code, jamais un message brut du serveur.
  async publierOffre(id) {
    const { error } = await supabase.rpc('publier_offre', { offre_id: id });
    if (!error) return { succes: true };
    const code = (error.message.match(/engagement_humain_requis|coach_non_verifie/) ?? [])[0];
    return { succes: false, code: code ?? 'inconnu' };
  },

  async retirerOffre(id) {
    const { error } = await supabase.rpc('retirer_offre', { offre_id: id });
    if (error) return echec(error);
    return { succes: true };
  },

  async lireProfilCoachPublic(coachId) {
    const { data, error } = await supabase
      .from('profils_coach')
      .select(
        'id, prenom, nom, photo_url, discipline, titre_court, bio, statut_verification, parcours_texte, langues',
      )
      .eq('id', coachId)
      .limit(1);
    if (error) throw error;
    const ligne = data?.[0] as
      | {
          id: string;
          prenom: string;
          nom: string;
          photo_url: string | null;
          discipline: string;
          titre_court: string | null;
          bio: string | null;
          statut_verification: string;
          parcours_texte: string | null;
          langues: string[];
        }
      | undefined;
    if (!ligne) return null;
    const verifiee = ligne.statut_verification === 'verifiee';
    // Appelée seulement si verifiee : la fonction renvoie déjà null sinon (0019), mais éviter
    // l'appel réseau pour un coach non vérifié reste la lecture la plus honnête du cas.
    let verifieeDepuisLe: string | null = null;
    if (verifiee) {
      const { data: date, error: erreurDate } = await supabase.rpc('date_verification_coach', {
        p_coach_id: coachId,
      });
      if (erreurDate) throw erreurDate;
      verifieeDepuisLe = date;
    }
    return {
      id: ligne.id,
      prenom: ligne.prenom,
      nom: ligne.nom,
      photoUrl: ligne.photo_url,
      discipline: ligne.discipline,
      titreCourt: ligne.titre_court,
      bio: ligne.bio,
      verifiee,
      verifieeDepuisLe,
      parcoursTexte: ligne.parcours_texte,
      langues: ligne.langues,
    } satisfies ProfilCoachPublic;
  },

  async lireDisciplines() {
    const { data, error } = await supabase
      .from('disciplines')
      .select('cle, libelle')
      .eq('active', true)
      .order('ordre_affichage', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Discipline[];
  },

  async lireCommunesReference() {
    const { data, error } = await supabase
      .from('communes_reference')
      .select('code_insee, nom')
      .order('nom', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((ligne) => ({
      codeInsee: ligne.code_insee as string,
      nom: ligne.nom as string,
    })) satisfies CommuneReference[];
  },

  async lireLangues() {
    const { data, error } = await supabase
      .from('langues')
      .select('cle, libelle')
      .eq('active', true)
      .order('ordre_affichage', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Langue[];
  },

  async rechercherCoachs(parametres: ParametresRecherche) {
    const { data, error } = await supabase.rpc('rechercher_coachs', {
      p_discipline: parametres.discipline ?? null,
      p_texte: parametres.texte ?? null,
      p_commune_insee: parametres.communeInsee ?? null,
      p_format: parametres.format ?? null,
      p_prix_min: parametres.prixMinCentimes ?? null,
      p_prix_max: parametres.prixMaxCentimes ?? null,
      p_limite: parametres.limite ?? undefined,
      p_decalage: parametres.decalage ?? undefined,
    });
    if (error) throw error;
    type LigneRecherche = {
      offre_id: string;
      coach_id: string;
      prenom: string;
      nom: string;
      photo_url: string | null;
      discipline: string;
      titre_court: string | null;
      commune_base_insee: string | null;
      formats: string[];
      titre: string;
      prix_centimes: number;
      total_resultats: number;
    };
    const lignes = (data ?? []) as LigneRecherche[];
    const resultats: ResultatCoachRecherche[] = lignes.map((l) => ({
      offreId: l.offre_id,
      coachId: l.coach_id,
      prenom: l.prenom,
      nom: l.nom,
      photoUrl: l.photo_url,
      discipline: l.discipline,
      titreCourt: l.titre_court,
      communeBaseInsee: l.commune_base_insee,
      formats: l.formats,
      titre: l.titre,
      prixCentimes: l.prix_centimes,
    }));
    // total_resultats est identique sur chaque ligne (count(*) over()) — 0 candidat rendu ne
    // veut pas dire 0 résultat total ailleurs, mais ici l'ensemble est vide par construction.
    return {
      resultats,
      totalResultats: lignes[0]?.total_resultats ?? 0,
    } satisfies ResultatRecherche;
  },

  async lireOffresPublieesDeCoach(coachId) {
    const { data, error } = await supabase
      .from('offres')
      .select(
        'id, titre, description, prix_centimes, benefices, engagement_humain, est_mise_en_avant, publiee_le, retiree_le',
      )
      .eq('coach_id', coachId)
      .not('publiee_le', 'is', null)
      .is('retiree_le', null);
    if (error) throw error;
    return ((data as LigneOffre[] | null) ?? []).map(offreDepuisLigne);
  },

  async demanderSuppressionCompte(motif) {
    const { error } = await supabase.rpc('supprimer_mon_compte', { p_motif: motif });
    if (error) return echec(error);
    return { succes: true };
  },

  async lireConsentementCommunications() {
    const { data, error } = await supabase
      .from('consentements_courants')
      .select('accorde, version')
      .eq('type', 'communicationsCommerciales')
      .limit(1);
    if (error) throw error;
    const ligne = data?.[0] as { accorde: boolean; version: string } | undefined;
    return { accorde: ligne?.accorde ?? false, version: ligne?.version ?? null };
  },

  async enregistrerConsentementCommunications(accorde, version) {
    const compteId = await compteIdCourant();
    const { error } = await supabase.from('consentements').insert({
      compte_id: compteId,
      type: 'communicationsCommerciales',
      accorde,
      version,
      origine: 'ecran_confidentialite',
    });
    if (error) return echec(error);
    return { succes: true };
  },

  async lireHistoriqueConsentements() {
    const { data, error } = await supabase
      .from('consentements')
      .select('type, accorde, version, horodatage')
      .order('horodatage', { ascending: false });
    if (error) throw error;
    return (data ?? []) as {
      type: string;
      accorde: boolean;
      version: string;
      horodatage: string;
    }[];
  },

  async demanderExportDonnees() {
    const { error } = await supabase.rpc('demander_export_donnees');
    if (!error) return { succes: true };
    const code = error.message.includes('export_trop_recent') ? 'export_trop_recent' : 'inconnu';
    return { succes: false, code };
  },

  async lireDernierExport() {
    const { data, error } = await supabase
      .from('demandes_export')
      .select('demande_le, pret_le, url_signee, expire_le, taille_octets')
      .order('demande_le', { ascending: false })
      .limit(1);
    if (error) throw error;
    const ligne = data?.[0] as
      | {
          demande_le: string;
          pret_le: string | null;
          url_signee: string | null;
          expire_le: string | null;
          taille_octets: number | null;
        }
      | undefined;
    if (!ligne) return null;
    return {
      demandeLe: ligne.demande_le,
      pretLe: ligne.pret_le,
      urlTelechargement: ligne.url_signee,
      expireLe: ligne.expire_le,
      tailleOctets: ligne.taille_octets,
    };
  },

  async lireDatesDocuments() {
    const { data, error } = await supabase
      .from('comptes')
      .select('cgu_version_acceptee, cree_le')
      .limit(1);
    if (error) throw error;
    const ligne = data?.[0] as { cgu_version_acceptee: string; cree_le: string } | undefined;
    if (!ligne) throw new Error('Compte introuvable (lireDatesDocuments).');
    return { cguVersionAcceptee: ligne.cgu_version_acceptee, creeLe: ligne.cree_le };
  },

  async lireMonJetonInvitation() {
    const { data, error } = await supabase.rpc('mon_jeton_invitation');
    if (error) throw error;
    return data as string;
  },

  async regenererJetonInvitation() {
    const { data, error } = await supabase.rpc('regenerer_jeton_invitation');
    if (error) throw error;
    return data as string;
  },

  async lireMesInvitations() {
    const { data, error } = await supabase.rpc('mes_invitations');
    if (error) throw error;
    return (data ?? []).map(
      (ligne: {
        id: string;
        statut: 'compte_cree' | 'abonnee';
        prenom: string;
        initiale_nom: string;
        abonnee_le: string | null;
      }) => ({
        id: ligne.id,
        statut: ligne.statut,
        prenom: ligne.prenom,
        initialeNom: ligne.initiale_nom,
        abonneeLe: ligne.abonnee_le,
      }),
    ) satisfies Invitation[];
  },

  async lireNombreInvitationsEnAttente() {
    const { data, error } = await supabase.rpc('nombre_invitations_en_attente');
    if (error) throw error;
    return data as number;
  },

  async ajouterInvitationEnAttente() {
    const { error } = await supabase.rpc('ajouter_invitation_en_attente');
    if (error) return { succes: false, erreur: error.message };
    return { succes: true };
  },

  async lireCoachParJetonInvitation(jeton: string) {
    const { data, error } = await supabase.rpc('coach_par_jeton_invitation', { p_jeton: jeton });
    if (error) throw error;
    return (data as string | null) ?? null;
  },

  // L4-04a : docs/api.md §7. Jeton de session joint par supabase-js ; aucune donnée de paiement
  // journalisée ici, l'URL de paiement comprise (CLAUDE.md §10).
  async demanderIntention(offreId: string, cleIdempotence: string): Promise<ResultatIntention> {
    const { data, error } = (await supabase.functions.invoke('abonnement-intention', {
      method: 'POST',
      headers: { 'Idempotency-Key': cleIdempotence },
      body: { offreId },
    })) as AppelFonction;
    if (error) {
      const refus = await refusDe(error);
      return refus ? { issue: 'refusee', refus } : { issue: 'sans_reponse' };
    }
    return intentionCreee(data);
  },

  // L4-04b : l'identifiant est encodé dans le chemin — il peut venir de l'adresse de retour,
  // donc de l'extérieur ; le serveur décide s'il appartient au compte (mon_intention, 0037).
  async constaterIntention(intentionId: string): Promise<ResultatConstat> {
    const { data, error } = (await supabase.functions.invoke(
      `abonnement-constat/${encodeURIComponent(intentionId)}`,
      { method: 'POST' },
    )) as AppelFonction;
    if (error) {
      const refus = await refusDe(error);
      return refus ? { issue: 'refusee', refus } : { issue: 'sans_reponse' };
    }
    return constat(data);
  },

  async lireMesAbonnements() {
    const { data, error } = await supabase
      .from('abonnements')
      .select(
        'id, prix_fige_centimes, statut, prochain_prelevement_le, pause_jusqu_le, fin_acces_le, offres(titre), profils_coach(prenom, nom)',
      )
      .order('cree_le', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as LigneAbonnementClient[]).map((l): AbonnementClient => ({
      id: l.id,
      coachPrenom: l.profils_coach?.prenom ?? null,
      coachNom: l.profils_coach?.nom ?? null,
      offreTitre: l.offres?.titre ?? null,
      prixFigeCentimes: l.prix_fige_centimes,
      statut: l.statut as StatutAbonnement,
      prochainPrelevementLe: l.prochain_prelevement_le,
      pauseJusquLe: l.pause_jusqu_le,
      finAccesLe: l.fin_acces_le,
    }));
  },

  async transitionAbonnement(abonnementId, transition) {
    const fonction = {
      resilier: 'demander_resiliation',
      annuler_resiliation: 'annuler_resiliation',
      reprendre: 'reprendre_abonnement',
    }[transition];
    const { error } = await supabase.rpc(fonction, { p_abonnement_id: abonnementId });
    if (error) return { succes: false, code: error.message };
    return { succes: true };
  },

  async lireEtiquettesAvis() {
    const { data, error } = await supabase
      .from('etiquettes_avis')
      .select('cle, libelle')
      .order('ordre_affichage', { ascending: true });
    if (error) throw error;
    return (data ?? []) as EtiquetteAvis[];
  },

  async lireAvisDuCoach(coachId: string): Promise<AvisDuCoach> {
    const [liste, synthese] = await Promise.all([
      supabase.rpc('avis_du_coach', { p_coach_id: coachId }),
      supabase.rpc('synthese_avis_du_coach', { p_coach_id: coachId }),
    ]);
    if (liste.error) throw liste.error;
    if (synthese.error) throw synthese.error;
    const s = (synthese.data as LigneSyntheseAvis[])[0];
    return {
      avis: ((liste.data ?? []) as LigneAvisPublic[]).map((a) => ({
        id: a.id,
        prenom: a.prenom,
        initialeNom: a.initiale_nom,
        dureeSuiviMois: a.duree_suivi_mois,
        note: a.note,
        etiquettes: a.etiquettes,
        texte: a.texte,
      })),
      synthese: {
        nombre: s.nombre,
        moyenne: s.moyenne === null ? null : Number(s.moyenne),
        distribution: s.distribution,
        etiquettesPortees: s.etiquettes_portees,
      },
    };
  },

  async lireMonAvis(coachId: string): Promise<EtatMonAvis> {
    const { data, error } = await supabase.rpc('mon_avis_possible', { p_coach_id: coachId });
    if (error) throw error;
    const l = (data as LigneMonAvis[])[0];
    if (l.etat === 'pas_encore')
      return { etat: 'pas_encore', joursRestants: l.jours_restants as number };
    if (l.etat === 'modifiable' || l.etat === 'fige') {
      return {
        etat: l.etat,
        avis: {
          note: l.note as number,
          etiquettes: l.etiquettes ?? [],
          texte: l.texte,
          statut: l.statut as MonAvis['statut'],
        },
      };
    }
    return { etat: l.etat };
  },

  deposerAvis(coachId: string, saisie: SaisieAvis): Promise<ResultatAvis> {
    return ecrireAvis('POST', coachId, saisie);
  },

  modifierAvis(coachId: string, saisie: SaisieAvis): Promise<ResultatAvis> {
    return ecrireAvis('PATCH', coachId, saisie);
  },
} satisfies PortDonnees;
