// Supprime tous les comptes de test crees par src/test/rls.banc.ts (prefixe "banc-rls-",
// domaine "banc-rls.test") sur le projet Supabase de developpement. A lancer a la main apres
// une execution de `npm run test:rls` tuee en cours de route (Ctrl+C, plantage reseau) : dans
// ce cas le afterAll du banc n'a pas eu l'occasion de nettoyer, et des comptes orphelins
// restent sur un projet partage avec l'usage manuel du developpeur. Voir
// npm run test:rls:nettoyage.
//
// GARDE DE SECURITE identique a src/test/rls.banc.ts, dupliquee volontairement : ce script
// tourne sous Node pur (aucune dependance, meme esprit que scripts/verifier-serveur-dev.mjs),
// le banc sous ts-jest — partager un seul fichier source pour ces quinze lignes ajouterait de
// la complexite d'import entre les deux systemes de modules pour peu de gain. Ne vise QUE le
// projet de developpement, jamais autre chose.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIXE_EMAIL = 'banc-rls-';
const DOMAINE_EMAIL = 'banc-rls.test';
const REFERENCE_PROJET_AUTORISEE = 'imzdtntaqbtymoacsxua';

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
  const variables = lireFichierEnv(path.join(racine, '.env.test.local'));
  const apiUrl = variables.SUPABASE_URL_TEST;
  const cleAdmin = variables.SUPABASE_CLE_ADMIN_TEST;

  const manquantes = [];
  if (!apiUrl) manquantes.push('SUPABASE_URL_TEST');
  if (!cleAdmin) manquantes.push('SUPABASE_CLE_ADMIN_TEST');
  if (manquantes.length > 0) {
    console.error(
      `Variable(s) manquante(s) dans .env.test.local : ${manquantes.join(', ')}. ` +
        'Voir .env.test.local.exemple.',
    );
    process.exit(1);
  }

  const correspondanceUrl = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(apiUrl.trim());
  const referenceTrouvee = correspondanceUrl?.[1] ?? apiUrl;
  if (referenceTrouvee !== REFERENCE_PROJET_AUTORISEE) {
    console.error(
      `GARDE DE SECURITE : SUPABASE_URL_TEST ne pointe pas vers le projet de developpement ` +
        `autorise (${REFERENCE_PROJET_AUTORISEE}). Reference trouvee : "${referenceTrouvee}". ` +
        'Nettoyage refuse.',
    );
    process.exit(1);
  }

  return { apiUrl: apiUrl.replace(/\/$/, ''), cleAdmin };
}

async function listerComptesDeTest(apiUrl, cleAdmin) {
  const correspondants = [];
  const parPage = 200;
  for (let page = 1; ; page += 1) {
    const reponse = await fetch(`${apiUrl}/auth/v1/admin/users?page=${page}&per_page=${parPage}`, {
      headers: { apikey: cleAdmin, Authorization: `Bearer ${cleAdmin}` },
    });
    if (!reponse.ok) {
      throw new Error(`Listage des comptes refuse : ${reponse.status} ${await reponse.text()}`);
    }
    const { users } = await reponse.json();
    if (!users || users.length === 0) break;
    for (const utilisateur of users) {
      const email = utilisateur.email ?? '';
      if (email.startsWith(PREFIXE_EMAIL) && email.endsWith(`@${DOMAINE_EMAIL}`)) {
        correspondants.push(utilisateur);
      }
    }
    if (users.length < parPage) break;
  }
  return correspondants;
}

async function supprimerCompte(apiUrl, cleAdmin, compte) {
  const reponse = await fetch(`${apiUrl}/auth/v1/admin/users/${compte.id}`, {
    method: 'DELETE',
    headers: { apikey: cleAdmin, Authorization: `Bearer ${cleAdmin}` },
  });
  if (!reponse.ok) {
    throw new Error(
      `Suppression de ${compte.email} refusee : ${reponse.status} ${await reponse.text()}`,
    );
  }
}

async function main() {
  const { apiUrl, cleAdmin } = chargerConfiguration();
  const comptes = await listerComptesDeTest(apiUrl, cleAdmin);

  if (comptes.length === 0) {
    console.log('Aucun compte de test (prefixe "banc-rls-") a nettoyer.');
    return;
  }

  console.log(`${comptes.length} compte(s) de test trouve(s), suppression...`);
  let echecs = 0;
  for (const compte of comptes) {
    try {
      await supprimerCompte(apiUrl, cleAdmin, compte);
      console.log(`  supprime : ${compte.email}`);
    } catch (erreur) {
      echecs += 1;
      console.error(`  ECHEC pour ${compte.email} : ${erreur.message}`);
    }
  }
  if (echecs > 0) {
    console.error(`${echecs} suppression(s) en echec. Relance le script.`);
    process.exitCode = 1;
  } else {
    console.log('Nettoyage termine.');
  }
}

await main();
