// Outils de clôture d'une étape d'écran (docs/dette.md, ligne du relais des paiements) : une étape se clôt
// dans un vrai navigateur, sur le chemin de l'application, contre la base de dev. Ce fichier
// pilote Chrome sans interface par son protocole de débogage (CDP), sans dépendance (WebSocket de
// Node 22). Jamais utilisé par l'application ni par npm run verif.
//
// Prérequis : Google Chrome installé, le serveur web lancé sur 8081
// (CI=1 npx expo start --web --port 8081), comptes-scenarios.local.md présent.
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export const MDP = readFileSync(join(RACINE, 'comptes-scenarios.local.md'), 'utf8').match(
  /Mot de passe commun à tous les comptes :\*\* `([^`]+)`/,
)[1];

let portSuivant = 9340 + Math.floor(Math.random() * 200);

export async function ouvrir({ largeur = 430, hauteur = 932, journal = false } = {}) {
  const port = portSuivant++;
  const profil = mkdtempSync(join(tmpdir(), 'cdp-'));
  const chrome = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profil}`,
      // Navigateur d'essai seulement : les cadres d'un autre domaine (défi 3-D Secure de la page de
      // paiement) restent dans le processus de la page, donc atteignables par le protocole.
      '--disable-site-isolation-trials',
      '--disable-features=IsolateOrigins,site-per-process',
      `--window-size=${largeur},${hauteur}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let cible;
  for (let i = 0; i < 60 && !cible; i++) {
    await pause(250);
    try {
      cible = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(
        (t) => t.type === 'page',
      );
    } catch {
      /* Chrome pas encore prêt : on réessaie */
    }
  }
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let n = 0;
  const attente = new Map();
  const erreurs = [];
  const ecouteurs = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method && ecouteurs.has(m.method)) for (const f of ecouteurs.get(m.method)) f(m.params);
    if (m.id && attente.has(m.id)) {
      attente.get(m.id)(m);
      attente.delete(m.id);
    }
    if (m.method === 'Runtime.exceptionThrown')
      erreurs.push(m.params.exceptionDetails.exception?.description?.slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      const t = JSON.stringify(m.params.args.map((a) => a.value ?? a.description)).slice(0, 300);
      erreurs.push(t);
      if (journal) console.log('console.error', t);
    }
  });
  const cdp = (method, params = {}) =>
    new Promise((r) => {
      const id = ++n;
      attente.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: largeur,
    height: hauteur,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const evaluer = async (expr) => {
    const r = await cdp('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.result?.exceptionDetails)
      throw new Error(
        'evaluer : ' +
          (
            r.result.exceptionDetails.exception?.description ??
            JSON.stringify(r.result.exceptionDetails)
          ).slice(0, 300),
      );
    return r.result?.result?.value;
  };
  const texte = async () => (await evaluer('document.body ? document.body.innerText : ""')) ?? '';
  const chemin = () => evaluer('location.pathname + location.search');
  const attendreTexte = async (motif, ms = 45000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const t = await texte().catch(() => '');
      if (motif.test(t)) return t;
      await pause(400);
    }
    throw new Error(
      `texte attendu absent : ${motif} ; écran : ${(await texte().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400)}`,
    );
  };
  const attendreHydratation = async () => {
    for (let i = 0; i < 600; i++) {
      if (
        await evaluer(
          `(() => { const e = document.querySelector('#root *'); if (!e) return false; return [...document.querySelectorAll('#root *')].slice(0, 50).some((x) => Object.keys(x).some((k) => k.startsWith('__reactProps'))); })()`,
        ).catch(() => false)
      )
        return;
      await pause(300);
    }
    throw new Error('React jamais branché sur la page');
  };
  const aller = async (url, motif) => {
    await cdp('Page.navigate', { url });
    if (motif) await attendreTexte(motif);
    await attendreHydratation();
    await pause(300);
  };
  const point = (selecteur) =>
    evaluer(
      `(() => { const e = ${selecteur}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
    );
  const cliquerXY = async ({ x, y }) => {
    for (const type of ['mousePressed', 'mouseReleased'])
      await cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  };
  const cliquer = async (selecteur) => {
    const p = await point(selecteur);
    if (!p) throw new Error(`élément introuvable : ${selecteur}`);
    await cliquerXY(p);
  };
  // Un élément cliquable (button, role=button, lien) dont le texte ou le libellé correspond.
  const selecteurTexte = (motif) =>
    `[...document.querySelectorAll('button,[role=button],a,[role=link],[role=tab],[role=checkbox],[role=radio],[role=switch]')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).find((b) => ${motif}.test((b.innerText || '').trim()) || ${motif}.test(b.getAttribute('aria-label') || ''))`;
  const appuyer = async (motif) => cliquer(selecteurTexte(motif));
  const existe = async (motif) => !!(await evaluer(`!!(${selecteurTexte(motif)})`));
  const saisir = async (selecteur, valeur) => {
    await cliquer(selecteur);
    await evaluer(`(() => { const e = ${selecteur}; e.select && e.select(); })()`);
    await cdp('Input.insertText', { text: valeur });
  };
  const touche = async (key, code, keyCode) => {
    await cdp('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      windowsVirtualKeyCode: keyCode,
    });
    await cdp('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode: keyCode,
    });
  };
  const capture = async (fichier) => {
    await pause(400);
    const img = await cdp('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, Buffer.from(img.result.data, 'base64'));
    return fichier;
  };
  const attendreChamps = async (n = 2) => {
    for (let i = 0; i < 600; i++) {
      if (
        (await evaluer(`document.querySelectorAll('input').length`).catch(() => 0)) >= n &&
        !/Bundling/.test(await texte())
      ) {
        await attendreHydratation();
        return;
      }
      await pause(300);
    }
    throw new Error('champs jamais affichés');
  };
  const connecter = async (email, base = 'http://localhost:8081') => {
    await aller(`${base}/connexion`, /Mot de passe oublié/);
    await attendreChamps();
    await saisir(`document.querySelectorAll('input')[0]`, email);
    await saisir(`document.querySelectorAll('input')[1]`, MDP);
    await appuyer(/^Se connecter$/);
    for (let i = 0; i < 100; i++) {
      if (!(await chemin()).startsWith('/connexion')) break;
      await pause(300);
    }
    await pause(1500);
  };
  const sur = (methode, f) => {
    if (!ecouteurs.has(methode)) ecouteurs.set(methode, []);
    ecouteurs.get(methode).push(f);
  };
  // Le sélecteur de fichier web (expo-document-picker crée un <input type=file> et le clique) :
  // on intercepte la boîte de dialogue et on lui donne un fichier.
  let fichierAChoisir = null;
  await cdp('Page.setInterceptFileChooserDialog', { enabled: true });
  sur('Page.fileChooserOpened', async (p) => {
    if (fichierAChoisir)
      await cdp('DOM.setFileInputFiles', {
        files: [fichierAChoisir],
        backendNodeId: p.backendNodeId,
      });
  });
  const choisirFichier = (chemin) => {
    fichierAChoisir = chemin;
  };
  const fermer = () => {
    try {
      ws.close();
    } catch {
      /* déjà fermé */
    }
    chrome.kill();
  };
  return {
    attendreChamps,
    sur,
    choisirFichier,
    cdp,
    evaluer,
    texte,
    chemin,
    attendreTexte,
    attendreHydratation,
    aller,
    cliquer,
    cliquerXY,
    point,
    appuyer,
    existe,
    saisir,
    touche,
    capture,
    connecter,
    fermer,
    erreurs,
    pause,
  };
}
