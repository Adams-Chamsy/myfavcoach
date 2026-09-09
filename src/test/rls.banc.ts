import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Banc d'essai des politiques RLS de supabase/migrations/0002_politiques.sql, contre le VRAI
// projet Supabase de DÉVELOPPEMENT, jamais une doublure : une politique trop permissive contre
// une fausse base ne produit aucun symptôme (docs/prompts/L1.md, P1.5).
//
// Cible le projet distant de développement, PAS une pile locale (Postgres + GoTrue + PostgREST
// via `supabase start`) : cette machine (8 Go de mémoire, disque saturé) ne fait pas tourner
// Docker de façon fiable. Le projet de développement est jetable — d'où la garde de sécurité
// ci-dessous, qui empêche ce banc de viser autre chose que lui, y compris une future
// production.
//
// Nom volontairement SANS ".test." : ce fichier ne doit jamais tourner via `npm test`
// générique (qui doit rester rapide et sans dépendance externe) — seulement via
// `npm run test:rls`, qui cible explicitement `**/rls.banc.ts`. `npm test` seul ne verra donc
// jamais ce fichier, `npm run test:rls` si.
//
// Si les identifiants manquent ou si la garde de sécurité refuse la cible, la suite entière
// ÉCHOUE dans son beforeAll — jamais `it.skip`, jamais une sortie verte sans avoir rien
// vérifié : un test ignoré qui ressemble à un test vert est le genre de faux vert qui a coûté
// du temps au lot L0.
//
// Portée des échecs de préparation : le beforeAll global (config, garde, comptes A/B/C) fait
// échouer TOUTE la suite s'il échoue — rien ne peut tourner sans ces trois comptes. Mais la
// préparation propre à profils_client (profils client de A et B) et à profils_coach (profil
// coach de B) vit dans un beforeAll imbriqué, à l'intérieur de son propre describe : un échec
// n'y contamine que les tests de ce describe, jamais les autres. Trouvé au cycle rouge/vert de
// profils_client_select_proprietaire (docs/prompts/L1.md, P1.5) : avant cette scission, sa
// suppression faisait échouer les 21 tests du fichier avec le même message, y compris des
// tests de `comptes` et `consentements` qui n'ont rien à voir avec profils_client.

const RACINE_DEPOT = join(__dirname, '..', '..');
const SUFFIXE_COMPTE = Date.now();
const MOT_DE_PASSE = 'Un-mot-de-passe-de-banc-2026';

// Préfixe et domaine des adresses de test : reconnaissables dans le tableau de bord Supabase
// (le projet est partagé avec l'usage manuel), et utilisés tels quels par
// `npm run test:rls:nettoyage` (scripts/nettoyer-comptes-banc-rls.mjs) pour retrouver et
// supprimer les comptes d'une exécution tuée en cours de route. ".test" est un domaine réservé
// (RFC 2606), jamais routable.
const PREFIXE_EMAIL = 'banc-rls-';
const DOMAINE_EMAIL = 'banc-rls.test';

// GARDE DE SÉCURITÉ — seule référence de projet acceptée. Ce banc CRÉE et SUPPRIME des comptes
// réels : pointé par erreur sur un mauvais projet (et un jour sur la production), il
// détruirait des données réelles. Une variable d'environnement mal copiée suffit — c'est
// exactement ce que cette constante empêche, en refusant de continuer plutôt que de faire
// confiance à ce que .secrets-rls.local contient.
const REFERENCE_PROJET_AUTORISEE = 'imzdtntaqbtymoacsxua';

let API_URL: string;
let ANON_KEY: string;
let SERVICE_ROLE_KEY: string;

type Session = { compteId: string; jwt: string };
type Appelant = Session | 'anon' | 'admin';

// Analyse minimale d'un fichier .env : pas de dépendance (CLAUDE.md §4, "aucune dépendance
// sans le demander"), on n'a besoin que de lignes CLE=valeur, avec guillemets optionnels.
function lireFichierEnv(chemin: string): Record<string, string> {
  if (!existsSync(chemin)) return {};
  const valeurs: Record<string, string> = {};
  for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
    const propre = ligne.trim();
    if (!propre || propre.startsWith('#')) continue;
    const correspondance = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(propre);
    if (!correspondance) continue;
    let valeur = correspondance[2].trim();
    if (
      (valeur.startsWith('"') && valeur.endsWith('"')) ||
      (valeur.startsWith("'") && valeur.endsWith("'"))
    ) {
      valeur = valeur.slice(1, -1);
    }
    valeurs[correspondance[1]] = valeur;
  }
  return valeurs;
}

// Lit les identifiants réseau (.env pour la clé anonyme, déjà publique ; .secrets-rls.local pour
// l'URL et la clé secrète d'administration du banc), vérifie qu'aucun ne manque, puis applique
// la garde de sécurité sur la référence de projet AVANT tout appel réseau.
function chargerConfigurationBanc(): { apiUrl: string; anonKey: string; cleAdmin: string } {
  const variablesPubliques = lireFichierEnv(join(RACINE_DEPOT, '.env'));
  const variablesTest = lireFichierEnv(join(RACINE_DEPOT, '.secrets-rls.local'));

  const anonKey = variablesPubliques.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const apiUrl = variablesTest.SUPABASE_URL_TEST;
  const cleAdmin = variablesTest.SUPABASE_CLE_ADMIN_TEST;

  const manquantes: string[] = [];
  if (!apiUrl) manquantes.push('SUPABASE_URL_TEST (.secrets-rls.local)');
  if (!cleAdmin) manquantes.push('SUPABASE_CLE_ADMIN_TEST (.secrets-rls.local)');
  if (!anonKey) manquantes.push('EXPO_PUBLIC_SUPABASE_ANON_KEY (.env)');
  if (manquantes.length > 0) {
    throw new Error(
      [
        `Variable(s) manquante(s) pour npm run test:rls : ${manquantes.join(', ')}.`,
        '',
        'Copie .secrets-rls.local.exemple en .secrets-rls.local et remplis-le (le fichier explique',
        'où trouver chaque valeur). Puis relance `npm run test:rls`.',
      ].join('\n'),
    );
  }

  const correspondanceUrl = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(apiUrl!.trim());
  const referenceTrouvee = correspondanceUrl?.[1] ?? apiUrl!;
  if (referenceTrouvee !== REFERENCE_PROJET_AUTORISEE) {
    throw new Error(
      [
        'GARDE DE SÉCURITÉ : SUPABASE_URL_TEST ne pointe pas vers le projet Supabase de',
        `développement autorisé (${REFERENCE_PROJET_AUTORISEE}).`,
        `Référence trouvée : "${referenceTrouvee}".`,
        '',
        'Ce banc CRÉE et SUPPRIME des comptes réels : corrige SUPABASE_URL_TEST dans',
        '.secrets-rls.local avant de relancer. Ne contourne jamais cette garde.',
      ].join('\n'),
    );
  }

  return { apiUrl: apiUrl!.replace(/\/$/, ''), anonKey: anonKey!, cleAdmin: cleAdmin! };
}

async function appelRest(
  chemin: string,
  options: {
    methode?: string;
    session?: Appelant;
    corps?: unknown;
  } = {},
): Promise<{ statut: number; corps: unknown }> {
  const { methode = 'GET', session = 'anon', corps } = options;
  const jeton =
    session === 'anon' ? ANON_KEY : session === 'admin' ? SERVICE_ROLE_KEY : session.jwt;

  const reponse = await fetch(`${API_URL}${chemin}`, {
    method: methode,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jeton}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });

  const texte = await reponse.text();
  let corpsAnalyse: unknown = null;
  if (texte) {
    try {
      corpsAnalyse = JSON.parse(texte);
    } catch {
      corpsAnalyse = texte;
    }
  }
  return { statut: reponse.status, corps: corpsAnalyse };
}

async function creerCompteReel(
  email: string,
  metadonnees: Record<string, unknown>,
): Promise<Session> {
  const creation = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: MOT_DE_PASSE,
      email_confirm: true, // pas de passage par Inbucket : le banc doit être déterministe.
      user_metadata: metadonnees,
    }),
  });
  if (!creation.ok) {
    throw new Error(
      `Création du compte ${email} refusée : ${creation.status} ${await creation.text()}`,
    );
  }
  const utilisateur = (await creation.json()) as { id: string };

  const connexion = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: MOT_DE_PASSE }),
  });
  if (!connexion.ok) {
    throw new Error(
      `Connexion de ${email} refusée : ${connexion.status} ${await connexion.text()}`,
    );
  }
  const session = (await connexion.json()) as { access_token: string };

  return { compteId: utilisateur.id, jwt: session.access_token };
}

async function supprimerCompteReel(compteId: string): Promise<void> {
  await fetch(`${API_URL}/auth/v1/admin/users/${compteId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  // ON DELETE CASCADE (0001_creer_identite.sql) nettoie comptes/profils_client/profils_coach/
  // consentements derrière — rien d'autre à faire ici.
}

let A: Session;
let B: Session;
let C: Session;

beforeAll(async () => {
  const configuration = chargerConfigurationBanc();
  API_URL = configuration.apiUrl;
  ANON_KEY = configuration.anonKey;
  SERVICE_ROLE_KEY = configuration.cleAdmin;

  // A : profil client seul. B : profil client + profil coach. C : aucun profil.
  A = await creerCompteReel(`${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-a@${DOMAINE_EMAIL}`, {
    date_naissance: '2000-01-01',
    cgu_version_acceptee: '2026-08-01',
  });
  B = await creerCompteReel(`${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-b@${DOMAINE_EMAIL}`, {
    date_naissance: '1995-01-01',
    cgu_version_acceptee: '2026-08-01',
  });
  C = await creerCompteReel(`${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-c@${DOMAINE_EMAIL}`, {
    date_naissance: '1990-01-01',
    cgu_version_acceptee: '2026-08-01',
  });
}, 30_000);

afterAll(async () => {
  if (A) await supprimerCompteReel(A.compteId);
  if (B) await supprimerCompteReel(B.compteId);
  if (C) await supprimerCompteReel(C.compteId);
});

describe('profils_client', () => {
  // A et B créent leur profil client par le chemin réel : leur propre session, la politique
  // d'INSERT de profils_client s'applique (PostgREST direct, docs/api.md §3).
  //
  // Chaque étape de préparation vérifie son propre succès : un échec silencieux ici (ex. une
  // politique RLS ou un GRANT manquant) ne doit jamais se manifester des dizaines de lignes plus
  // bas comme un échec de politique incompréhensible — il doit arrêter CE beforeAll, avec la
  // réponse HTTP exacte, sans faire échouer les describe voisins (comptes, consentements) qui
  // n'ont pas besoin de profils_client.
  beforeAll(async () => {
    const profilClientA = await appelRest('/rest/v1/profils_client', {
      methode: 'POST',
      session: A,
      corps: { compte_id: A.compteId, prenom: 'A' },
    });
    if (profilClientA.statut >= 400) {
      throw new Error(
        `Préparation du banc : création du profil client de A refusée (${profilClientA.statut}) : ` +
          JSON.stringify(profilClientA.corps),
      );
    }

    const profilClientB = await appelRest('/rest/v1/profils_client', {
      methode: 'POST',
      session: B,
      corps: { compte_id: B.compteId, prenom: 'B' },
    });
    if (profilClientB.statut >= 400) {
      throw new Error(
        `Préparation du banc : création du profil client de B refusée (${profilClientB.statut}) : ` +
          JSON.stringify(profilClientB.corps),
      );
    }
  }, 30_000);

  it('A lit son profil client : une ligne', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_client?compte_id=eq.${A.compteId}`,
      {
        session: A,
      },
    );
    expect(statut).toBe(200);
    expect(corps).toHaveLength(1);
  });

  it('A lit le profil client de B : zéro ligne', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_client?compte_id=eq.${B.compteId}`,
      {
        session: A,
      },
    );
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });

  // Trou de couverture trouvé par le cycle rouge/vert de profils_client_update_espace_client :
  // seul le cas illégitime (ci-dessous) était couvert. Supprimer la politique ne faisait alors
  // ROUGIR aucun test — le cas légitime (le propriétaire modifie son propre profil) prouve que
  // la politique autorise bien l'accès qu'elle doit autoriser, pas seulement qu'elle refuse.
  // nom, objectifs et onboarding_etape ajoutés ici (P1.11) : trois des quatre champs que
  // src/services/donnees/supabase.ts écrit sans qu'aucun scénario du banc n'ait jamais exercé
  // leur nom exact contre le vrai serveur — trouvé en répondant à la question posée après le
  // bug date_naissance/dateNaissance (voir la nouvelle entrée de docs/dette.md et la ligne 5 du
  // tableau des faux verts de docs/prompts/L1.md). rythme_hebdo l'était déjà ; le rassemblement
  // ici, dans le même PATCH, prouve les quatre noms de colonnes d'un coup.
  it('A modifie son propre profil client : accepté (rythme_hebdo, nom, objectifs, onboarding_etape)', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_client?compte_id=eq.${A.compteId}`,
      {
        methode: 'PATCH',
        session: A,
        corps: {
          rythme_hebdo: '3 fois par semaine',
          nom: 'Dupont',
          objectifs: ['perdre-du-poids', 'mieux-manger'],
          onboarding_etape: 3,
        },
      },
    );
    expect(statut).toBe(200);
    const ligne = (
      corps as {
        rythme_hebdo: string;
        nom: string;
        objectifs: string[];
        onboarding_etape: number;
      }[]
    )[0];
    expect(ligne.rythme_hebdo).toBe('3 fois par semaine');
    expect(ligne.nom).toBe('Dupont');
    expect(ligne.objectifs).toEqual(['perdre-du-poids', 'mieux-manger']);
    expect(ligne.onboarding_etape).toBe(3);
  });

  // Trouvé en P1.11 en corrigeant creerProfilClient (le bouton retour peut ramener à l'étape 1
  // une fois le profil déjà créé — un second INSERT y échouerait sur la contrainte d'unicité) :
  // un upsert (POST + Prefer: resolution=merge-duplicates, l'équivalent REST de .upsert())
  // semblait la solution évidente, mais échoue — compte_id n'a AUCUN grant UPDATE
  // (0001_creer_identite.sql : "un profil ne change jamais de propriétaire"), et le plan
  // d'exécution d'un upsert le réécrit dans sa branche UPDATE même à valeur inchangée. D'où le
  // choix réel : UPDATE (colonnes accordées) d'abord, INSERT seulement si 0 ligne touchée.
  it('A upserte son propre profil client (POST + merge-duplicates) : refusé — compte_id sans grant UPDATE', async () => {
    const reponse = await fetch(`${API_URL}/rest/v1/profils_client`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${A.jwt}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({ compte_id: A.compteId, prenom: 'Camille-upsert' }),
    });
    expect(reponse.status).toBe(403);
    const corps = await reponse.json();
    expect(JSON.stringify(corps)).toContain('permission denied');
  });

  // Trouvé en P1.11 : src/services/donnees/supabase.ts envoyait un PATCH SANS ce filtre —
  // jamais vu ici (le banc filtre toujours), jamais vu par le test mocké de l'adaptateur (qui
  // ne vérifie que ce que le mock a reçu, pas ce que Postgres en ferait). Documente la vraie
  // raison, permanente : Supabase précharge `safeupdate` sur le rôle authenticator
  // (session_preload_libraries, confirmé via pg_roles.rolconfig), qui refuse tout UPDATE/DELETE
  // sans clause WHERE — avant même que RLS s'évalue. Un PATCH sans filtre échoue donc ICI aussi
  // maintenant, indépendamment du code applicatif : ce scénario reste vrai tant que
  // `safeupdate` reste chargé, que src/services/donnees/supabase.ts filtre ou non.
  it('A modifie son profil client SANS filtre compte_id dans l’URL : refusé par safeupdate, pas par RLS', async () => {
    const { statut, corps } = await appelRest('/rest/v1/profils_client', {
      methode: 'PATCH',
      session: A,
      corps: { rythme_hebdo: '5 fois et plus par semaine' },
    });
    expect(statut).toBe(400);
    expect(JSON.stringify(corps)).toContain('UPDATE requires a WHERE clause');
  });

  it('A modifie le profil client de B : refusé', async () => {
    const { corps } = await appelRest(`/rest/v1/profils_client?compte_id=eq.${B.compteId}`, {
      methode: 'PATCH',
      session: A,
      corps: { prenom: 'PIRATE' },
    });
    // RLS sans ligne correspondante = 0 ligne affectée, silencieusement (docs/backend.md §5).
    expect(corps).toEqual([]);

    // Preuve indépendante, par un chemin qui ne dépend pas de la politique testée : le profil
    // de B n'a pas changé.
    const { corps: relu } = await appelRest(`/rest/v1/profils_client?compte_id=eq.${B.compteId}`, {
      session: 'admin',
    });
    expect((relu as { prenom: string }[])[0].prenom).toBe('B');
  });

  it("un deuxième profil client sur le même compte est refusé par la contrainte d'unicité", async () => {
    const { statut } = await appelRest('/rest/v1/profils_client', {
      methode: 'POST',
      session: A,
      corps: { compte_id: A.compteId, prenom: 'A bis' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });
});

describe('profils_coach', () => {
  // Le profil coach de B : creer_profil_coach (fonction SECURITY DEFINER, docs/ecrans/
  // L1-08-activation-espace-coach.md) n'existe pas encore — c'est un lot L2. service_role
  // contourne RLS pour ce SEUL geste de préparation du banc, jamais dans une assertion de
  // politique elle-même (chaque assertion ci-dessous appelle en tant que A, B ou C, jamais en
  // tant que service_role, sauf pour relire un état de contrôle indépendant de ce qui est
  // testé). Nécessite le GRANT de supabase/migrations/0003_accorder_service_role.sql.
  beforeAll(async () => {
    const profilCoachB = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: { compte_id: B.compteId, prenom: 'B', nom: 'Coach', discipline: 'yoga' },
    });
    if (profilCoachB.statut >= 400) {
      throw new Error(
        `Préparation du banc : création du profil coach de B refusée (${profilCoachB.statut}) : ` +
          `${JSON.stringify(profilCoachB.corps)} — vérifie que 0003_accorder_service_role.sql ` +
          'est bien appliqué sur ce projet.',
      );
    }

    // Précondition réelle et indépendante de describe('profils_client') : basculer_profil('client')
    // exige qu'un profil client existe déjà (0002_politiques.sql) — sans ça, le retour "coach ->
    // client" du test suivant échoue silencieusement (son résultat n'est pas vérifié, seul l'aller
    // l'est) et B reste bloqué en espace coach pour le test d'après. Trouvé quand
    // describe('profils_client') a été isolé dans son propre beforeAll : son échec laissait alors
    // B sans profil client, cassant ce describe-ci pour une raison qui n'a rien à voir avec ses
    // propres politiques. Via service_role, jamais affecté par les politiques de profils_client :
    // ce n'est pas ce que ce describe teste, seulement ce dont il a besoin pour exister.
    const profilClientExistant = await appelRest(
      `/rest/v1/profils_client?compte_id=eq.${B.compteId}`,
      { session: 'admin' },
    );
    const dejaCree =
      Array.isArray(profilClientExistant.corps) && profilClientExistant.corps.length > 0;
    if (!dejaCree) {
      const creation = await appelRest('/rest/v1/profils_client', {
        methode: 'POST',
        session: 'admin',
        corps: { compte_id: B.compteId, prenom: 'B' },
      });
      if (creation.statut >= 400) {
        throw new Error(
          `Préparation du banc : création (secours) du profil client de B refusée ` +
            `(${creation.statut}) : ${JSON.stringify(creation.corps)}`,
        );
      }
    }
  }, 30_000);

  it('B, en espace client, lit son profil coach : une ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/profils_coach?compte_id=eq.${B.compteId}`, {
      session: B,
    });
    expect(statut).toBe(200);
    expect(corps).toHaveLength(1);
  });

  // Ce test ne PROUVE PAS profils_coach_insert_espace_coach : le cycle rouge/vert de P1.5 a
  // montré 21/21 verts avec ET sans cette politique — elle refuse ce qu'un défaut absence-de-
  // politique refuserait de toute façon (personne ne peut satisfaire son WITH CHECK par ce
  // chemin, voir docs/dette.md). Elle est fonctionnellement inerte aujourd'hui, pas seulement
  // hors de portée du banc. Ce test reste néanmoins utile : il documente le comportement attendu
  // (refus) et resterait vert si la politique disparaissait par erreur — juste sans le prouver
  // par un rouge. Voir docs/dette.md pour l'analyse complète et l'échéance L2.
  it('A tente de créer son profil coach hors espace coach : refusé', async () => {
    const { statut } = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: A,
      corps: { compte_id: A.compteId, prenom: 'A', nom: 'Test', discipline: 'yoga' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  it('B, en espace client, modifie son profil coach : refusé', async () => {
    const { corps } = await appelRest(`/rest/v1/profils_coach?compte_id=eq.${B.compteId}`, {
      methode: 'PATCH',
      session: B,
      corps: { discipline: 'cybersecurite' },
    });
    expect(corps).toEqual([]);
  });

  // Séquentiel par nature : ce test décrit une vraie transition d'état (docs/prompts/L1.md).
  // Remet B en espace client à la fin pour ne pas fausser les tests suivants.
  it('B bascule en coach, modifie son profil coach : accepté', async () => {
    // try/finally : trouvé en cycle rouge/vert de profils_coach_select_proprietaire — un échec
    // des assertions du milieu (n'importe laquelle, pas seulement lors d'un cycle) laissait B
    // bloqué en espace coach, ce qui faisait échouer le test suivant pour une raison sans
    // rapport avec ce qu'il teste réellement. La bascule retour doit s'exécuter dans tous les
    // cas, échec ou non, pour isoler ce test des suivants.
    try {
      const bascule = await appelRest('/rest/v1/rpc/basculer_profil', {
        methode: 'POST',
        session: B,
        corps: { profil: 'coach' },
      });
      expect(bascule.statut).toBe(200);
      expect(bascule.corps).toBe('coach');

      const { statut, corps } = await appelRest(
        `/rest/v1/profils_coach?compte_id=eq.${B.compteId}`,
        {
          methode: 'PATCH',
          session: B,
          corps: { discipline: 'cybersecurite' },
        },
      );
      expect(statut).toBe(200);
      expect((corps as { discipline: string }[])[0].discipline).toBe('cybersecurite');
    } finally {
      await appelRest('/rest/v1/rpc/basculer_profil', {
        methode: 'POST',
        session: B,
        corps: { profil: 'client' },
      });
    }
  });

  it("C bascule vers 'coach' : refusé avec un message exploitable", async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/basculer_profil', {
      methode: 'POST',
      session: C,
      corps: { profil: 'coach' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/Aucun profil coach/);
  });

  it("A appelle basculer_profil en passant l'identifiant de compte de B : sans effet", async () => {
    // Aucun paramètre de compte n'existe dans la signature (0002_politiques.sql) : la fonction
    // agit toujours sur auth.uid(). "Passer l'identifiant de B" n'est possible qu'en ajoutant un
    // paramètre que la fonction ne connaît pas — PostgREST refuse alors de trouver la fonction
    // correspondante, avant même qu'elle ne s'exécute.
    const tentative = await appelRest('/rest/v1/rpc/basculer_profil', {
      methode: 'POST',
      session: A,
      corps: { profil: 'coach', compte_id: B.compteId },
    });
    expect(tentative.statut).toBeGreaterThanOrEqual(400);

    // Preuve indépendante : le profil actif de B (remis en 'client' au test précédent) n'a pas
    // bougé.
    const { corps } = await appelRest(`/rest/v1/comptes?id=eq.${B.compteId}&select=profil_actif`, {
      session: 'admin',
    });
    expect((corps as { profil_actif: string }[])[0].profil_actif).toBe('client');
  });

  // Imbriqué (pas un describe voisin) : hérite du beforeAll ci-dessus (profil coach de B),
  // dont ces tests ont eux aussi besoin.
  describe('colonnes protégées', () => {
    it('une mise à jour directe de profils_coach.statut_verification (hors examen humain) est refusée', async () => {
      const { statut } = await appelRest(`/rest/v1/profils_coach?compte_id=eq.${B.compteId}`, {
        methode: 'PATCH',
        session: B,
        corps: { statut_verification: 'verifiee' },
      });
      expect(statut).toBeGreaterThanOrEqual(400);
    });
  });
});

describe('comptes', () => {
  // Trou de couverture trouvé par le cycle rouge/vert de comptes_select_soi : aucun scénario
  // n'exerçait cette politique (le seul autre test de ce bloc est un UPDATE, refusé pour une
  // tout autre raison — l'absence de grant sur la colonne — et la lecture de basculer_profil
  // passe par service_role, qui contourne RLS et n'est jamais concerné par cette politique).
  // Supprimer comptes_select_soi ne faisait alors ROUGIR aucun test.
  it('A lit son compte : une ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/comptes?id=eq.${A.compteId}`, {
      session: A,
    });
    expect(statut).toBe(200);
    expect(corps).toHaveLength(1);
  });

  it('A lit le compte de B : zéro ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/comptes?id=eq.${B.compteId}`, {
      session: A,
    });
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });

  // Trou de couverture trouvé par le cycle rouge/vert de comptes_update_soi : le seul autre
  // test d'UPDATE sur comptes cible profil_actif, une colonne SANS AUCUN grant (0001) — refusée
  // avant même que RLS s'évalue. telephone est la seule colonne réellement accordée en écriture
  // (0001_creer_identite.sql) ; sans ces deux scénarios, supprimer comptes_update_soi ne
  // faisait ROUGIR aucun test.
  it('A modifie son téléphone : accepté', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/comptes?id=eq.${A.compteId}`, {
      methode: 'PATCH',
      session: A,
      corps: { telephone: '0600000001' },
    });
    expect(statut).toBe(200);
    expect((corps as { telephone: string }[])[0].telephone).toBe('0600000001');
  });

  it('A modifie le téléphone de B : refusé', async () => {
    const { corps } = await appelRest(`/rest/v1/comptes?id=eq.${B.compteId}`, {
      methode: 'PATCH',
      session: A,
      corps: { telephone: '0600000002' },
    });
    // RLS sans ligne correspondante = 0 ligne affectée, silencieusement (docs/backend.md §5).
    expect(corps).toEqual([]);

    // Preuve indépendante, par un chemin qui ne dépend pas de la politique testée : le
    // téléphone de B n'a pas changé.
    const { corps: relu } = await appelRest(`/rest/v1/comptes?id=eq.${B.compteId}`, {
      session: 'admin',
    });
    expect((relu as { telephone: string | null }[])[0].telephone).not.toBe('0600000002');
  });

  it('une mise à jour directe de comptes.profil_actif (hors basculer_profil) est refusée', async () => {
    // Colonne non accordée en écriture (0001_creer_identite.sql) : PostgREST refuse la requête
    // elle-même, une erreur explicite plutôt qu'une mise à jour silencieuse à 0 ligne.
    const { statut } = await appelRest(`/rest/v1/comptes?id=eq.${A.compteId}`, {
      methode: 'PATCH',
      session: A,
      corps: { profil_actif: 'coach' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  it('une mise à jour directe de comptes.date_naissance est refusée (base de la lecture seule L1-09)', async () => {
    // docs/ecrans/L1-09-mes-informations.md : la date de naissance est en lecture seule parce
    // qu'elle porte la règle des 18 ans. « Lecture seule dans l'arbre rendu » (critère 3) est
    // une garantie d'écran ; la vraie barrière est ici — colonne hors de la liste GRANT UPDATE
    // (0001_creer_identite.sql), PostgREST refuse la requête, jamais une écriture silencieuse.
    const { statut } = await appelRest(`/rest/v1/comptes?id=eq.${A.compteId}`, {
      methode: 'PATCH',
      session: A,
      corps: { date_naissance: '1990-01-01' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  it("l'insertion d'un compte de moins de 18 ans est refusée par le déclencheur", async () => {
    const reponse = await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-mineur@${DOMAINE_EMAIL}`,
        password: MOT_DE_PASSE,
        email_confirm: true,
        user_metadata: { date_naissance: '2015-01-01', cgu_version_acceptee: '2026-08-01' },
      }),
    });
    // GoTrue peut reformuler l'erreur du déclencheur plutôt que la citer mot pour mot : on
    // vérifie le refus (pas 2xx), pas le texte exact du message côté HTTP.
    expect(reponse.ok).toBe(false);
  });
});

describe('consentements', () => {
  it("l'insertion d'un consentement sans version est refusée", async () => {
    const { statut } = await appelRest('/rest/v1/consentements', {
      methode: 'POST',
      session: A,
      corps: { compte_id: A.compteId, type: 'donneesSante', accorde: true, origine: 'banc' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });
});

// Toute vue exposée se teste comme une table (docs/prompts/L1.md, P1.5) : un accès légitime qui
// rend la donnée, un accès d'un autre compte qui ne rend rien. En commençant par
// consentements_courants.
describe('consentements_courants (vue) — testée comme une table', () => {
  it('A lit son état courant : une ligne', async () => {
    await appelRest('/rest/v1/consentements', {
      methode: 'POST',
      session: A,
      corps: {
        compte_id: A.compteId,
        type: 'donneesSante',
        accorde: true,
        version: '2026-08-01',
        origine: 'banc',
      },
    });

    const { statut, corps } = await appelRest(
      `/rest/v1/consentements_courants?compte_id=eq.${A.compteId}`,
      { session: A },
    );
    expect(statut).toBe(200);
    expect(corps).toHaveLength(1);
  });

  it("A lit l'état courant de B : zéro ligne", async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/consentements_courants?compte_id=eq.${B.compteId}`,
      { session: A },
    );
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });
});

// Compte dédié à ce scénario, jamais A/B/C : un changement de mot de passe qui leur serait
// appliqué contaminerait tout ce qui les réutilise dans les describe ci-dessus. Prouve la VRAIE
// garantie de docs/ecrans/L1-04-connexion.md, "Nouveau mot de passe" (fiche corrigée à P1.9
// après vérification empirique — voir le commentaire complet là-bas) : le jeton de
// RAFRAÎCHISSEMENT d'une session ouverte ailleurs est invalidé immédiatement ; son jeton
// D'ACCÈS déjà émis, lui, reste valable jusqu'à sa propre expiration (`jwt_expiry`,
// supabase/config.toml). Jamais "ne peut plus rien lire à l'instant" — ni promis par la fiche
// corrigée, ni testé comme tel ici.
describe('changement de mot de passe : sessions ouvertes ailleurs (docs/ecrans/L1-04-connexion.md)', () => {
  it("révoque immédiatement le rafraîchissement d'une autre session, sans invalider son jeton d'accès déjà émis", async () => {
    const email = `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-d@${DOMAINE_EMAIL}`;
    const sessionAppareil1 = await creerCompteReel(email, {
      date_naissance: '1990-01-01',
      cgu_version_acceptee: '2026-08-01',
    });

    try {
      // Deuxième connexion, même compte, mot de passe encore valide à cet instant : simule un
      // deuxième appareil déjà connecté ailleurs.
      const connexion2 = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: MOT_DE_PASSE }),
      });
      if (!connexion2.ok) {
        throw new Error(
          `Deuxième connexion refusée : ${connexion2.status} ${await connexion2.text()}`,
        );
      }
      const sessionAppareil2 = (await connexion2.json()) as {
        access_token: string;
        refresh_token: string;
      };

      // Changement de mot de passe DEPUIS l'appareil 1 — même endpoint que
      // portAuthSupabase.changerMotDePasse (src/services/auth/supabase.ts).
      const changement = await fetch(`${API_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${sessionAppareil1.jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: `${MOT_DE_PASSE}-nouveau` }),
      });
      expect(changement.status).toBe(200);

      // Puis la révocation des autres sessions, comme le fait changerMotDePasse en pratique.
      const revocation = await fetch(`${API_URL}/auth/v1/logout?scope=others`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${sessionAppareil1.jwt}` },
      });
      expect(revocation.status).toBe(204);

      // La vraie garantie : l'appareil 2 ne peut plus JAMAIS obtenir un nouveau jeton.
      const rafraichissementAppareil2 = await fetch(
        `${API_URL}/auth/v1/token?grant_type=refresh_token`,
        {
          method: 'POST',
          headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: sessionAppareil2.refresh_token }),
        },
      );
      expect(rafraichissementAppareil2.status).toBe(400);

      // Ce que ce n'est PAS : son jeton d'accès déjà émis reste valable — résidu borné par
      // jwt_expiry, jamais une lecture bloquée à l'instant. Un échec ici signalerait que
      // Supabase a changé de comportement, pas un bug de l'application — voir le commentaire
      // de ce describe.
      const lectureResiduelle = await appelRest('/rest/v1/comptes?select=id', {
        session: { compteId: sessionAppareil1.compteId, jwt: sessionAppareil2.access_token },
      });
      expect(lectureResiduelle.statut).toBe(200);
    } finally {
      await supprimerCompteReel(sessionAppareil1.compteId);
    }
  });
});

// profil_actif_courant() (0002_politiques.sql) est le mécanisme réel derrière
// src/services/donnees/supabase.ts, ajouté à P1.10 — jamais exercé directement par un
// scénario avant ce describe, seulement indirectement via basculer_profil ci-dessus. Une
// fonction SECURITY DEFINER a besoin de ses propres preuves (docs/backend.md §7), pas
// seulement de celles de basculer_profil qui l'entoure.
describe('profil_actif_courant() (docs/backend.md §7, src/services/donnees/)', () => {
  it("rend le profil actif du compte appelant, jamais celui d'un autre", async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/profil_actif_courant', {
      methode: 'POST',
      session: A,
      corps: {},
    });
    expect(statut).toBe(200);
    expect(corps).toBe('client'); // A ne bascule jamais dans ce fichier.
  });

  it('anon ne peut pas l’appeler (revoke from public, 0002_politiques.sql)', async () => {
    const { statut } = await appelRest('/rest/v1/rpc/profil_actif_courant', {
      methode: 'POST',
      session: 'anon',
      corps: {},
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });
});

// docs/ecrans/L1-05-onboarding-client.md, étape 3/4, critère 4 : "un test contre la base
// réelle prouve qu'écrire une mesure sans consentement enregistré est refusé côté serveur,
// indépendamment de l'écran." Auto-suffisant, jamais dépendant de l'ordre des tests
// précédents : C n'a jamais accordé aucun consentement dans ce fichier avant ce describe.
describe('poids du profil client protégé par consentement (0004_proteger_donnees_sante.sql)', () => {
  beforeAll(async () => {
    // Reflète le vrai parcours (docs/ecrans/L1-05, étape 1 crée la ligne sans poids ; étape 3
    // l'écrit plus tard) : jamais un profil déjà muni de poids créé d'un coup, qui masquerait
    // le chemin UPDATE que ce déclencheur protège réellement.
    const { statut } = await appelRest('/rest/v1/profils_client', {
      methode: 'POST',
      session: C,
      corps: { compte_id: C.compteId, prenom: 'Camille-C' },
    });
    if (statut !== 201) throw new Error(`Préparation du profil client de C échouée : ${statut}`);
  });

  it('C écrit son poids de départ sans consentement donneesSante : refusé', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_client?compte_id=eq.${C.compteId}`,
      {
        methode: 'PATCH',
        session: C,
        corps: { poids_depart_grammes: 70000 },
      },
    );
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).not.toMatch(/70000/); // jamais dans une trace d'erreur
  });

  it('C accorde le consentement donneesSante, puis écrit son poids de départ : accepté', async () => {
    await appelRest('/rest/v1/consentements', {
      methode: 'POST',
      session: C,
      corps: {
        compte_id: C.compteId,
        type: 'donneesSante',
        accorde: true,
        version: '2026-08-01',
        origine: 'banc',
      },
    });

    const { statut } = await appelRest(`/rest/v1/profils_client?compte_id=eq.${C.compteId}`, {
      methode: 'PATCH',
      session: C,
      corps: { poids_depart_grammes: 70000 },
    });
    expect(statut).toBe(200);
  });

  // docs/domaine.md §3.12 : "Son retrait ne supprime pas les données : il bloque l'écriture" —
  // pas "bloque toute écriture future sur la ligne entière" (voir le commentaire de la
  // migration). Un champ SANS RAPPORT (prénom) doit rester modifiable même consentement retiré,
  // poids déjà enregistré compris.
  it('consentement retiré ensuite : le poids déjà enregistré ne bloque pas un champ sans rapport (prénom)', async () => {
    await appelRest('/rest/v1/consentements', {
      methode: 'POST',
      session: C,
      corps: {
        compte_id: C.compteId,
        type: 'donneesSante',
        accorde: false,
        version: '2026-08-01',
        origine: 'banc',
      },
    });

    const { statut } = await appelRest(`/rest/v1/profils_client?compte_id=eq.${C.compteId}`, {
      methode: 'PATCH',
      session: C,
      corps: { prenom: 'Camille-modifie' },
    });
    expect(statut).toBe(200);
  });

  it('consentement retiré : réécrire le poids reste refusé', async () => {
    const { statut } = await appelRest(`/rest/v1/profils_client?compte_id=eq.${C.compteId}`, {
      methode: 'PATCH',
      session: C,
      corps: { poids_cible_grammes: 65000 },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });
});
