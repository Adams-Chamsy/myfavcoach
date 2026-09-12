// Construit le VRAI bundle de production — web, iOS ET Android en une seule commande
// (`npx expo export -p all`) — et prouve que ni la clef admin
// (EXPO_PUBLIC_SUPABASE_ADMIN_ANON_KEY) ni aucune référence à app/(admin)/ n'y figurent, sur
// AUCUNE des trois plateformes.
//
// Pourquoi ce script existe : metro.config.js retire app/(admin)/ du bundle via
// resolver.blockList, et src/test/aucun-lien-vers-admin.test.ts prouve qu'aucun écran mobile ne
// LIE vers cette route — mais aucun des deux ne prouve que la clef admin elle-même
// (EXPO_PUBLIC_*, donc INLINÉE À LA COMPILATION par le plugin Babel d'Expo, comme toute variable
// de ce préfixe) n'atteint le bundle compilé. « Retirer la route du graphe » et « la clef
// n'apparaît nulle part dans les octets livrés » sont deux preuves distinctes (docs/prompts/L1.md,
// tableau des faux verts, 3e ligne) : la seconde n'était pas faite.
//
// docs/ecrans/L2-10-back-office-verification.md, critère 7, exige explicitement « iOS et
// Android », pas seulement le web : une première version de ce script ne construisait que
// `-p web`, vérifiée à la main une seule fois pour iOS pendant la revue de fin de lot — une
// protection vérifiée à la main une fois n'est pas une protection (CLAUDE.md §7, règle 4).
// `-p all` construit les trois plateformes réellement ciblées par ce projet (web, iOS, Android —
// ni tvOS ni macOS, absents de la configuration Expo) dans le même `dist/`, sans commande
// séparée ni cache à vider trois fois : le même balayage récursif ci-dessous couvre alors les
// trois bundles d'un coup, `_expo/static/js/{web,ios,android}/`. Les bundles iOS/Android sont du
// bytecode Hermes (`.hbc`), pas du JS lisible tel quel — vérifié empiriquement que
// `readFileSync(..., 'utf8')` y retrouve quand même les chaînes de caractères littérales
// (clefs, noms de route) intactes : le décodeur UTF-8 de Node est tolérant aux octets non-UTF-8
// du bytecode environnant, il ne lève jamais, et la sous-chaîne recherchée reste repérable.
//
// Le balayage se prouve d'abord capable de détecter (même discipline que
// src/test/secrets-interdits.test.ts) : la clef MOBILE (EXPO_PUBLIC_SUPABASE_ANON_KEY) DOIT se
// retrouver dans le bundle (elle est lue par le client mobile, c'est attendu) — si elle n'y est
// pas, le balayage lui-même est cassé et rien de ce qui suit ne prouve quoi que ce soit.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname;
const DOSSIER_DIST = join(RACINE, 'dist');

function lireVariablesEnv() {
  const contenu = readFileSync(join(RACINE, '.env'), 'utf8');
  const valeurs = {};
  for (const ligne of contenu.split('\n')) {
    const correspondance = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(ligne.trim());
    if (correspondance) valeurs[correspondance[1]] = correspondance[2].trim();
  }
  return valeurs;
}

function fichiersRecursifs(dossier) {
  const resultats = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) resultats.push(...fichiersRecursifs(chemin));
    else resultats.push(chemin);
  }
  return resultats;
}

function balayerDist(motif, racine = DOSSIER_DIST) {
  return fichiersRecursifs(racine).filter((chemin) => {
    try {
      return motif.test(readFileSync(chemin, 'utf8'));
    } catch {
      // Fichier binaire (police, image) : jamais une clef ou une chaîne de route.
      return false;
    }
  });
}

// Une plateforme par sous-dossier de sortie d'expo export (`_expo/static/js/<plateforme>/`) —
// web, iOS, Android : les trois seules réellement ciblées par ce projet (CLAUDE.md §1).
const PLATEFORMES = ['web', 'ios', 'android'];

function dossierPlateforme(plateforme) {
  return join(DOSSIER_DIST, '_expo', 'static', 'js', plateforme);
}

const env = lireVariablesEnv();
const CLE_MOBILE = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const CLE_ADMIN = env.EXPO_PUBLIC_SUPABASE_ADMIN_ANON_KEY;

if (!CLE_MOBILE || !CLE_ADMIN) {
  console.error(
    '[verifier-bundle-production] .env incomplet : EXPO_PUBLIC_SUPABASE_ANON_KEY et ' +
      'EXPO_PUBLIC_SUPABASE_ADMIN_ANON_KEY sont toutes deux requises pour ce contrôle.',
  );
  process.exit(1);
}
if (CLE_MOBILE === CLE_ADMIN) {
  console.error(
    '[verifier-bundle-production] EXPO_PUBLIC_SUPABASE_ANON_KEY et ' +
      'EXPO_PUBLIC_SUPABASE_ADMIN_ANON_KEY sont IDENTIQUES : ce contrôle ne peut pas distinguer ' +
      'une fuite de la présence légitime de la clef mobile. Utilise deux valeurs distinctes.',
  );
  process.exit(1);
}

// --clear (cache Metro) est OBLIGATOIRE ici : trouvé en écrivant ce script -- sans lui, un
// build precedent (.env different, ex. le gabarit vide de .env.exemple) reste dans le cache
// Metro et expo export embarque des valeurs PERIMEES sans jamais relire le vrai .env courant.
// Sans --clear, ce script aurait pu rapporter un FAUX echec ("clef mobile absente") ou pire, un
// FAUX succes qui ne prouve rien sur le VRAI contenu de .env.
console.log('[verifier-bundle-production] npx expo export -p all --clear (web, iOS, Android)…');
execFileSync('npx', ['expo', 'export', '-p', 'all', '--clear'], { cwd: RACINE, stdio: 'inherit' });

if (!existsSync(DOSSIER_DIST)) {
  console.error('[verifier-bundle-production] dist/ absent après export — build échoué.');
  process.exit(1);
}

// Chaque plateforme doit avoir réellement produit un bundle — sans ce contrôle, `-p all` qui
// n'exporterait (silencieusement, ex. mauvaise config Expo) que le web laisserait le balayage
// ci-dessous "réussir" en ne prouvant jamais rien pour iOS/Android : exactement le défaut d'une
// vérification faite à la main une seule fois, translaté en code.
const MOTIF_CLE_MOBILE = new RegExp(CLE_MOBILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
for (const plateforme of PLATEFORMES) {
  const dossier = dossierPlateforme(plateforme);
  if (!existsSync(dossier) || fichiersRecursifs(dossier).length === 0) {
    console.error(
      `[verifier-bundle-production] bundle "${plateforme}" absent de dist/ après ` +
        `expo export -p all — build échoué ou plateforme silencieusement omise.`,
    );
    process.exit(1);
  }

  // Le balayage se prouve capable de détecter, PLATEFORME PAR PLATEFORME (pas seulement "quelque
  // part dans dist/") : la clef mobile DOIT apparaître dans CE bundle précis, sinon rien ne
  // prouve que ce bundle-là a été réellement inspecté.
  if (balayerDist(MOTIF_CLE_MOBILE, dossier).length === 0) {
    console.error(
      `[verifier-bundle-production] ÉCHEC DU BALAYAGE LUI-MÊME sur "${plateforme}" : la clef ` +
        'mobile (EXPO_PUBLIC_SUPABASE_ANON_KEY), attendue dans ce bundle, n’y apparaît nulle ' +
        'part. Ce contrôle ne peut donc rien prouver sur la clef admin pour cette plateforme — ' +
        'corrige le balayage avant de lui faire confiance.',
    );
    process.exit(1);
  }
}

const contientCleAdmin = balayerDist(new RegExp(CLE_ADMIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
const contientReferenceAdmin = balayerDist(/\(admin\)/);
const cheminsAdmin = fichiersRecursifs(DOSSIER_DIST).filter((c) => c.includes('(admin)'));

const echecs = [
  ...contientCleAdmin.map((c) => `clef admin trouvée dans ${c.replace(RACINE, '')}`),
  ...contientReferenceAdmin.map((c) => `référence "(admin)" trouvée dans ${c.replace(RACINE, '')}`),
  ...cheminsAdmin.map((c) => `fichier de route (admin) présent : ${c.replace(RACINE, '')}`),
];

if (echecs.length > 0) {
  console.error(
    '[verifier-bundle-production] ÉCHEC :\n' + echecs.map((e) => `  - ${e}`).join('\n'),
  );
  process.exit(1);
}

console.log(
  '[verifier-bundle-production] OK — web, iOS, Android : clef mobile présente sur les trois ' +
    '(balayage prouvé capable sur chacun), clef admin et toute référence à (admin) absentes ' +
    'du bundle de production, sur les trois.',
);
