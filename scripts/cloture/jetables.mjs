// Outils de clôture (voir navigateur.mjs). Comptes clients jetables (essai-…@mfc.test) pour les
// essais de paiement : même création que scripts/comptes-scenarios.mjs (compte par l'API
// d'administration, puis profil client et onboarding par la session de l'utilisateur). Le rôle
// serveur ne sert qu'à créer le compte confirmé, à LIRE l'état, et à supprimer les jetables.
// supprimerJetables() se lance à la fin de chaque clôture qui en crée.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
function lireEnv(chemin) {
  const v = {};
  for (const l of readFileSync(chemin, 'utf8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(l.trim());
    if (m) v[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return v;
}
const s = lireEnv(`${racine}/.secrets-rls.local`);
const p = lireEnv(`${racine}/.env`);
export const cfg = {
  apiUrl: s.SUPABASE_URL_TEST.replace(/\/$/, ''),
  cleAdmin: s.SUPABASE_CLE_ADMIN_TEST,
  cleAnon: p.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  motDePasse: s.COMPTES_TEST_MOT_DE_PASSE,
};
if (!cfg.apiUrl.includes('imzdtntaqbtymoacsxua')) throw new Error('pas le projet de dev');

export async function appel(chemin, { methode = 'GET', jeton, corps, entetes = {} } = {}) {
  const r = await fetch(`${cfg.apiUrl}${chemin}`, {
    method: methode,
    headers: {
      apikey: jeton ? cfg.cleAnon : cfg.cleAdmin,
      Authorization: `Bearer ${jeton ?? cfg.cleAdmin}`,
      ...(corps !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...entetes,
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const t = await r.text();
  let d;
  try {
    d = t ? JSON.parse(t) : null;
  } catch {
    d = t;
  }
  if (!r.ok) throw new Error(`${methode} ${chemin} : ${r.status} ${t.slice(0, 300)}`);
  return d;
}
export const seConnecter = async (email) =>
  (
    await appel('/auth/v1/token?grant_type=password', {
      methode: 'POST',
      jeton: cfg.cleAnon,
      corps: { email, password: cfg.motDePasse },
    })
  ).access_token;

export async function creerClient(
  cle,
  { onboarding = true, prenom = 'Essai', nom = 'Paiement' } = {},
) {
  const email = `essai-${cle}@mfc.test`;
  const u = await appel('/auth/v1/admin/users', {
    methode: 'POST',
    corps: {
      email,
      password: cfg.motDePasse,
      email_confirm: true,
      user_metadata: { date_naissance: '1995-06-15', cgu_version_acceptee: '2026-09-04' },
    },
  });
  const jeton = await seConnecter(email);
  await appel('/rest/v1/rpc/creer_profil_client', {
    methode: 'POST',
    jeton,
    corps: { prenom, nom },
  });
  if (onboarding) {
    const patch = (corps) =>
      appel(`/rest/v1/profils_client?compte_id=eq.${u.id}`, {
        methode: 'PATCH',
        jeton,
        corps,
        entetes: { Prefer: 'return=minimal' },
      });
    await patch({
      objectifs: ['perdre-du-poids', 'mieux-manger'],
      rythme_hebdo: '3-4-fois',
      onboarding_etape: 3,
    });
    await patch({ onboarding_etape: 4 });
    await patch({ onboarding_etape: 5 });
  }
  return { email, id: u.id, jeton };
}
export async function offreYannick() {
  const [o] = await appel(
    `/rest/v1/offres?titre=eq.${encodeURIComponent('Suivi complet')}&publiee_le=not.is.null&retiree_le=is.null&select=id,coach_id`,
  );
  return o;
}
export async function lienPaiement(jeton, offreId, moyen) {
  const corps = { offreId, ...(moyen ? { moyen } : {}) };
  return (
    await appel('/functions/v1/abonnement-intention', {
      methode: 'POST',
      jeton,
      corps,
      entetes: { 'Idempotency-Key': randomUUID() },
    })
  ).urlPaiement;
}
export async function supprimerJetables() {
  const { users } = await appel('/auth/v1/admin/users?page=1&per_page=1000');
  const cibles = users.filter((x) => /^essai-.*@mfc\.test$/.test(x.email));
  for (const x of cibles) await appel(`/auth/v1/admin/users/${x.id}`, { methode: 'DELETE' });
  return cibles.map((x) => x.email);
}
export async function abonnementsDe(compteId) {
  const [pc] = await appel(`/rest/v1/profils_client?compte_id=eq.${compteId}&select=id`);
  if (!pc) return [];
  return appel(`/rest/v1/abonnements?profil_client_id=eq.${pc.id}&select=statut,moyen,cree_le`);
}
