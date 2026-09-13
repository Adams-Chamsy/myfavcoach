import { randomUUID } from 'crypto';
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

// Préfixe et domaine des adresses de test : reconnaissables dans le tableau de bord Supabase
// (le projet est partagé avec l'usage manuel), et utilisés tels quels par
// `npm run test:rls:nettoyage` (scripts/nettoyer-comptes-banc-rls.mjs) pour retrouver et
// supprimer les comptes d'une exécution tuée en cours de route. ".test" est un domaine réservé
// (RFC 2606), jamais routable.
const PREFIXE_EMAIL = 'banc-rls-';
const DOMAINE_EMAIL = 'banc-rls.test';

// GARDE DE SÉCURITÉ — seules cibles acceptées. Ce banc CRÉE et SUPPRIME des comptes réels :
// pointé par erreur sur un mauvais projet (et un jour sur la production), il détruirait des
// données réelles. Une variable d'environnement mal copiée suffit — c'est exactement ce que
// cette garde empêche, en refusant de continuer plutôt que de faire confiance à ce que
// .secrets-rls.local contient.
//
// Deux cibles, jamais une autre :
//   - le projet Supabase de DÉVELOPPEMENT distant (référence ci-dessous), pour l'usage local ;
//   - une pile Supabase LOCALE (`supabase start`, hôte localhost / 127.0.0.1) — sans donnée
//     réelle partagée, donc sans risque à créer/supprimer. C'est la cible du workflow
//     .github/workflows/banc-rls.yml (P1.15) : la CI monte une pile éphémère plutôt que de
//     toucher au projet distant partagé.
// Un autre distant (autre référence, `.supabase.co` de prod incluse) est toujours refusé.
const REFERENCE_PROJET_AUTORISEE = 'imzdtntaqbtymoacsxua';
const HOTES_LOCAUX_AUTORISES = new Set(['localhost', '127.0.0.1']);

let API_URL: string;
let ANON_KEY: string;
let SERVICE_ROLE_KEY: string;
// Mot de passe des comptes éphémères du banc : lu depuis .secrets-rls.local
// (BANC_RLS_MOT_DE_PASSE), jamais en clair dans ce fichier suivi par git. Renseigné par le
// beforeAll global, comme API_URL / ANON_KEY / SERVICE_ROLE_KEY.
let MOT_DE_PASSE: string;

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
// l'URL, la clé secrète d'administration du banc et le mot de passe des comptes éphémères),
// vérifie qu'aucun ne manque, puis applique la garde de sécurité sur la référence de projet
// AVANT tout appel réseau.
function chargerConfigurationBanc(): {
  apiUrl: string;
  anonKey: string;
  cleAdmin: string;
  motDePasse: string;
} {
  const variablesPubliques = lireFichierEnv(join(RACINE_DEPOT, '.env'));
  const variablesTest = lireFichierEnv(join(RACINE_DEPOT, '.secrets-rls.local'));

  const anonKey = variablesPubliques.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const apiUrl = variablesTest.SUPABASE_URL_TEST;
  const cleAdmin = variablesTest.SUPABASE_CLE_ADMIN_TEST;
  const motDePasse = variablesTest.BANC_RLS_MOT_DE_PASSE;

  const manquantes: string[] = [];
  if (!apiUrl) manquantes.push('SUPABASE_URL_TEST (.secrets-rls.local)');
  if (!cleAdmin) manquantes.push('SUPABASE_CLE_ADMIN_TEST (.secrets-rls.local)');
  if (!motDePasse) manquantes.push('BANC_RLS_MOT_DE_PASSE (.secrets-rls.local)');
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

  let hoteUrl = '';
  try {
    hoteUrl = new URL(apiUrl!.trim()).hostname;
  } catch {
    hoteUrl = '';
  }
  const correspondanceUrl = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(apiUrl!.trim());
  const referenceTrouvee = correspondanceUrl?.[1] ?? apiUrl!;
  const cibleAutorisee =
    HOTES_LOCAUX_AUTORISES.has(hoteUrl) || referenceTrouvee === REFERENCE_PROJET_AUTORISEE;
  if (!cibleAutorisee) {
    throw new Error(
      [
        'GARDE DE SÉCURITÉ : SUPABASE_URL_TEST ne pointe ni vers le projet Supabase de',
        `développement autorisé (${REFERENCE_PROJET_AUTORISEE}), ni vers une pile locale`,
        '(hôte localhost / 127.0.0.1).',
        `Cible trouvée : "${hoteUrl || referenceTrouvee}".`,
        '',
        'Ce banc CRÉE et SUPPRIME des comptes réels : corrige SUPABASE_URL_TEST dans',
        '.secrets-rls.local avant de relancer. Ne contourne jamais cette garde.',
      ].join('\n'),
    );
  }

  return {
    apiUrl: apiUrl!.replace(/\/$/, ''),
    anonKey: anonKey!,
    cleAdmin: cleAdmin!,
    motDePasse: motDePasse!,
  };
}

async function appelRest(
  chemin: string,
  options: {
    methode?: string;
    session?: Appelant;
    corps?: unknown;
    prefer?: string;
  } = {},
): Promise<{ statut: number; corps: unknown }> {
  const { methode = 'GET', session = 'anon', corps, prefer = 'return=representation' } = options;
  const jeton =
    session === 'anon' ? ANON_KEY : session === 'admin' ? SERVICE_ROLE_KEY : session.jwt;

  const reponse = await fetch(`${API_URL}${chemin}`, {
    method: methode,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jeton}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
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
let D: Session;
// Depuis 0008_politiques_offres.sql : profils_coach.compte_id n'est plus accordée en SELECT à
// authenticated, pour aucun compte, y compris son propriétaire — un GRANT est global au rôle,
// il ne peut pas distinguer "sa propre ligne" de "celle d'un autre" maintenant que ce rôle voit
// aussi les profils vérifiés d'autrui (profils_coach_select_verifiee). Filtrer ou relire par
// compte_id échoue donc désormais pour B comme pour n'importe qui — id (accordée, publique une
// fois le profil vérifié) est le seul filtre qui reste valide pour un appel en tant que B ou A.
let profilCoachIdB: string;
// Hissée au niveau du module (initialement locale au describe('offres')) : describe('pieces_verification'),
// plus bas, réutilise le profil coach de D (jamais vérifié) comme "coach_id d'un autre" — un
// vrai profil existant, pour que le refus observé vienne de la politique et non d'une violation
// de clef étrangère sur un identifiant inventé.
let profilCoachIdD: string;
// Liste exacte du GRANT SELECT de 0008_politiques_offres.sql sur profils_coach — compte_id en
// est absente, volontairement. PostgREST demande "toutes les colonnes" par défaut quand aucun
// `select=` n'est fourni (GET comme le corps représentatif d'un PATCH) : sans cette liste
// explicite, tout appel authenticated/anon échoue en 403 "permission denied for table", que la
// ligne visée existe ou non — ce n'est pas la politique RLS qui répond, c'est le grant.
const COLONNES_PROFIL_COACH_ACCORDEES =
  'id,prenom,nom,photo_url,discipline,titre_court,bio,commune_base_insee,statut_verification,cree_le';

// Même mécanique, sur comptes cette fois : liste exacte du GRANT SELECT de
// 0013_creer_role_examinateur.sql, qui a retiré le SELECT table-large hérité de
// 0001_creer_identite.sql/0006_verrouiller_grants.sql pour en exclure est_examinateur (jamais
// accordée à authenticated, docs/backend.md §9). Un GET/PATCH sans select= explicite équivaut à
// select=*, qui échouerait désormais en 403 pour la même raison que ci-dessus.
const COLONNES_COMPTES_ACCORDEES =
  'id,date_naissance,telephone,profil_actif,cgu_version_acceptee,cree_le,supprime_le';

beforeAll(async () => {
  const configuration = chargerConfigurationBanc();
  API_URL = configuration.apiUrl;
  ANON_KEY = configuration.anonKey;
  SERVICE_ROLE_KEY = configuration.cleAdmin;
  MOT_DE_PASSE = configuration.motDePasse;

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
  // D : coach jamais vérifié (statut_verification reste 'absente'), avec une offre marquée
  // publiée par service_role directement (docs/domaine.md §4.2, P2.4) — une fixture
  // délibérément incohérente : aucun chemin applicatif ne la produit, publier_offre refuserait
  // (coach_non_verifie). Elle prouve que offres_select_publiees revérifie le statut du coach à
  // CHAQUE lecture, pas seulement au moment où publiee_le a été posée.
  // "-f", pas "-d" : "-d" est déjà pris par le compte jetable du describe "changement de mot de
  // passe" plus bas (même SUFFIXE_COMPTE partagé sur tout le fichier — une collision d'e-mail
  // fait échouer la création avec 422 email_exists, trouvé en exécutant ce banc).
  D = await creerCompteReel(`${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-f@${DOMAINE_EMAIL}`, {
    date_naissance: '1985-01-01',
    cgu_version_acceptee: '2026-08-01',
  });
}, 30_000);

afterAll(async () => {
  if (A) await supprimerCompteReel(A.compteId);
  if (B) await supprimerCompteReel(B.compteId);
  if (C) await supprimerCompteReel(C.compteId);
  if (D) await supprimerCompteReel(D.compteId);
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

  // Sens illégitime de profils_client_insert_espace_client, chemin « autre compte » : le
  // WITH CHECK exige compte_id = auth.uid(). Miroir de « A tente de créer son profil coach hors
  // espace coach » (describe profils_coach) — le cas était couvert côté coach, pas côté client.
  it('A insère un profil client pour le compte de B : refusé, profil de B intact', async () => {
    const { statut } = await appelRest('/rest/v1/profils_client', {
      methode: 'POST',
      session: A,
      corps: { compte_id: B.compteId, prenom: 'PIRATE' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);

    const { corps: relu } = await appelRest(`/rest/v1/profils_client?compte_id=eq.${B.compteId}`, {
      session: 'admin',
    });
    expect((relu as { prenom: string }[])[0].prenom).toBe('B');
  });

  // Sens illégitime, chemin « espace » : le WITH CHECK exige aussi profil_actif_courant() =
  // 'client'. Compte dédié muni d'un profil coach (donc profil actif 'coach') et SANS profil
  // client — creer_profil_coach le place exactement dans cet état. Il tente alors d'insérer son
  // propre profil client : refusé parce qu'il n'est pas en espace client.
  it('un compte en espace coach ne peut pas insérer son profil client : refusé', async () => {
    const email = `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-insert-client-espace@${DOMAINE_EMAIL}`;
    const compte = await creerCompteReel(email, {
      date_naissance: '1990-01-01',
      cgu_version_acceptee: '2026-08-01',
    });
    try {
      const creationCoach = await appelRest('/rest/v1/rpc/creer_profil_coach', {
        methode: 'POST',
        session: compte,
        corps: { discipline: 'yoga', telephone: '0612345678', prenom: 'X', nom: 'Y' },
      });
      expect(creationCoach.statut).toBeLessThan(400);

      const { statut } = await appelRest('/rest/v1/profils_client', {
        methode: 'POST',
        session: compte,
        corps: { compte_id: compte.compteId, prenom: 'X' },
      });
      expect(statut).toBeGreaterThanOrEqual(400);

      const { corps } = await appelRest(`/rest/v1/profils_client?compte_id=eq.${compte.compteId}`, {
        session: 'admin',
      });
      expect(corps).toEqual([]);
    } finally {
      await supprimerCompteReel(compte.compteId);
    }
  });
});

describe('profils_coach', () => {
  // Le profil coach de B, créé par INSERT service_role — PAS par creer_profil_coach (0005) :
  // cette fonction passerait aussi comptes.profil_actif à 'coach', or plusieurs tests de ce
  // describe supposent B en espace CLIENT au départ (« B, en espace client, … »). L'INSERT
  // admin pose le profil sans toucher au profil actif. service_role contourne RLS pour ce SEUL
  // geste de préparation, jamais dans une assertion de politique (chaque assertion ci-dessous
  // appelle en tant que A, B ou C, sauf relecture d'un état de contrôle indépendant). Nécessite
  // le GRANT de supabase/migrations/0003_accorder_service_role.sql. Le test réel de
  // creer_profil_coach vit dans son propre describe, plus bas.
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
    profilCoachIdB = (profilCoachB.corps as { id: string }[])[0].id;

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
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=${COLONNES_PROFIL_COACH_ACCORDEES}`,
      { session: B },
    );
    expect(statut).toBe(200);
    expect(corps).toHaveLength(1);
  });

  // Sens illégitime de profils_coach_select_proprietaire : A (session authentifiée) lit le
  // profil coach de B → zéro ligne. Miroir exact de « A lit le profil client de B » (describe
  // profils_client) : le rouge/vert de ce chemin précis n'était pas prouvé côté coach. Filtre
  // par id, pas compte_id (voir la note sur profilCoachIdB) : le profil de B n'étant pas
  // 'verifiee' dans ce describe, ni profils_coach_select_proprietaire (A n'est pas B) ni
  // profils_coach_select_verifiee (pas vérifié) ne l'admettent pour A.
  it('A lit le profil coach de B : zéro ligne', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=${COLONNES_PROFIL_COACH_ACCORDEES}`,
      { session: A },
    );
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
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
    const { corps } = await appelRest(
      `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=${COLONNES_PROFIL_COACH_ACCORDEES}`,
      {
        methode: 'PATCH',
        session: B,
        corps: { discipline: 'cybersécurité' },
      },
    );
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
        `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=${COLONNES_PROFIL_COACH_ACCORDEES}`,
        {
          methode: 'PATCH',
          session: B,
          corps: { discipline: 'cybersécurité' },
        },
      );
      expect(statut).toBe(200);
      expect((corps as { discipline: string }[])[0].discipline).toBe('cybersécurité');
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
    // Filtre par id, pas compte_id : depuis 0008, compte_id n'est plus lisible par authenticated
    // (voir la note sur profilCoachIdB) — filtrer par compte_id ferait échouer cet appel avec
    // "permission denied" avant même d'atteindre la colonne statut_verification, ce qui ferait
    // passer ce test pour la MAUVAISE raison (faux vert : la protection qu'il prétend prouver
    // ne serait plus celle réellement exercée).
    it('une mise à jour directe de profils_coach.statut_verification (hors examen humain) est refusée', async () => {
      const { statut } = await appelRest(`/rest/v1/profils_coach?id=eq.${profilCoachIdB}`, {
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
    const { statut, corps } = await appelRest(
      `/rest/v1/comptes?id=eq.${A.compteId}&select=${COLONNES_COMPTES_ACCORDEES}`,
      { session: A },
    );
    expect(statut).toBe(200);
    expect(corps).toHaveLength(1);
  });

  it('A lit le compte de B : zéro ligne', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/comptes?id=eq.${B.compteId}&select=${COLONNES_COMPTES_ACCORDEES}`,
      { session: A },
    );
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });

  // Trou de couverture trouvé par le cycle rouge/vert de comptes_update_soi : le seul autre
  // test d'UPDATE sur comptes cible profil_actif, une colonne SANS AUCUN grant (0001) — refusée
  // avant même que RLS s'évalue. telephone est la seule colonne réellement accordée en écriture
  // (0001_creer_identite.sql) ; sans ces deux scénarios, supprimer comptes_update_soi ne
  // faisait ROUGIR aucun test.
  it('A modifie son téléphone : accepté', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/comptes?id=eq.${A.compteId}&select=${COLONNES_COMPTES_ACCORDEES}`,
      {
        methode: 'PATCH',
        session: A,
        corps: { telephone: '0600000001' },
      },
    );
    expect(statut).toBe(200);
    expect((corps as { telephone: string }[])[0].telephone).toBe('0600000001');
  });

  it('A modifie le téléphone de B : refusé', async () => {
    const { corps } = await appelRest(
      `/rest/v1/comptes?id=eq.${B.compteId}&select=${COLONNES_COMPTES_ACCORDEES}`,
      {
        methode: 'PATCH',
        session: A,
        corps: { telephone: '0600000002' },
      },
    );
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

// consentements : le journal d'ajout qui porte la seule donnée de santé du lot
// (docs/domaine.md §3.12, 0004_proteger_donnees_sante.sql). Sa chaîne de confidentialité — un
// compte n'insère un consentement QUE pour lui-même, n'en lit QUE les siens — se prouve dans
// les deux sens ici, pas seulement via la vue consentements_courants plus bas.
describe('consentements (journal — chaîne de confidentialité de la donnée de santé)', () => {
  beforeAll(async () => {
    // Sens légitime de consentements_insert_proprietaire : A insère SON propre consentement.
    const { statut } = await appelRest('/rest/v1/consentements', {
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
    if (statut >= 400) {
      throw new Error(
        `Préparation : insertion du consentement de A refusée (${statut}) — consentements_insert_proprietaire ne laisse pas passer le cas légitime.`,
      );
    }
  }, 30_000);

  it("l'insertion d'un consentement sans version est refusée", async () => {
    const { statut } = await appelRest('/rest/v1/consentements', {
      methode: 'POST',
      session: A,
      corps: { compte_id: A.compteId, type: 'donneesSante', accorde: true, origine: 'banc' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  // Sens illégitime de consentements_insert_proprietaire : A insère un consentement AU NOM DE B.
  it('A insère un consentement pour le compte de B : refusé, et B n’en a aucun', async () => {
    const { statut } = await appelRest('/rest/v1/consentements', {
      methode: 'POST',
      session: A,
      corps: {
        compte_id: B.compteId,
        type: 'donneesSante',
        accorde: true,
        version: '2026-08-01',
        origine: 'banc',
      },
    });
    expect(statut).toBeGreaterThanOrEqual(400);

    // Preuve indépendante : rien n'a été écrit dans le journal de B.
    const { corps } = await appelRest(
      `/rest/v1/consentements?compte_id=eq.${B.compteId}&type=eq.donneesSante`,
      { session: 'admin' },
    );
    expect(corps).toEqual([]);
  });

  // Sens légitime de consentements_select_proprietaire, SELECT DIRECT sur le journal (pas la vue).
  it('A lit ses propres consentements (journal) : au moins une ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/consentements?compte_id=eq.${A.compteId}`, {
      session: A,
    });
    expect(statut).toBe(200);
    expect((corps as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  // Sens illégitime : A lit le journal de consentements de B.
  it('A lit les consentements de B (journal) : zéro ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/consentements?compte_id=eq.${B.compteId}`, {
      session: A,
    });
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
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

// docs/ecrans/L1-09-mes-informations.md, critère 4 : un changement d'adresse ne prend effet
// qu'après confirmation (double_confirm_changes = true, supabase/config.toml). Prouve
// l'invariant côté base : la demande MET EN ATTENTE la nouvelle adresse (auth.users.new_email)
// sans toucher à auth.users.email.
//
// Passe par POST /auth/v1/admin/generate_link (type email_change_new) et JAMAIS par
// PUT /auth/v1/user : les deux mettent la même chose en attente, mais generate_link N'ENVOIE
// AUCUN COURRIEL (il rend le lien directement), là où PUT /user tenterait un envoi à chaque
// exécution du banc vers une adresse .test non routable — du quota consommé pour rien
// (service de courriel intégré, ~2/h sur le plan gratuit). generate_link exige la clé admin,
// que le banc a déjà.
describe("changement d'adresse : effectif seulement après confirmation (docs/ecrans/L1-09)", () => {
  it('met la nouvelle adresse en attente (new_email) sans modifier auth.users.email', async () => {
    const email = `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-e@${DOMAINE_EMAIL}`;
    const nouvelEmail = `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-e-nouveau@${DOMAINE_EMAIL}`;
    const session = await creerCompteReel(email, {
      date_naissance: '1990-01-01',
      cgu_version_acceptee: '2026-08-01',
    });

    try {
      const lien = await fetch(`${API_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'email_change_new', email, new_email: nouvelEmail }),
      });
      expect(lien.status).toBeLessThan(400);

      const relu = await fetch(`${API_URL}/auth/v1/admin/users/${session.compteId}`, {
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      });
      const utilisateur = (await relu.json()) as { email: string; new_email: string | null };
      // L'adresse du compte n'a pas bougé ; la nouvelle n'est que MISE EN ATTENTE.
      expect(utilisateur.email).toBe(email);
      expect(utilisateur.new_email).toBe(nouvelEmail);
    } finally {
      await supprimerCompteReel(session.compteId);
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

  // docs/ecrans/L1-09, « Confidentialité » (P1.13d) : après un retrait, « Effacer mes mesures
  // enregistrées » remet les colonnes de poids à NULL. Le déclencheur ne bloque que l'écriture
  // d'une valeur NON nulle (0004, `and new.poids_* is not null`) — l'effacement doit donc
  // passer malgré le consentement retiré. C n'a toujours pas de consentement `donneesSante`
  // actif à ce stade du fichier.
  it('consentement retiré : effacer le poids (le remettre à NULL) est accepté', async () => {
    const { statut } = await appelRest(`/rest/v1/profils_client?compte_id=eq.${C.compteId}`, {
      methode: 'PATCH',
      session: C,
      corps: { poids_depart_grammes: null, poids_cible_grammes: null },
    });
    expect(statut).toBe(200);

    const { corps } = await appelRest(
      `/rest/v1/profils_client?compte_id=eq.${C.compteId}&select=poids_depart_grammes,poids_cible_grammes`,
      { session: 'admin' },
    );
    expect((corps as { poids_depart_grammes: number | null }[])[0].poids_depart_grammes).toBeNull();
  });
});

// docs/ecrans/L1-08-activation-espace-coach.md : creer_profil_coach (0005_creer_profil_coach.sql,
// SECURITY DEFINER) insère le profil coach ET passe comptes.profil_actif à 'coach' dans une
// seule transaction. Comptes dédiés (D, E, G), jamais A/B/C : cette fonction change leur état.
describe('creer_profil_coach (0005_creer_profil_coach.sql)', () => {
  async function appelerRpcCreerCoach(
    session: Session,
    corps: Record<string, unknown>,
  ): Promise<{ statut: number; corps: unknown }> {
    return appelRest('/rest/v1/rpc/creer_profil_coach', { methode: 'POST', session, corps });
  }

  it('crée le profil coach et passe le profil actif à coach, atomiquement', async () => {
    const email = `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-coach-d@${DOMAINE_EMAIL}`;
    const D = await creerCompteReel(email, {
      date_naissance: '1990-01-01',
      cgu_version_acceptee: '2026-08-01',
    });

    try {
      const { statut } = await appelerRpcCreerCoach(D, {
        discipline: 'yoga',
        telephone: '0612345678',
        prenom: 'Dora',
        nom: 'Test',
      });
      expect(statut).toBeLessThan(400);

      const { corps: profils } = await appelRest(
        `/rest/v1/profils_coach?compte_id=eq.${D.compteId}&select=discipline,statut_verification`,
        { session: 'admin' },
      );
      expect(profils).toHaveLength(1);
      expect((profils as { discipline: string; statut_verification: string }[])[0]).toMatchObject({
        discipline: 'yoga',
        statut_verification: 'absente',
      });

      const { corps: compte } = await appelRest(
        `/rest/v1/comptes?id=eq.${D.compteId}&select=profil_actif,telephone`,
        { session: 'admin' },
      );
      expect((compte as { profil_actif: string; telephone: string }[])[0]).toMatchObject({
        profil_actif: 'coach',
        telephone: '0612345678',
      });

      // Deuxième appel : refusé par la contrainte d'unicité de profils_coach.compte_id (0001),
      // pas seulement par l'écran. La transaction échoue en entier — toujours une seule ligne.
      const secondAppel = await appelerRpcCreerCoach(D, {
        discipline: 'cuisine',
        telephone: '0611111111',
        prenom: 'Dora',
        nom: 'Test',
      });
      expect(secondAppel.statut).toBeGreaterThanOrEqual(400);

      const { corps: profilsApres } = await appelRest(
        `/rest/v1/profils_coach?compte_id=eq.${D.compteId}&select=discipline`,
        { session: 'admin' },
      );
      expect(profilsApres).toHaveLength(1);
      expect((profilsApres as { discipline: string }[])[0].discipline).toBe('yoga');
    } finally {
      await supprimerCompteReel(D.compteId);
    }
  });

  it('une erreur en cours de création ne laisse aucun profil coach partiel ni ne change le profil actif', async () => {
    const email = `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-coach-e@${DOMAINE_EMAIL}`;
    const E = await creerCompteReel(email, {
      date_naissance: '1990-01-01',
      cgu_version_acceptee: '2026-08-01',
    });

    try {
      // nom NULL : profils_coach.nom est NOT NULL (0001) → l'INSERT échoue, donc toute la
      // fonction. L'UPDATE de comptes.profil_actif qui suit ne s'exécute jamais.
      const { statut } = await appelerRpcCreerCoach(E, {
        discipline: 'yoga',
        telephone: '0612345678',
        prenom: 'Eli',
        nom: null,
      });
      expect(statut).toBeGreaterThanOrEqual(400);

      const { corps: profils } = await appelRest(
        `/rest/v1/profils_coach?compte_id=eq.${E.compteId}`,
        { session: 'admin' },
      );
      expect(profils).toEqual([]);

      const { corps: compte } = await appelRest(
        `/rest/v1/comptes?id=eq.${E.compteId}&select=profil_actif`,
        { session: 'admin' },
      );
      expect((compte as { profil_actif: string }[])[0].profil_actif).toBe('client');
    } finally {
      await supprimerCompteReel(E.compteId);
    }
  });

  it('un compte ne peut créer un profil coach que pour lui-même', async () => {
    const emailG = `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-coach-g@${DOMAINE_EMAIL}`;
    const emailH = `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-coach-h@${DOMAINE_EMAIL}`;
    const G = await creerCompteReel(emailG, {
      date_naissance: '1990-01-01',
      cgu_version_acceptee: '2026-08-01',
    });
    const H = await creerCompteReel(emailH, {
      date_naissance: '1990-01-01',
      cgu_version_acceptee: '2026-08-01',
    });

    try {
      // La fonction n'a AUCUN paramètre de compte (signature (discipline, telephone, prenom,
      // nom)) : glisser un compte_id supplémentaire ne correspond à aucune fonction — PostgREST
      // refuse la requête (404/400 selon la version), la tentative n'aboutit nulle part.
      const tentativeAvecCompteId = await appelerRpcCreerCoach(G, {
        discipline: 'yoga',
        telephone: '0612345678',
        prenom: 'Gaby',
        nom: 'Test',
        compte_id: H.compteId,
      });
      expect(tentativeAvecCompteId.statut).toBeGreaterThanOrEqual(400);

      // Appel correct par G : crée le profil coach de G (auth.uid()), jamais celui de H.
      const { statut } = await appelerRpcCreerCoach(G, {
        discipline: 'yoga',
        telephone: '0612345678',
        prenom: 'Gaby',
        nom: 'Test',
      });
      expect(statut).toBeLessThan(400);

      const { corps: coachH } = await appelRest(
        `/rest/v1/profils_coach?compte_id=eq.${H.compteId}`,
        { session: 'admin' },
      );
      expect(coachH).toEqual([]);

      const { corps: coachG } = await appelRest(
        `/rest/v1/profils_coach?compte_id=eq.${G.compteId}&select=compte_id`,
        { session: 'admin' },
      );
      expect(coachG).toHaveLength(1);
      expect((coachG as { compte_id: string }[])[0].compte_id).toBe(G.compteId);
    } finally {
      await supprimerCompteReel(G.compteId);
      await supprimerCompteReel(H.compteId);
    }
  });
});

// Première famille d'ouvertures du dépôt (docs/prompts/L2.md, P2.4 ; docs/backend.md §8) : une
// politique trop permissive ici ne produit plus une liste vide, elle produit une fuite. Les cas
// illégitimes comptent au moins autant que les cas légitimes — voir le groupe dédié plus bas.
describe('offres', () => {
  let offreIdBrouillonB: string;
  let offreIdPublieeB: string;
  let offreIdRetireeB: string;
  let offreIdPublieeD: string;

  beforeAll(async () => {
    // D : profil coach jamais vérifié (statut_verification reste 'absente').
    const creationD = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: { compte_id: D.compteId, prenom: 'D', nom: 'Coach', discipline: 'yoga' },
    });
    if (creationD.statut >= 400) {
      throw new Error(
        `Préparation du banc : création du profil coach de D refusée (${creationD.statut}) : ` +
          `${JSON.stringify(creationD.corps)}`,
      );
    }
    profilCoachIdD = (creationD.corps as { id: string }[])[0].id;

    // Offre de D marquée publiée DIRECTEMENT par service_role — fixture délibérément
    // incohérente : aucun chemin applicatif ne la produit (publier_offre refuserait avec
    // coach_non_verifie). Elle prouve que offres_select_publiees revérifie le statut du coach à
    // CHAQUE lecture, pas seulement au moment où publiee_le a été posée une fois pour toutes.
    const offreD = await appelRest('/rest/v1/offres', {
      methode: 'POST',
      session: 'admin',
      corps: {
        coach_id: profilCoachIdD,
        titre: 'Offre de D',
        prix_centimes: 4900,
        publiee_le: new Date().toISOString(),
      },
    });
    if (offreD.statut >= 400) {
      throw new Error(
        `Préparation du banc : création de l'offre de D refusée (${offreD.statut}) : ` +
          `${JSON.stringify(offreD.corps)}`,
      );
    }
    offreIdPublieeD = (offreD.corps as { id: string }[])[0].id;

    // B passe en 'verifiee' par service_role DIRECTEMENT, pas par la fonction de P2.6 (pas
    // encore écrite à ce lot — P2.4 précède P2.6 dans l'ordre du fichier). Ce describe ne teste
    // pas cette transition elle-même (ses propres règles et son propre banc arriveront avec
    // P2.6) : un coach déjà vérifié n'est ici qu'un état de départ nécessaire pour tester la
    // lecture publique des offres et de profils_coach.
    const verification = await appelRest(`/rest/v1/profils_coach?id=eq.${profilCoachIdB}`, {
      methode: 'PATCH',
      session: 'admin',
      corps: { statut_verification: 'verifiee' },
    });
    if (verification.statut >= 400) {
      throw new Error(
        `Préparation du banc : passage de B en 'verifiee' refusé (${verification.statut}) : ` +
          `${JSON.stringify(verification.corps)}`,
      );
    }

    // B bascule en espace coach pour le reste du describe.
    const bascule = await appelRest('/rest/v1/rpc/basculer_profil', {
      methode: 'POST',
      session: B,
      corps: { profil: 'coach' },
    });
    if (bascule.statut >= 400) {
      throw new Error(
        `Préparation du banc : bascule de B en coach refusée (${bascule.statut}) : ` +
          `${JSON.stringify(bascule.corps)}`,
      );
    }

    // Les deux offres de B ci-dessous sont créées par service_role, PAS par la session de B —
    // trouvé en refaisant le cycle rouge/vert de offres_select_proprietaire : les créer via B
    // avec la représentation par défaut (Prefer: return=representation) fait dépendre la
    // PRÉPARATION elle-même de cette politique (Postgres refuse la ligne insérée en RETURNING
    // si aucune politique SELECT ne l'admet, « new row violates row-level security policy » —
    // pas une erreur de grant, une contrainte du RETURNING lui-même). Résultat : tout le
    // describe s'effondrait dès que offres_select_proprietaire disparaissait, y compris des
    // tests qui n'ont rien à voir avec elle — masquant que ces 17 rouges ne visaient RIEN
    // directement. Même trou que celui déjà trouvé sur offres_update_espace_coach, juste plus
    // large. Ici, la préparation est neutre ; les tests eux-mêmes (plus bas) exercent
    // spécifiquement offres_select_proprietaire et offres_insert_espace_coach.
    const brouillon = await appelRest('/rest/v1/offres', {
      methode: 'POST',
      session: 'admin',
      corps: { coach_id: profilCoachIdB, titre: 'Brouillon de B', prix_centimes: 4900 },
    });
    if (brouillon.statut >= 400) {
      throw new Error(
        `Préparation du banc : brouillon de B refusé (${brouillon.statut}) : ` +
          `${JSON.stringify(brouillon.corps)}`,
      );
    }
    offreIdBrouillonB = (brouillon.corps as { id: string }[])[0].id;

    // Une deuxième offre pour B, destinée à être publiée puis retirée par les tests eux-mêmes
    // (pas ici) : « B publie une offre » et « B retire une offre » appellent publier_offre/
    // retirer_offre, SECURITY DEFINER — elles ne dépendent d'aucune politique select/insert sur
    // offres, la création par service_role ne change donc rien à ce que ces deux tests prouvent.
    const aPublier = await appelRest('/rest/v1/offres', {
      methode: 'POST',
      session: 'admin',
      corps: {
        coach_id: profilCoachIdB,
        titre: 'Suivi complet',
        prix_centimes: 4900,
        benefices: ['Programme réécrit chaque semaine'],
        engagement_humain: ['ajustement hebdomadaire'],
      },
    });
    if (aPublier.statut >= 400) {
      throw new Error(
        `Préparation du banc : offre à publier de B refusée (${aPublier.statut}) : ` +
          `${JSON.stringify(aPublier.corps)}`,
      );
    }
    offreIdPublieeB = (aPublier.corps as { id: string }[])[0].id;
  }, 30_000);

  afterAll(async () => {
    // Retour en espace client : même précaution que describe('profils_coach'). Ce describe
    // n'est plus le dernier du fichier depuis P2.5 (describe('pieces_verification') suit et
    // rebascule B en coach dans son propre beforeAll) — exactement la raison de ne jamais
    // supposer un ordre de fichier plutôt que de le garantir ici.
    await appelRest('/rest/v1/rpc/basculer_profil', {
      methode: 'POST',
      session: B,
      corps: { profil: 'client' },
    });
  });

  // --- Séquence de publication/retrait, séquentielle par nature (comme la bascule de rôle
  // plus haut) : chaque test dépend de l'état laissé par le précédent. ---

  it('B publie une offre : accepté', async () => {
    // 204, pas 200 : publier_offre rend void, PostgREST répond "No Content" pour une fonction
    // sans valeur de retour — pas une erreur, la représentation par défaut d'un succès sans
    // corps.
    const { statut, corps } = await appelRest('/rest/v1/rpc/publier_offre', {
      methode: 'POST',
      session: B,
      corps: { offre_id: offreIdPublieeB },
    });
    expect(statut).toBe(204);
    expect(corps).toBeNull();
  });

  it("anon lit une offre publiée d'un coach vérifié : une ligne", async () => {
    const { statut, corps } = await appelRest(`/rest/v1/offres?id=eq.${offreIdPublieeB}`, {
      session: 'anon',
    });
    expect(statut).toBe(200);
    expect(corps).toHaveLength(1);
  });

  it('A (client) lit une offre publiée : une ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/offres?id=eq.${offreIdPublieeB}`, {
      session: A,
    });
    expect(statut).toBe(200);
    expect(corps).toHaveLength(1);
  });

  it('B retire une offre : accepté', async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/retirer_offre', {
      methode: 'POST',
      session: B,
      corps: { offre_id: offreIdPublieeB },
    });
    expect(statut).toBe(204);
    expect(corps).toBeNull();
    offreIdRetireeB = offreIdPublieeB;
  });

  it('anon lit une offre retirée : zéro ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/offres?id=eq.${offreIdRetireeB}`, {
      session: 'anon',
    });
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });

  // --- Sens légitimes restants ---

  // Cas légitime d'offres_select_proprietaire, maintenant isolé : la fixture est créée par
  // service_role (voir beforeAll) — B ne fait ici qu'un SELECT par son propre chemin, sans
  // aucune dépendance à offres_insert_espace_coach. Vérifié rouge/vert seul (2026-09-13).
  it('B lit ses propres brouillons : au moins une ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/offres?id=eq.${offreIdBrouillonB}`, {
      session: B,
    });
    expect(statut).toBe(200);
    expect((corps as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  // Cas légitime d'offres_insert_espace_coach, jusque-là absent — comme pour
  // offres_select_proprietaire, seul un effondrement du beforeAll le « couvrait ». Prefer:
  // return=minimal, exprès : ce test ne doit dépendre QUE de l'INSERT (with check), jamais de
  // offres_select_proprietaire (qui gouvernerait sinon la représentation retournée). La preuve
  // de création passe par une relecture admin, indépendante des deux politiques.
  it('B insère sa propre offre, par son propre chemin : accepté', async () => {
    const titre = `Inseree-par-B-${Date.now()}`;
    const insertion = await appelRest('/rest/v1/offres', {
      methode: 'POST',
      session: B,
      prefer: 'return=minimal',
      corps: { coach_id: profilCoachIdB, titre, prix_centimes: 3900 },
    });
    expect(insertion.statut).toBe(201);

    const { corps: relecture } = await appelRest(
      `/rest/v1/offres?coach_id=eq.${profilCoachIdB}&titre=eq.${encodeURIComponent(titre)}`,
      { session: 'admin' },
    );
    expect((relecture as unknown[]).length).toBe(1);
  });

  // --- Sens illégitimes : c'est ici que se joue le lot. ---

  it('anon lit un brouillon : zéro ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/offres?id=eq.${offreIdBrouillonB}`, {
      session: 'anon',
    });
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });

  it("anon lit l'offre publiée de D, coach non vérifié : zéro ligne", async () => {
    const { statut, corps } = await appelRest(`/rest/v1/offres?id=eq.${offreIdPublieeD}`, {
      session: 'anon',
    });
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });

  it('A lit les brouillons de B : zéro ligne', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/offres?id=eq.${offreIdBrouillonB}`, {
      session: A,
    });
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });

  it('A modifie une offre de B : refusé', async () => {
    const { corps } = await appelRest(`/rest/v1/offres?id=eq.${offreIdBrouillonB}`, {
      methode: 'PATCH',
      session: A,
      corps: { titre: 'PIRATE' },
    });
    expect(corps).toEqual([]);
  });

  // Cas légitime d'offres_update_espace_coach, jusque-là absent : publier_offre/retirer_offre
  // sont SECURITY DEFINER et contournent RLS pour leur propre écriture (publiee_le/retiree_le) —
  // aucun des deux ne prouve donc que cette politique autorise quoi que ce soit. Sans ce test,
  // la retirer ne fait rougir personne (vérifié : cycle rouge/vert de P2.4) — exactement le
  // défaut « politique fonctionnellement inerte » déjà trouvé en L1 sur
  // profils_coach_insert_espace_coach (docs/dette.md), ici sur le sens légitime plutôt
  // qu'illégitime.
  it('B modifie directement sa propre offre (titre) : accepté', async () => {
    const { statut, corps } = await appelRest(`/rest/v1/offres?id=eq.${offreIdBrouillonB}`, {
      methode: 'PATCH',
      session: B,
      corps: { titre: 'Brouillon renommé' },
    });
    expect(statut).toBe(200);
    expect((corps as { titre: string }[])[0].titre).toBe('Brouillon renommé');
  });

  it('B, en espace CLIENT, insère une offre : refusé', async () => {
    try {
      await appelRest('/rest/v1/rpc/basculer_profil', {
        methode: 'POST',
        session: B,
        corps: { profil: 'client' },
      });
      const { statut } = await appelRest('/rest/v1/offres', {
        methode: 'POST',
        session: B,
        corps: { coach_id: profilCoachIdB, titre: 'Depuis le mauvais espace', prix_centimes: 4900 },
      });
      expect(statut).toBeGreaterThanOrEqual(400);
    } finally {
      // Remet B en coach : les tests suivants du describe en ont besoin.
      await appelRest('/rest/v1/rpc/basculer_profil', {
        methode: 'POST',
        session: B,
        corps: { profil: 'coach' },
      });
    }
  });

  it("B insère une offre avec le coach_id d'un autre coach : refusé", async () => {
    const { statut } = await appelRest('/rest/v1/offres', {
      methode: 'POST',
      session: B,
      corps: { coach_id: profilCoachIdD, titre: 'Vol de coach_id', prix_centimes: 4900 },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  it('un DELETE sur offres, par le propriétaire lui-même : refusé', async () => {
    const { statut } = await appelRest(`/rest/v1/offres?id=eq.${offreIdBrouillonB}`, {
      methode: 'DELETE',
      session: B,
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  // --- profils_coach : la même prudence que pour offres, colonne par colonne. ---

  it('anon lit profils_coach de D (non vérifié) directement : zéro ligne', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_coach?id=eq.${profilCoachIdD}&select=${COLONNES_PROFIL_COACH_ACCORDEES}`,
      { session: 'anon' },
    );
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });

  it('anon lit profils_coach de B (vérifié) directement : une ligne, sans compte_id', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=${COLONNES_PROFIL_COACH_ACCORDEES}`,
      { session: 'anon' },
    );
    expect(statut).toBe(200);
    expect(corps).toHaveLength(1);
    expect(corps).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ compte_id: expect.anything() })]),
    );
  });

  // Précision explicite (pas déduite d'un select=* qui omettrait silencieusement la colonne) :
  // une demande EXPLICITE de compte_id sur un profil vérifié doit produire une vraie erreur
  // PostgREST (permission refusée), jamais un 200 avec la colonne absente ou nulle — les deux
  // ne prouvent pas la même chose, et c'est la première qu'on veut voir ici.
  it("anon lit le compte_id d'un coach vérifié, par une demande explicite : refusé (pas silencieux)", async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=compte_id`,
      { session: 'anon' },
    );
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/permission denied/i);
  });

  it('anon atteint profils_coach par relation imbriquée PostgREST depuis offres : refusé ou sans les colonnes fermées', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/offres?id=eq.${offreIdBrouillonB}&select=*,profils_coach(*)`,
      { session: 'anon' },
    );
    // Deux issues sûres, une seule dangereuse. Sûres : la requête échoue entièrement (le grant
    // colonne par colonne de profils_coach refuse "*"), ou elle réussit sans exposer compte_id.
    // Dangereuse, et c'est ce qui ferait échouer cette assertion : compte_id présent quelque
    // part dans la réponse.
    expect(JSON.stringify(corps)).not.toMatch(/compte_id/);
    if (statut < 400) {
      expect(corps).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// pieces_verification (0012_creer_pieces_verification.sql, P2.5)
// ---------------------------------------------------------------------------------------------

// L'API Storage n'est pas PostgREST, mais c'est le même hôte (API_URL) et le même schéma
// d'autorisation (apikey + Bearer) : appelRest sert tel quel, chemin = /storage/v1/object/...
// Le corps envoyé n'a rien d'un vrai fichier (une pièce d'identité inventée serait une donnée
// de contenu, interdite par CLAUDE.md §4) — seul le fait qu'un objet existe ou non, et qui peut
// le relire, est sous test ici.
describe('pieces_verification', () => {
  const CHEMIN_STOCKAGE_BASE = '/storage/v1/object/pieces-verification';
  // Liste exacte du GRANT SELECT de 0012_creer_pieces_verification.sql — chemin_stockage en
  // est absent, volontairement (décision 2 du fichier de migration). Un GET sans select=
  // équivaut à select=* et exigerait donc un GRANT sur TOUTES les colonnes, chemin_stockage
  // compris : même mécanique déjà rencontrée sur profils_coach (COLONNES_PROFIL_COACH_ACCORDEES,
  // plus haut dans ce fichier) et sur l'INSERT de pieces_verification ci-dessous.
  const COLONNES_PIECES_ACCORDEES = 'id,coach_id,type,depose_le,examinee_le,cree_le';

  let cheminPieceB: string;
  let idPieceB: string;

  beforeAll(async () => {
    // B repasse en espace coach : describe('offres') l'a laissée en espace client dans son
    // propre afterAll (précaution symétrique, voir son commentaire).
    const bascule = await appelRest('/rest/v1/rpc/basculer_profil', {
      methode: 'POST',
      session: B,
      corps: { profil: 'coach' },
    });
    if (bascule.statut >= 400) {
      throw new Error(
        `Préparation du banc : bascule de B en coach refusée (${bascule.statut}) : ` +
          `${JSON.stringify(bascule.corps)}`,
      );
    }
  }, 30_000);

  afterAll(async () => {
    await appelRest('/rest/v1/rpc/basculer_profil', {
      methode: 'POST',
      session: B,
      corps: { profil: 'client' },
    });
  });

  // --- Sens légitime : dépôt par le propriétaire, fichier ET ligne de métadonnées. ---

  it('B dépose une pièce : le fichier est accepté, puis la ligne de métadonnées aussi', async () => {
    cheminPieceB = randomUUID();
    const depotFichier = await appelRest(`${CHEMIN_STOCKAGE_BASE}/${cheminPieceB}`, {
      methode: 'POST',
      session: B,
      corps: { contenu: 'pièce de test, jamais un vrai document (CLAUDE.md §4)' },
    });
    expect(depotFichier.statut).toBeLessThan(300);

    // select= explicite, colonnes accordées seulement : la représentation par défaut d'un
    // POST équivaut à select=*, qui exigerait un GRANT SELECT sur chemin_stockage — absent par
    // décision (voir le commentaire d'en-tête de 0012_creer_pieces_verification.sql). Même
    // mécanique que l'INSERT de offres avec return=minimal, ici avec un select= ciblé pour
    // récupérer idPieceB dans le même appel.
    const ligne = await appelRest(
      '/rest/v1/pieces_verification?select=id,coach_id,type,depose_le,examinee_le,cree_le',
      {
        methode: 'POST',
        session: B,
        corps: { coach_id: profilCoachIdB, type: 'identite', chemin_stockage: cheminPieceB },
      },
    );
    expect(ligne.statut).toBe(201);
    idPieceB = (ligne.corps as { id: string }[])[0].id;
  });

  // Cas légitime de la décision "affichage métadonnées seules" (P2.5, point 3) : le coach voit
  // qu'il a déposé une pièce, de quel type, sans jamais recevoir chemin_stockage.
  it('B lit les métadonnées de sa pièce : une ligne, sans chemin_stockage', async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/pieces_verification?id=eq.${idPieceB}&select=${COLONNES_PIECES_ACCORDEES}`,
      { session: B },
    );
    expect(statut).toBe(200);
    const lignes = corps as Record<string, unknown>[];
    expect(lignes).toHaveLength(1);
    expect(lignes[0].type).toBe('identite');
    expect(lignes[0]).not.toHaveProperty('chemin_stockage');
  });

  // --- Sens illégitimes : lecture du FICHIER, par quiconque, y compris son propriétaire. ---

  it('B relit le fichier de sa propre pièce : refusé (P2.5, point 3 — "pas même lui")', async () => {
    const { statut } = await appelRest(`${CHEMIN_STOCKAGE_BASE}/${cheminPieceB}`, {
      session: B,
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  it('un autre compte (A) relit la pièce de B : refusé, ni le fichier ni la ligne', async () => {
    const fichier = await appelRest(`${CHEMIN_STOCKAGE_BASE}/${cheminPieceB}`, { session: A });
    expect(fichier.statut).toBeGreaterThanOrEqual(400);

    const ligne = await appelRest(
      `/rest/v1/pieces_verification?id=eq.${idPieceB}&select=${COLONNES_PIECES_ACCORDEES}`,
      { session: A },
    );
    expect(ligne.statut).toBe(200);
    expect(ligne.corps).toEqual([]);
  });

  it('anon relit la pièce de B : refusé, ni le fichier ni la ligne', async () => {
    const fichier = await appelRest(`${CHEMIN_STOCKAGE_BASE}/${cheminPieceB}`, {
      session: 'anon',
    });
    expect(fichier.statut).toBeGreaterThanOrEqual(400);

    // anon n'a AUCUN grant sur cette table (le GRANT SELECT colonne par colonne ne vise que
    // authenticated) : même avec select= explicite, refusé par le grant avant même la RLS.
    const ligne = await appelRest(
      `/rest/v1/pieces_verification?id=eq.${idPieceB}&select=${COLONNES_PIECES_ACCORDEES}`,
      { session: 'anon' },
    );
    expect(ligne.statut).toBeGreaterThanOrEqual(400);
  });

  // Cas explicitement demandé par P2.5, point 5 : un chemin construit à la main depuis un
  // coach_id public — exactement la convention REJETÉE à la décision du point 4. L'objet est
  // posé réellement (par service_role, jamais par un rôle client) pour que le refus observé
  // vienne bien de l'absence de politique SELECT sur storage.objects, pas de l'absence de
  // l'objet lui-même.
  it('un chemin deviné depuis le coach_id public de B (convention rejetée) : refusé malgré tout', async () => {
    const cheminDevine = `${profilCoachIdB}/identite-fabriquee.pdf`;
    const depotAdmin = await appelRest(`${CHEMIN_STOCKAGE_BASE}/${cheminDevine}`, {
      methode: 'POST',
      session: 'admin',
      corps: { contenu: 'objet posé directement par service_role, pour ce test seulement' },
    });
    if (depotAdmin.statut >= 400) {
      throw new Error(
        `Préparation du banc : dépôt admin au chemin deviné refusé (${depotAdmin.statut}) : ` +
          `${JSON.stringify(depotAdmin.corps)}`,
      );
    }

    const lectureAnon = await appelRest(`${CHEMIN_STOCKAGE_BASE}/${cheminDevine}`, {
      session: 'anon',
    });
    expect(lectureAnon.statut).toBeGreaterThanOrEqual(400);

    const lectureA = await appelRest(`${CHEMIN_STOCKAGE_BASE}/${cheminDevine}`, { session: A });
    expect(lectureA.statut).toBeGreaterThanOrEqual(400);
  });

  // --- Sens illégitimes : écriture de la LIGNE par qui n'en a pas le droit. ---

  it('B insère une pièce pour le coach_id de D (un autre coach) : refusé', async () => {
    const { statut } = await appelRest('/rest/v1/pieces_verification', {
      methode: 'POST',
      session: B,
      prefer: 'return=minimal',
      corps: { coach_id: profilCoachIdD, type: 'identite', chemin_stockage: randomUUID() },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  it('B, en espace CLIENT, insère une pièce : refusé', async () => {
    const versClient = await appelRest('/rest/v1/rpc/basculer_profil', {
      methode: 'POST',
      session: B,
      corps: { profil: 'client' },
    });
    if (versClient.statut >= 400) {
      throw new Error(
        `Préparation du test : bascule de B en client refusée (${versClient.statut}) : ` +
          `${JSON.stringify(versClient.corps)}`,
      );
    }

    const { statut } = await appelRest('/rest/v1/pieces_verification', {
      methode: 'POST',
      session: B,
      prefer: 'return=minimal',
      corps: { coach_id: profilCoachIdB, type: 'identite', chemin_stockage: randomUUID() },
    });
    expect(statut).toBeGreaterThanOrEqual(400);

    // Repasse en coach : les tests suivants du describe (aucun ici, mais son propre afterAll)
    // supposent cet état.
    const versCoach = await appelRest('/rest/v1/rpc/basculer_profil', {
      methode: 'POST',
      session: B,
      corps: { profil: 'coach' },
    });
    if (versCoach.statut >= 400) {
      throw new Error(
        `Nettoyage du test : bascule de B en coach refusée (${versCoach.statut}) : ` +
          `${JSON.stringify(versCoach.corps)}`,
      );
    }
  });

  it('anon insère une pièce : refusé', async () => {
    const { statut } = await appelRest('/rest/v1/pieces_verification', {
      methode: 'POST',
      session: 'anon',
      prefer: 'return=minimal',
      corps: { coach_id: profilCoachIdB, type: 'identite', chemin_stockage: randomUUID() },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  it('anon dépose un fichier dans le compartiment : refusé', async () => {
    const { statut } = await appelRest(`${CHEMIN_STOCKAGE_BASE}/${randomUUID()}`, {
      methode: 'POST',
      session: 'anon',
      corps: { contenu: 'tentative anon' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  // --- Relation imbriquée PostgREST, dans les deux sens (porte de sortie L2, point 1 — le seul
  // chemin d'accès à une pièce d'identité qui n'avait jamais été essayé). Même famille que le
  // test « anon atteint profils_coach par relation imbriquée depuis offres » plus haut, mais sur
  // la table la plus sensible du schéma : un embed PostgREST traverse une relation déclarée par
  // clé étrangère (pieces_verification.coach_id -> profils_coach.id) et ne doit jamais contourner
  // ni le GRANT colonne par colonne (chemin_stockage absent des deux côtés) ni la politique RLS
  // de la table embarquée — PostgREST réévalue les deux pour la relation imbriquée, mais ce n'est
  // vérifié nulle part dans ce dépôt avant cette section. ---

  describe('relation imbriquée PostgREST (pieces_verification <-> profils_coach)', () => {
    // Colonnes EXPLICITEMENT accordées des deux côtés de la relation embarquée — jamais "*". Un
    // "*" sur la table embarquée échoue systématiquement au niveau du GRANT (compte_id absent de
    // celui de profils_coach, chemin_stockage absent de celui de pieces_verification), et ce
    // AVANT même que RLS n'entre en jeu : un premier essai avec "*" l'a confirmé empiriquement
    // (403 dans les six cas, y compris pour A/B qui ont pourtant un grant colonne par colonne sur
    // la table de base). Cette forme-là prouve seulement le grant, pas la politique RLS de la
    // relation embarquée — ce que ce test doit réellement établir. Colonnes explicites ici pour
    // que le grant passe et que ce soit RLS, seule, qui décide de ce qui apparaît.
    const EMBED_PIECES = `pieces_verification(${COLONNES_PIECES_ACCORDEES})`;
    const EMBED_PROFIL_COACH = `profils_coach(${COLONNES_PROFIL_COACH_ACCORDEES})`;

    // Sens 1 : depuis pieces_verification, embarquer profils_coach. Peu de risque nouveau (la
    // ligne de base est déjà fermée à anon/A), mais jamais vérifié : à prouver, pas à supposer.
    it('anon : pieces_verification(profils_coach) — refusé à la base, jamais atteint', async () => {
      const { statut, corps } = await appelRest(
        `/rest/v1/pieces_verification?id=eq.${idPieceB}&select=${COLONNES_PIECES_ACCORDEES},${EMBED_PROFIL_COACH}`,
        { session: 'anon' },
      );
      // anon n'a aucun GRANT sur pieces_verification (colonne ou table) : refusé avant même
      // d'atteindre la relation imbriquée.
      expect(statut).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(corps)).not.toMatch(/chemin_stockage|compte_id/);
    });

    it('A (compte ordinaire, ni propriétaire ni examinateur) : pieces_verification(profils_coach) — ligne vide', async () => {
      const { statut, corps } = await appelRest(
        `/rest/v1/pieces_verification?id=eq.${idPieceB}&select=${COLONNES_PIECES_ACCORDEES},${EMBED_PROFIL_COACH}`,
        { session: A },
      );
      // A a le GRANT colonne (authenticated) des deux côtés de la relation, donc le grant seul
      // ne suffit plus à refuser : c'est bien la politique RLS de pieces_verification (ni
      // propriétaire, ni examinateur) qui doit vider la ligne de base — avec ou sans la
      // relation imbriquée demandée.
      expect(statut).toBe(200);
      expect(corps).toEqual([]);
    });

    it('B (coach propriétaire) : pieces_verification(profils_coach) — sa ligne, son propre profil, jamais compte_id ni chemin_stockage', async () => {
      const { statut, corps } = await appelRest(
        `/rest/v1/pieces_verification?id=eq.${idPieceB}&select=${COLONNES_PIECES_ACCORDEES},${EMBED_PROFIL_COACH}`,
        { session: B },
      );
      expect(statut).toBe(200);
      const lignes = corps as { profils_coach?: { compte_id?: unknown } }[];
      expect(lignes).toHaveLength(1);
      expect(lignes[0].profils_coach).toBeTruthy();
      expect(JSON.stringify(corps)).not.toMatch(/chemin_stockage|compte_id/);
    });

    // Sens 2, le chemin réellement redouté : depuis profils_coach (lisible par anon dès qu'un
    // coach est vérifié), embarquer pieces_verification. C'est la table cible la plus dangereuse
    // du schéma, atteinte depuis la table la plus largement ouverte du schéma.
    it('anon : profils_coach(pieces_verification) — profil visible, aucune pièce', async () => {
      const { statut, corps } = await appelRest(
        `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=${COLONNES_PROFIL_COACH_ACCORDEES},${EMBED_PIECES}`,
        { session: 'anon' },
      );
      // anon n'a AUCUN grant sur pieces_verification, contrairement à A/B ci-dessous
      // (authenticated seulement) : soit PostgREST refuse la requête entière, soit elle réussit
      // sans la relation imbriquée peuplée — jamais avec une pièce dedans.
      expect(JSON.stringify(corps)).not.toMatch(/chemin_stockage/);
      if (statut < 400) {
        const lignes = corps as { pieces_verification?: unknown[] }[];
        expect(lignes[0]?.pieces_verification ?? []).toEqual([]);
      } else {
        expect(statut).toBeGreaterThanOrEqual(400);
      }
    });

    it('A (compte ordinaire) : profils_coach(pieces_verification) — profil visible, aucune pièce', async () => {
      const { statut, corps } = await appelRest(
        `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=${COLONNES_PROFIL_COACH_ACCORDEES},${EMBED_PIECES}`,
        { session: A },
      );
      // A a le grant colonne sur pieces_verification (authenticated) : le grant seul ne bloque
      // plus rien ici, c'est exactement pour ça que ce cas est le plus dangereux des six — seule
      // la politique RLS de pieces_verification (ni propriétaire, ni examinateur) doit vider la
      // relation imbriquée. Le profil de B reste lisible (verifiee), la pièce non.
      expect(statut).toBe(200);
      const lignes = corps as { pieces_verification?: unknown[] }[];
      expect(lignes).toHaveLength(1);
      expect(lignes[0].pieces_verification).toEqual([]);
      expect(JSON.stringify(corps)).not.toMatch(/chemin_stockage/);
    });

    it('B (coach propriétaire) : profils_coach(pieces_verification) — sa propre pièce, jamais chemin_stockage', async () => {
      const { statut, corps } = await appelRest(
        `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=${COLONNES_PROFIL_COACH_ACCORDEES},${EMBED_PIECES}`,
        { session: B },
      );
      // B lit son propre profil, avec sa propre pièce en relation imbriquée (RLS le permet, il
      // en est propriétaire) — mais le grant colonne par colonne exclut chemin_stockage même
      // pour lui : la métadonnée apparaît, jamais le chemin réel du fichier.
      expect(statut).toBe(200);
      const lignes = corps as { pieces_verification?: { type?: string }[] }[];
      expect(lignes).toHaveLength(1);
      expect(lignes[0].pieces_verification).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'identite' })]),
      );
      expect(JSON.stringify(corps)).not.toMatch(/chemin_stockage/);
    });
  });

  // --- Lecture réservée au back-office (docs/backend.md §9, 0013_creer_role_examinateur.sql).
  // Trouvé manquant en relisant P2.5 : 0012 fermait la lecture à tout le monde sauf
  // service_role, sans jamais construire le chemin réservé à un vrai compte examinateur que son
  // propre commentaire promettait. Les deux sens exigés : l'examinateur lit, un compte
  // ordinaire ne lit pas — ni le fichier, ni chemin_stockage via la fonction dédiée. ---
  describe("lecture par l'examinateur", () => {
    let EX: Session;

    beforeAll(async () => {
      EX = await creerCompteReel(`${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-examinateur@${DOMAINE_EMAIL}`, {
        date_naissance: '1988-01-01',
        cgu_version_acceptee: '2026-08-01',
      });
      // est_examinateur = true reste une opération manuelle par service_role, jamais par
      // l'application (docs/backend.md §9, dernière phrase) — ce PATCH admin simule exactement
      // cette opération pour le banc.
      const promotion = await appelRest(`/rest/v1/comptes?id=eq.${EX.compteId}`, {
        methode: 'PATCH',
        session: 'admin',
        corps: { est_examinateur: true },
      });
      if (promotion.statut >= 400) {
        throw new Error(
          `Préparation du banc : promotion de EX en examinateur refusée (${promotion.statut}) : ` +
            `${JSON.stringify(promotion.corps)}`,
        );
      }
    }, 30_000);

    afterAll(async () => {
      if (EX) await supprimerCompteReel(EX.compteId);
    });

    it("l'examinateur lit la pièce de B via pieces_verification_pour_examinateur() : chemin_stockage inclus", async () => {
      const { statut, corps } = await appelRest(
        '/rest/v1/rpc/pieces_verification_pour_examinateur',
        { methode: 'POST', session: EX },
      );
      expect(statut).toBe(200);
      const ligneB = (corps as Record<string, unknown>[]).find((l) => l.id === idPieceB);
      expect(ligneB).toBeDefined();
      expect(ligneB?.chemin_stockage).toBe(cheminPieceB);
    });

    it('un compte ordinaire (A) appelle la même fonction : ensemble vide, jamais une erreur', async () => {
      const { statut, corps } = await appelRest(
        '/rest/v1/rpc/pieces_verification_pour_examinateur',
        { methode: 'POST', session: A },
      );
      expect(statut).toBe(200);
      expect(corps).toEqual([]);
    });

    it('anon ne peut pas appeler pieces_verification_pour_examinateur (revoke from public, anon)', async () => {
      const { statut } = await appelRest('/rest/v1/rpc/pieces_verification_pour_examinateur', {
        methode: 'POST',
        session: 'anon',
      });
      expect(statut).toBeGreaterThanOrEqual(400);
    });

    it("l'examinateur lit le FICHIER de la pièce de B (storage.objects) : accepté", async () => {
      const { statut } = await appelRest(`${CHEMIN_STOCKAGE_BASE}/${cheminPieceB}`, {
        session: EX,
      });
      expect(statut).toBeLessThan(300);
    });

    // L2-10 (consultation d'un dossier) : le back-office ne lit jamais le fichier brut, il
    // demande une URL SIGNÉE (POST /storage/v1/object/sign/..., endpoint distinct du GET direct
    // ci-dessus, soumis à la même politique SELECT sur storage.objects mais jamais prouvé
    // séparément jusqu'ici — rouge/vert dans les deux sens, comme toute lecture inter-comptes
    // (docs/backend.md §8).
    it("l'examinateur crée une URL signée pour la pièce de B : accepté", async () => {
      const { statut, corps } = await appelRest(
        `/storage/v1/object/sign/pieces-verification/${cheminPieceB}`,
        { methode: 'POST', session: EX, corps: { expiresIn: 600 } },
      );
      expect(statut).toBeLessThan(300);
      expect((corps as { signedURL?: string }).signedURL).toBeDefined();
    });

    it('un compte ordinaire (A) tente de créer une URL signée pour la pièce de B : refusé', async () => {
      const { statut } = await appelRest(
        `/storage/v1/object/sign/pieces-verification/${cheminPieceB}`,
        { methode: 'POST', session: A, corps: { expiresIn: 600 } },
      );
      expect(statut).toBeGreaterThanOrEqual(400);
    });

    it('est_examinateur_courant() : vrai pour EX, faux pour un compte ordinaire, refusé pour anon', async () => {
      const pourEx = await appelRest('/rest/v1/rpc/est_examinateur_courant', {
        methode: 'POST',
        session: EX,
      });
      expect(pourEx.statut).toBe(200);
      expect(pourEx.corps).toBe(true);

      const pourA = await appelRest('/rest/v1/rpc/est_examinateur_courant', {
        methode: 'POST',
        session: A,
      });
      expect(pourA.statut).toBe(200);
      expect(pourA.corps).toBe(false);

      const pourAnon = await appelRest('/rest/v1/rpc/est_examinateur_courant', {
        methode: 'POST',
        session: 'anon',
      });
      expect(pourAnon.statut).toBeGreaterThanOrEqual(400);
    });
  });
});

// ---------------------------------------------------------------------------------------------
// disciplines (0020_creer_disciplines_reference.sql) — validation de L3, 13 septembre 2026
// ---------------------------------------------------------------------------------------------

describe('disciplines — clé étrangère depuis profils_coach.discipline', () => {
  let compteSansDiscipline: Session;

  beforeAll(async () => {
    compteSansDiscipline = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-discipline-inconnue@${DOMAINE_EMAIL}`,
      { date_naissance: '1991-01-01', cgu_version_acceptee: '2026-08-01' },
    );
  });

  afterAll(async () => {
    if (compteSansDiscipline) await supprimerCompteReel(compteSansDiscipline.compteId);
  });

  // C'est la contrainte elle-même qu'il faut exercer (validation de L3, 13 septembre 2026), pas
  // un mécanisme qui se trouve sur le chemin (règle 9) : ce test écrit directement dans
  // profils_coach par admin (service_role, qui contourne RLS mais jamais une contrainte de
  // table) — une discipline absente de la table de référence doit être refusée par la clé
  // étrangère elle-même, indépendamment de toute politique RLS ou de tout rôle.
  it('une discipline absente de la table de référence est refusée à l’écriture (clé étrangère)', async () => {
    const { statut, corps } = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: {
        compte_id: compteSansDiscipline.compteId,
        prenom: 'Sans',
        nom: 'Discipline',
        discipline: 'discipline-qui-n-existe-pas',
      },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/foreign key|profils_coach_discipline_fkey/i);
  });
});

// ---------------------------------------------------------------------------------------------
// decider_verification_coach (0015_creer_decision_verification.sql, P2.6)
// ---------------------------------------------------------------------------------------------

describe('decider_verification_coach', () => {
  let coachEnExamen: Session;
  let profilCoachEnExamenId: string;
  let EXX: Session;

  beforeAll(async () => {
    // 'natation' n'est PAS une des sept clés de disciplines (0020_creer_disciplines_reference.sql)
    // : profils_coach.discipline porte une clé étrangère depuis ce même lot. Sa propre ligne de
    // référence, insérée et retirée par ce describe — jamais une clé existante réutilisée pour
    // ne pas coupler ce test à une autre discipline. Un test qui écrivait une valeur qu'aucune
    // contrainte n'autorisait a survécu tout L2 sans que rien ne le signale (trouvé à la
    // validation de L3, 13 septembre 2026) : c'était un faux vert de la même famille que la
    // règle 9 (docs/prompts/L3.md), la préparation du test contournait une contrainte qui
    // n'existait pas encore.
    const referenceDiscipline = await appelRest('/rest/v1/disciplines', {
      methode: 'POST',
      session: 'admin',
      corps: { cle: 'natation', libelle: 'Natation', ordre_affichage: 99 },
    });
    if (referenceDiscipline.statut >= 400) {
      throw new Error(
        `Préparation du banc : ligne de référence 'natation' refusée (${referenceDiscipline.statut}) : ` +
          `${JSON.stringify(referenceDiscipline.corps)}`,
      );
    }

    // Coach dédié, forcé à 'en_examen' par service_role : seul état de départ nécessaire pour
    // prouver la transition acceptée vers 'verifiee'. D (module-level, describe('offres')) sert
    // pour la transition illégale depuis 'absente'.
    coachEnExamen = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-coach-examen@${DOMAINE_EMAIL}`,
      { date_naissance: '1992-01-01', cgu_version_acceptee: '2026-08-01' },
    );
    const creationProfil = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: {
        compte_id: coachEnExamen.compteId,
        prenom: 'Examen',
        nom: 'Coach',
        discipline: 'natation',
      },
    });
    if (creationProfil.statut >= 400) {
      throw new Error(
        `Préparation du banc : profil du coach en examen refusé (${creationProfil.statut}) : ` +
          `${JSON.stringify(creationProfil.corps)}`,
      );
    }
    profilCoachEnExamenId = (creationProfil.corps as { id: string }[])[0].id;

    const misEnExamen = await appelRest(`/rest/v1/profils_coach?id=eq.${profilCoachEnExamenId}`, {
      methode: 'PATCH',
      session: 'admin',
      corps: { statut_verification: 'en_examen' },
    });
    if (misEnExamen.statut >= 400) {
      throw new Error(
        `Préparation du banc : passage en 'en_examen' refusé (${misEnExamen.statut}) : ` +
          `${JSON.stringify(misEnExamen.corps)}`,
      );
    }

    EXX = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-examinateur-p26@${DOMAINE_EMAIL}`,
      {
        date_naissance: '1988-01-01',
        cgu_version_acceptee: '2026-08-01',
      },
    );
    const promotion = await appelRest(`/rest/v1/comptes?id=eq.${EXX.compteId}`, {
      methode: 'PATCH',
      session: 'admin',
      corps: { est_examinateur: true },
    });
    if (promotion.statut >= 400) {
      throw new Error(
        `Préparation du banc : promotion de EXX en examinateur refusée (${promotion.statut}) : ` +
          `${JSON.stringify(promotion.corps)}`,
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (coachEnExamen) await supprimerCompteReel(coachEnExamen.compteId);
    if (EXX) await supprimerCompteReel(EXX.compteId);
    // Après la suppression du compte (cascade jusqu'à profils_coach, qui retire la seule ligne
    // référençant 'natation') : la ligne de référence peut à son tour être retirée sans violer
    // la clé étrangère.
    await appelRest('/rest/v1/disciplines?cle=eq.natation', {
      methode: 'DELETE',
      session: 'admin',
    });
  });

  it('un compte authenticated ordinaire (A) appelle la fonction : refusé (examinateur_requis)', async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/decider_verification_coach', {
      methode: 'POST',
      session: A,
      corps: { p_coach_id: profilCoachEnExamenId, p_decision: 'verifiee', p_motif: 'test' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/examinateur_requis/);
  });

  it('anon appelle la fonction : refusé', async () => {
    const { statut } = await appelRest('/rest/v1/rpc/decider_verification_coach', {
      methode: 'POST',
      session: 'anon',
      corps: { p_coach_id: profilCoachEnExamenId, p_decision: 'verifiee', p_motif: 'test' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });

  it("l'examinateur tente 'absente' vers 'verifiee' (coach D) : refusé (transition_invalide)", async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/decider_verification_coach', {
      methode: 'POST',
      session: EXX,
      corps: { p_coach_id: profilCoachIdD, p_decision: 'verifiee', p_motif: 'test' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/transition_invalide/);
  });

  it("l'examinateur appelle sans motif : refusé (motif_requis)", async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/decider_verification_coach', {
      methode: 'POST',
      session: EXX,
      corps: { p_coach_id: profilCoachEnExamenId, p_decision: 'verifiee', p_motif: '   ' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/motif_requis/);
  });

  it("l'examinateur décide 'en_examen' vers 'verifiee' : accepté, journalisé", async () => {
    const { statut } = await appelRest('/rest/v1/rpc/decider_verification_coach', {
      methode: 'POST',
      session: EXX,
      corps: {
        p_coach_id: profilCoachEnExamenId,
        p_decision: 'verifiee',
        p_motif: 'Dossier complet et conforme',
      },
    });
    expect(statut).toBe(204);

    const relu = await appelRest(
      `/rest/v1/profils_coach?id=eq.${profilCoachEnExamenId}&select=statut_verification`,
      { session: 'admin' },
    );
    expect((relu.corps as { statut_verification: string }[])[0].statut_verification).toBe(
      'verifiee',
    );

    const journal = await appelRest(
      `/rest/v1/decisions_verification?dossier=eq.${profilCoachEnExamenId}`,
      { session: 'admin' },
    );
    expect(journal.statut).toBe(200);
    const lignes = journal.corps as Record<string, unknown>[];
    expect(lignes).toHaveLength(1);
    expect(lignes[0].decision).toBe('verifiee');
    expect(lignes[0].examinateur).toBe(EXX.compteId);
    expect(lignes[0].motif).toBe('Dossier complet et conforme');
  });

  it("l'examinateur retente 'verifiee' vers 'verifiee' (déjà décidé) : refusé, transition non listée", async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/decider_verification_coach', {
      methode: 'POST',
      session: EXX,
      corps: { p_coach_id: profilCoachEnExamenId, p_decision: 'verifiee', p_motif: 'test' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/transition_invalide/);
  });

  it('une mise à jour directe de statut_verification, même par un examinateur, reste refusée (régression L1)', async () => {
    const { statut } = await appelRest(`/rest/v1/profils_coach?id=eq.${profilCoachEnExamenId}`, {
      methode: 'PATCH',
      session: EXX,
      corps: { statut_verification: 'refusee' },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------------------------
// date_verification_coach (0019_creer_date_verification_publique.sql, correction docs/domaine.md
// §5.1 du 12 septembre 2026)
// ---------------------------------------------------------------------------------------------

describe('date_verification_coach', () => {
  let coachVerifie: Session;
  let profilCoachVerifieId: string;
  let examinateurDate: Session;
  // Capturée en beforeAll, jamais fixée à l'avance : decisions_verification.horodatage vaut
  // now() au moment de l'appel (0015), et service_role n'a JAMAIS eu de GRANT INSERT sur cette
  // table (délibéré, "l'écriture directe contournerait la validation de transition" — voir le
  // commentaire de 0015) — trouvé en écrivant ce banc (403, pas une supposition). La seule
  // façon honnête de poser la précondition est donc le vrai mécanisme, decider_verification_coach
  // (déjà testé pour lui-même juste au-dessus), pas un raccourci qui contournerait la même règle
  // que ce fichier vérifie par ailleurs.
  let horodatageAttendu: string;

  beforeAll(async () => {
    // Sa propre ligne de référence pour 'natation' — même motif que describe
    // ('decider_verification_coach') juste au-dessus, pas une clé existante réutilisée.
    const referenceDiscipline = await appelRest('/rest/v1/disciplines', {
      methode: 'POST',
      session: 'admin',
      corps: { cle: 'natation', libelle: 'Natation', ordre_affichage: 99 },
    });
    if (referenceDiscipline.statut >= 400) {
      throw new Error(
        `Préparation du banc : ligne de référence 'natation' refusée (${referenceDiscipline.statut}) : ` +
          `${JSON.stringify(referenceDiscipline.corps)}`,
      );
    }

    coachVerifie = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-coach-date-verif@${DOMAINE_EMAIL}`,
      { date_naissance: '1990-01-01', cgu_version_acceptee: '2026-08-01' },
    );
    const creationProfil = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: {
        compte_id: coachVerifie.compteId,
        prenom: 'Date',
        nom: 'Verification',
        discipline: 'natation',
      },
    });
    if (creationProfil.statut >= 400) {
      throw new Error(
        `Préparation du banc : profil du coach à vérifier refusé (${creationProfil.statut}) : ` +
          `${JSON.stringify(creationProfil.corps)}`,
      );
    }
    profilCoachVerifieId = (creationProfil.corps as { id: string }[])[0].id;

    const misEnExamen = await appelRest(`/rest/v1/profils_coach?id=eq.${profilCoachVerifieId}`, {
      methode: 'PATCH',
      session: 'admin',
      corps: { statut_verification: 'en_examen' },
    });
    if (misEnExamen.statut >= 400) {
      throw new Error(
        `Préparation du banc : passage en 'en_examen' refusé (${misEnExamen.statut}) : ` +
          `${JSON.stringify(misEnExamen.corps)}`,
      );
    }

    examinateurDate = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-examinateur-date-verif@${DOMAINE_EMAIL}`,
      { date_naissance: '1988-01-01', cgu_version_acceptee: '2026-08-01' },
    );
    const promotion = await appelRest(`/rest/v1/comptes?id=eq.${examinateurDate.compteId}`, {
      methode: 'PATCH',
      session: 'admin',
      corps: { est_examinateur: true },
    });
    if (promotion.statut >= 400) {
      throw new Error(
        `Préparation du banc : promotion de l'examinateur refusée (${promotion.statut}) : ` +
          `${JSON.stringify(promotion.corps)}`,
      );
    }

    const decision = await appelRest('/rest/v1/rpc/decider_verification_coach', {
      methode: 'POST',
      session: examinateurDate,
      corps: {
        p_coach_id: profilCoachVerifieId,
        p_decision: 'verifiee',
        p_motif: 'Préparation du banc — date_verification_coach',
      },
    });
    if (decision.statut !== 204) {
      throw new Error(
        `Préparation du banc : décision 'verifiee' refusée (${decision.statut}) : ` +
          `${JSON.stringify(decision.corps)}`,
      );
    }

    // Lue via admin (SELECT seul accordé, voir plus haut) — jamais devinée : la date exacte que
    // decider_verification_coach a réellement journalisée (now() au moment de l'appel).
    const journal = await appelRest(
      `/rest/v1/decisions_verification?dossier=eq.${profilCoachVerifieId}&decision=eq.verifiee&select=horodatage`,
      { session: 'admin' },
    );
    const lignes = journal.corps as { horodatage: string }[];
    if (lignes.length !== 1) {
      throw new Error(
        `Préparation du banc : ${lignes.length} ligne(s) 'verifiee' journalisée(s), 1 attendue`,
      );
    }
    horodatageAttendu = lignes[0].horodatage;
  }, 30_000);

  afterAll(async () => {
    // coachVerifie d'abord : ON DELETE CASCADE (profils_coach -> decisions_verification, 0015)
    // retire la ligne de décision AVANT que la suppression d'examinateurDate ne rencontre sa
    // propre clef étrangère (examinateur références comptes) — même ordre que
    // describe('decider_verification_coach') juste au-dessus, même raison.
    if (coachVerifie) await supprimerCompteReel(coachVerifie.compteId);
    if (examinateurDate) await supprimerCompteReel(examinateurDate.compteId);
    // Après la suppression du compte (cascade jusqu'à profils_coach) : la ligne de référence
    // 'natation' peut être retirée sans violer la clé étrangère.
    await appelRest('/rest/v1/disciplines?cle=eq.natation', {
      methode: 'DELETE',
      session: 'admin',
    });
  });

  it('anon lit la date de vérification d’un coach vérifié : la bonne date, exacte', async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/date_verification_coach', {
      methode: 'POST',
      session: 'anon',
      corps: { p_coach_id: profilCoachVerifieId },
    });
    expect(statut).toBe(200);
    expect(new Date(corps as string).toISOString()).toBe(new Date(horodatageAttendu).toISOString());
  });

  it('un compte authenticated ordinaire (A) lit la même date : accordé, pas réservé à anon', async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/date_verification_coach', {
      methode: 'POST',
      session: A,
      corps: { p_coach_id: profilCoachVerifieId },
    });
    expect(statut).toBe(200);
    expect(new Date(corps as string).toISOString()).toBe(new Date(horodatageAttendu).toISOString());
  });

  it('coach jamais vérifié (D, statut_verification = absente) : null, pas une erreur', async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/date_verification_coach', {
      methode: 'POST',
      session: 'anon',
      corps: { p_coach_id: profilCoachIdD },
    });
    expect(statut).toBe(200);
    expect(corps).toBeNull();
  });

  it('coach vérifié puis révoqué : null malgré la ligne "verifiee" passée — le statut courant décide, pas l’historique', async () => {
    const revocation = await appelRest('/rest/v1/rpc/decider_verification_coach', {
      methode: 'POST',
      session: examinateurDate,
      corps: {
        p_coach_id: profilCoachVerifieId,
        p_decision: 'revoquee',
        p_motif: 'Préparation du banc — révocation pour test',
      },
    });
    expect(revocation.statut).toBe(204);

    const { statut, corps } = await appelRest('/rest/v1/rpc/date_verification_coach', {
      methode: 'POST',
      session: 'anon',
      corps: { p_coach_id: profilCoachVerifieId },
    });
    expect(statut).toBe(200);
    expect(corps).toBeNull();
  });

  it('la table decisions_verification reste directement illisible pour anon — la fonction reste le SEUL chemin', async () => {
    const { statut } = await appelRest(
      `/rest/v1/decisions_verification?dossier=eq.${profilCoachVerifieId}`,
      { session: 'anon' },
    );
    expect(statut).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------------------------
// rechercher_coachs (0023_creer_recherche_coachs.sql) — P3.3, banc des ouvertures à grande
// échelle (docs/prompts/L3.md)
// ---------------------------------------------------------------------------------------------

type LigneRecherche = {
  offre_id: string;
  coach_id: string;
  prenom: string;
  discipline: string;
  commune_base_insee: string | null;
  formats: string[];
  prix_centimes: number;
  total_resultats: number;
};

describe('rechercher_coachs', () => {
  // Discipline dédiée à ce describe, jamais 'yoga' (déjà utilisée ailleurs dans ce fichier avec
  // un sens différent) ni l'une des sept clés réelles — une clé de référence éphémère à elle,
  // même motif que 'natation' pour decider_verification_coach.
  const DISCIPLINE_RECHERCHE = 'discipline-recherche-banc';
  const DISCIPLINE_PLAFOND = 'discipline-plafond-banc';
  // Sert aussi de texte recherché tel quel dans le test de correspondance textuelle : une
  // discipline dont la CLÉ est le mot recherché exerce la branche "correspondance exacte"
  // (case 3) sans dépendre d'une coïncidence avec une vraie discipline.
  const DISCIPLINE_TEXTE = 'discipline-texte-banc';

  let coachLyon: Session;
  let coachParis: Session;
  let coachVisio: Session;
  let coachVisioComplet: Session;
  let coachTexteDiscipline: Session;
  let coachTexteBio: Session;
  let coachSansOffrePubliee: Session;
  let coachPlafond: Session;
  const profilsCrees: string[] = [];

  const BIO_LONGUE =
    'Dix ans d’expérience en préparation physique, spécialisée dans la reprise en douceur ' +
    'après blessure ou arrêt prolongé, avec un accompagnement individualisé pas à pas.';

  async function creerCoachVerifie(params: {
    suffixe: string;
    discipline: string;
    communeInsee?: string;
    formats?: string[];
    bio?: string;
    parcoursTexte?: string;
    photoUrl?: string;
  }): Promise<{ session: Session; profilId: string }> {
    const session = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-${params.suffixe}@${DOMAINE_EMAIL}`,
      { date_naissance: '1990-01-01', cgu_version_acceptee: '2026-08-01' },
    );
    const creation = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: {
        compte_id: session.compteId,
        prenom: params.suffixe,
        nom: 'Recherche',
        discipline: params.discipline,
        commune_base_insee: params.communeInsee ?? null,
        formats: params.formats ?? [],
        bio: params.bio ?? null,
        parcours_texte: params.parcoursTexte ?? null,
        photo_url: params.photoUrl ?? null,
      },
    });
    if (creation.statut >= 400) {
      throw new Error(
        `Préparation du banc : profil ${params.suffixe} refusé (${creation.statut}) : ` +
          `${JSON.stringify(creation.corps)}`,
      );
    }
    const profilId = (creation.corps as { id: string }[])[0].id;
    // Créé 'absente' (défaut, 0001), passé en 'verifiee' par un second appel admin — même
    // pattern que describe('offres') pour B : statut_verification est une colonne protégée
    // (docs/backend.md §7), jamais posée directement à la création dans ce fichier.
    const verification = await appelRest(`/rest/v1/profils_coach?id=eq.${profilId}`, {
      methode: 'PATCH',
      session: 'admin',
      corps: { statut_verification: 'verifiee' },
    });
    if (verification.statut >= 400) {
      throw new Error(
        `Préparation du banc : passage en 'verifiee' refusé pour ${params.suffixe} (${verification.statut})`,
      );
    }
    profilsCrees.push(profilId);
    return { session, profilId };
  }

  async function publierOffreAdmin(coachId: string, titre: string, prixCentimes: number) {
    const creation = await appelRest('/rest/v1/offres', {
      methode: 'POST',
      session: 'admin',
      corps: {
        coach_id: coachId,
        titre,
        prix_centimes: prixCentimes,
        publiee_le: new Date().toISOString(),
      },
    });
    if (creation.statut >= 400) {
      throw new Error(
        `Préparation du banc : offre "${titre}" refusée (${creation.statut}) : ` +
          `${JSON.stringify(creation.corps)}`,
      );
    }
    return (creation.corps as { id: string }[])[0].id;
  }

  let referenceDisciplineRecherche: string;
  let referenceDisciplinePlafond: string;
  let referenceDisciplineTexte: string;

  beforeAll(async () => {
    // Trois lignes de référence éphémères — même motif que 'natation' plus haut : ce describe
    // teste rechercher_coachs(), pas la table disciplines elle-même, une discipline dédiée
    // évite de coupler ce test à une clé réelle qui pourrait changer.
    for (const [cle, ordre] of [
      [DISCIPLINE_RECHERCHE, 90],
      [DISCIPLINE_PLAFOND, 91],
      [DISCIPLINE_TEXTE, 92],
    ] as const) {
      const ref = await appelRest('/rest/v1/disciplines', {
        methode: 'POST',
        session: 'admin',
        corps: { cle, libelle: cle, ordre_affichage: ordre },
      });
      if (ref.statut >= 400) {
        throw new Error(
          `Préparation du banc : ligne de référence '${cle}' refusée (${ref.statut}) : ` +
            `${JSON.stringify(ref.corps)}`,
        );
      }
    }
    referenceDisciplineRecherche = DISCIPLINE_RECHERCHE;
    referenceDisciplinePlafond = DISCIPLINE_PLAFOND;
    referenceDisciplineTexte = DISCIPLINE_TEXTE;

    // Lyon (69123), présentiel, bonne complétude (bio + parcours ≥ 80 caractères, photo).
    const lyon = await creerCoachVerifie({
      suffixe: 'recherche-lyon',
      discipline: DISCIPLINE_RECHERCHE,
      communeInsee: '69123',
      formats: ['presentiel'],
      bio: BIO_LONGUE,
      parcoursTexte: BIO_LONGUE,
      photoUrl: 'https://exemple.test/photo.jpg',
    });
    coachLyon = lyon.session;
    await publierOffreAdmin(lyon.profilId, 'Offre Lyon', 3000);

    // Paris (75056), présentiel, complétude nulle (rien renseigné) — plus loin de Lyon et moins
    // complet : doit apparaître APRÈS le coach de Lyon dans une recherche centrée sur Lyon. Prix
    // délibérément différent des autres (9000, contre 3000 ailleurs) : seul candidat du groupe à
    // exclure par un filtre de budget, sans toucher aux autres tests de ce describe.
    const paris = await creerCoachVerifie({
      suffixe: 'recherche-paris',
      discipline: DISCIPLINE_RECHERCHE,
      communeInsee: '75056',
      formats: ['presentiel'],
    });
    coachParis = paris.session;
    await publierOffreAdmin(paris.profilId, 'Offre Paris', 9000);

    // Visio : proximité fixe à 0,6 quelle que soit la commune demandée (docs/domaine.md §5.7) —
    // doit passer devant Paris (loin) mais reste derrière Lyon (0 km, proximité 1,0) dans une
    // recherche centrée sur Lyon. Complétude nulle : isole la proximité de la complétude dans le
    // test d'ordonnancement (Lyon a AUSSI la meilleure complétude — ce coach-ci n'a que la
    // proximité pour se distinguer de Paris).
    const visio = await creerCoachVerifie({
      suffixe: 'recherche-visio',
      discipline: DISCIPLINE_RECHERCHE,
      formats: ['visio'],
    });
    coachVisio = visio.session;
    await publierOffreAdmin(visio.profilId, 'Offre Visio', 3000);

    // Même proximité que le précédent (visio, 0,6 fixe), mais bonne complétude — isole la
    // complétude de la proximité : à proximité strictement égale, seule la complétude doit
    // départager les deux.
    const visioComplet = await creerCoachVerifie({
      suffixe: 'recherche-visio-complet',
      discipline: DISCIPLINE_RECHERCHE,
      formats: ['visio'],
      bio: BIO_LONGUE,
      parcoursTexte: BIO_LONGUE,
      photoUrl: 'https://exemple.test/photo.jpg',
    });
    coachVisioComplet = visioComplet.session;
    await publierOffreAdmin(visioComplet.profilId, 'Offre Visio complet', 3000);

    // Correspondance textuelle (docs/domaine.md §5.6) : deux coachs à proximité et complétude
    // STRICTEMENT égales (visio, rien renseigné), qui ne diffèrent que par où le texte recherché
    // apparaît — la discipline elle-même (correspondance exacte, cas 3) pour l'un, la bio
    // seulement (cas 1) pour l'autre. DISCIPLINE_TEXTE sert de mot recherché ET de discipline :
    // sa propre ligne de référence (voir plus haut) en fait une clé valide pour la contrainte.
    const texteDiscipline = await creerCoachVerifie({
      suffixe: 'recherche-texte-discipline',
      discipline: DISCIPLINE_TEXTE,
      formats: ['visio'],
    });
    coachTexteDiscipline = texteDiscipline.session;
    await publierOffreAdmin(texteDiscipline.profilId, 'Offre texte discipline', 3000);

    const texteBio = await creerCoachVerifie({
      suffixe: 'recherche-texte-bio',
      discipline: DISCIPLINE_RECHERCHE,
      formats: ['visio'],
      // Sous 80 caractères : ne compte pas dans la complétude (docs/domaine.md §5.6), pour
      // rester à égalité stricte avec coachTexteDiscipline (bio nulle) sur cette dimension.
      bio: `Spécialiste ${DISCIPLINE_TEXTE}.`,
    });
    coachTexteBio = texteBio.session;
    await publierOffreAdmin(texteBio.profilId, 'Offre texte bio', 3000);

    // Vérifié, mais AUCUNE offre publiée (seulement un brouillon) — ne doit jamais apparaître.
    const sansOffre = await creerCoachVerifie({
      suffixe: 'recherche-sans-offre',
      discipline: DISCIPLINE_RECHERCHE,
      formats: ['presentiel'],
    });
    coachSansOffrePubliee = sansOffre.session;
    const brouillon = await appelRest('/rest/v1/offres', {
      methode: 'POST',
      session: 'admin',
      corps: { coach_id: sansOffre.profilId, titre: 'Brouillon', prix_centimes: 3000 },
    });
    if (brouillon.statut >= 400) {
      throw new Error(`Préparation du banc : brouillon refusé (${brouillon.statut})`);
    }

    // Plafond : un seul coach vérifié, 35 offres publiées — largement au-delà du plafond de 30
    // (docs/backend.md §10). Un coach avec plusieurs offres publiées est rare mais non exclu par
    // docs/domaine.md §3.3 (voir docs/ecrans/L3-02, Contenu) : le plus simple pour dépasser le
    // plafond sans créer 35 comptes.
    const plafond = await creerCoachVerifie({
      suffixe: 'recherche-plafond',
      discipline: DISCIPLINE_PLAFOND,
      formats: ['visio'],
    });
    coachPlafond = plafond.session;
    await Promise.all(
      Array.from({ length: 35 }, (_, i) => publierOffreAdmin(plafond.profilId, `Offre ${i}`, 2000)),
    );
  }, 60_000);

  afterAll(async () => {
    // Les comptes d'abord : ON DELETE CASCADE (profils_coach -> offres, 0007) retire les offres
    // avant que les lignes de référence des disciplines ne soient retirées à leur tour.
    for (const session of [
      coachLyon,
      coachParis,
      coachVisio,
      coachVisioComplet,
      coachTexteDiscipline,
      coachTexteBio,
      coachSansOffrePubliee,
      coachPlafond,
    ]) {
      if (session) await supprimerCompteReel(session.compteId);
    }
    for (const cle of [
      referenceDisciplineRecherche,
      referenceDisciplinePlafond,
      referenceDisciplineTexte,
    ]) {
      await appelRest(`/rest/v1/disciplines?cle=eq.${cle}`, {
        methode: 'DELETE',
        session: 'admin',
      });
    }
  }, 30_000);

  it('anon cherche par discipline : ne rend que des coachs vérifiés avec une offre publiée dans cette discipline', async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: DISCIPLINE_RECHERCHE, p_commune_insee: '69123' },
    });
    expect(statut).toBe(200);
    const lignes = corps as LigneRecherche[];
    // Lyon, Paris, Visio, Visio complet, Texte bio — cinq candidats de DISCIPLINE_RECHERCHE avec
    // une offre publiée. Texte discipline en est exclu : sa discipline est DISCIPLINE_TEXTE, pas
    // celle-ci.
    expect(lignes).toHaveLength(5);
    expect(new Set(lignes.map((l) => l.discipline))).toEqual(new Set([DISCIPLINE_RECHERCHE]));
    // Illégitime, au même endroit que le légitime (règle 6) : ni D (coach non vérifié, offre
    // publiée en 'yoga'), ni le coach sans offre publiée n'apparaissent.
    expect(lignes.some((l) => l.coach_id === profilCoachIdD)).toBe(false);
    expect(lignes.every((l) => l.prenom !== 'recherche-sans-offre')).toBe(true);
  });

  it('un compte authenticated ordinaire obtient exactement le même résultat que anon, à discipline et commune égales', async () => {
    const corps = { p_discipline: DISCIPLINE_RECHERCHE, p_commune_insee: '69123' };
    const reponseAnon = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps,
    });
    const reponseA = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: A,
      corps,
    });
    expect(reponseA.statut).toBe(200);
    const idsAnon = (reponseAnon.corps as LigneRecherche[]).map((l) => l.offre_id).sort();
    const idsA = (reponseA.corps as LigneRecherche[]).map((l) => l.offre_id).sort();
    expect(idsA).toEqual(idsAnon);
  });

  it('la proximité ordonne correctement : Lyon (0 km) devant Visio (0,6 fixe) devant Paris (loin), à discipline égale', async () => {
    const { corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: DISCIPLINE_RECHERCHE, p_commune_insee: '69123', p_limite: 30 },
    });
    const prenoms = (corps as LigneRecherche[]).map((l) => l.prenom);
    expect(prenoms.indexOf('recherche-lyon')).toBeLessThan(prenoms.indexOf('recherche-visio'));
    expect(prenoms.indexOf('recherche-visio')).toBeLessThan(prenoms.indexOf('recherche-paris'));
  });

  it('la complétude ordonne correctement, à proximité STRICTEMENT égale (deux coachs visio)', async () => {
    // Sans commune demandée : les deux presentiel (Lyon, Paris) tombent à proximité 0, les deux
    // visio restent à 0,6 — seule la complétude peut alors les départager entre eux.
    const { corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: DISCIPLINE_RECHERCHE, p_limite: 30 },
    });
    const prenoms = (corps as LigneRecherche[]).map((l) => l.prenom);
    expect(prenoms.indexOf('recherche-visio-complet')).toBeLessThan(
      prenoms.indexOf('recherche-visio'),
    );
  });

  it('la correspondance textuelle ordonne correctement : discipline exacte devant bio seule, à proximité et complétude égales', async () => {
    const { corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_texte: DISCIPLINE_TEXTE, p_limite: 30 },
    });
    const lignes = corps as LigneRecherche[];
    const prenoms = lignes.map((l) => l.prenom);
    expect(prenoms).toContain('recherche-texte-discipline');
    expect(prenoms).toContain('recherche-texte-bio');
    expect(prenoms.indexOf('recherche-texte-discipline')).toBeLessThan(
      prenoms.indexOf('recherche-texte-bio'),
    );
    // Aucun des autres candidats du describe n'a de raison de matcher ce texte (ni leur
    // discipline, ni leur titre, ni leur bio ne le contiennent).
    expect(prenoms).not.toContain('recherche-lyon');
    expect(prenoms).not.toContain('recherche-paris');
  });

  it('le filtre de budget exclut une offre hors bornes, sans toucher aux autres', async () => {
    const { corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: DISCIPLINE_RECHERCHE, p_prix_max: 5000 },
    });
    const prenoms = (corps as LigneRecherche[]).map((l) => l.prenom);
    // Paris (9000) est le seul candidat du groupe au-dessus de la borne.
    expect(prenoms).not.toContain('recherche-paris');
    expect(prenoms).toContain('recherche-lyon');
  });

  it('le filtre de format exclut les coachs présentiel quand seul « visio » est demandé', async () => {
    const { corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: DISCIPLINE_RECHERCHE, p_format: 'visio', p_limite: 30 },
    });
    const prenoms = (corps as LigneRecherche[]).map((l) => l.prenom);
    expect(new Set(prenoms)).toEqual(
      new Set(['recherche-visio', 'recherche-visio-complet', 'recherche-texte-bio']),
    );
  });

  it('un coach non vérifié (D) n’apparaît jamais, même en filtrant sur sa propre discipline', async () => {
    // D (module-level, describe('offres')) est en 'yoga', jamais vérifié, avec une offre
    // publiée directement par service_role (fixture délibérément incohérente, même famille que
    // le test équivalent de describe('offres')) — persiste pour tout le fichier (afterAll
    // global). Filtrer explicitement sur SA discipline exerce vraiment le filtre
    // statut_verification, contrairement à une recherche sur DISCIPLINE_RECHERCHE où D serait de
    // toute façon absent par discipline seule, sans que ce test ne prouve rien sur la
    // vérification.
    const { corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: 'yoga', p_limite: 30 },
    });
    const lignes = corps as LigneRecherche[];
    expect(lignes.some((l) => l.coach_id === profilCoachIdD)).toBe(false);
  });

  it('un coach « visio » ressort quelle que soit la commune demandée (docs/domaine.md §5.7)', async () => {
    const { corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      // Une commune du référentiel où AUCUN de ces coachs n'est basé : seul le coach visio a
      // une raison structurelle d'apparaître avec une proximité non nulle.
      corps: { p_discipline: DISCIPLINE_RECHERCHE, p_commune_insee: '59350' },
    });
    const lignes = corps as LigneRecherche[];
    expect(lignes.some((l) => l.prenom === 'recherche-visio')).toBe(true);
  });

  it('une discipline qui n’existe pour aucun coach vérifié rend un ensemble vide, jamais une erreur', async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: 'discipline-totalement-absente-du-banc' },
    });
    expect(statut).toBe(200);
    expect(corps).toEqual([]);
  });

  it('aucune colonne fermée de profils_coach ne sort par cette fonction', async () => {
    const { corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: DISCIPLINE_RECHERCHE, p_commune_insee: '69123' },
    });
    const ligne = (corps as Record<string, unknown>[])[0];
    expect(ligne).not.toHaveProperty('compte_id');
  });

  it('le plafond dur : une demande très au-delà du plafond ne reçoit jamais plus que 30 lignes', async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: DISCIPLINE_PLAFOND, p_limite: 5000 },
    });
    expect(statut).toBe(200);
    const lignes = corps as LigneRecherche[];
    expect(lignes.length).toBe(30);
    // Le total exact, lui, reflète les 35 lignes réelles — décision validée de L3-02 :
    // l'énumération complète est assumée, le total est exposé, jamais tronqué par le plafond.
    expect(lignes[0].total_resultats).toBe(35);
  });

  it('la pagination (décalage) atteint les lignes au-delà du plafond', async () => {
    const { corps } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
      methode: 'POST',
      session: 'anon',
      corps: { p_discipline: DISCIPLINE_PLAFOND, p_limite: 30, p_decalage: 30 },
    });
    const lignes = corps as LigneRecherche[];
    expect(lignes).toHaveLength(5);
  });

  it('le bruit de départage : deux appels identiques, à quelques secondes d’écart, peuvent rendre un ordre différent parmi des ex-æquo', async () => {
    // Les 35 offres du coach du plafond sont strictement ex-æquo (même coach, donc même
    // discipline/proximité/complétude) : si l'ordre ne varie JAMAIS entre deux appels, le bruit
    // n'est pas tiré à l'exécution — c'est un rouge, pas une coïncidence à ignorer.
    const corps = { p_discipline: DISCIPLINE_PLAFOND, p_limite: 30 };
    const resultats = new Set<string>();
    for (let essai = 0; essai < 5; essai++) {
      const { corps: reponse } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
        methode: 'POST',
        session: 'anon',
        corps,
      });
      resultats.add((reponse as LigneRecherche[]).map((l) => l.offre_id).join(','));
    }
    expect(resultats.size).toBeGreaterThan(1);
  });

  // Règle 8 (docs/prompts/L2.md, reprise docs/prompts/L3.md) : un test qui deviendra faux plus
  // tard porte son intention dans le fichier. Décision du 13 septembre 2026
  // (0024_documenter_defense_profondeur_recherche.sql) : les filtres statut_verification et
  // publiee_le/retiree_le du corps de la fonction sont gardés comme défense en profondeur,
  // redondants avec les politiques tant que security invoker tient — mais AUCUN cycle de
  // cassage ne les fait rougir (P3.3), donc rien d'autre ne signale une bascule vers security
  // definer. Ce test-ci exerce précisément ce qui les rendrait à nouveau la SEULE protection.
  it('rechercher_coachs reste security invoker — sinon les deux filtres redondants deviennent la seule protection', async () => {
    const { statut, corps } = await appelRest('/rest/v1/rpc/rechercher_coachs_est_invoker', {
      methode: 'POST',
      session: 'anon',
    });
    expect(statut).toBe(200);
    expect(corps).toBe(true);
  });
});
