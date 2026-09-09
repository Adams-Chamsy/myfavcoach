// Jeu de comptes de test DURABLES sur le projet Supabase de developpement — a lancer une fois,
// puis reutilisables a chaque seance. Ne depend d'AUCUN courriel : tous les comptes sont crees
// deja confirmes via l'API d'administration (email_confirm), sauf "attente", volontairement non
// confirme pour exercer l'ecran L1-03.
//
//   node scripts/comptes-test-durables.mjs            (cree / met a jour, idempotent)
//   node scripts/comptes-test-durables.mjs --supprimer (efface les comptes "compte-test-*")
//   npm run comptes:test  /  npm run comptes:test:supprimer
//
// Prefixe "compte-test-", domaine "mfc.test" (RFC 2606, non routable) : distinct de "banc-rls-"
// pour que ni le banc RLS ni son nettoyage (scripts/nettoyer-comptes-banc-rls.mjs) n'y touchent.
// Node pur, aucune dependance (meme esprit que scripts/verifier-serveur-dev.mjs).
//
// GARDE DE SECURITE identique a src/test/rls.banc.ts, dupliquee volontairement : ne vise QUE le
// projet de developpement.
//
// Ce script ECRIT des lignes auth.users / profils_client / profils_coach et appelle
// basculer_profil. La cle d'administration (role serveur) a SELECT + INSERT sur les tables
// profils (migration 0003), jamais UPDATE : le passage du profil actif a "coach" se fait donc
// par la vraie fonction basculer_profil, connecte en tant que ce compte, pas par un PATCH
// direct. comptes.telephone n'est pas renseigne (aucun droit d'ecriture pour ce role, et non
// requis pour que les comptes servent).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PREFIXE_EMAIL = 'compte-test-';
const DOMAINE_EMAIL = 'mfc.test';
const REFERENCE_PROJET_AUTORISEE = 'imzdtntaqbtymoacsxua';
const DATE_NAISSANCE = '1995-06-15';
const VERSION_CGU = '2026-09-04';
// Le mot de passe commun des comptes est lu depuis .secrets-rls.local
// (COMPTES_TEST_MOT_DE_PASSE), jamais en clair ici : voyage dans `cfg.motDePasse`.

// La description "atterrit sur" est le resultat de garde.ts (determinerDestination) pour cet
// etat de compte — utile pour savoir quel compte prendre selon l'ecran a tester.
const COMPTES = [
  {
    cle: 'client',
    emailConfirme: true,
    profilClient: {
      prenom: 'Camille',
      nom: 'Dupré',
      onboarding_etape: 5,
      objectifs: ['perdre-du-poids', 'mieux-manger'],
      rythme_hebdo: '3-4-fois',
    },
    profilCoach: null,
    profilActif: 'client',
    atterritSur: 'espace client (accueil), onboarding terminé',
  },
  {
    cle: 'coach',
    emailConfirme: true,
    profilClient: null,
    profilCoach: { prenom: 'Yannick', nom: 'Berthaud', discipline: 'préparation physique' },
    profilActif: 'coach',
    atterritSur: 'espace coach (pilotage)',
  },
  {
    cle: 'duo',
    emailConfirme: true,
    profilClient: {
      prenom: 'Inès',
      nom: 'Marchand',
      onboarding_etape: 5,
      objectifs: [],
      rythme_hebdo: null,
    },
    profilCoach: { prenom: 'Inès', nom: 'Marchand', discipline: 'yoga' },
    profilActif: 'client',
    atterritSur: 'espace client, bascule vers coach disponible',
  },
  {
    cle: 'neuf',
    emailConfirme: true,
    profilClient: null,
    profilCoach: null,
    profilActif: 'client',
    atterritSur: 'onboarding client, étape 1',
  },
  {
    cle: 'attente',
    emailConfirme: false,
    profilClient: null,
    profilCoach: null,
    profilActif: 'client',
    atterritSur: 'écran L1-03 (vérification de l’adresse)',
  },
];

function lireFichierEnv(chemin) {
  if (!existsSync(chemin)) return {};
  const valeurs = {};
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

function chargerConfiguration() {
  const secrets = lireFichierEnv(path.join(racine, '.secrets-rls.local'));
  const publiques = lireFichierEnv(path.join(racine, '.env'));
  const apiUrl = secrets.SUPABASE_URL_TEST;
  const cleAdmin = secrets.SUPABASE_CLE_ADMIN_TEST;
  const cleAnon = publiques.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const motDePasse = secrets.COMPTES_TEST_MOT_DE_PASSE;

  const manquantes = [];
  if (!apiUrl) manquantes.push('SUPABASE_URL_TEST (.secrets-rls.local)');
  if (!cleAdmin) manquantes.push('SUPABASE_CLE_ADMIN_TEST (.secrets-rls.local)');
  if (!cleAnon) manquantes.push('EXPO_PUBLIC_SUPABASE_ANON_KEY (.env)');
  if (!motDePasse) manquantes.push('COMPTES_TEST_MOT_DE_PASSE (.secrets-rls.local)');
  if (manquantes.length > 0) {
    console.error(
      `Variable(s) manquante(s) : ${manquantes.join(', ')}. Voir .secrets-rls.local.exemple.`,
    );
    process.exit(1);
  }

  const correspondanceUrl = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(apiUrl.trim());
  const reference = correspondanceUrl?.[1] ?? apiUrl;
  if (reference !== REFERENCE_PROJET_AUTORISEE) {
    console.error(
      `GARDE DE SECURITE : SUPABASE_URL_TEST ne pointe pas vers le projet de developpement ` +
        `autorise (${REFERENCE_PROJET_AUTORISEE}). Reference trouvee : "${reference}". Refuse.`,
    );
    process.exit(1);
  }

  return { apiUrl: apiUrl.replace(/\/$/, ''), cleAdmin, cleAnon, motDePasse };
}

const emailDe = (cle) => `${PREFIXE_EMAIL}${cle}@${DOMAINE_EMAIL}`;

async function listerTousLesComptes(cfg) {
  const comptes = [];
  for (let page = 1; ; page += 1) {
    const r = await fetch(`${cfg.apiUrl}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: cfg.cleAdmin, Authorization: `Bearer ${cfg.cleAdmin}` },
    });
    if (!r.ok) throw new Error(`Listage refuse : ${r.status} ${await r.text()}`);
    const { users } = await r.json();
    if (!users || users.length === 0) break;
    comptes.push(...users);
    if (users.length < 200) break;
  }
  return comptes;
}

async function creerCompte(cfg, email, emailConfirme) {
  const r = await fetch(`${cfg.apiUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: cfg.cleAdmin,
      Authorization: `Bearer ${cfg.cleAdmin}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: cfg.motDePasse,
      email_confirm: emailConfirme,
      user_metadata: { date_naissance: DATE_NAISSANCE, cgu_version_acceptee: VERSION_CGU },
    }),
  });
  if (!r.ok) throw new Error(`Création de ${email} refusée : ${r.status} ${await r.text()}`);
  return (await r.json()).id;
}

async function ligneExiste(cfg, table, compteId) {
  const r = await fetch(
    `${cfg.apiUrl}/rest/v1/${table}?compte_id=eq.${compteId}&select=id&limit=1`,
    { headers: { apikey: cfg.cleAdmin, Authorization: `Bearer ${cfg.cleAdmin}` } },
  );
  if (!r.ok) throw new Error(`Lecture ${table} refusée : ${r.status} ${await r.text()}`);
  return (await r.json()).length > 0;
}

async function insererProfil(cfg, table, corps) {
  const r = await fetch(`${cfg.apiUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: cfg.cleAdmin,
      Authorization: `Bearer ${cfg.cleAdmin}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error(`Insertion ${table} refusée : ${r.status} ${await r.text()}`);
}

async function profilActifCourant(cfg, compteId) {
  const r = await fetch(`${cfg.apiUrl}/rest/v1/comptes?id=eq.${compteId}&select=profil_actif`, {
    headers: { apikey: cfg.cleAdmin, Authorization: `Bearer ${cfg.cleAdmin}` },
  });
  if (!r.ok) throw new Error(`Lecture comptes refusée : ${r.status} ${await r.text()}`);
  return (await r.json())[0]?.profil_actif;
}

async function basculerVersCoach(cfg, email) {
  const co = await fetch(`${cfg.apiUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: cfg.cleAnon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: cfg.motDePasse }),
  });
  if (!co.ok) throw new Error(`Connexion de ${email} refusée : ${co.status} ${await co.text()}`);
  const { access_token } = await co.json();

  const r = await fetch(`${cfg.apiUrl}/rest/v1/rpc/basculer_profil`, {
    method: 'POST',
    headers: {
      apikey: cfg.cleAnon,
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ profil: 'coach' }),
  });
  if (!r.ok) throw new Error(`basculer_profil('coach') refusé : ${r.status} ${await r.text()}`);
}

async function assurerCompte(cfg, comptesExistants, def) {
  const email = emailDe(def.cle);
  const existant = comptesExistants.find((u) => u.email === email);
  const compteId = existant ? existant.id : await creerCompte(cfg, email, def.emailConfirme);
  const actions = existant ? [] : ['compte créé'];

  if (def.profilClient && !(await ligneExiste(cfg, 'profils_client', compteId))) {
    await insererProfil(cfg, 'profils_client', { compte_id: compteId, ...def.profilClient });
    actions.push('profil client');
  }
  if (def.profilCoach && !(await ligneExiste(cfg, 'profils_coach', compteId))) {
    await insererProfil(cfg, 'profils_coach', { compte_id: compteId, ...def.profilCoach });
    actions.push('profil coach');
  }
  if (def.profilActif === 'coach' && (await profilActifCourant(cfg, compteId)) !== 'coach') {
    await basculerVersCoach(cfg, email);
    actions.push('profil actif → coach');
  }

  return { email, compteId, actions: actions.length ? actions.join(', ') : 'déjà à jour' };
}

async function supprimerTout(cfg, comptesExistants) {
  const cibles = comptesExistants.filter(
    (u) =>
      (u.email ?? '').startsWith(PREFIXE_EMAIL) && (u.email ?? '').endsWith(`@${DOMAINE_EMAIL}`),
  );
  if (cibles.length === 0) {
    console.log(`Aucun compte "${PREFIXE_EMAIL}*" à supprimer.`);
    return;
  }
  for (const u of cibles) {
    const r = await fetch(`${cfg.apiUrl}/auth/v1/admin/users/${u.id}`, {
      method: 'DELETE',
      headers: { apikey: cfg.cleAdmin, Authorization: `Bearer ${cfg.cleAdmin}` },
    });
    console.log(`  ${r.ok ? 'supprimé' : `ÉCHEC ${r.status}`} : ${u.email}`);
  }
  console.log('Suppression terminée (ON DELETE CASCADE nettoie les profils).');
}

async function main() {
  const cfg = chargerConfiguration();
  const comptesExistants = await listerTousLesComptes(cfg);

  if (process.argv.includes('--supprimer')) {
    await supprimerTout(cfg, comptesExistants);
    return;
  }

  console.log(`Mot de passe commun : ${cfg.motDePasse}\n`);
  for (const def of COMPTES) {
    const { email, actions } = await assurerCompte(cfg, comptesExistants, def);
    console.log(`${email.padEnd(34)}  ${actions}`);
    console.log(`${''.padEnd(34)}  → ${def.atterritSur}\n`);
  }
  console.log('Prêt. Connecte-toi sur le simulateur avec une de ces adresses.');
}

await main();
