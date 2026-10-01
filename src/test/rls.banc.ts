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

// Piège déjà vécu avec les disciplines : ce fichier écrit 'yoga'/'cuisine'/'cybersécurité' en
// dur à plus de vingt endroits, en pariant que ces clés restent dans le catalogue de référence
// — un pari qui a déjà cassé une fois (la ligne éphémère 'natation', créée puis retirée dans ce
// même fichier pour d'autres tests, aurait pu tout aussi bien être confondue avec une clé
// « normale » par un futur test qui ne l'aurait pas su hors catalogue). Plutôt que de reproduire
// ce pari pour les langues, cet helper lit une clé RÉELLEMENT valide dans la vraie table avant
// de s'en servir : si le contenu de 0025 change un jour, les tests qui l'utilisent s'adaptent au
// lieu de rougir pour une mauvaise raison — ou pire, de continuer à passer par hasard.
async function uneLangueValide(): Promise<string> {
  const { statut, corps } = await appelRest(
    '/rest/v1/langues?select=cle&order=ordre_affichage.asc&limit=1',
  );
  if (statut !== 200 || !Array.isArray(corps) || corps.length === 0) {
    throw new Error(
      `Préparation du banc : aucune langue de référence lisible (${statut}) — 0025 est-elle appliquée ?`,
    );
  }
  return (corps[0] as { cle: string }).cle;
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

  // Même famille que le test ci-dessus, même mécanisme (le grant, pas une politique) -- ajouté en
  // écrivant jeton_invitation (L3bis, 0026) : docs/backend.md §8, "toute colonne ajoutée à
  // profils_coach est publique par défaut, dès qu'elle est accordée" -- jeton_invitation n'est
  // JAMAIS accordée, la preuve en est ici, avec le code d'erreur explicite (42501), pas seulement
  // le message.
  it("anon lit jeton_invitation d'un coach vérifié, par une demande explicite : refusé par le grant (42501)", async () => {
    const { statut, corps } = await appelRest(
      `/rest/v1/profils_coach?id=eq.${profilCoachIdB}&select=jeton_invitation`,
      { session: 'anon' },
    );
    expect(statut).toBeGreaterThanOrEqual(400);
    expect((corps as { code?: string }).code).toBe('42501');
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
// communes_reference (0023) et disciplines (0020) — lecture DIRECTE par anon, porte de sortie
// du lot L3, point 2 : jusqu'ici ces deux politiques (communes_reference_select_public,
// disciplines_select_actives) n'étaient exercées qu'à travers rechercher_coachs() — pour
// disciplines, même pas ça : la fonction filtre `pc.discipline = p_discipline` en texte, sans
// jamais joindre la table. Une politique atteinte seulement par une jointure interne à une
// fonction SECURITY INVOKER n'est pas la même chose qu'une politique exercée par la lecture
// directe que l'écran fait réellement (`lireCommunesReference`/`lireDisciplines`,
// `GET /rest/v1/...`) : même famille que le `select=…(*)` que le grant colonne par colonne
// refuse en L2 — une politique qui laisse passer la ligne n'est pas la preuve que le grant
// laisse passer les colonnes qu'un vrai appel demande.
// ---------------------------------------------------------------------------------------------

describe('communes_reference et disciplines — lecture directe par anon (grants publics)', () => {
  it('anon lit communes_reference directement : les six lignes du référentiel réduit, colonnes complètes', async () => {
    const { statut, corps } = await appelRest(
      '/rest/v1/communes_reference?select=code_insee,nom,latitude,longitude',
      { session: 'anon' },
    );
    expect(statut).toBe(200);
    const lignes = corps as { code_insee: string; nom: string; latitude: number }[];
    expect(lignes).toHaveLength(6);
    expect(lignes.map((l) => l.code_insee).sort()).toEqual(
      ['31555', '33063', '44109', '59350', '69123', '75056'].sort(),
    );
    expect(lignes.every((l) => typeof l.latitude === 'number')).toBe(true);
  });

  it('anon lit disciplines directement : au moins les sept disciplines réelles, actives seulement', async () => {
    const { statut, corps } = await appelRest(
      '/rest/v1/disciplines?select=cle,libelle,ordre_affichage,active',
      { session: 'anon' },
    );
    expect(statut).toBe(200);
    const lignes = corps as { cle: string; active: boolean }[];
    expect(lignes.length).toBeGreaterThanOrEqual(7);
    expect(lignes.every((l) => l.active)).toBe(true);
    expect(lignes.map((l) => l.cle)).toContain('yoga');
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
// langues (déclencheur) et communes_reference (clé étrangère) — 0025, formulaire de L1-09
// ---------------------------------------------------------------------------------------------

describe('langues et communes_reference — contraintes ajoutées par 0025', () => {
  let compteContraintes: Session;
  let compteClientCommune: Session;
  // Compte dédié au test positif (langue valide acceptée) : compteContraintes sert aux DEUX
  // tests négatifs voisins (langue absente, commune absente), qui doivent chacun échouer sans
  // laisser de ligne — le réutiliser pour un écriture qui RÉUSSIT casserait le test négatif
  // suivant (conflit d'unicité sur profils_coach.compte_id, plus jamais la contrainte visée).
  let compteLangueValide: Session;

  beforeAll(async () => {
    compteContraintes = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-contraintes-profil-coach@${DOMAINE_EMAIL}`,
      { date_naissance: '1991-01-01', cgu_version_acceptee: '2026-08-01' },
    );
    compteClientCommune = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-contrainte-commune-client@${DOMAINE_EMAIL}`,
      { date_naissance: '1991-01-01', cgu_version_acceptee: '2026-08-01' },
    );
    compteLangueValide = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-langue-valide-profil-coach@${DOMAINE_EMAIL}`,
      { date_naissance: '1991-01-01', cgu_version_acceptee: '2026-08-01' },
    );
  });

  afterAll(async () => {
    if (compteContraintes) await supprimerCompteReel(compteContraintes.compteId);
    if (compteClientCommune) await supprimerCompteReel(compteClientCommune.compteId);
    if (compteLangueValide) await supprimerCompteReel(compteLangueValide.compteId);
  });

  // Même principe que le test de discipline ci-dessus (règle 9) : c'est le déclencheur
  // lui-même qui doit rougir, pas une politique RLS qui se trouverait sur le chemin — écriture
  // directe par admin (service_role), qui contourne RLS mais jamais un déclencheur ni une
  // contrainte de table.
  it('une langue absente de la table de référence est refusée à l’écriture (déclencheur)', async () => {
    const { statut, corps } = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: {
        compte_id: compteContraintes.compteId,
        prenom: 'Sans',
        nom: 'Langue',
        discipline: 'yoga',
        langues: ['langue-qui-n-existe-pas'],
      },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/langue inconnue/i);
  });

  // Symétrique du test ci-dessus : le déclencheur doit accepter une langue réelle aussi
  // sûrement qu'il refuse une langue inventée — sans cette moitié-là, rien ne prouverait que la
  // contrainte ne bloque pas TOUT, langue valide comprise. `uneLangueValide()` lit la clé dans
  // la vraie table (voir son commentaire) plutôt que d'en deviner une.
  it('une langue réellement valide (lue dans le catalogue réel) est acceptée à l’écriture', async () => {
    const langueValide = await uneLangueValide();
    const { statut, corps } = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: {
        compte_id: compteLangueValide.compteId,
        prenom: 'Avec',
        nom: 'Langue',
        discipline: 'yoga',
        langues: [langueValide],
      },
    });
    expect(statut).toBeLessThan(300);
    expect((corps as { langues: string[] }[])[0]?.langues).toEqual([langueValide]);
  });

  it('une commune absente du référentiel est refusée à l’écriture, côté coach (clé étrangère)', async () => {
    const { statut, corps } = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: {
        compte_id: compteContraintes.compteId,
        prenom: 'Sans',
        nom: 'Commune',
        discipline: 'yoga',
        commune_base_insee: '00000',
      },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/foreign key|profils_coach_commune_base_insee_fkey/i);
  });

  // Côté client, une insertion directe par le compte lui-même est légitime (docs/api.md §3,
  // déjà exercée par le describe profils_client plus haut) — la commune y est donc exercée par
  // une vraie session, pas par admin.
  it('une commune absente du référentiel est refusée à l’écriture, côté client (clé étrangère)', async () => {
    const { statut, corps } = await appelRest('/rest/v1/profils_client', {
      methode: 'POST',
      session: compteClientCommune,
      corps: {
        compte_id: compteClientCommune.compteId,
        prenom: 'Sans',
        commune_insee: '00000',
      },
    });
    expect(statut).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(corps)).toMatch(/foreign key|profils_client_commune_insee_fkey/i);
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

  it('le bruit de départage : deux appels identiques, à quelques secondes d’écart, peuvent rendre un ordre différent parmi des ex-æquo, jamais un total différent', async () => {
    // Les 35 offres du coach du plafond sont strictement ex-æquo (même coach, donc même
    // discipline/proximité/complétude) : si l'ordre ne varie JAMAIS entre deux appels, le bruit
    // n'est pas tiré à l'exécution — c'est un rouge, pas une coïncidence à ignorer.
    //
    // L3-02, critère 5 : « jamais un total différent ». Porte de sortie du lot L3, point 4 —
    // le bruit ne doit être qu'un désordre, jamais un canal qui laisse fuiter une information
    // supplémentaire. Prouver que l'ORDRE varie ne prouve pas encore que RIEN D'AUTRE ne varie :
    // sans l'assertion sur total_resultats ci-dessous, rien n'empêchait par exemple qu'un appel
    // recompte un total différent par accident (course, erreur de requête) sans qu'aucun test ne
    // le voie — structurellement improbable à la lecture du SQL (count(*) over () sur le même
    // ensemble WHERE, indépendant de l'ORDER BY), mais « improbable à la lecture du code » n'est
    // pas ce que ce dépôt appelle une preuve ailleurs (CLAUDE.md §6, §8) ; ça ne commence pas ici.
    const corps = { p_discipline: DISCIPLINE_PLAFOND, p_limite: 30 };
    const resultats = new Set<string>();
    const totaux = new Set<number>();
    for (let essai = 0; essai < 5; essai++) {
      const { corps: reponse } = await appelRest('/rest/v1/rpc/rechercher_coachs', {
        methode: 'POST',
        session: 'anon',
        corps,
      });
      const lignes = reponse as LigneRecherche[];
      resultats.add(lignes.map((l) => l.offre_id).join(','));
      totaux.add(lignes[0].total_resultats);
    }
    expect(resultats.size).toBeGreaterThan(1);
    expect(totaux.size).toBe(1);
    expect([...totaux][0]).toBe(35);
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

// ---------------------------------------------------------------------------------------------
// invitations (0026/0027) — L3bis. P3bis.4 : jeton, lecture étroite dans les deux sens, piège
// abonnee, liaison compte -> invitation.
// ---------------------------------------------------------------------------------------------

describe('invitations — L3bis (0026/0027)', () => {
  async function creerCoachAvecJeton(
    suffixe: string,
    discipline = 'yoga',
  ): Promise<{ session: Session; profilId: string; jeton: string }> {
    const session = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-${suffixe}@${DOMAINE_EMAIL}`,
      { date_naissance: '1990-01-01', cgu_version_acceptee: '2026-08-01' },
    );
    const creation = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: { compte_id: session.compteId, prenom: suffixe, nom: 'Coach', discipline },
    });
    if (creation.statut >= 400) {
      throw new Error(`Préparation du banc : profil coach ${suffixe} refusé (${creation.statut})`);
    }
    const profilId = (creation.corps as { id: string }[])[0].id;
    // coach_par_jeton_invitation() (0027) exige statut_verification = 'verifiee', même fermeture
    // que profils_coach_select_verifiee (0008) : un coach en cours d'examen ne doit pas avoir un
    // lien qui fonctionne. Vérifié systématiquement ici pour que les tests plus bas exercent le
    // mécanisme visé, pas ce refus-là (qui a sa propre couverture, describe('offres') plus haut).
    const verification = await appelRest(`/rest/v1/profils_coach?id=eq.${profilId}`, {
      methode: 'PATCH',
      session: 'admin',
      corps: { statut_verification: 'verifiee' },
    });
    if (verification.statut >= 400) {
      throw new Error(
        `Préparation du banc : vérification du coach ${suffixe} refusée (${verification.statut})`,
      );
    }
    // Le jeton se lit par la session du coach lui-même, jamais par service_role (docs/backend.md
    // §8 : jeton_invitation n'est accordée à aucun rôle, y compris pour préparer un banc).
    const { corps: jeton } = await appelRest('/rest/v1/rpc/mon_jeton_invitation', {
      methode: 'POST',
      session,
    });
    return { session, profilId, jeton: jeton as string };
  }

  // Compte créé PAR LE LIEN (le vrai déclencheur, 0027), profils_client créé ensuite par le
  // compte lui-même (légitime, docs/api.md §3) : l'état "compte_cree" complet, visible via
  // mes_invitations() -- à la différence du premier test de ce describe, qui s'arrête
  // volontairement avant cette étape.
  async function creerInviteComplet(suffixe: string, jeton: string, nom: string): Promise<Session> {
    const session = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-${suffixe}@${DOMAINE_EMAIL}`,
      { date_naissance: '1995-01-01', cgu_version_acceptee: '2026-08-01', jeton_invitation: jeton },
    );
    const creationProfil = await appelRest('/rest/v1/profils_client', {
      methode: 'POST',
      session,
      corps: { compte_id: session.compteId, prenom: suffixe, nom },
    });
    if (creationProfil.statut >= 400) {
      throw new Error(
        `Préparation du banc : profil client ${suffixe} refusé (${creationProfil.statut})`,
      );
    }
    return session;
  }

  // docs/domaine.md §3.15, docs/ecrans/L3bis-I01-inviter-mes-clients.md, "Colonnes rendues" :
  // mes_invitations() joint ProfilClient, qui ne se crée qu'à l'étape 1 de l'onboarding, jamais
  // à l'inscription elle-même. Ce test prouve les DEUX moitiés à la fois -- la ligne existe
  // réellement (le déclencheur a fonctionné), ET elle n'apparaît pas via mes_invitations() tant
  // que ProfilClient n'existe pas -- sans les deux, on ne distingue pas "le lien a échoué" de
  // "le lien a marché mais le JOIN la cache", exactement l'ambiguïté que ce test doit lever.
  it("mes_invitations() n'inclut pas un compte créé par le lien tant qu'il n'a pas de ProfilClient (onboarding non commencé)", async () => {
    const coach = await creerCoachAvecJeton('invitations-coach-sans-profil');
    const invite = await creerCompteReel(
      `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-invitations-invite-sans-profil@${DOMAINE_EMAIL}`,
      {
        date_naissance: '1995-01-01',
        cgu_version_acceptee: '2026-08-01',
        jeton_invitation: coach.jeton,
      },
    );

    const { corps: ligneReelle } = await appelRest(
      `/rest/v1/invitations?compte_invite_id=eq.${invite.compteId}&select=id,statut`,
      { session: 'admin' },
    );
    expect(ligneReelle).toHaveLength(1);
    expect((ligneReelle as { statut: string }[])[0].statut).toBe('compte_cree');

    const { corps: viaFonction } = await appelRest('/rest/v1/rpc/mes_invitations', {
      methode: 'POST',
      session: coach.session,
    });
    expect(viaFonction).toEqual([]);

    await supprimerCompteReel(invite.compteId);
    await supprimerCompteReel(coach.session.compteId);
  });

  describe('le jeton (point 1 de docs/prompts/L3bis.md)', () => {
    // Deux tests partagent les deux mêmes comptes (beforeAll/afterAll) plutôt que d'en créer un
    // troisième pour la seule devinette : la machine de développement n'a pas la limite
    // habituelle en tête, mais le projet Supabase de dev, lui, plafonne les connexions par
    // fenêtre de temps (over_request_rate_limit, trouvé en écrivant ce describe) -- chaque
    // compte réel de moins compte, à l'échelle de tout ce fichier.
    let coachA: { session: Session; profilId: string; jeton: string };
    let coachB: { session: Session; profilId: string; jeton: string };

    beforeAll(async () => {
      coachA = await creerCoachAvecJeton('jeton-a');
      coachB = await creerCoachAvecJeton('jeton-b');
    }, 30_000);

    afterAll(async () => {
      await supprimerCompteReel(coachA.session.compteId);
      await supprimerCompteReel(coachB.session.compteId);
    }, 30_000);

    it("un jeton construit à la main à partir du nom public d'un coach ne résout à rien — comme un jeton absent", async () => {
      // Même motif que le chemin de stockage de P2.5 : parier sur le nom public + un suffixe
      // court, jamais sur le vrai jeton (22 caractères aléatoires, jamais dérivés du nom).
      const jetonDevine = `jeton-a-${coachA.profilId.slice(0, 4)}`;
      const { statut, corps } = await appelRest('/rest/v1/rpc/coach_par_jeton_invitation', {
        methode: 'POST',
        session: 'anon',
        corps: { p_jeton: jetonDevine },
      });
      expect(statut).toBe(200);
      expect(corps).toBeNull();
    });

    it('deux coachs ont chacun leur propre jeton, jamais le même, jamais dérivable l’un de l’autre', async () => {
      expect(coachA.jeton).not.toBe(coachB.jeton);
      expect(coachA.jeton).toHaveLength(22);
      expect(coachB.jeton).toHaveLength(22);
      // "Dérivable" testé au sens le plus direct : aucun n'est une sous-chaîne de l'autre — un
      // vrai dérivé (préfixe, suffixe partagé) le serait.
      expect(coachB.jeton).not.toContain(coachA.jeton.slice(0, 10));
    });

    it('un coach régénère son jeton : l’ancien ne résout plus rien, le nouveau fonctionne, une invitation déjà liée reste inchangée', async () => {
      const coach = await creerCoachAvecJeton('jeton-regenere');
      const ancienJeton = coach.jeton;
      const invite = await creerInviteComplet('jeton-regenere-invite', ancienJeton, 'Avant');

      const { statut: statutRegen, corps: nouveauJeton } = await appelRest(
        '/rest/v1/rpc/regenerer_jeton_invitation',
        { methode: 'POST', session: coach.session },
      );
      expect(statutRegen).toBe(200);
      expect(nouveauJeton).not.toBe(ancienJeton);

      const { corps: viaAncien } = await appelRest('/rest/v1/rpc/coach_par_jeton_invitation', {
        methode: 'POST',
        session: 'anon',
        corps: { p_jeton: ancienJeton },
      });
      expect(viaAncien).toBeNull();

      const { corps: viaNouveau } = await appelRest('/rest/v1/rpc/coach_par_jeton_invitation', {
        methode: 'POST',
        session: 'anon',
        corps: { p_jeton: nouveauJeton },
      });
      expect(viaNouveau).toBe(coach.profilId);

      // L'invitation créée AVANT la régénération reste lisible telle quelle -- la régénération
      // ne touche qu'au jeton, jamais aux lignes invitations (0026, regenerer_jeton_invitation).
      const { corps: invitationsApres } = await appelRest('/rest/v1/rpc/mes_invitations', {
        methode: 'POST',
        session: coach.session,
      });
      expect(invitationsApres).toEqual([
        expect.objectContaining({ prenom: 'jeton-regenere-invite', initiale_nom: 'A' }),
      ]);

      await supprimerCompteReel(invite.compteId);
      await supprimerCompteReel(coach.session.compteId);
    });
  });

  describe('la lecture étroite par le coach, dans les deux sens (docs/backend.md §11)', () => {
    let coach: { session: Session; profilId: string; jeton: string };
    let coachB: { session: Session; profilId: string; jeton: string };
    let invite: Session;

    beforeAll(async () => {
      coach = await creerCoachAvecJeton('lecture-etroite-coach');
      coachB = await creerCoachAvecJeton('lecture-etroite-autre-coach');
      invite = await creerInviteComplet('lecture-etroite-invite', coach.jeton, 'Dupont');
    }, 30_000);

    afterAll(async () => {
      await supprimerCompteReel(invite.compteId);
      await supprimerCompteReel(coach.session.compteId);
      await supprimerCompteReel(coachB.session.compteId);
    }, 30_000);

    it('le coach lit id + statut + prenom + initiale_nom + abonnee_le de sa propre invitation, colonnes exactes', async () => {
      const { statut, corps } = await appelRest('/rest/v1/rpc/mes_invitations', {
        methode: 'POST',
        session: coach.session,
      });
      expect(statut).toBe(200);
      const lignes = corps as Record<string, unknown>[];
      expect(lignes).toHaveLength(1);
      const ligne = lignes[0];
      expect(Object.keys(ligne).sort()).toEqual(
        ['id', 'statut', 'prenom', 'initiale_nom', 'abonnee_le'].sort(),
      );
      expect(ligne.statut).toBe('compte_cree');
      expect(ligne.prenom).toBe('lecture-etroite-invite');
      expect(ligne.abonnee_le).toBeNull();
      expect(ligne).not.toHaveProperty('compte_cree_le');
    });

    // Assertion sur la VALEUR, pas seulement sur l'absence d'un champ nommé "nom" : le vrai nom
    // de l'invité ('Dupont') est connu par construction (préparé ci-dessus) -- comparé
    // directement à ce que mes_invitations() rend, pour que le test rougisse si un futur
    // renommage de colonne (nom_complet, identite...) faisait fuiter le nom complet ailleurs.
    it('initiale_nom ne contient jamais plus que la première lettre du vrai nom -- vérifié contre la valeur réelle', async () => {
      const { corps } = await appelRest('/rest/v1/rpc/mes_invitations', {
        methode: 'POST',
        session: coach.session,
      });
      const ligne = (corps as { initiale_nom: string }[])[0];
      const vraiNom = 'Dupont';
      expect(ligne.initiale_nom).toBe(vraiNom.charAt(0));
      expect(ligne.initiale_nom).toHaveLength(1);
      expect(JSON.stringify(corps)).not.toContain(vraiNom);
    });

    it('GET /rest/v1/invitations directement (authenticated) : refusé par le grant (42501), même avec des colonnes non sensibles (id, statut)', async () => {
      const large = await appelRest('/rest/v1/invitations', { session: coach.session });
      expect(large.statut).toBeGreaterThanOrEqual(400);
      expect((large.corps as { code?: string }).code).toBe('42501');

      const etroit = await appelRest('/rest/v1/invitations?select=id,statut', {
        session: coach.session,
      });
      expect(etroit.statut).toBeGreaterThanOrEqual(400);
      expect((etroit.corps as { code?: string }).code).toBe('42501');
    });

    it('relation imbriquée PostgREST depuis une autre table vers invitations : refusée, même mécanisme que le grant', async () => {
      // invitations n'étant référencée par aucune table que l'application peut lire (comptes et
      // profils_coach ne l'exposent pas comme relation inverse accordée), le chemin le plus
      // proche est une tentative directe avec une relation imbriquée sur elle-même -- refusée
      // pour la même raison que l'accès direct : le grant ferme la table avant qu'une politique
      // n'ait la moindre occasion de s'appliquer.
      const { statut, corps } = await appelRest(
        '/rest/v1/invitations?select=id,comptes(date_naissance)',
        { session: coach.session },
      );
      expect(statut).toBeGreaterThanOrEqual(400);
      expect((corps as { code?: string }).code).toBe('42501');
    });

    it('un AUTRE coach ne reçoit aucune ligne qui ne lui appartient pas', async () => {
      const { statut, corps } = await appelRest('/rest/v1/rpc/mes_invitations', {
        methode: 'POST',
        session: coachB.session,
      });
      expect(statut).toBe(200);
      expect(corps).toEqual([]);
    });

    it('anon : refusé sur la table (42501) et refusé à l’exécution de mes_invitations()', async () => {
      const table = await appelRest('/rest/v1/invitations', { session: 'anon' });
      expect(table.statut).toBeGreaterThanOrEqual(400);
      expect((table.corps as { code?: string }).code).toBe('42501');

      // Jamais accordée à anon (docs/backend.md §11) -- à la différence de
      // date_verification_coach(), qui l'est parce que la date est publique. mes_invitations()
      // ne l'est pas : refus d'exécution, pas un ensemble vide.
      const fonction = await appelRest('/rest/v1/rpc/mes_invitations', {
        methode: 'POST',
        session: 'anon',
      });
      expect(fonction.statut).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(fonction.corps)).toMatch(/permission denied/i);
    });

    // Même défaut que mes_invitations() ci-dessus, trouvé le même jour (revue de fin de lot
    // L3bis + CI sur pile fraîche, 0030_verrouiller_grants_invitations.sql) : ces quatre
    // fonctions partagent le même style "revoke execute ... from public" que mes_invitations()
    // avait avant sa correction — un style qui ne ferme PAS un grant séparé posé directement à
    // anon sur une pile dont le baseline en accorde un (la pile locale de CI, jamais le projet
    // distant partagé). Testées ensemble : la même classe de trou, fermée partout à la fois.
    it.each([
      'mon_jeton_invitation',
      'regenerer_jeton_invitation',
      'nombre_invitations_en_attente',
      'ajouter_invitation_en_attente',
    ])(
      'anon ne peut pas exécuter %s() (aucune de ces quatre fonctions ne lui est accordée)',
      async (nom) => {
        const { statut, corps } = await appelRest(`/rest/v1/rpc/${nom}`, {
          methode: 'POST',
          session: 'anon',
        });
        expect(statut).toBeGreaterThanOrEqual(400);
        expect(JSON.stringify(corps)).toMatch(/permission denied/i);
      },
    );

    it("une invitation en_attente n'apparaît individuellement nulle part, même en creux", async () => {
      // Insérée directement par service_role (grant insert, 0027) -- aucun mécanisme applicatif
      // ne crée encore de ligne en_attente à ce lot (l'action "Ajouter" de I-01 est un prompt
      // d'écran, P3bis.5, pas encore construit) : c'est le chemin honnête pour la préparer ici.
      const enAttente = await appelRest('/rest/v1/invitations', {
        methode: 'POST',
        session: 'admin',
        corps: { coach_id: coach.profilId, statut: 'en_attente' },
      });
      expect(enAttente.statut).toBeLessThan(300);
      const idEnAttente = (enAttente.corps as { id: string }[])[0].id;

      const { corps } = await appelRest('/rest/v1/rpc/mes_invitations', {
        methode: 'POST',
        session: coach.session,
      });
      const lignes = corps as { id: string }[];
      expect(lignes.some((l) => l.id === idEnAttente)).toBe(false);
      expect(JSON.stringify(corps)).not.toContain(idEnAttente);

      await appelRest(`/rest/v1/invitations?id=eq.${idEnAttente}`, {
        methode: 'DELETE',
        session: 'admin',
      });
    });

    // Réutilise coach/coachB/invite du beforeAll de ce describe plutôt que ses propres comptes
    // (comme les deux tests suivants) : le projet Supabase de dev plafonne les connexions par
    // fenêtre de temps (over_request_rate_limit), trouvé en écrivant ce fichier -- chaque compte
    // réel évité compte, à l'échelle de tout le banc.
    it('un compte créé par le lien porte compte_invite_id vers ce compte précisément, jamais vers un autre coach', async () => {
      const { corps } = await appelRest(
        `/rest/v1/invitations?compte_invite_id=eq.${invite.compteId}&select=coach_id,compte_invite_id`,
        { session: 'admin' },
      );
      const lignes = corps as { coach_id: string; compte_invite_id: string }[];
      expect(lignes).toHaveLength(1);
      expect(lignes[0].coach_id).toBe(coach.profilId);
      expect(lignes[0].coach_id).not.toBe(coachB.profilId);
      expect(lignes[0].compte_invite_id).toBe(invite.compteId);
    });

    // Règle 8 (docs/prompts/L3bis.md), INVERSÉE à L4 (P4.3, 0033_creer_abonnements.sql) comme
    // l'annonçait ce test lui-même. Jusqu'à L4, AUCUN chemin ne faisait passer une invitation à
    // 'abonnee' ; désormais UN SEUL le fait : la première entrée en 'actif' d'un abonnement du
    // client invité chez CE coach précisément (entrer_en_actif_premiere_fois, docs/domaine.md
    // §4.11). Le remplacer plutôt que le supprimer : les trois refus d'écriture directe de la
    // version d'origine restent vrais et restent vérifiés ci-dessous -- seul le chemin légitime
    // est nouveau.
    it("[Règle 8, inversée à L4] l'invitation passe à 'abonnee' quand l'invité s'abonne à SON inviteur, jamais à un autre coach, et par aucun autre chemin", async () => {
      const { corps: avant } = await appelRest('/rest/v1/rpc/mes_invitations', {
        methode: 'POST',
        session: coach.session,
      });
      const idInvitation = (avant as { id: string; statut: string }[])[0].id;
      expect((avant as { statut: string }[])[0].statut).toBe('compte_cree');

      // Les trois écritures directes restent refusées (aucun grant UPDATE sur invitations, pour
      // aucun rôle, 0027/0030) : la seule porte est la fonction, jamais un PATCH.
      for (const session of [coach.session, invite, 'admin' as const]) {
        const tentative = await appelRest(`/rest/v1/invitations?id=eq.${idInvitation}`, {
          methode: 'PATCH',
          session,
          corps: { statut: 'abonnee' },
        });
        expect(tentative.statut).toBeGreaterThanOrEqual(400);
      }

      const hier = new Date(Date.now() - 86_400_000).toISOString();
      const offreDe = async (coachId: string): Promise<string> => {
        const { corps } = await appelRest('/rest/v1/offres', {
          methode: 'POST',
          session: 'admin',
          corps: {
            coach_id: coachId,
            titre: 'Suivi',
            prix_centimes: 4900,
            benefices: ['a', 'b', 'c'],
            engagement_humain: ['ajustement_hebdomadaire'],
            publiee_le: hier,
          },
        });
        return (corps as { id: string }[])[0].id;
      };
      const offreInviteur = await offreDe(coach.profilId);
      const offreAutreCoach = await offreDe(coachB.profilId);
      const { corps: profils } = await appelRest(
        `/rest/v1/profils_client?compte_id=eq.${invite.compteId}&select=id`,
        { session: 'admin' },
      );
      const profilInvite = (profils as { id: string }[])[0].id;
      const souscrire = (offre: string, moyen: 'carte' | 'sepa', nom: string) =>
        appelRest('/rest/v1/rpc/souscrire_abonnement', {
          methode: 'POST',
          session: 'admin',
          corps: {
            p_profil_client_id: profilInvite,
            p_offre_id: offre,
            p_moyen: moyen,
            p_reference_paiement: `banc-${SUFFIXE_COMPTE}-invitation-${nom}`,
            p_prix_fige_centimes: 4900,
            p_intention_creee_le: new Date().toISOString(),
          },
        });
      const statutInvitation = async (): Promise<{ statut: string; abonnee_le: string | null }> => {
        const { corps } = await appelRest(
          `/rest/v1/invitations?id=eq.${idInvitation}&select=statut,abonnee_le`,
          { session: 'admin' },
        );
        return (corps as { statut: string; abonnee_le: string | null }[])[0];
      };

      // Sens illégitime : un abonnement ACTIF chez un AUTRE coach ne change rien.
      const autre = await souscrire(offreAutreCoach, 'carte', 'autre-coach');
      expect(autre.statut).toBe(200);
      expect((await statutInvitation()).statut).toBe('compte_cree');

      // Chez l'inviteur, mais en SEPA non confirmé : toujours rien (§4.3, première entrée en actif).
      const sepa = await souscrire(offreInviteur, 'sepa', 'inviteur-sepa');
      expect(sepa.statut).toBe(200);
      expect((await statutInvitation()).statut).toBe('compte_cree');

      // Sens légitime : confirmation du premier prélèvement -> 'abonnee', abonnee_le posée.
      const confirmation = await appelRest('/rest/v1/rpc/confirmer_premier_prelevement', {
        methode: 'POST',
        session: 'admin',
        corps: { p_abonnement_id: sepa.corps as string },
      });
      expect(confirmation.statut).toBe(204);
      const apres = await statutInvitation();
      expect(apres.statut).toBe('abonnee');
      expect(apres.abonnee_le).not.toBeNull();

      // Le coach le lit par son chemin normal, mes_invitations().
      const { corps: vuParLeCoach } = await appelRest('/rest/v1/rpc/mes_invitations', {
        methode: 'POST',
        session: coach.session,
      });
      expect(
        (vuParLeCoach as { id: string; statut: string }[]).find((l) => l.id === idInvitation)
          ?.statut,
      ).toBe('abonnee');
    });
  });

  describe('la liaison compte -> invitation, à l’inscription (0027, creer_compte_depuis_auth)', () => {
    it('un compte créé SANS jeton (inscription normale) ne crée aucune ligne invitations', async () => {
      const compteNormal = await creerCompteReel(
        `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-inscription-normale-sans-jeton@${DOMAINE_EMAIL}`,
        { date_naissance: '1995-01-01', cgu_version_acceptee: '2026-08-01' },
      );
      const { corps } = await appelRest(
        `/rest/v1/invitations?compte_invite_id=eq.${compteNormal.compteId}`,
        { session: 'admin' },
      );
      expect(corps).toEqual([]);
      await supprimerCompteReel(compteNormal.compteId);
    });

    it('un jeton présent mais invalide dans les métadonnées ne bloque pas l’inscription et ne crée aucune ligne', async () => {
      const compteJetonInvalide = await creerCompteReel(
        `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-inscription-jeton-invalide@${DOMAINE_EMAIL}`,
        {
          date_naissance: '1995-01-01',
          cgu_version_acceptee: '2026-08-01',
          jeton_invitation: 'jeton-completement-invente-qui-n-existe-pas',
        },
      );
      const { corps } = await appelRest(
        `/rest/v1/invitations?compte_invite_id=eq.${compteJetonInvalide.compteId}`,
        { session: 'admin' },
      );
      expect(corps).toEqual([]);
      await supprimerCompteReel(compteJetonInvalide.compteId);
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Abonnements — L4, P4.3 (0033_creer_abonnements.sql ; docs/domaine.md §3.4, §4.3, §5.5)
// ---------------------------------------------------------------------------------------------

// Jour civil Europe/Paris, au format AAAA-MM-JJ : la même définition que le serveur
// ((now() at time zone 'Europe/Paris')::date), jamais le jour UTC de la machine de test.
function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

function plusJours(jour: string, jours: number): string {
  const date = new Date(`${jour}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

function messageDe(corps: unknown): string {
  return (corps as { message?: string } | null)?.message ?? JSON.stringify(corps);
}

type LigneAbonnement = {
  id: string;
  statut: string;
  actif_depuis_le: string | null;
  jour_prelevement: number;
  prochain_prelevement_le: string;
  pause_jusqu_le: string | null;
  derniere_pause_le: string | null;
  resilie_le: string | null;
  fin_acces_le: string | null;
  prix_fige_centimes: number;
};

describe('abonnements — L4 (0033)', () => {
  // UNE seule connexion de plus pour tout ce describe (plafond de connexions du projet de
  // développement, docs/dette.md : trouvé en écrivant P4.3, le banc complet ne tenait plus dans
  // une fenêtre avec trois comptes connectés de plus). Le coach n'a jamais besoin d'une session :
  // son compte est créé par l'API d'administration SANS connexion, son profil client inséré par
  // service_role. client2 est le compte A du module (profil client seul, jamais en espace coach,
  // supprimé par l'afterAll global -- ses abonnements partent en cascade). Seul client1 se
  // connecte. Le compte de client1 porte AUSSI un profil coach jamais vérifié
  // (coach_non_verifie), celui du coach un profil client (auto_abonnement_interdit).
  let coachCompteId: string;
  let profilCoachId: string;
  let offreId: string;
  let offreBrouillonId: string;
  let offreRetireeId: string;
  let offreCoachNonVerifieId: string;
  let profilClientDuCoachId: string;
  let client1: Session;
  let profilClient1: string;
  let client2: Session;
  let profilClient2: string;
  let abonnement1: string; // client1, SEPA puis confirmé : sert aux transitions client
  let commissionPosee: string;

  const reference = (nom: string): string => `banc-${SUFFIXE_COMPTE}-${nom}`;

  async function insererOffre(
    coachId: string,
    dates: { publiee_le: string | null; retiree_le?: string | null },
  ): Promise<string> {
    const { statut, corps } = await appelRest('/rest/v1/offres', {
      methode: 'POST',
      session: 'admin',
      corps: {
        coach_id: coachId,
        titre: 'Suivi complet',
        prix_centimes: 4900,
        benefices: ['Programme', 'Visio', 'Messages'],
        engagement_humain: ['ajustement_hebdomadaire'],
        ...dates,
      },
    });
    if (statut >= 400) throw new Error(`Préparation du banc : offre refusée (${statut})`);
    return (corps as { id: string }[])[0].id;
  }

  async function creerProfilClient(session: Session, prenom: string): Promise<string> {
    const { statut, corps } = await appelRest('/rest/v1/profils_client', {
      methode: 'POST',
      session,
      corps: { compte_id: session.compteId, prenom, nom: 'Banc' },
    });
    if (statut >= 400) throw new Error(`Préparation du banc : profil client refusé (${statut})`);
    return (corps as { id: string }[])[0].id;
  }

  async function souscrire(
    profilClientId: string,
    offre: string,
    moyen: 'carte' | 'sepa',
    ref: string,
    session: Appelant = 'admin',
    intentionCreeeLe: string = new Date().toISOString(),
  ): Promise<{ statut: number; corps: unknown }> {
    return appelRest('/rest/v1/rpc/souscrire_abonnement', {
      methode: 'POST',
      session,
      corps: {
        p_profil_client_id: profilClientId,
        p_offre_id: offre,
        p_moyen: moyen,
        p_reference_paiement: ref,
        p_prix_fige_centimes: 4900,
        p_intention_creee_le: intentionCreeeLe,
      },
    });
  }

  async function lire(id: string): Promise<LigneAbonnement> {
    const { corps } = await appelRest(`/rest/v1/abonnements?id=eq.${id}&select=*`, {
      session: 'admin',
    });
    return (corps as LigneAbonnement[])[0];
  }

  async function commissionDuCoach(): Promise<string | null> {
    const { corps } = await appelRest(
      `/rest/v1/profils_coach?id=eq.${profilCoachId}&select=commission_offerte_jusqu_le`,
      { session: 'admin' },
    );
    return (corps as { commission_offerte_jusqu_le: string | null }[])[0]
      .commission_offerte_jusqu_le;
  }

  async function transition(
    fonction: string,
    session: Appelant,
    corps: Record<string, unknown>,
  ): Promise<{ statut: number; corps: unknown }> {
    return appelRest(`/rest/v1/rpc/${fonction}`, { methode: 'POST', session, corps });
  }

  beforeAll(async () => {
    // Création par l'API d'administration seule : même appel que creerCompteReel, sans la
    // connexion qui suit -- c'est elle, pas la création, que le plafond compte.
    const creation = await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-abo-coach@${DOMAINE_EMAIL}`,
        password: MOT_DE_PASSE,
        email_confirm: true,
        user_metadata: { date_naissance: '1988-01-01', cgu_version_acceptee: '2026-08-01' },
      }),
    });
    if (!creation.ok) throw new Error(`Préparation du banc : coach refusé (${creation.status})`);
    coachCompteId = ((await creation.json()) as { id: string }).id;
    const profil = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: { compte_id: coachCompteId, prenom: 'Abo', nom: 'Coach', discipline: 'yoga' },
    });
    profilCoachId = (profil.corps as { id: string }[])[0].id;
    await appelRest(`/rest/v1/profils_coach?id=eq.${profilCoachId}`, {
      methode: 'PATCH',
      session: 'admin',
      corps: { statut_verification: 'verifiee' },
    });
    const hier = new Date(Date.now() - 86_400_000).toISOString();
    offreId = await insererOffre(profilCoachId, { publiee_le: hier });
    offreBrouillonId = await insererOffre(profilCoachId, { publiee_le: null });
    offreRetireeId = await insererOffre(profilCoachId, {
      publiee_le: hier,
      retiree_le: new Date().toISOString(),
    });
    const profilDuCoach = await appelRest('/rest/v1/profils_client', {
      methode: 'POST',
      session: 'admin',
      corps: { compte_id: coachCompteId, prenom: 'CoachAussiClient', nom: 'Banc' },
    });
    profilClientDuCoachId = (profilDuCoach.corps as { id: string }[])[0].id;

    client1 = await creerCompteReel(`${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-abo-c1@${DOMAINE_EMAIL}`, {
      date_naissance: '1995-01-01',
      cgu_version_acceptee: '2026-08-01',
    });
    profilClient1 = await creerProfilClient(client1, 'Client1');
    client2 = A;
    // Le profil client de A est normalement créé par le beforeAll de describe('profils_client').
    // Filtré avec -t, ce describe ne tourne pas : sans ce repli, A n'aurait aucun profil et tout
    // ce describe échouerait dans sa préparation (trouvé en P4.4). Créé alors par la session de A
    // elle-même, le chemin légitime -- jamais par service_role.
    const profilA = await appelRest(
      `/rest/v1/profils_client?compte_id=eq.${A.compteId}&select=id`,
      {
        session: 'admin',
      },
    );
    const existant = (profilA.corps as { id: string }[])[0];
    profilClient2 = existant ? existant.id : await creerProfilClient(A, 'Client2');

    // Profil coach JAMAIS vérifié, sur le compte de client1, avec une offre marquée publiée par
    // service_role -- fixture délibérément incohérente (même famille que D, describe('offres')) :
    // prouve que la souscription revérifie le statut du coach, pas seulement la publication.
    const nonVerifie = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: { compte_id: client1.compteId, prenom: 'Non', nom: 'Verifie', discipline: 'yoga' },
    });
    offreCoachNonVerifieId = await insererOffre((nonVerifie.corps as { id: string }[])[0].id, {
      publiee_le: hier,
    });
  }, 60_000);

  afterAll(async () => {
    if (client1) await supprimerCompteReel(client1.compteId);
    if (coachCompteId) await supprimerCompteReel(coachCompteId);
    // client2 = A : supprimé par l'afterAll global.
  }, 30_000);

  describe('souscription et premier prélèvement : serveur seulement', () => {
    it('anon ne peut pas exécuter souscrire_abonnement', async () => {
      const { statut, corps } = await souscrire(
        profilClient1,
        offreId,
        'carte',
        reference('x'),
        'anon',
      );
      expect(statut).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(corps)).toMatch(/permission denied/i);
    });

    // Sens illégitime qui compte le plus : un client qui pourrait appeler cette fonction se
    // créerait un abonnement sans rien payer.
    it('un client ne peut pas se souscrire lui-même un abonnement', async () => {
      const { statut, corps } = await souscrire(
        profilClient1,
        offreId,
        'carte',
        reference('x'),
        client1,
      );
      expect(statut).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(corps)).toMatch(/permission denied/i);
    });

    it('SEPA : naît en_attente_confirmation, sans actif_depuis_le ni commission posée', async () => {
      const { statut, corps } = await souscrire(
        profilClient1,
        offreId,
        'sepa',
        reference('sepa-1'),
      );
      expect(statut).toBe(200);
      abonnement1 = corps as string;
      const ligne = await lire(abonnement1);
      expect(ligne.statut).toBe('en_attente_confirmation');
      expect(ligne.actif_depuis_le).toBeNull();
      expect(ligne.prix_fige_centimes).toBe(4900);
      expect(ligne.jour_prelevement).toBeGreaterThanOrEqual(1);
      expect(ligne.jour_prelevement).toBeLessThanOrEqual(28);
      expect(await commissionDuCoach()).toBeNull();
    });

    it('confirmer_premier_prelevement : en_attente -> actif, pose actif_depuis_le et la commission à J+90', async () => {
      const { statut } = await transition('confirmer_premier_prelevement', 'admin', {
        p_abonnement_id: abonnement1,
      });
      expect(statut).toBe(204);
      const ligne = await lire(abonnement1);
      expect(ligne.statut).toBe('actif');
      expect(ligne.actif_depuis_le).not.toBeNull();
      commissionPosee = (await commissionDuCoach()) as string;
      expect(commissionPosee).toBe(plusJours(aujourdhuiParis(), 90));
    });

    it('confirmer deux fois, ou rejeter un abonnement actif : transition_interdite', async () => {
      const deuxieme = await transition('confirmer_premier_prelevement', 'admin', {
        p_abonnement_id: abonnement1,
      });
      expect(messageDe(deuxieme.corps)).toBe('transition_interdite');
      const rejet = await transition('rejeter_premier_prelevement', 'admin', {
        p_abonnement_id: abonnement1,
      });
      expect(messageDe(rejet.corps)).toBe('transition_interdite');
      expect((await lire(abonnement1)).statut).toBe('actif');
    });

    it('carte : naît actif ; la commission du coach, déjà posée, ne bouge plus (§5.5)', async () => {
      const { statut, corps } = await souscrire(
        profilClient2,
        offreId,
        'carte',
        reference('carte-2'),
      );
      expect(statut).toBe(200);
      const ligne = await lire(corps as string);
      expect(ligne.statut).toBe('actif');
      expect(ligne.actif_depuis_le).not.toBeNull();
      expect(await commissionDuCoach()).toBe(commissionPosee);
    });

    it('la même référence de paiement deux fois ne crée qu’un abonnement (webhook et constat)', async () => {
      const premier = await souscrire(profilClient2, offreId, 'carte', reference('carte-2'));
      const second = await souscrire(profilClient2, offreId, 'carte', reference('carte-2'));
      expect(second.corps).toBe(premier.corps);
      const { corps } = await appelRest(
        `/rest/v1/abonnements?profil_client_id=eq.${profilClient2}&statut=eq.actif&select=id`,
        { session: 'admin' },
      );
      expect(corps).toHaveLength(1);
    });

    it('rejeter : en_attente -> annule, état terminal', async () => {
      const { corps } = await souscrire(profilClient2, offreId, 'sepa', reference('sepa-rejet'));
      const id = corps as string;
      const rejet = await transition('rejeter_premier_prelevement', 'admin', {
        p_abonnement_id: id,
      });
      expect(rejet.statut).toBe(204);
      expect((await lire(id)).statut).toBe('annule');
      const confirmation = await transition('confirmer_premier_prelevement', 'admin', {
        p_abonnement_id: id,
      });
      expect(messageDe(confirmation.corps)).toBe('transition_interdite');
    });

    it('une offre en brouillon ne se souscrit pas : offre_indisponible', async () => {
      const { corps } = await souscrire(
        profilClient1,
        offreBrouillonId,
        'carte',
        reference('brouillon'),
      );
      expect(messageDe(corps)).toBe('offre_indisponible');
    });

    // docs/domaine.md §3.3 (tranché le 28 septembre 2026) : l'intention fige l'offre. L'offre de
    // ce test a été retirée « maintenant » (beforeAll) : une intention créée avant ce retrait, il
    // y a moins de 30 minutes, reste honorée ; une intention créée après le retrait, ou trop
    // ancienne, ne l'est pas.
    describe('offre retirée entre l’intention et le paiement (§3.3)', () => {
      const ilYa = (minutes: number): string =>
        new Date(Date.now() - minutes * 60_000).toISOString();

      it('intention antérieure au retrait, de moins de 30 minutes : la souscription est honorée', async () => {
        const { statut, corps } = await souscrire(
          profilClient1,
          offreRetireeId,
          'carte',
          reference('retiree-honoree'),
          'admin',
          ilYa(10),
        );
        expect(statut).toBe(200);
        expect((await lire(corps as string)).statut).toBe('actif');
      });

      it('intention créée APRÈS le retrait : offre_indisponible', async () => {
        const { corps } = await souscrire(
          profilClient1,
          offreRetireeId,
          'carte',
          reference('retiree-apres'),
          'admin',
          new Date(Date.now() + 1000).toISOString(),
        );
        expect(messageDe(corps)).toBe('offre_indisponible');
      });

      it('intention de plus de 30 minutes sur une offre retirée depuis : offre_indisponible', async () => {
        const { corps } = await souscrire(
          profilClient1,
          offreRetireeId,
          'carte',
          reference('retiree-vieille'),
          'admin',
          ilYa(31),
        );
        expect(messageDe(corps)).toBe('offre_indisponible');
      });

      it('sans date d’intention : intention_requise', async () => {
        const { corps } = await appelRest('/rest/v1/rpc/souscrire_abonnement', {
          methode: 'POST',
          session: 'admin',
          corps: {
            p_profil_client_id: profilClient1,
            p_offre_id: offreId,
            p_moyen: 'carte',
            p_reference_paiement: reference('sans-intention'),
            p_prix_fige_centimes: 4900,
            p_intention_creee_le: null,
          },
        });
        expect(messageDe(corps)).toBe('intention_requise');
      });
    });

    it('le coach d’une offre publiée mais non vérifié : coach_non_verifie', async () => {
      const { corps } = await souscrire(
        profilClient1,
        offreCoachNonVerifieId,
        'carte',
        reference('non-verifie'),
      );
      expect(messageDe(corps)).toBe('coach_non_verifie');
    });

    it('un compte ne s’abonne jamais à sa propre offre : auto_abonnement_interdit', async () => {
      const { corps } = await souscrire(profilClientDuCoachId, offreId, 'carte', reference('auto'));
      expect(messageDe(corps)).toBe('auto_abonnement_interdit');
    });

    it('jour de prélèvement : 29/30/31 ramenés à 28, échéance au même jour du mois suivant', async () => {
      const jour = await transition('jour_prelevement_pour', 'admin', { p_jour: '2026-01-31' });
      expect(jour.corps).toBe(28);
      const fevrier = await transition('echeance_suivante', 'admin', {
        p_depuis: '2026-01-31',
        p_jour: 28,
      });
      expect(fevrier.corps).toBe('2026-02-28');
      const annee = await transition('echeance_suivante', 'admin', {
        p_depuis: '2026-12-15',
        p_jour: 15,
      });
      expect(annee.corps).toBe('2027-01-15');
    });
  });

  describe('lecture et écriture directes', () => {
    it('chaque client lit ses abonnements, jamais ceux d’un autre', async () => {
      const lecture1 = await appelRest('/rest/v1/abonnements?select=id', { session: client1 });
      const ids1 = (lecture1.corps as { id: string }[]).map((l) => l.id);
      expect(ids1).toContain(abonnement1);
      expect(ids1).toHaveLength(2); // abonnement1 et l'abonnement honoré sur l'offre retirée
      const lecture2 = await appelRest('/rest/v1/abonnements?select=id', { session: client2 });
      const ids2 = (lecture2.corps as { id: string }[]).map((l) => l.id);
      expect(ids2).toHaveLength(2);
      expect(ids2).not.toContain(abonnement1);
    });

    // B (module) : un compte tiers, avec profil client ET profil coach, qui n'est partie à aucun
    // de ces abonnements. Le coach de ce describe n'a pas de session (voir plus haut) ; aucune
    // lecture coach n'existe de toute façon à L4 (pilotage : L7).
    it('un compte tiers (client et coach) ne lit aucun de ces abonnements', async () => {
      const { corps } = await appelRest('/rest/v1/abonnements?select=id', { session: B });
      expect(corps).toEqual([]);
    });

    it('anon ne lit rien', async () => {
      const { statut, corps } = await appelRest('/rest/v1/abonnements?select=id');
      expect(statut).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(corps)).toMatch(/permission denied/i);
    });

    it('reference_paiement n’est lisible par aucun client, même sur son propre abonnement', async () => {
      const { statut, corps } = await appelRest('/rest/v1/abonnements?select=reference_paiement', {
        session: client1,
      });
      expect(statut).toBeGreaterThanOrEqual(400);
      expect((corps as { code?: string }).code).toBe('42501');
    });

    it('aucune écriture directe : ni insertion, ni changement de statut, pas même par service_role', async () => {
      const insertion = await appelRest('/rest/v1/abonnements', {
        methode: 'POST',
        session: client1,
        corps: { profil_client_id: profilClient1, statut: 'actif' },
      });
      expect((insertion.corps as { code?: string }).code).toBe('42501');
      const client = await appelRest(`/rest/v1/abonnements?id=eq.${abonnement1}`, {
        methode: 'PATCH',
        session: client1,
        corps: { statut: 'resilie' },
      });
      expect((client.corps as { code?: string }).code).toBe('42501');
      const admin = await appelRest(`/rest/v1/abonnements?id=eq.${abonnement1}`, {
        methode: 'PATCH',
        session: 'admin',
        corps: { statut: 'resilie' },
      });
      expect((admin.corps as { code?: string }).code).toBe('42501');
      expect((await lire(abonnement1)).statut).toBe('actif');
    });
  });

  describe('transitions demandées par le client (§4.3)', () => {
    it('un autre client, ou anon, ne touche jamais à l’abonnement de client1', async () => {
      const autre = await transition('demander_resiliation', client2, {
        p_abonnement_id: abonnement1,
      });
      expect(messageDe(autre.corps)).toBe('abonnement_introuvable');
      const anon = await transition('demander_resiliation', 'anon', {
        p_abonnement_id: abonnement1,
      });
      expect(JSON.stringify(anon.corps)).toMatch(/permission denied/i);
      expect((await lire(abonnement1)).statut).toBe('actif');
    });

    it('pause : 61 jours refusés, 30 jours acceptés (actif -> en_pause)', async () => {
      const trop = await transition('demander_pause', client1, {
        p_abonnement_id: abonnement1,
        p_jusqu_au: plusJours(aujourdhuiParis(), 61),
      });
      expect(messageDe(trop.corps)).toBe('duree_pause_invalide');
      const avantPause = (await lire(abonnement1)).actif_depuis_le;
      const pause = await transition('demander_pause', client1, {
        p_abonnement_id: abonnement1,
        p_jusqu_au: plusJours(aujourdhuiParis(), 30),
      });
      expect(pause.statut).toBe(204);
      const ligne = await lire(abonnement1);
      expect(ligne.statut).toBe('en_pause');
      expect(ligne.derniere_pause_le).toBe(aujourdhuiParis());
      expect(ligne.actif_depuis_le).toBe(avantPause);
    });

    it('reprise : en_pause -> actif, nouveau cycle depuis aujourd’hui, actif_depuis_le inchangée ; reprendre un abonnement actif est refusé', async () => {
      const avant = (await lire(abonnement1)).actif_depuis_le;
      const reprise = await transition('reprendre_abonnement', client1, {
        p_abonnement_id: abonnement1,
      });
      expect(reprise.statut).toBe(204);
      const ligne = await lire(abonnement1);
      expect(ligne.statut).toBe('actif');
      expect(ligne.pause_jusqu_le).toBeNull();
      expect(ligne.actif_depuis_le).toBe(avant);
      // docs/domaine.md §4.3 (tranché le 28 septembre 2026) : cycle recalculé sur le jour de reprise.
      const aujourdhui = aujourdhuiParis();
      expect(ligne.prochain_prelevement_le).toBe(aujourdhui);
      expect(ligne.jour_prelevement).toBe(Math.min(Number(aujourdhui.slice(8, 10)), 28));
      const encore = await transition('reprendre_abonnement', client1, {
        p_abonnement_id: abonnement1,
      });
      expect(messageDe(encore.corps)).toBe('transition_interdite');
    });

    it('une seconde pause dans les 12 mois : pause_deja_utilisee ; possible une fois la dernière vieille de 13 mois', async () => {
      const refus = await transition('demander_pause', client1, {
        p_abonnement_id: abonnement1,
        p_jusqu_au: plusJours(aujourdhuiParis(), 10),
      });
      expect(messageDe(refus.corps)).toBe('pause_deja_utilisee');

      // Ancienneté simulée par service_role (point 9 de docs/prompts/L4.md), jamais attendue.
      await appelRest(`/rest/v1/abonnements?id=eq.${abonnement1}`, {
        methode: 'PATCH',
        session: 'admin',
        corps: { derniere_pause_le: plusJours(aujourdhuiParis(), -400) },
      });
      const accepte = await transition('demander_pause', client1, {
        p_abonnement_id: abonnement1,
        p_jusqu_au: plusJours(aujourdhuiParis(), 10),
      });
      expect(accepte.statut).toBe(204);
      await transition('reprendre_abonnement', client1, { p_abonnement_id: abonnement1 });
      expect((await lire(abonnement1)).statut).toBe('actif');
    });

    it('résiliation : actif -> resiliation_programmee, fin d’accès à la prochaine échéance, jamais immédiate', async () => {
      const avant = await lire(abonnement1);
      const { statut } = await transition('demander_resiliation', client1, {
        p_abonnement_id: abonnement1,
      });
      expect(statut).toBe(204);
      const ligne = await lire(abonnement1);
      expect(ligne.statut).toBe('resiliation_programmee');
      expect(ligne.fin_acces_le).toBe(avant.prochain_prelevement_le);
      expect(ligne.resilie_le).not.toBeNull();
    });

    it('annulation de la résiliation : -> actif, dates effacées, actif_depuis_le inchangée ; une seconde annulation est refusée', async () => {
      const avant = (await lire(abonnement1)).actif_depuis_le;
      const { statut } = await transition('annuler_resiliation', client1, {
        p_abonnement_id: abonnement1,
      });
      expect(statut).toBe(204);
      const ligne = await lire(abonnement1);
      expect(ligne.statut).toBe('actif');
      expect(ligne.fin_acces_le).toBeNull();
      expect(ligne.resilie_le).toBeNull();
      expect(ligne.actif_depuis_le).toBe(avant);
      const encore = await transition('annuler_resiliation', client1, {
        p_abonnement_id: abonnement1,
      });
      expect(messageDe(encore.corps)).toBe('transition_interdite');
    });

    // docs/domaine.md §4.3 (tranché le 28 septembre 2026) : résilier en ligne reste possible en
    // pause -- effet le jour même, aucune période payée n'étant en cours de service. Sur
    // l'abonnement carte de client2, pour ne pas clore abonnement1. impaye et suspendu suivent
    // la même branche mais ne sont atteignables qu'en P4.8 (échecs de prélèvement) : leurs deux
    // sens se testent là, pas ici.
    it('résilier pendant une pause : resilie le jour même, pause effacée ; puis plus rien n’est possible', async () => {
      const { corps: idCarte } = await souscrire(
        profilClient2,
        offreId,
        'carte',
        reference('carte-2'),
      );
      const id = idCarte as string;
      await transition('demander_pause', client2, {
        p_abonnement_id: id,
        p_jusqu_au: plusJours(aujourdhuiParis(), 20),
      });
      expect((await lire(id)).statut).toBe('en_pause');
      const { statut } = await transition('demander_resiliation', client2, { p_abonnement_id: id });
      expect(statut).toBe(204);
      const ligne = await lire(id);
      expect(ligne.statut).toBe('resilie');
      expect(ligne.fin_acces_le).toBe(aujourdhuiParis());
      expect(ligne.pause_jusqu_le).toBeNull();
      const reprise = await transition('reprendre_abonnement', client2, { p_abonnement_id: id });
      expect(messageDe(reprise.corps)).toBe('transition_interdite');
      const annulation = await transition('annuler_resiliation', client2, { p_abonnement_id: id });
      expect(messageDe(annulation.corps)).toBe('transition_interdite');
    });
  });

  // -------------------------------------------------------------------------------------------
  // Factures et commission (0036 ; docs/domaine.md §3.5, §3.10, §5.5)
  // -------------------------------------------------------------------------------------------
  // À ce stade du describe, les paiements encaissés chez le coach de ce describe sont, dans
  // l'ordre : sepa-1 (confirmé), carte-2, retiree-honoree. sepa-rejet n'a jamais été encaissé ;
  // les refus (brouillon, non vérifié, auto-abonnement, intentions refusées) n'ont rien inséré ;
  // les rejeux de carte-2 n'ont rien émis de plus.
  describe('factures et commission (0036)', () => {
    type Facture = {
      id: string;
      numero: string;
      reference_prestataire: string;
      vendeur_profil_coach_id: string;
      vendeur_prenom: string;
      vendeur_nom: string;
      vendeur_siren: string | null;
      vendeur_regime_tva: string | null;
      client_prenom: string;
      libelle: string;
      periode_du: string;
      periode_au: string;
      montant_ttc_centimes: number;
      montant_ht_centimes: number | null;
      tva_centimes: number | null;
      commission_centimes: number;
      abonnement_id: string;
    };
    type Ligne = { facture_id: string; taux_applique: number; montant_centimes: number };
    const annee = (): string => aujourdhuiParis().slice(0, 4);

    async function facturesDuCoach(coachId: string): Promise<Facture[]> {
      const { corps } = await appelRest(
        `/rest/v1/factures?vendeur_profil_coach_id=eq.${coachId}&select=*&order=numero.asc`,
        { session: 'admin' },
      );
      return corps as Facture[];
    }
    async function factureDe(ref: string): Promise<Facture | undefined> {
      const { corps } = await appelRest(
        `/rest/v1/factures?reference_prestataire=eq.${ref}&select=*`,
        { session: 'admin' },
      );
      return (corps as Facture[])[0];
    }
    async function ligneDe(factureId: string): Promise<Ligne> {
      const { corps } = await appelRest(
        `/rest/v1/lignes_commission?facture_id=eq.${factureId}&select=*`,
        { session: 'admin' },
      );
      return (corps as Ligne[])[0];
    }
    async function poserFinCommission(coachId: string, jour: string): Promise<void> {
      const { statut } = await appelRest(`/rest/v1/profils_coach?id=eq.${coachId}`, {
        methode: 'PATCH',
        session: 'admin',
        corps: { commission_offerte_jusqu_le: jour },
      });
      if (statut >= 400)
        throw new Error(`Préparation du banc : date de commission refusée (${statut})`);
    }

    it('chaque paiement encaissé a sa facture, numérotée sans trou dans la série du coach', async () => {
      const factures = await facturesDuCoach(profilCoachId);
      expect(factures.map((f) => f.numero)).toEqual([
        `${annee()}-000001`,
        `${annee()}-000002`,
        `${annee()}-000003`,
      ]);
      expect(factures.map((f) => f.reference_prestataire).sort()).toEqual(
        [reference('carte-2'), reference('retiree-honoree'), reference('sepa-1')].sort(),
      );
      expect(await factureDe(reference('sepa-rejet'))).toBeUndefined();
    });

    it('la facture porte sa propre copie : parties, libellé, période, montant ; HT, TVA et identité fiscale vides (mode test)', async () => {
      const facture = (await factureDe(reference('carte-2'))) as Facture;
      const abonnement = await lire(facture.abonnement_id);
      expect(facture.vendeur_prenom).toBe('Abo');
      expect(facture.vendeur_nom).toBe('Coach');
      expect(facture.client_prenom).toBeTruthy();
      expect(facture.libelle).toBe('Suivi complet');
      expect(facture.montant_ttc_centimes).toBe(4900);
      expect(facture.periode_au).toBe(plusJours(abonnement.prochain_prelevement_le, -1));
      expect(facture.montant_ht_centimes).toBeNull();
      expect(facture.tva_centimes).toBeNull();
      expect(facture.vendeur_siren).toBeNull();
      expect(facture.vendeur_regime_tva).toBeNull();
    });

    it('une ligne de commission par facture, à 0 % pendant les 90 jours offerts', async () => {
      for (const facture of await facturesDuCoach(profilCoachId)) {
        const ligne = await ligneDe(facture.id);
        expect(ligne.taux_applique).toBe(0);
        expect(ligne.montant_centimes).toBe(0);
        expect(facture.commission_centimes).toBe(0);
      }
    });

    // Porte de sortie de L4, étape 5 : la commission bascule exactement le jour de
    // commission_offerte_jusqu_le, jamais avant ; une ligne écrite n'est jamais recalculée.
    it('bascule au jour 90 : le jour même, 10 % ; la veille, 0 % ; une ligne écrite ne change plus', async () => {
      await poserFinCommission(profilCoachId, aujourdhuiParis());
      const jour = await souscrire(profilClient1, offreId, 'carte', reference('jour-90'));
      expect(jour.statut).toBe(200);
      const factureJour = (await factureDe(reference('jour-90'))) as Facture;
      expect((await ligneDe(factureJour.id)).taux_applique).toBe(10);
      expect((await ligneDe(factureJour.id)).montant_centimes).toBe(490);
      expect(factureJour.commission_centimes).toBe(490);

      await poserFinCommission(profilCoachId, plusJours(aujourdhuiParis(), 1));
      await souscrire(profilClient1, offreId, 'carte', reference('veille-90'));
      const factureVeille = (await factureDe(reference('veille-90'))) as Facture;
      expect((await ligneDe(factureVeille.id)).taux_applique).toBe(0);

      // La date a reculé d'un jour après coup : la ligne du « jour 90 » reste à 10 %.
      expect((await ligneDe(factureJour.id)).taux_applique).toBe(10);
    });

    // Complète la preuve de P4.3 (« même jour » seulement) : une date posée un autre jour,
    // n'importe lequel, n'est jamais recalculée par une nouvelle entrée en actif.
    it('la fin de commission offerte n’est jamais recalculée, même posée un autre jour', async () => {
      await poserFinCommission(profilCoachId, '2026-01-01');
      await souscrire(profilClient2, offreId, 'carte', reference('pas-de-recalcul'));
      expect(await commissionDuCoach()).toBe('2026-01-01');
      const facture = (await factureDe(reference('pas-de-recalcul'))) as Facture;
      expect((await ligneDe(facture.id)).taux_applique).toBe(10);
    });

    it('une série par coach : le premier paiement chez un autre coach est son 000001', async () => {
      const { corps } = await appelRest(
        `/rest/v1/offres?id=eq.${offreCoachNonVerifieId}&select=coach_id`,
        {
          session: 'admin',
        },
      );
      const autreCoach = (corps as { coach_id: string }[])[0].coach_id;
      // Vérifié ici seulement : coach_non_verifie a déjà été prouvé plus haut sur ce même profil.
      await appelRest(`/rest/v1/profils_coach?id=eq.${autreCoach}`, {
        methode: 'PATCH',
        session: 'admin',
        corps: { statut_verification: 'verifiee' },
      });
      const { statut } = await souscrire(
        profilClient2,
        offreCoachNonVerifieId,
        'carte',
        reference('autre-serie'),
      );
      expect(statut).toBe(200);
      expect((await facturesDuCoach(autreCoach)).map((f) => f.numero)).toEqual([
        `${annee()}-000001`,
      ]);
      // La série du premier coach, elle, a continué sans trou et sans emprunt.
      expect((await facturesDuCoach(profilCoachId)).map((f) => f.numero)).toEqual(
        [1, 2, 3, 4, 5, 6].map((n) => `${annee()}-00000${n}`),
      );
    });

    it('aucune écriture directe sur une facture ou une ligne de commission, pas même par service_role', async () => {
      const facture = (await factureDe(reference('carte-2'))) as Facture;
      const modification = await appelRest(`/rest/v1/factures?id=eq.${facture.id}`, {
        methode: 'PATCH',
        session: 'admin',
        corps: { montant_ttc_centimes: 1 },
      });
      expect((modification.corps as { code?: string }).code).toBe('42501');
      const suppression = await appelRest(`/rest/v1/factures?id=eq.${facture.id}`, {
        methode: 'DELETE',
        session: 'admin',
      });
      expect((suppression.corps as { code?: string }).code).toBe('42501');
      const ligne = await appelRest(`/rest/v1/lignes_commission?facture_id=eq.${facture.id}`, {
        methode: 'PATCH',
        session: 'admin',
        corps: { taux_applique: 10 },
      });
      expect((ligne.corps as { code?: string }).code).toBe('42501');
      expect(((await factureDe(reference('carte-2'))) as Facture).montant_ttc_centimes).toBe(4900);
    });

    it.each(['factures', 'lignes_commission', 'compteurs_factures', 'tentatives_prelevement'])(
      'aucun client ne lit %s directement',
      async (table) => {
        const { statut, corps } = await appelRest(`/rest/v1/${table}?select=*`, {
          session: client1,
        });
        expect(statut).toBeGreaterThanOrEqual(400);
        expect((corps as { code?: string }).code).toBe('42501');
      },
    );

    it('etat_paiement_abonnement : le client lit le montant et la date de sa dernière facture, rien sur l’abonnement d’un autre', async () => {
      const { statut, corps } = await transition('etat_paiement_abonnement', client1, {
        p_abonnement_id: abonnement1,
      });
      expect(statut).toBe(200);
      const etat = (
        corps as {
          derniere_facture_montant_centimes: number;
          derniere_facture_payee_le: string | null;
          dernier_echec_motif: string | null;
          prochain_prelevement_le: string;
        }[]
      )[0];
      expect(etat.derniere_facture_montant_centimes).toBe(4900);
      expect(etat.derniere_facture_payee_le).not.toBeNull();
      expect(etat.dernier_echec_motif).toBeNull();
      expect(etat.prochain_prelevement_le).toBe((await lire(abonnement1)).prochain_prelevement_le);
      // Exactement ces cinq colonnes : ni numéro, ni référence, ni commission, ni parties.
      expect(Object.keys(etat).sort()).toEqual([
        'dernier_echec_le',
        'dernier_echec_motif',
        'derniere_facture_montant_centimes',
        'derniere_facture_payee_le',
        'prochain_prelevement_le',
      ]);

      const autre = await transition('etat_paiement_abonnement', client2, {
        p_abonnement_id: abonnement1,
      });
      expect(messageDe(autre.corps)).toBe('abonnement_introuvable');
      const anon = await transition('etat_paiement_abonnement', 'anon', {
        p_abonnement_id: abonnement1,
      });
      expect(JSON.stringify(anon.corps)).toMatch(/permission denied/i);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Idempotence des appels sortants (0034 ; docs/backend.md §13)
  // -------------------------------------------------------------------------------------------
  describe('cles_idempotence (0034)', () => {
    type Reponse = { etat: string; code_reponse: number | null; corps_reponse: unknown };
    const reserver = (session: Appelant, cle: string, empreinte = 'offre-1') =>
      transition('reserver_cle_idempotence', session, {
        p_cle: cle,
        p_operation: 'intention_souscription',
        p_empreinte: empreinte,
      });
    const etat = (corps: unknown): string => (corps as Reponse[])[0].etat;
    const reculer = (cle: string, minutes: number) =>
      appelRest(`/rest/v1/cles_idempotence?cle=eq.${cle}`, {
        methode: 'PATCH',
        session: 'admin',
        corps: { reservee_le: new Date(Date.now() - minutes * 60_000).toISOString() },
      });

    it('première réservation : nouvelle ; seconde, avant la fin : en_cours ; après la fin : rejouee, réponse identique', async () => {
      const cle = randomUUID();
      expect(etat((await reserver(client1, cle)).corps)).toBe('nouvelle');
      expect(etat((await reserver(client1, cle)).corps)).toBe('en_cours');
      const fin = await transition('terminer_cle_idempotence', client1, {
        p_cle: cle,
        p_code: 201,
        p_corps: { urlPaiement: 'https://exemple.test/paiement' },
      });
      expect(fin.statut).toBe(204);
      const rejouee = (await reserver(client1, cle)).corps as Reponse[];
      expect(rejouee[0].etat).toBe('rejouee');
      expect(rejouee[0].code_reponse).toBe(201);
      expect(rejouee[0].corps_reponse).toEqual({ urlPaiement: 'https://exemple.test/paiement' });
    });

    it('même clé, autre requête : cle_idempotence_reutilisee', async () => {
      const cle = randomUUID();
      await reserver(client1, cle, 'offre-1');
      const { corps } = await reserver(client1, cle, 'offre-2');
      expect(messageDe(corps)).toBe('cle_idempotence_reutilisee');
    });

    it('en_cours abandonné depuis 6 minutes : reprise ; depuis 4 minutes : toujours en_cours', async () => {
      const abandonnee = randomUUID();
      await reserver(client1, abandonnee);
      await reculer(abandonnee, 6);
      expect(etat((await reserver(client1, abandonnee)).corps)).toBe('reprise');
      // La reprise remet l'horloge à zéro : un second appel immédiat ne reprend pas encore.
      expect(etat((await reserver(client1, abandonnee)).corps)).toBe('en_cours');

      const recente = randomUUID();
      await reserver(client1, recente);
      await reculer(recente, 4);
      expect(etat((await reserver(client1, recente)).corps)).toBe('en_cours');
    });

    // Corrigé en l'exécutant (P4.3) : la première version attendait non_authentifie sous
    // service_role, alors que 0034 n'accorde EXECUTE qu'à authenticated (docs/backend.md §13) --
    // l'appel est refusé plus tôt, par le grant, avant d'atteindre la garde. C'est ce refus-là
    // que l'Edge Function rencontrerait si elle appelait avec le mauvais client. La garde
    // « auth.uid() is null -> non_authentifie » reste une seconde barrière, qu'aucun appel
    // PostgREST ne peut atteindre (anon n'a pas EXECUTE, authenticated a toujours un uid).
    it('appelée sous service_role (sans jeton client) ou par anon : refus d’exécution', async () => {
      const admin = await reserver('admin', randomUUID());
      expect(JSON.stringify(admin.corps)).toMatch(/permission denied/i);
      const anon = await reserver('anon', randomUUID());
      expect(JSON.stringify(anon.corps)).toMatch(/permission denied/i);
    });

    it('la clé de client1 n’existe pas pour client2 : réservation indépendante, et client2 ne la termine pas', async () => {
      const cle = randomUUID();
      await reserver(client1, cle);
      expect(etat((await reserver(client2, cle)).corps)).toBe('nouvelle');
      const fin = await transition('terminer_cle_idempotence', client2, {
        p_cle: cle,
        p_code: 201,
        p_corps: {},
      });
      expect(fin.statut).toBe(204); // termine SA clé à lui
      expect(etat((await reserver(client1, cle)).corps)).toBe('en_cours'); // celle de client1 intacte
    });

    it('terminer une clé inconnue : cle_idempotence_inconnue', async () => {
      const { corps } = await transition('terminer_cle_idempotence', client1, {
        p_cle: randomUUID(),
        p_code: 201,
        p_corps: {},
      });
      expect(messageDe(corps)).toBe('cle_idempotence_inconnue');
    });

    it('aucune lecture directe de la table, pour aucun client', async () => {
      const { statut } = await appelRest('/rest/v1/cles_idempotence?select=cle', {
        session: client1,
      });
      expect(statut).toBeGreaterThanOrEqual(400);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Conservation (0036 ; docs/domaine.md §2, §3.5) -- DERNIER bloc de ce describe : il supprime
  // les comptes de client1 et du coach, dont plus aucun test n'a besoin après lui.
  // -------------------------------------------------------------------------------------------
  describe('conservation des pièces comptables (0036)', () => {
    it('supprimer le compte du client, puis celui du coach, ne supprime aucune facture ni ligne de commission', async () => {
      const compter = async (table: string, filtre: string): Promise<number> => {
        const { corps } = await appelRest(`/rest/v1/${table}?${filtre}&select=id`, {
          session: 'admin',
        });
        return (corps as unknown[]).length;
      };
      const factures = await compter('factures', `vendeur_profil_coach_id=eq.${profilCoachId}`);
      const lignes = await compter('lignes_commission', `profil_coach_id=eq.${profilCoachId}`);
      expect(factures).toBeGreaterThan(0);

      await supprimerCompteReel(client1.compteId);
      await supprimerCompteReel(coachCompteId);

      // Les comptes ont bien disparu, et leurs abonnements avec eux (cascade de 0033)...
      const { corps: abonnementsRestants } = await appelRest(
        `/rest/v1/abonnements?profil_coach_id=eq.${profilCoachId}&select=id`,
        { session: 'admin' },
      );
      expect(abonnementsRestants).toEqual([]);
      // ... mais pas une facture, pas une ligne, et chacune reste lisible sans eux.
      expect(await compter('factures', `vendeur_profil_coach_id=eq.${profilCoachId}`)).toBe(
        factures,
      );
      expect(await compter('lignes_commission', `profil_coach_id=eq.${profilCoachId}`)).toBe(
        lignes,
      );
      const { corps } = await appelRest(
        `/rest/v1/factures?reference_prestataire=eq.${reference('sepa-1')}&select=vendeur_nom,client_prenom,montant_ttc_centimes`,
        { session: 'admin' },
      );
      expect(corps).toEqual([
        { vendeur_nom: 'Coach', client_prenom: 'Client1', montant_ttc_centimes: 4900 },
      ]);
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Intentions et synchronisation d'une session de paiement — L4, P4.5a
// (0037_creer_intentions_et_evenements.sql ; docs/api.md §7 ; docs/backend.md §12, §13 ;
// docs/domaine.md §3.3)
// ---------------------------------------------------------------------------------------------

// Aucun appel au prestataire ici : synchroniser_session_paiement reçoit l'état de la session tel
// que l'Edge Function (P4.5b) l'aura relu chez lui. Le banc joue ce rôle, en service_role, avec
// des identifiants d'événement et de session inventés : c'est la fonction SQL qu'on prouve, pas
// le prestataire.
//
// Aucune connexion de plus (plafond du projet de développement, docs/dette.md) : les clients sont
// A et B, déjà connectés par le beforeAll global ; les deux coachs sont créés par l'API
// d'administration, sans connexion. Règle 13 (docs/prompts/L4.md) : ce bloc ne suppose rien de
// l'état que d'autres blocs ont donné à A et B -- il crée leur profil client s'il manque et les
// bascule lui-même en espace client.
describe('intentions et synchronisation — L4 (0037)', () => {
  let coachCompteId: string;
  let coachEcarteCompteId: string;
  let offreId: string;
  let offreBrouillonId: string;
  let offreCoachEcarteId: string;
  let profilCoachEcarteId: string;
  let profilClientA: string;

  // Uniques par exécution : la même base de développement garde les lignes des exécutions
  // précédentes (evenements_prestataire n'a aucune clé étrangère vers un compte supprimé).
  const evenement = (nom: string): string => `evt_banc_${SUFFIXE_COMPTE}_${nom}`;
  const sessionPaiement = (nom: string): string => `cs_banc_${SUFFIXE_COMPTE}_${nom}`;

  async function creerCoachVerifie(suffixe: string): Promise<{ compte: string; profil: string }> {
    const creation = await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `${PREFIXE_EMAIL}${SUFFIXE_COMPTE}-${suffixe}@${DOMAINE_EMAIL}`,
        password: MOT_DE_PASSE,
        email_confirm: true,
        user_metadata: { date_naissance: '1988-01-01', cgu_version_acceptee: '2026-08-01' },
      }),
    });
    if (!creation.ok) throw new Error(`Préparation du banc : coach refusé (${creation.status})`);
    const compte = ((await creation.json()) as { id: string }).id;
    const profil = await appelRest('/rest/v1/profils_coach', {
      methode: 'POST',
      session: 'admin',
      corps: { compte_id: compte, prenom: 'Intention', nom: 'Coach', discipline: 'yoga' },
    });
    if (profil.statut >= 400) throw new Error(`Préparation du banc : profil coach refusé`);
    const profilId = (profil.corps as { id: string }[])[0].id;
    await poserStatutCoach(profilId, 'verifiee');
    return { compte, profil: profilId };
  }

  async function poserStatutCoach(profilCoachId: string, statut: string): Promise<void> {
    const { statut: http } = await appelRest(`/rest/v1/profils_coach?id=eq.${profilCoachId}`, {
      methode: 'PATCH',
      session: 'admin',
      corps: { statut_verification: statut },
    });
    if (http >= 400) throw new Error(`Préparation du banc : statut ${statut} refusé (${http})`);
  }

  async function insererOffre(coachId: string, publieeLe: string | null): Promise<string> {
    const { statut, corps } = await appelRest('/rest/v1/offres', {
      methode: 'POST',
      session: 'admin',
      corps: {
        coach_id: coachId,
        titre: 'Suivi intention',
        prix_centimes: 4900,
        benefices: ['Programme', 'Visio', 'Messages'],
        engagement_humain: ['ajustement_hebdomadaire'],
        publiee_le: publieeLe,
      },
    });
    if (statut >= 400) throw new Error(`Préparation du banc : offre refusée (${statut})`);
    return (corps as { id: string }[])[0].id;
  }

  // Profil client présent et espace client actif, créés par la session du compte elle-même (le
  // chemin légitime), jamais par service_role.
  async function assurerEspaceClient(session: Session, prenom: string): Promise<string> {
    const lu = await appelRest(
      `/rest/v1/profils_client?compte_id=eq.${session.compteId}&select=id`,
      { session: 'admin' },
    );
    let id = (lu.corps as { id: string }[])[0]?.id;
    if (!id) {
      const cree = await appelRest('/rest/v1/profils_client', {
        methode: 'POST',
        session,
        corps: { compte_id: session.compteId, prenom, nom: 'Banc' },
      });
      if (cree.statut >= 400) throw new Error(`Préparation du banc : profil client refusé`);
      id = (cree.corps as { id: string }[])[0].id;
    }
    const bascule = await appelRest('/rest/v1/rpc/basculer_profil', {
      methode: 'POST',
      session,
      corps: { profil: 'client' },
    });
    if (bascule.statut !== 200) throw new Error(`Préparation du banc : bascule client refusée`);
    return id;
  }

  async function creerIntention(
    session: Appelant,
    offre: string,
  ): Promise<{ statut: number; corps: unknown }> {
    return appelRest('/rest/v1/rpc/creer_intention_souscription', {
      methode: 'POST',
      session,
      corps: { p_offre_id: offre },
    });
  }

  async function nouvelleIntention(offre: string = offreId): Promise<string> {
    const { statut, corps } = await creerIntention(A, offre);
    if (statut !== 200) throw new Error(`Préparation du banc : intention refusée (${statut})`);
    return (corps as { intention_id: string }[])[0].intention_id;
  }

  async function attacher(
    intention: string,
    session: string,
    appelant: Appelant = 'admin',
  ): Promise<{ statut: number; corps: unknown }> {
    return appelRest('/rest/v1/rpc/attacher_session_intention', {
      methode: 'POST',
      session: appelant,
      corps: { p_intention_id: intention, p_session: session },
    });
  }

  type EtatSession = {
    intention: string;
    session: string;
    evenement?: string | null;
    statut?: 'open' | 'complete' | 'expired';
    recu?: boolean;
    echoue?: boolean;
    moyen?: 'carte' | 'sepa';
    montant?: number;
    appelant?: Appelant;
  };

  // Valeurs par défaut : une carte payée, livrée par le constat (aucun identifiant d'événement).
  async function synchroniser(etat: EtatSession): Promise<{ statut: number; corps: unknown }> {
    return appelRest('/rest/v1/rpc/synchroniser_session_paiement', {
      methode: 'POST',
      session: etat.appelant ?? 'admin',
      corps: {
        p_evenement_id: etat.evenement ?? null,
        p_evenement_type: 'checkout.session.completed',
        p_intention_id: etat.intention,
        p_session: etat.session,
        p_statut_session: etat.statut ?? 'complete',
        p_paiement_recu: etat.recu ?? true,
        p_paiement_echoue: etat.echoue ?? false,
        p_moyen: etat.moyen ?? 'carte',
        p_montant_centimes: etat.montant ?? 4900,
        p_client_prestataire: 'cus_banc',
      },
    });
  }

  async function compter(table: string, filtre: string): Promise<number> {
    const { corps } = await appelRest(`/rest/v1/${table}?${filtre}&select=*`, {
      session: 'admin',
    });
    return (corps as unknown[]).length;
  }

  async function abonnementsDe(session: string): Promise<{ id: string; statut: string }[]> {
    const { corps } = await appelRest(
      `/rest/v1/abonnements?reference_paiement=eq.${session}&select=id,statut`,
      { session: 'admin' },
    );
    return corps as { id: string; statut: string }[];
  }

  async function lignesCommissionDe(session: string): Promise<number> {
    const { corps } = await appelRest(
      `/rest/v1/factures?reference_prestataire=eq.${session}&select=id`,
      { session: 'admin' },
    );
    const factures = corps as { id: string }[];
    if (factures.length === 0) return 0;
    return compter('lignes_commission', `facture_id=in.(${factures.map((f) => f.id).join(',')})`);
  }

  beforeAll(async () => {
    const coach = await creerCoachVerifie('int-coach');
    coachCompteId = coach.compte;
    const hier = new Date(Date.now() - 86_400_000).toISOString();
    offreId = await insererOffre(coach.profil, hier);
    offreBrouillonId = await insererOffre(coach.profil, null);

    const ecarte = await creerCoachVerifie('int-coach-ecarte');
    coachEcarteCompteId = ecarte.compte;
    profilCoachEcarteId = ecarte.profil;
    offreCoachEcarteId = await insererOffre(ecarte.profil, hier);

    profilClientA = await assurerEspaceClient(A, 'ClientIntention');
    await assurerEspaceClient(B, 'AutreClient');
  }, 60_000);

  afterAll(async () => {
    if (coachCompteId) await supprimerCompteReel(coachCompteId);
    if (coachEcarteCompteId) await supprimerCompteReel(coachEcarteCompteId);
    // A et B : supprimés par l'afterAll global.
  }, 30_000);

  describe('creer_intention_souscription : le client, avec son jeton', () => {
    it('anon ne peut pas créer d’intention', async () => {
      const { statut, corps } = await creerIntention('anon', offreId);
      expect(statut).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(corps)).toMatch(/permission denied/i);
    });

    it('fige le titre et le prix, expire dans 30 minutes, au nom du profil client appelant', async () => {
      const avant = Date.now();
      const { statut, corps } = await creerIntention(A, offreId);
      expect(statut).toBe(200);
      const ligne = (
        corps as {
          intention_id: string;
          titre: string;
          prix_centimes: number;
          jour_prelevement: number;
          expire_le: string;
        }[]
      )[0];
      expect(ligne.titre).toBe('Suivi intention');
      expect(ligne.prix_centimes).toBe(4900);
      expect(ligne.jour_prelevement).toBeGreaterThanOrEqual(1);
      expect(ligne.jour_prelevement).toBeLessThanOrEqual(28);
      const minutes = (new Date(ligne.expire_le).getTime() - avant) / 60_000;
      expect(minutes).toBeGreaterThan(29);
      expect(minutes).toBeLessThan(31);

      const { corps: stocke } = await appelRest(
        `/rest/v1/intentions_souscription?id=eq.${ligne.intention_id}&select=profil_client_id,titre_fige,prix_fige_centimes,session_prestataire`,
        { session: 'admin' },
      );
      expect(stocke).toEqual([
        {
          profil_client_id: profilClientA,
          titre_fige: 'Suivi intention',
          prix_fige_centimes: 4900,
          session_prestataire: null,
        },
      ]);
    });

    it('une offre en brouillon : offre_indisponible, avant toute page de paiement', async () => {
      const { corps } = await creerIntention(A, offreBrouillonId);
      expect(messageDe(corps)).toBe('offre_indisponible');
    });

    it('le client ne lit pas directement la table des intentions, même la sienne', async () => {
      const { statut, corps } = await appelRest('/rest/v1/intentions_souscription?select=id', {
        session: A,
      });
      expect(statut).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(corps)).toMatch(/permission denied/i);
    });
  });

  describe('mon_intention : seulement la sienne', () => {
    it('A lit son intention', async () => {
      const intention = await nouvelleIntention();
      const { statut, corps } = await appelRest('/rest/v1/rpc/mon_intention', {
        methode: 'POST',
        session: A,
        corps: { p_intention_id: intention },
      });
      expect(statut).toBe(200);
      expect((corps as { session_prestataire: string | null }[])[0].session_prestataire).toBe(null);
    });

    // Sens illégitime. B est en espace client, avec un profil client (beforeAll) : le refus
    // vient de la propriété de l'intention, pas du contrôle d'espace (règle 9).
    it('B ne lit pas l’intention de A : intention_introuvable', async () => {
      const intention = await nouvelleIntention();
      const { corps } = await appelRest('/rest/v1/rpc/mon_intention', {
        methode: 'POST',
        session: B,
        corps: { p_intention_id: intention },
      });
      expect(messageDe(corps)).toBe('intention_introuvable');
    });
  });

  // docs/backend.md §13 : un lien entre deux objets ne se déclare jamais par le client quand le
  // serveur peut le poser. Un client qui pourrait attacher une session à SON intention y
  // attacherait la session payée par quelqu'un d'autre, et recevrait l'abonnement à sa place.
  describe('le lien intention <-> session ne vient jamais du client', () => {
    it('A ne peut pas attacher une session à son intention', async () => {
      const intention = await nouvelleIntention();
      const { statut, corps } = await attacher(intention, sessionPaiement('volee'), A);
      expect(statut).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(corps)).toMatch(/permission denied/i);
    });

    it('A ne peut pas synchroniser une session payée vers son intention', async () => {
      const intention = await nouvelleIntention();
      const { statut, corps } = await synchroniser({
        intention,
        session: sessionPaiement('volee-2'),
        appelant: A,
      });
      expect(statut).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(corps)).toMatch(/permission denied/i);
      expect(await abonnementsDe(sessionPaiement('volee-2'))).toEqual([]);
    });

    it('le serveur pose la session une fois ; la même pose ne change rien, une autre lève', async () => {
      const intention = await nouvelleIntention();
      expect((await attacher(intention, sessionPaiement('pose'))).statut).toBe(204);
      expect((await attacher(intention, sessionPaiement('pose'))).statut).toBe(204);
      const autre = await attacher(intention, sessionPaiement('pose-autre'));
      expect(messageDe(autre.corps)).toBe('session_incoherente');
    });

    it('synchroniser une autre session que celle posée : session_incoherente, rien d’écrit', async () => {
      const intention = await nouvelleIntention();
      await attacher(intention, sessionPaiement('posee'));
      const { corps } = await synchroniser({
        intention,
        session: sessionPaiement('pas-la-bonne'),
        evenement: evenement('pas-la-bonne'),
      });
      expect(messageDe(corps)).toBe('session_incoherente');
      expect(await abonnementsDe(sessionPaiement('pas-la-bonne'))).toEqual([]);
      // L'identifiant d'événement est annulé avec le reste : la relivraison sera retraitée.
      expect(await compter('evenements_prestataire', `id=eq.${evenement('pas-la-bonne')}`)).toBe(0);
    });
  });

  describe('synchroniser_session_paiement : webhook et constat, une seule fonction', () => {
    it('session encore ouverte : non_terminee ; expirée : expiree ; aucun abonnement', async () => {
      const ouverte = await nouvelleIntention();
      const r1 = await synchroniser({
        intention: ouverte,
        session: sessionPaiement('ouverte'),
        statut: 'open',
        recu: false,
      });
      expect(r1.corps).toBe('non_terminee');
      const expiree = await nouvelleIntention();
      const r2 = await synchroniser({
        intention: expiree,
        session: sessionPaiement('expiree'),
        statut: 'expired',
        recu: false,
      });
      expect(r2.corps).toBe('expiree');
      expect(await abonnementsDe(sessionPaiement('ouverte'))).toEqual([]);
      expect(await abonnementsDe(sessionPaiement('expiree'))).toEqual([]);
    });

    it('le même événement signé livré deux fois : une facture, une ligne de commission', async () => {
      const intention = await nouvelleIntention();
      const s = sessionPaiement('doublon');
      const premier = await synchroniser({
        intention,
        session: s,
        evenement: evenement('doublon'),
      });
      const second = await synchroniser({ intention, session: s, evenement: evenement('doublon') });
      expect(premier.corps).toBe('abonne');
      expect(second.corps).toBe('deja_traite');
      expect(await abonnementsDe(s)).toEqual([expect.objectContaining({ statut: 'actif' })]);
      expect(await compter('factures', `reference_prestataire=eq.${s}`)).toBe(1);
      expect(await lignesCommissionDe(s)).toBe(1);
      expect(await compter('evenements_prestataire', `id=eq.${evenement('doublon')}`)).toBe(1);
    });

    it('deux événements DIFFÉRENTS pour la même session : toujours un seul abonnement', async () => {
      const intention = await nouvelleIntention();
      const s = sessionPaiement('deux-evenements');
      await synchroniser({ intention, session: s, evenement: evenement('de-1') });
      const second = await synchroniser({ intention, session: s, evenement: evenement('de-2') });
      expect(second.corps).toBe('abonne');
      expect(await abonnementsDe(s)).toHaveLength(1);
      expect(await compter('factures', `reference_prestataire=eq.${s}`)).toBe(1);
    });

    it('constat puis webhook, webhook puis constat : un seul abonnement chaque fois', async () => {
      const i1 = await nouvelleIntention();
      const s1 = sessionPaiement('constat-dabord');
      await synchroniser({ intention: i1, session: s1 });
      await synchroniser({ intention: i1, session: s1, evenement: evenement('constat-dabord') });
      const i2 = await nouvelleIntention();
      const s2 = sessionPaiement('webhook-dabord');
      await synchroniser({ intention: i2, session: s2, evenement: evenement('webhook-dabord') });
      await synchroniser({ intention: i2, session: s2 });
      expect(await abonnementsDe(s1)).toHaveLength(1);
      expect(await abonnementsDe(s2)).toHaveLength(1);
      expect(await compter('factures', `reference_prestataire=eq.${s1}`)).toBe(1);
      expect(await compter('factures', `reference_prestataire=eq.${s2}`)).toBe(1);
    });

    it('un montant différent du prix figé : montant_incoherent, rien d’écrit', async () => {
      const intention = await nouvelleIntention();
      const s = sessionPaiement('montant');
      const { corps } = await synchroniser({
        intention,
        session: s,
        montant: 100,
        evenement: evenement('montant'),
      });
      expect(messageDe(corps)).toBe('montant_incoherent');
      expect(await abonnementsDe(s)).toEqual([]);
      expect(await compter('evenements_prestataire', `id=eq.${evenement('montant')}`)).toBe(0);
    });

    it('une intention inconnue lève (le webhook répondra 500, le prestataire relivrera)', async () => {
      const { corps } = await synchroniser({
        intention: randomUUID(),
        session: sessionPaiement('inconnue'),
        evenement: evenement('inconnue'),
      });
      expect(messageDe(corps)).toBe('intention_inconnue');
      expect(await compter('evenements_prestataire', `id=eq.${evenement('inconnue')}`)).toBe(0);
    });

    // docs/backend.md §12, règle 2 : aucun ordre d'arrivée supposé. Les événements en retard
    // portent ici un état ANCIEN (non payé) -- le cas le plus défavorable : l'Edge Function
    // relira l'état courant, mais la fonction SQL ne doit pas reculer même si elle ne le fait pas.
    describe('SEPA : même état final dans l’ordre naturel et dans l’ordre inverse', () => {
      it('ordre naturel : mandat (en_attente), puis prélèvement réussi (actif)', async () => {
        const intention = await nouvelleIntention();
        const s = sessionPaiement('sepa-naturel');
        await synchroniser({
          intention,
          session: s,
          moyen: 'sepa',
          recu: false,
          evenement: evenement('sepa-naturel-1'),
        });
        expect(await abonnementsDe(s)).toEqual([
          expect.objectContaining({ statut: 'en_attente_confirmation' }),
        ]);
        await synchroniser({
          intention,
          session: s,
          moyen: 'sepa',
          recu: true,
          evenement: evenement('sepa-naturel-2'),
        });
        expect(await abonnementsDe(s)).toEqual([expect.objectContaining({ statut: 'actif' })]);
      });

      it('ordre inverse : prélèvement réussi d’abord, puis le mandat en retard -> actif', async () => {
        const intention = await nouvelleIntention();
        const s = sessionPaiement('sepa-inverse');
        await synchroniser({
          intention,
          session: s,
          moyen: 'sepa',
          recu: true,
          evenement: evenement('sepa-inverse-2'),
        });
        await synchroniser({
          intention,
          session: s,
          moyen: 'sepa',
          recu: false,
          evenement: evenement('sepa-inverse-1'),
        });
        expect(await abonnementsDe(s)).toEqual([expect.objectContaining({ statut: 'actif' })]);
        expect(await compter('factures', `reference_prestataire=eq.${s}`)).toBe(1);
      });

      it('un échec livré après le succès du même prélèvement : toujours actif', async () => {
        const intention = await nouvelleIntention();
        const s = sessionPaiement('sepa-echec-tardif');
        await synchroniser({ intention, session: s, moyen: 'sepa', recu: true });
        const { statut } = await synchroniser({
          intention,
          session: s,
          moyen: 'sepa',
          recu: false,
          echoue: true,
          evenement: evenement('sepa-echec-tardif'),
        });
        expect(statut).toBe(200);
        expect(await abonnementsDe(s)).toEqual([expect.objectContaining({ statut: 'actif' })]);
      });

      it('rejet avant le mandat, puis le mandat en retard : annule, sans facture', async () => {
        const intention = await nouvelleIntention();
        const s = sessionPaiement('sepa-rejet');
        await synchroniser({
          intention,
          session: s,
          moyen: 'sepa',
          recu: false,
          echoue: true,
          evenement: evenement('sepa-rejet-2'),
        });
        await synchroniser({
          intention,
          session: s,
          moyen: 'sepa',
          recu: false,
          evenement: evenement('sepa-rejet-1'),
        });
        expect(await abonnementsDe(s)).toEqual([expect.objectContaining({ statut: 'annule' })]);
        expect(await compter('factures', `reference_prestataire=eq.${s}`)).toBe(0);
      });
    });
  });

  // docs/domaine.md §3.3 (révisé le 1er octobre 2026) : au paiement, seul 'verifiee' est honoré.
  // Les quatre intentions sont créées pendant que le coach est encore vérifié (seul cas où
  // creer_intention_souscription l'accepte) ; chaque test pose ensuite le statut qu'il exerce.
  describe('coach écarté entre l’intention et le paiement (§3.3)', () => {
    const statutsEcartes = ['revoquee', 'refusee', 'en_examen', 'complement_demande'] as const;
    const intentions: Record<string, string> = {};
    let intentionSepa: string;

    beforeAll(async () => {
      await poserStatutCoach(profilCoachEcarteId, 'verifiee');
      for (const statut of statutsEcartes) {
        intentions[statut] = await nouvelleIntention(offreCoachEcarteId);
      }
      intentionSepa = await nouvelleIntention(offreCoachEcarteId);
    }, 30_000);

    it.each(statutsEcartes)(
      'coach %s : accepté (200), aucun abonnement, une anomalie coach_ecarte',
      async (statutCoach) => {
        await poserStatutCoach(profilCoachEcarteId, statutCoach);
        const s = sessionPaiement(`ecarte-${statutCoach}`);
        const { statut, corps } = await synchroniser({
          intention: intentions[statutCoach],
          session: s,
          evenement: evenement(`ecarte-${statutCoach}`),
        });
        expect(statut).toBe(200);
        expect(corps).toBe('coach_ecarte');
        expect(await abonnementsDe(s)).toEqual([]);
        const { corps: anomalies } = await appelRest(
          `/rest/v1/anomalies_paiement?session_prestataire=eq.${s}&select=intention_id,motif,statut_coach_constate`,
          { session: 'admin' },
        );
        expect(anomalies).toEqual([
          {
            intention_id: intentions[statutCoach],
            motif: 'coach_ecarte',
            statut_coach_constate: statutCoach,
          },
        ]);
        // L'événement est mémorisé : accepté une fois pour toutes, jamais relivré en boucle.
        expect(
          await compter('evenements_prestataire', `id=eq.${evenement(`ecarte-${statutCoach}`)}`),
        ).toBe(1);
      },
    );

    it('un second événement pour la même session : toujours une seule anomalie', async () => {
      await poserStatutCoach(profilCoachEcarteId, 'revoquee');
      const s = sessionPaiement('ecarte-revoquee');
      const { corps } = await synchroniser({
        intention: intentions.revoquee,
        session: s,
        evenement: evenement('ecarte-revoquee-bis'),
      });
      expect(corps).toBe('coach_ecarte');
      expect(await compter('anomalies_paiement', `session_prestataire=eq.${s}`)).toBe(1);
    });

    // Règle 8 : ce test deviendra faux quand docs/dette.md (« abonnement SEPA en
    // en_attente_confirmation dont le coach est révoqué ») sera tranché, en L5. Il fige le
    // comportement actuel, documenté, pour qu'un changement soit une décision et pas un accident.
    it('abonnement SEPA déjà créé, coach révoqué ensuite : la confirmation passe (dette L5)', async () => {
      await poserStatutCoach(profilCoachEcarteId, 'verifiee');
      const s = sessionPaiement('ecarte-sepa');
      await synchroniser({ intention: intentionSepa, session: s, moyen: 'sepa', recu: false });
      await poserStatutCoach(profilCoachEcarteId, 'revoquee');
      const { corps } = await synchroniser({
        intention: intentionSepa,
        session: s,
        moyen: 'sepa',
        recu: true,
      });
      expect(corps).toBe('abonne');
      expect(await abonnementsDe(s)).toEqual([expect.objectContaining({ statut: 'actif' })]);
      expect(await compter('anomalies_paiement', `session_prestataire=eq.${s}`)).toBe(0);
    });
  });
});
