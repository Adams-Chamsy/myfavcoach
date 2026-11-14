// Outils de clôture (voir navigateur.mjs). Paie une page Stripe Checkout de TEST dans le navigateur
// piloté, après avoir exigé un relais Stripe en état de livrer.
//
// Le relais : le projet de dev n'a AUCUN point de terminaison Stripe, il ne reçoit les événements
// que par `stripe listen` lancé sur la machine (npm run relais:stripe). Deux fois, le 3 et le
// 14 novembre 2026, un paiement de test a réussi chez Stripe sans créer d'abonnement : la première
// fois le relais ne tournait pas ; la seconde, il ne tournait pas au moment du paiement, puis son
// secret de signature ne correspondait plus à celui du projet (la CLI Stripe avait été reconnectée
// le 11), et le webhook refusait chaque événement en 400, en silence. exigerRelaisStripe() refuse
// donc AVANT qu'un lien de paiement soit créé, dans les deux cas. Les empreintes comparées sont
// des condensats SHA-256 tronqués, jamais le secret lui-même : rien de secret n'est affiché.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pause } from './navigateur.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REFERENCE_PROJET_DEV = 'imzdtntaqbtymoacsxua';
const URL_WEBHOOK_DEV = `https://${REFERENCE_PROJET_DEV}.supabase.co/functions/v1/webhook-paiement`;

function refuser(raison) {
  throw new Error(`REFUSÉ, aucun lien de paiement créé : ${raison}`);
}

function empreinteSecretRelais() {
  const r = spawnSync('stripe', ['listen', '--print-secret'], { encoding: 'utf8' });
  const secret = (r.stdout ?? '').trim();
  if (r.status !== 0 || !secret)
    refuser('la CLI Stripe ne rend pas de secret de relais (stripe login ?)');
  return createHash('sha256').update(secret).digest('hex');
}

function empreinteSecretProjet() {
  const r = spawnSync('npx', ['supabase', 'secrets', 'list', '--output', 'json'], {
    cwd: RACINE,
    encoding: 'utf8',
  });
  const sortie = r.stdout ?? '';
  const debut = sortie.indexOf('[');
  if (r.status !== 0 || debut < 0) {
    refuser('la liste des secrets du projet de dev est illisible (supabase login ?)');
  }
  const secrets = JSON.parse(sortie.slice(debut));
  const webhook = (secrets ?? []).find((x) => x.name === 'STRIPE_WEBHOOK_SECRET');
  if (!webhook) refuser('STRIPE_WEBHOOK_SECRET absent du projet de dev');
  return webhook.value;
}

let relaisVerifie = false;

export function exigerRelaisStripe() {
  if (relaisVerifie) return;
  const projetLie = spawnSync('cat', [join(RACINE, 'supabase', '.temp', 'project-ref')], {
    encoding: 'utf8',
  }).stdout?.trim();
  if (projetLie !== REFERENCE_PROJET_DEV)
    refuser(`le projet Supabase lié n'est pas le dev (${projetLie || 'aucun'})`);
  const processus = spawnSync('pgrep', ['-fl', 'stripe listen'], { encoding: 'utf8' }).stdout ?? '';
  const enMarche = processus
    .split('\n')
    .some((l) => l.includes(URL_WEBHOOK_DEV) && l.includes('checkout.session.completed'));
  if (!enMarche) {
    refuser(
      'aucun relais Stripe ne tourne vers le webhook du dev. Lance-le dans un autre terminal, laisse-le tourner : npm run relais:stripe',
    );
  }
  const relais = empreinteSecretRelais();
  const projet = empreinteSecretProjet();
  if (relais !== projet) {
    refuser(
      `le secret du relais (empreinte ${relais.slice(0, 12)}) n'est pas celui du projet (${projet.slice(0, 12)}) : ` +
        'le webhook refuserait chaque événement. Repose-le : stripe listen --print-secret | scripts/poser-secret-stripe.sh STRIPE_WEBHOOK_SECRET',
    );
  }
  relaisVerifie = true;
}

// « Payer » dans l'application (04b) crée le lien de paiement : on ne l'appuie qu'une fois le
// relais exigé, puis on paie sur la page Stripe.
export async function payerDepuisLApplication(nav, options) {
  exigerRelaisStripe();
  await nav.appuyer(/^Payer \d/);
  return payer(nav, options);
}

const CARTES = {
  reussie: '4242424242424242',
  troisDS: '4000002760003184',
  refusee: '4000000000000002',
};

// Depuis novembre 2026, Checkout rend tout le formulaire (e-mail, moyens, « Payer ») dans un cadre
// js.stripe.com (« elements-inner-habanero ») : on l'atteint par le protocole de débogage, dans un
// monde isolé du cadre (isolation des sites désactivée dans navigateur.mjs).
async function cadres(nav) {
  const arbre = await nav.cdp('Page.getFrameTree');
  const liste = [];
  const parcourir = (n) => {
    liste.push(n.frame);
    (n.childFrames ?? []).forEach(parcourir);
  };
  parcourir(arbre.result.frameTree);
  return liste;
}
export async function dansCadre(nav, motifUrl, expression) {
  for (const f of await cadres(nav)) {
    if (!motifUrl.test(f.url)) continue;
    const monde = await nav.cdp('Page.createIsolatedWorld', {
      frameId: f.id,
      worldName: 'cloture',
    });
    const r = await nav.cdp('Runtime.evaluate', {
      contextId: monde.result.executionContextId,
      returnByValue: true,
      awaitPromise: true,
      expression,
    });
    const v = r.result?.result?.value;
    if (v !== undefined && v !== null && v !== false) return v;
  }
  return null;
}
const FORM = /elements-inner-habanero|elements-inner-payment|elements-inner-card/;
async function attendreDansCadre(nav, expression, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const v = await dansCadre(nav, FORM, expression).catch(() => null);
    if (v) return v;
    await pause(500);
  }
  throw new Error(`cadre Stripe : ${expression.slice(0, 80)} jamais vrai`);
}
async function taper(nav, selecteur, valeur) {
  await attendreDansCadre(
    nav,
    `(() => { const e = document.querySelector(${JSON.stringify(selecteur)}); if (!e) return false; e.focus(); return true; })()`,
  );
  await nav.cdp('Input.insertText', { text: valeur });
  await pause(300);
}

export async function payer(
  nav,
  { email, moyen = 'carte', carte = 'reussie', dossier, prefixe = 'stripe' },
) {
  exigerRelaisStripe();
  const shot = async (nom) => dossier && nav.capture(`${dossier}/${prefixe}-${nom}.png`);
  await attendreDansCadre(nav, `/Moyens? de paiement/.test(document.body.innerText)`);
  await pause(1500);
  await taper(nav, '#linkAuthentication-emailInput, #email', email);
  const libelle = moyen === 'carte' ? 'Carte bancaire' : 'Prélèvement SEPA';
  await attendreDansCadre(
    nav,
    `(() => { const e = [...document.querySelectorAll('label,div,span,button')].filter((x) => (x.innerText || '').trim() === ${JSON.stringify(libelle)}).pop(); if (!e) return false; e.click(); return true; })()`,
  );
  await pause(2000);
  if (moyen === 'carte') {
    await taper(
      nav,
      '#cardNumber, input[name=number], input[autocomplete=cc-number]',
      CARTES[carte],
    );
    await taper(nav, '#cardExpiry, input[name=expiry], input[autocomplete=cc-exp]', '12 / 34');
    await taper(nav, '#cardCvc, input[name=cvc], input[autocomplete=cc-csc]', '123');
  } else {
    await taper(nav, '#iban, input[name=iban]', 'FR1420041010050500013M02606');
  }
  for (const [sel, val] of [
    [
      '#billingName, input[name=name], input[autocomplete=name], input[autocomplete="cc-name"]',
      'Essai Paiement',
    ],
    ['#billingAddressLine1, input[name=addressLine1]', '1 rue de Rivoli'],
    ['#billingPostalCode, input[name=postalCode]', '75001'],
    ['#billingLocality, input[name=locality]', 'Paris'],
  ]) {
    const present = await dansCadre(
      nav,
      FORM,
      `!!document.querySelector(${JSON.stringify(sel)}) && !document.querySelector(${JSON.stringify(sel)}).value`,
    );
    if (present) await taper(nav, sel, val);
  }
  await shot('1-rempli');
  await attendreDansCadre(
    nav,
    `(() => { const b = document.querySelector('#submit, button[type=submit]'); if (!b) return false; b.click(); return true; })()`,
  );
  return { shot };
}

// 3-D Secure de test : la page de défi de Stripe s'ouvre dans un cadre ; on appuie sur « Complete ».
export async function valider3DS(nav, { reussir = true } = {}) {
  for (let i = 0; i < 60; i++) {
    const { result } = await nav.cdp('Page.getFrameTree');
    const cadres = [];
    const parcourir = (n) => {
      cadres.push(n.frame);
      (n.childFrames || []).forEach(parcourir);
    };
    parcourir(result.frameTree);
    if (cadres.some((f) => /hooks\.stripe\.com|3ds|challenge|authenticate/i.test(f.url))) break;
    await pause(500);
  }
  await pause(6000);
  // Le bouton est dans un cadre imbriqué : on le trouve par le DOM de chaque contexte d'exécution.
  const motif = reussir ? 'COMPLETE|Complete|Réussir|Autoriser' : 'FAIL|Fail|Échec|Refuser';
  for (let essai = 0; essai < 40; essai++) {
    const { result } = await nav.cdp('Page.getFrameTree');
    const ids = [];
    const parcourir = (n) => {
      ids.push(n.frame.id);
      (n.childFrames || []).forEach(parcourir);
    };
    parcourir(result.frameTree);
    for (const frameId of ids) {
      const monde = await nav.cdp('Page.createIsolatedWorld', { frameId, worldName: 'sonde' });
      const ctx = monde.result?.executionContextId;
      if (!ctx) continue;
      const r = await nav.cdp('Runtime.evaluate', {
        contextId: ctx,
        returnByValue: true,
        expression: `(() => { const b = [...document.querySelectorAll('button,input[type=submit],a')].find((x) => /${motif}/.test((x.innerText || x.value || '').trim())); if (!b) return null; b.click(); return (b.innerText || b.value).trim(); })()`,
      });
      if (r.result?.result?.value) return r.result.result.value;
    }
    await pause(1000);
  }
  throw new Error('bouton 3-D Secure introuvable');
}
