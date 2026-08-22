// Demarre le vrai serveur de developpement Expo, interroge "/" et "/_galerie", verifie une
// reponse 200 sans erreur de build embarquee, puis l'arrete. Utilise par npm run verif.
//
// Pourquoi ce script existe : deux prompts de suite ont annonce un mecanisme d'exclusion de
// fichiers (resolver.blockList dans metro.config.js) cense empecher expo-router de planter au
// demarrage sur un conflit de route — sans jamais le verifier en conditions reelles. Ni
// `npm run verif` ni `npx expo export` ne demarrent le serveur de developpement : le premier ne
// touche pas a expo-router, le second tourne en production, un mode qui avale silencieusement
// ce genre de conflit au lieu de le signaler (voir docs/dette.md). Le bug n'est apparu qu'au
// prochain `npm start` reel. Cette etape ferme cet angle mort : elle fait ce que `npm start` fait,
// dans les memes conditions (mode developpement), et echoue si la page renvoyee est une page
// d'erreur de build plutot qu'un ecran.
//
// Port dedie (8098), different du port par defaut d'Expo (8081) : si le developpeur a deja un
// `npm start` ouvert dans un autre terminal, ce script ne doit ni s'y accrocher ni le perturber.
import { spawn } from 'node:child_process';

const PORT = 8098;
const DELAI_MAX_DEMARRAGE_MS = 90_000;
const INTERVALLE_SONDAGE_MS = 1_500;
const DELAI_REQUETE_MS = 5_000;
const MARQUEUR_ERREUR_BUILD = '_expo-static-error';
const ROUTES_A_VERIFIER = ['/', '/_galerie'];

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function demarrerServeur() {
  // `detached: true` place le processus (et les workers Metro qu'il lance) dans son propre
  // groupe, pour pouvoir tout arreter d'un coup avec un pid negatif — un `child.kill()` seul ne
  // tue que le processus `expo`, pas forcement ses enfants.
  const serveur = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let sortie = '';
  serveur.stdout.on('data', (donnees) => {
    sortie += donnees.toString();
  });
  serveur.stderr.on('data', (donnees) => {
    sortie += donnees.toString();
  });

  return { serveur, lireSortie: () => sortie };
}

async function arreterServeur(serveur) {
  if (serveur.pid == null || serveur.exitCode != null) {
    return;
  }
  try {
    process.kill(-serveur.pid, 'SIGTERM');
  } catch {
    // Deja arrete, ou groupe de processus deja disparu : rien a faire.
  }
  const arretConfirme = await Promise.race([
    new Promise((resolve) => serveur.once('exit', () => resolve(true))),
    attendre(5_000).then(() => false),
  ]);
  if (!arretConfirme) {
    try {
      process.kill(-serveur.pid, 'SIGKILL');
    } catch {
      // Deja arrete entre-temps.
    }
  }
}

async function requeter(chemin) {
  const reponse = await fetch(`http://localhost:${PORT}${chemin}`, {
    signal: AbortSignal.timeout(DELAI_REQUETE_MS),
  });
  const corps = await reponse.text();
  return { statut: reponse.status, corps };
}

async function attendreLeServeurPret() {
  const echeance = Date.now() + DELAI_MAX_DEMARRAGE_MS;
  while (Date.now() < echeance) {
    try {
      await requeter('/');
      return;
    } catch {
      await attendre(INTERVALLE_SONDAGE_MS);
    }
  }
  throw new Error(
    `Le serveur ne repond toujours pas sur le port ${PORT} apres ${DELAI_MAX_DEMARRAGE_MS / 1000} s. ` +
      `Si ce port est deja occupe par un processus bloque d'une precedente execution, verifie avec ` +
      `\`lsof -i :${PORT}\` et arrete-le a la main.`,
  );
}

async function verifierRoute(chemin) {
  const { statut, corps } = await requeter(chemin);
  const contientErreurBuild = corps.includes(MARQUEUR_ERREUR_BUILD);

  if (statut !== 200 || contientErreurBuild) {
    const extrait = contientErreurBuild
      ? (corps.match(/"content":"([^"]*)"/)?.[1] ?? corps.slice(0, 400))
      : corps.slice(0, 400);
    throw new Error(`${chemin} : statut ${statut}, erreur de build detectee : ${extrait}`);
  }
}

async function main() {
  const { serveur, lireSortie } = demarrerServeur();

  try {
    await attendreLeServeurPret();
    for (const route of ROUTES_A_VERIFIER) {
      await verifierRoute(route);
      console.log(`[verifier-serveur-dev] ${route} : OK`);
    }
  } catch (erreur) {
    console.error(`[verifier-serveur-dev] ECHEC — ${erreur.message}`);
    console.error('--- sortie du serveur (derniers 2000 caracteres) ---');
    console.error(lireSortie().slice(-2000));
    process.exitCode = 1;
  } finally {
    await arreterServeur(serveur);
  }
}

await main();
