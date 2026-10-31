// Rattrape les anomalies de paiement ouvertes sur le projet Supabase de developpement, une fois
// un defaut de notre code corrige et deploye : appelle l'Edge Function anomalies-retraitement
// (supabase/functions/anomalies-retraitement/index.ts, migration 0040) avec la cle d'administration
// du projet de developpement (SUPABASE_CLE_ADMIN_TEST, la meme que le banc),
// et affiche le bilan anomalie par anomalie. Voir npm run anomalies:retraiter.
//
//   node scripts/retraiter-anomalies-paiement.mjs              -- toutes les anomalies ouvertes
//   node scripts/retraiter-anomalies-paiement.mjs cs_test_...  -- celles d'une seule session
//
// GARDE DE SECURITE identique a scripts/nettoyer-comptes-banc-rls.mjs, dupliquee pour la meme
// raison (Node pur, aucune dependance) : ne vise QUE le projet de developpement. Aucune cle n'est
// jamais affichee.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  const variables = lireFichierEnv(path.join(racine, '.secrets-rls.local'));
  const apiUrl = variables.SUPABASE_URL_TEST;
  const cleAdmin = variables.SUPABASE_CLE_ADMIN_TEST;

  const manquantes = [];
  if (!apiUrl) manquantes.push('SUPABASE_URL_TEST');
  if (!cleAdmin) manquantes.push('SUPABASE_CLE_ADMIN_TEST');
  if (manquantes.length > 0) {
    console.error(
      `Variable(s) manquante(s) dans .secrets-rls.local : ${manquantes.join(', ')}. ` +
        'Voir .secrets-rls.local.exemple.',
    );
    process.exit(1);
  }

  const correspondanceUrl = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(apiUrl.trim());
  const referenceTrouvee = correspondanceUrl?.[1] ?? apiUrl;
  if (referenceTrouvee !== REFERENCE_PROJET_AUTORISEE) {
    console.error(
      `GARDE DE SECURITE : SUPABASE_URL_TEST ne pointe pas vers le projet de developpement ` +
        `autorise (${REFERENCE_PROJET_AUTORISEE}). Reference trouvee : "${referenceTrouvee}". ` +
        'Retraitement refuse.',
    );
    process.exit(1);
  }

  return { apiUrl: apiUrl.replace(/\/$/, ''), cleAdmin };
}

const session = process.argv[2] ?? null;
if (session !== null && !session.startsWith('cs_')) {
  console.error(`Session invalide : "${session}" (attendu : cs_...).`);
  process.exit(1);
}

const { apiUrl, cleAdmin } = chargerConfiguration();
const reponse = await fetch(`${apiUrl}/functions/v1/anomalies-retraitement`, {
  method: 'POST',
  headers: {
    apikey: cleAdmin,
    Authorization: `Bearer ${cleAdmin}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(session === null ? {} : { session }),
});
const corps = await reponse.json().catch(() => null);
if (!reponse.ok || corps === null) {
  console.error(`Retraitement refuse : HTTP ${reponse.status} ${JSON.stringify(corps)}`);
  process.exit(1);
}

for (const ligne of corps.bilan) {
  console.log(
    `${ligne.issue === 'resolue' ? 'RESOLUE' : 'OUVERTE'}  ${ligne.session}  ${ligne.motif}  -> ${ligne.detail}`,
  );
}
console.log(`${corps.resolues} resolue(s), ${corps.ouvertes} encore ouverte(s).`);
// Code de sortie non nul s'il reste une anomalie ouverte : un lancement automatique le verra.
process.exit(corps.ouvertes > 0 ? 2 : 0);
