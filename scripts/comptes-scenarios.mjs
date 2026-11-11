// Comptes de SCÉNARIO sur le projet Supabase de développement (2 novembre 2026) : un compte par
// état à éprouver à la main (coach à chaque étape de sa vérification, client à chaque étape de
// son abonnement, examinateur, avis publié), pour ne plus fabriquer les comptes à chaque séance.
//
//   npm run comptes:scenarios               crée ou complète les comptes, idempotent ;
//                                           écrit comptes-scenarios.local.md (ignoré par git)
//   npm run comptes:scenarios:paiements     ouvre les trois paiements à faire à la main
//   npm run comptes:scenarios:supprimer     efface les comptes « scenario-* »
//
// Même forme que scripts/comptes-test-durables.mjs (P1.5) : préfixe distinct (« scenario- »,
// domaine mfc.test non routable), donc ni le banc RLS ni son nettoyage ni les comptes durables
// n'y touchent ; même garde de projet ; même mot de passe commun, lu dans .secrets-rls.local
// (COMPTES_TEST_MOT_DE_PASSE), jamais en clair ici.
//
// UNE DIFFÉRENCE AVEC P1.5, VOULUE : tout passe par le CHEMIN DE L'APPLICATION, avec la session
// de chaque compte (les mêmes requêtes que src/services/donnees/supabase.ts) — creer_profil_client,
// creer_profil_coach, les écritures d'onboarding, le dépôt des pièces (soumission automatique,
// 0053), la décision par un vrai examinateur (decider_verification_coach), l'offre et
// publier_offre, l'intention de paiement (abonnement-intention), demander_pause,
// demander_resiliation, le dépôt d'avis (Edge Function avis). Le rôle serveur ne sert qu'à :
//   - créer les comptes déjà confirmés (sinon un courriel par compte, 2 par heure sur le dev) ;
//   - LIRE l'état, pour savoir quelle étape reste à faire et pour écrire le fichier ;
//   - UNE fabrication, nommée et étiquetée là où elle a lieu : la date de début du suivi de
//     l'abonnement résilié, antidatée pour que l'avis soit possible (voir antidaterSuivi).
// La promotion de l'examinateur passe par scripts/promouvoir-examinateur.sh, le chemin officiel.
//
// Ce qui N'EST PAS atteignable (décision du développeur, 2 novembre 2026) : l'abonnement impayé.
// Il faut un prélèvement échoué à l'échéance suivante, un mois plus tard (docs/dette.md).
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PREFIXE_EMAIL = 'scenario-';
const DOMAINE_EMAIL = 'mfc.test';
const REFERENCE_PROJET_AUTORISEE = 'imzdtntaqbtymoacsxua';
const DATE_NAISSANCE = '1995-06-15';
const VERSION_CGU = '2026-09-04';
// Le numéro des coachs de test, celui du banc RLS (src/test/rls.banc.ts) : creer_profil_coach
// l'exige (docs/domaine.md §3.1), aucun écran ne l'affiche.
const TELEPHONE_TEST = '0612345678';
const FICHIER_LISIBLE = path.join(racine, 'comptes-scenarios.local.md');
const TYPES_PIECES = ['identite', 'diplome_ou_certification', 'assurance_rc_pro'];
// Un PDF minimal mais valide : le back-office l'ouvre comme une vraie pièce.
const PDF_TEST = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

// Noms, disciplines, offre et avis : tous tirés de src/fixtures/demonstration.ts (CLAUDE.md §4,
// aucune valeur de contenu inventée). Le jeu n'a que six coachs et cinq clients pour douze comptes
// nommés : plusieurs comptes portent donc le même nom, et seule l'adresse les distingue.
const OFFRE_YANNICK = {
  titre: 'Suivi complet',
  description:
    "Je remets en mouvement les gens qui n'aiment pas les salles de sport. 12 ans de préparation physique, dont 4 en rééducation. On avance par paliers, sans culpabilité — et tu me dis tout, même les semaines ratées.",
  prix_centimes: 4900,
  benefices: [
    'Programme adapté chaque semaine',
    '1 visio de 30 min par mois',
    'Messagerie avec ton coach, réponse en 24 h',
  ],
  // Les libellés que l'écran de création envoie (ENGAGEMENTS_POSSIBLES, ecran-creation-offre.tsx).
  engagement_humain: ['ajustement hebdomadaire', 'visio mensuelle'],
  est_mise_en_avant: true,
};
const AVIS_SOPHIE = {
  note: 5,
  etiquettes: [],
  texte:
    'Trois mois et je ne rate plus une séance. Il ajuste dès que je bloque, et il ne me sort jamais le discours "no pain no gain".',
};

const COACH_YANNICK = { prenom: 'Yannick', nom: 'Berthaud', discipline: 'préparation physique' };

// `coach.dossier` : l'état visé du dossier de vérification. `client.etape` : l'étape d'onboarding
// visée (1 = profil créé à l'étape 2 et abandonné, 5 = terminé). `abonnement` : l'état visé de
// l'abonnement à l'offre de Yannick, atteint après un VRAI paiement (mode --paiements).
const COMPTES = [
  { cle: 'examinateur', examinateur: true, usage: 'back-office : /admin/verification' },
  {
    cle: 'coach-sans-dossier',
    coach: { prenom: 'Thomas', nom: 'Kieffer', discipline: 'développement professionnel' },
    dossier: 'absente',
    usage: 'coach seul, aucune pièce déposée',
  },
  {
    cle: 'coach-en-examen',
    coach: { prenom: 'Ophélie', nom: 'Renard', discipline: 'cuisine' },
    dossier: 'en_examen',
    usage: 'dossier en examen, visible dans la file du back-office',
  },
  {
    cle: 'coach-complement',
    coach: { prenom: 'Marc', nom: 'Ferreira', discipline: 'RGPD' },
    dossier: 'complement_demande',
    usage: 'l’examinateur demande un complément',
  },
  {
    cle: 'coach-refuse',
    coach: { prenom: 'Bruno', nom: 'Talbot', discipline: 'préparation physique' },
    dossier: 'refusee',
    usage: 'dossier refusé (impasse jusqu’à A2, docs/dette.md)',
  },
  {
    cle: 'coach-verifie',
    coach: { prenom: 'Nadia', nom: 'Belkacem', discipline: 'cybersécurité' },
    dossier: 'verifiee',
    usage: 'coach vérifiée, aucune offre publiée',
  },
  {
    cle: 'coach-offre',
    coach: COACH_YANNICK,
    dossier: 'verifiee',
    offre: true,
    usage: 'coach vérifié, offre « Suivi complet » publiée : les abonnements le visent',
  },
  {
    cle: 'coach-seul',
    coach: { prenom: 'Léa', nom: 'Nguyen', discipline: 'nutrition' },
    dossier: 'absente',
    usage:
      'À USAGE UNIQUE : feuille → « Espace client » mène à l’onboarding client (option B). ' +
      'Une fois essayé, le compte a un profil client : --supprimer puis relancer pour le retrouver',
  },
  {
    cle: 'duo',
    client: { prenom: 'Inès', nom: 'Marchand', etape: 5 },
    coach: { prenom: 'Inès', nom: 'Marchand', discipline: 'yoga' },
    dossier: 'absente',
    actif: 'client',
    usage: 'les deux profils, bascule dans les deux sens',
  },
  {
    cle: 'coach-onboarding-client-abandonne',
    coach: { prenom: 'Karim', nom: 'Osei', discipline: 'cuisine' },
    client: { prenom: 'Karim', nom: 'Osei', etape: 1 },
    dossier: 'absente',
    actif: 'coach',
    usage:
      'coach qui a quitté l’onboarding client à l’étape 2 : la bascule vers le client doit reprendre l’étape 2',
  },
  { cle: 'client-neuf', usage: 'aucun profil : onboarding client, étape 1' },
  {
    cle: 'attente',
    emailNonConfirme: true,
    usage: 'adresse non confirmée : écran « Regarde tes e-mails. »',
  },
  {
    cle: 'client-sans-abonnement',
    client: { prenom: 'Léa', nom: 'Nguyen', etape: 5 },
    usage: 'onboarding terminé, aucun abonnement',
  },
  {
    cle: 'client-actif',
    client: { prenom: 'Camille', nom: 'Dupré', etape: 5 },
    abonnement: 'actif',
    usage: 'abonnée à Yannick, abonnement actif',
  },
  {
    cle: 'client-pause',
    client: { prenom: 'Karim', nom: 'Osei', etape: 5 },
    abonnement: 'en_pause',
    usage: 'abonné à Yannick, abonnement en pause',
  },
  {
    cle: 'client-resilie',
    client: { prenom: 'Sophie', nom: 'Lambert', etape: 5 },
    abonnement: 'resilie',
    avis: true,
    usage: 'abonnement résilié, a publié l’avis visible sur le profil de Yannick',
  },
];

// ---------------------------------------------------------------------------------------------
// Configuration et garde de projet (identiques à scripts/comptes-test-durables.mjs)
// ---------------------------------------------------------------------------------------------

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
  // La fabrication de la date passe par `supabase db query --linked`, qui vise le projet LIÉ :
  // il doit être le même.
  const lie = existsSync(path.join(racine, 'supabase/.temp/project-ref'))
    ? readFileSync(path.join(racine, 'supabase/.temp/project-ref'), 'utf8').trim()
    : '';
  if (lie !== REFERENCE_PROJET_AUTORISEE) {
    console.error(`GARDE DE SECURITE : le projet lié (« ${lie} ») n'est pas le dev. Refuse.`);
    process.exit(1);
  }

  return { apiUrl: apiUrl.replace(/\/$/, ''), cleAdmin, cleAnon, motDePasse };
}

const emailDe = (cle) => `${PREFIXE_EMAIL}${cle}@${DOMAINE_EMAIL}`;

// ---------------------------------------------------------------------------------------------
// Appels : rôle serveur (création de compte, lecture seule) et session de l'utilisateur
// ---------------------------------------------------------------------------------------------

async function appel(cfg, chemin, { methode = 'GET', jeton, corps, prefer, entetes = {} } = {}) {
  const cle = jeton ? cfg.cleAnon : cfg.cleAdmin;
  const r = await fetch(`${cfg.apiUrl}${chemin}`, {
    method: methode,
    headers: {
      apikey: cle,
      Authorization: `Bearer ${jeton ?? cfg.cleAdmin}`,
      ...(corps !== undefined && !Buffer.isBuffer(corps)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(prefer ? { Prefer: prefer } : {}),
      ...entetes,
    },
    body: corps === undefined ? undefined : Buffer.isBuffer(corps) ? corps : JSON.stringify(corps),
  });
  const texte = await r.text();
  let donnees = null;
  try {
    donnees = texte ? JSON.parse(texte) : null;
  } catch {
    donnees = texte;
  }
  if (!r.ok) throw new Error(`${methode} ${chemin} : ${r.status} ${texte.slice(0, 300)}`);
  return donnees;
}

// Lecture seule par le rôle serveur : jamais une écriture d'état.
const lire = (cfg, chemin) => appel(cfg, `/rest/v1/${chemin}`);
const rpc = (cfg, jeton, nom, args = {}) =>
  appel(cfg, `/rest/v1/rpc/${nom}`, { methode: 'POST', jeton, corps: args });

async function listerComptes(cfg) {
  const comptes = [];
  for (let page = 1; ; page += 1) {
    const { users } = await appel(cfg, `/auth/v1/admin/users?page=${page}&per_page=200`);
    if (!users || users.length === 0) break;
    comptes.push(...users);
    if (users.length < 200) break;
  }
  return comptes;
}

async function assurerCompte(cfg, existants, def) {
  const email = emailDe(def.cle);
  const existant = existants.find((u) => u.email === email);
  if (existant) return { id: existant.id, cree: false };
  const cree = await appel(cfg, '/auth/v1/admin/users', {
    methode: 'POST',
    corps: {
      email,
      password: cfg.motDePasse,
      email_confirm: !def.emailNonConfirme,
      user_metadata: { date_naissance: DATE_NAISSANCE, cgu_version_acceptee: VERSION_CGU },
    },
  });
  return { id: cree.id, cree: true };
}

async function seConnecter(cfg, email) {
  const r = await appel(cfg, '/auth/v1/token?grant_type=password', {
    methode: 'POST',
    jeton: cfg.cleAnon,
    corps: { email, password: cfg.motDePasse },
  });
  return r.access_token;
}

const aujourdhuiParis = (decalageJours = 0) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(
    new Date(Date.now() + decalageJours * 86_400_000),
  );

// ---------------------------------------------------------------------------------------------
// Les étapes, par le chemin de l'application
// ---------------------------------------------------------------------------------------------

async function assurerProfilClient(cfg, jeton, compteId, client, journal) {
  let [ligne] = await lire(cfg, `profils_client?compte_id=eq.${compteId}&select=onboarding_etape`);
  if (!ligne) {
    await rpc(cfg, jeton, 'creer_profil_client', { prenom: client.prenom, nom: client.nom });
    journal.push('profil client (creer_profil_client)');
    ligne = { onboarding_etape: 2 };
  }
  // Mêmes PATCH que l'adaptateur (enregistrerObjectifsEtRythme, enregistrerPointDeDepart sans
  // poids — aucune donnée de santé dans ces comptes —, terminerOnboarding), filtrés par compte_id.
  const patcher = (corps) =>
    appel(cfg, `/rest/v1/profils_client?compte_id=eq.${compteId}`, {
      methode: 'PATCH',
      jeton,
      corps,
      prefer: 'return=minimal',
    });
  if (client.etape >= 5) {
    if (ligne.onboarding_etape < 3) {
      await patcher({
        objectifs: ['perdre-du-poids', 'mieux-manger'],
        rythme_hebdo: '3-4-fois',
        onboarding_etape: 3,
      });
    }
    if (ligne.onboarding_etape < 4) await patcher({ onboarding_etape: 4 });
    if (ligne.onboarding_etape < 5) {
      await patcher({ onboarding_etape: 5 });
      journal.push('onboarding terminé');
    }
  }
}

async function deposerPieces(cfg, jeton, coachId, journal) {
  const deja = new Set(
    (await lire(cfg, `pieces_verification?coach_id=eq.${coachId}&select=type`)).map((p) => p.type),
  );
  for (const type of TYPES_PIECES.filter((t) => !deja.has(t))) {
    // Même chemin que deposerPieceVerification : un chemin demandé au serveur, le fichier vers
    // Storage avec la session du coach, puis la ligne.
    const chemin = await rpc(cfg, jeton, 'nouveau_chemin_stockage');
    await appel(cfg, `/storage/v1/object/pieces-verification/${chemin}`, {
      methode: 'POST',
      jeton,
      corps: PDF_TEST,
      entetes: { 'Content-Type': 'application/pdf' },
    });
    await appel(cfg, '/rest/v1/pieces_verification', {
      methode: 'POST',
      jeton,
      corps: { coach_id: coachId, type, chemin_stockage: chemin },
      prefer: 'return=minimal',
    });
  }
  if (deja.size < TYPES_PIECES.length) journal.push('trois pièces déposées → en examen (0053)');
}

async function assurerCoach(cfg, jeton, compteId, def, jetonExaminateur, journal) {
  const [profil] = await lire(cfg, `profils_coach?compte_id=eq.${compteId}&select=id`);
  if (!profil) {
    await rpc(cfg, jeton, 'creer_profil_coach', {
      discipline: def.coach.discipline,
      telephone: TELEPHONE_TEST,
      prenom: def.coach.prenom,
      nom: def.coach.nom,
    });
    journal.push('profil coach (creer_profil_coach)');
  }
  const coachId = await rpc(cfg, jeton, 'mon_profil_coach_id');
  if (def.dossier !== 'absente') {
    const [{ statut }] = await rpc(cfg, jeton, 'mon_dossier_verification');
    if (statut === 'absente') await deposerPieces(cfg, jeton, coachId, journal);
    const [{ statut: apresDepot }] = await rpc(cfg, jeton, 'mon_dossier_verification');
    if (def.dossier !== 'en_examen' && apresDepot === 'en_examen') {
      await rpc(cfg, jetonExaminateur, 'decider_verification_coach', {
        p_coach_id: coachId,
        p_decision: def.dossier,
        p_motif: `Compte de scénario : décision « ${def.dossier} » de démonstration.`,
      });
      journal.push(`décision de l’examinateur : ${def.dossier}`);
    }
  }
  if (def.offre) {
    const publiees = await lire(
      cfg,
      `offres?coach_id=eq.${coachId}&publiee_le=not.is.null&retiree_le=is.null&select=id`,
    );
    if (publiees.length === 0) {
      const [offre] = await appel(cfg, '/rest/v1/offres?select=id', {
        methode: 'POST',
        jeton,
        corps: { coach_id: coachId, ...OFFRE_YANNICK },
        prefer: 'return=representation',
      });
      await rpc(cfg, jeton, 'publier_offre', { offre_id: offre.id });
      journal.push('offre « Suivi complet » publiée (publier_offre)');
    }
  }
  return coachId;
}

async function abonnementDe(cfg, compteId) {
  const [client] = await lire(cfg, `profils_client?compte_id=eq.${compteId}&select=id`);
  if (!client) return null;
  const [abonnement] = await lire(
    cfg,
    `abonnements?profil_client_id=eq.${client.id}&statut=neq.annule&order=cree_le.desc&limit=1&select=id,statut,actif_depuis_le`,
  );
  return abonnement ?? null;
}

// ⚠️ FABRIQUÉ, PAS LE CHEMIN DE L'APPLICATION ⚠️
// Le seul état fabriqué de ce jeu (décision du développeur, 2 novembre 2026). Un avis exige au
// moins 30 jours de suivi (eligibilite_avis, 0049) : aucun abonnement réel ne les a encore. On
// ANTIDATE donc ici, par une requête SQL directe, la date de début du suivi de l'abonnement
// résilié (abonnements.actif_depuis_le, 35 jours en arrière). Tout le reste de ce scénario passe
// par le vrai chemin : le paiement, la pause, la résiliation, et le dépôt de l'avis lui-même (Edge
// Function avis, session de la cliente). Mais l'éligibilité, elle, est fabriquée : ce compte NE
// PROUVE PAS que le dépôt d'avis fonctionne pour un vrai suivi de 30 jours (docs/dette.md).
function antidaterSuivi(abonnementId) {
  if (!/^[0-9a-f-]{36}$/.test(abonnementId)) throw new Error('identifiant d’abonnement inattendu');
  const resultat = spawnSync(
    'npx',
    [
      'supabase',
      'db',
      'query',
      '--linked',
      `update public.abonnements set actif_depuis_le = now() - interval '35 days' where id = '${abonnementId}' and statut = 'resilie';`,
    ],
    { cwd: racine, encoding: 'utf8' },
  );
  if (resultat.status !== 0 || /"_tag":"Error"/.test(resultat.stdout ?? '')) {
    throw new Error(
      `antidatage refusé : ${(resultat.stdout || resultat.stderr || '').slice(0, 300)}`,
    );
  }
}

async function amenerAbonnement(cfg, jeton, compteId, def, coachYannickId, journal) {
  let abonnement = await abonnementDe(cfg, compteId);
  if (!abonnement) return 'en attente du paiement (npm run comptes:scenarios:paiements)';
  if (abonnement.statut === 'en_attente_confirmation') return 'en attente de confirmation';
  const id = abonnement.id;

  if (def.abonnement === 'en_pause' && abonnement.statut === 'actif') {
    await rpc(cfg, jeton, 'demander_pause', {
      p_abonnement_id: id,
      p_jusqu_au: aujourdhuiParis(30),
    });
    journal.push('pause demandée (demander_pause)');
  }
  if (def.abonnement === 'resilie') {
    if (abonnement.statut === 'actif') {
      // Depuis une pause, la résiliation prend effet le jour même (docs/domaine.md §4.3) : c'est
      // ce qui permet d'atteindre « résilié » sans attendre la fin d'une période payée.
      await rpc(cfg, jeton, 'demander_pause', {
        p_abonnement_id: id,
        p_jusqu_au: aujourdhuiParis(30),
      });
      journal.push('pause demandée (demander_pause)');
      abonnement = await abonnementDe(cfg, compteId);
    }
    if (abonnement.statut === 'en_pause') {
      await rpc(cfg, jeton, 'demander_resiliation', { p_abonnement_id: id });
      journal.push('résiliation (demander_resiliation)');
    }
  }
  if (def.avis) {
    abonnement = await abonnementDe(cfg, compteId);
    const [client] = await lire(cfg, `profils_client?compte_id=eq.${compteId}&select=id`);
    const avis = await lire(cfg, `avis?profil_client_id=eq.${client.id}&select=id`);
    if (abonnement.statut === 'resilie' && avis.length === 0) {
      antidaterSuivi(abonnement.id); // ⚠️ FABRIQUÉ — voir le commentaire de antidaterSuivi
      journal.push('⚠️ début du suivi ANTIDATÉ de 35 jours (fabriqué)');
      await appel(cfg, '/functions/v1/avis', {
        methode: 'POST',
        jeton,
        corps: { coachId: coachYannickId, ...AVIS_SOPHIE },
      });
      journal.push('avis déposé (Edge Function avis)');
    }
  }
  return (await abonnementDe(cfg, compteId)).statut;
}

// ---------------------------------------------------------------------------------------------
// Les modes
// ---------------------------------------------------------------------------------------------

async function promouvoirExaminateur(email) {
  const r = spawnSync('bash', [path.join(racine, 'scripts/promouvoir-examinateur.sh'), email], {
    cwd: racine,
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`promotion refusée : ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

async function construire(cfg) {
  const existants = await listerComptes(cfg);
  const resultats = [];
  const ids = {};
  const jetons = {};

  // L'examinateur d'abord : les décisions des coachs passent par lui.
  for (const def of COMPTES) {
    const { id, cree } = await assurerCompte(cfg, existants, def);
    ids[def.cle] = id;
    const journal = cree ? ['compte créé'] : [];
    if (def.examinateur) {
      const sortie = await promouvoirExaminateur(emailDe(def.cle));
      if (sortie.startsWith('Promu')) journal.push('promu examinateur (promouvoir-examinateur.sh)');
    }
    resultats.push({ def, journal });
  }
  jetons.examinateur = await seConnecter(cfg, emailDe('examinateur'));

  let coachYannickId = null;
  for (const r of resultats) {
    const { def, journal } = r;
    if (def.examinateur || def.emailNonConfirme || (!def.coach && !def.client)) continue;
    const jeton = await seConnecter(cfg, emailDe(def.cle));
    jetons[def.cle] = jeton;
    // Le duo crée son profil client d'abord (il atterrira côté client) ; le coach qui a quitté
    // l'onboarding client crée son profil coach d'abord, puis son profil client.
    if (def.client && def.actif === 'client') {
      await assurerProfilClient(cfg, jeton, ids[def.cle], def.client, journal);
    }
    if (def.coach) {
      const coachId = await assurerCoach(
        cfg,
        jeton,
        ids[def.cle],
        def,
        jetons.examinateur,
        journal,
      );
      if (def.offre) coachYannickId = coachId;
    }
    if (def.client && def.actif !== 'client') {
      await assurerProfilClient(cfg, jeton, ids[def.cle], def.client, journal);
    }
    // Remet l'espace visé : creer_profil_client et creer_profil_coach activent chacun le leur.
    if (def.actif) {
      const [{ profil_actif }] = await lire(
        cfg,
        `comptes?id=eq.${ids[def.cle]}&select=profil_actif`,
      );
      if (profil_actif !== def.actif) {
        await rpc(cfg, jeton, 'basculer_profil', { profil: def.actif });
        journal.push(`espace actif → ${def.actif} (basculer_profil)`);
      }
    }
  }

  for (const r of resultats) {
    if (!r.def.abonnement) continue;
    r.abonnement = await amenerAbonnement(
      cfg,
      jetons[r.def.cle],
      ids[r.def.cle],
      r.def,
      coachYannickId,
      r.journal,
    );
  }
  return { resultats, ids };
}

// Le relais des événements Stripe : le projet de dev n'a AUCUN point de terminaison Stripe, il ne
// reçoit les événements que par `stripe listen` lancé sur la machine (docs/backend.md §12). Sans
// lui, le paiement réussit chez Stripe et l'abonnement n'est jamais créé. Trouvé le 3 novembre
// 2026 : trois paiements faits, aucun abonnement — le relais n'était dit nulle part. Les liens ne
// sont donc ouverts que si un relais tourne, vers CE webhook, avec checkout.session.completed.
// Ce contrôle prouve qu'un processus tourne, pas que son secret de signature est le bon : celui-là
// se compare par empreinte (docs/dette.md, ligne du relais).
const URL_WEBHOOK_DEV = `https://${REFERENCE_PROJET_AUTORISEE}.supabase.co/functions/v1/webhook-paiement`;

function relaisStripeEnMarche() {
  const r = spawnSync('pgrep', ['-fl', 'stripe listen'], { encoding: 'utf8' });
  return (r.stdout ?? '')
    .split('\n')
    .some(
      (ligne) => ligne.includes(URL_WEBHOOK_DEV) && ligne.includes('checkout.session.completed'),
    );
}

function exigerRelaisStripe() {
  if (!relaisStripeEnMarche()) {
    console.error(
      'REFUSÉ : aucun relais Stripe ne tourne vers le webhook du projet de dev. Sans lui, un ' +
        'paiement réussit chez Stripe mais ne crée jamais l’abonnement.\n' +
        'Lance-le dans un autre terminal, laisse-le tourner, puis relance cette commande :\n' +
        '  npm run relais:stripe',
    );
    process.exit(1);
  }
}

async function ouvrirPaiements(cfg) {
  const [offre] = await lire(
    cfg,
    `offres?titre=eq.${encodeURIComponent(OFFRE_YANNICK.titre)}&publiee_le=not.is.null&retiree_le=is.null&select=id,coach_id`,
  );
  if (!offre)
    throw new Error('Offre de Yannick introuvable : lance d’abord npm run comptes:scenarios');
  const liens = [];
  for (const def of COMPTES.filter((c) => c.abonnement)) {
    const [{ id: compteId }] = (await listerComptes(cfg)).filter(
      (u) => u.email === emailDe(def.cle),
    );
    if (await abonnementDe(cfg, compteId)) {
      liens.push({ def, deja: true });
      continue;
    }
    const jeton = await seConnecter(cfg, emailDe(def.cle));
    // Même appel que demanderIntention (04a) : l'Edge Function abonnement-intention, la session
    // de la cliente, une clé d'idempotence par essai.
    const intention = await appel(cfg, '/functions/v1/abonnement-intention', {
      methode: 'POST',
      jeton,
      corps: { offreId: offre.id },
      // Un UUID, comme l'application (l'Edge Function refuse tout autre format :
      // cle_idempotence_requise). Corrigé le 3 novembre 2026 : la première version envoyait
      // « scenario-<compte>-<heure> », refusé avant toute création d'intention.
      entetes: { 'Idempotency-Key': randomUUID() },
    });
    liens.push({ def, url: intention.urlPaiement });
  }
  return liens;
}

function ecrireFichier(cfg, { resultats }, liens = null) {
  const lignes = [
    '# Comptes de scénario — projet de développement',
    '',
    `Écrit par \`scripts/comptes-scenarios.mjs\` le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}.`,
    'Ce fichier est ignoré par git (`.gitignore`). Ne le copie nulle part.',
    '',
    `**Mot de passe commun à tous les comptes :** \`${cfg.motDePasse}\``,
    '',
    '| Adresse | Usage | Ce qui a été fait à cette exécution |',
    '|---|---|---|',
  ];
  for (const { def, journal, abonnement } of resultats) {
    const etat = abonnement ? ` — abonnement : **${abonnement}**` : '';
    lignes.push(
      `| \`${emailDe(def.cle)}\` | ${def.usage}${etat} | ${journal.length ? journal.join(' ; ') : 'déjà à jour'} |`,
    );
  }
  lignes.push(
    '',
    '## ⚠️ Fabriqué, pas le chemin de l’application',
    '',
    `L’avis de \`${emailDe('client-resilie')}\` repose sur une date **antidatée** : le début de son`,
    'suivi a été reculé de 35 jours par une requête SQL directe, parce qu’un avis exige 30 jours',
    'de suivi et qu’aucun abonnement réel ne les a encore. Le paiement, la pause, la résiliation et',
    'le dépôt de l’avis sont réels ; **l’éligibilité ne l’est pas**. Ce compte ne prouve pas que le',
    'dépôt d’avis fonctionne pour un vrai suivi (docs/dette.md).',
    '',
    '## Absent de ce jeu',
    '',
    '- **Abonnement impayé** : il faut un prélèvement échoué à l’échéance suivante, un mois plus',
    '  tard. Non fabriqué (décision du 2 novembre 2026).',
  );
  if (liens) {
    lignes.push(
      '',
      '## Paiements à faire, dans cet ordre',
      '',
      `Liens ouverts le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}, **valables 31 minutes**.`,
      'Carte de test : `4242 4242 4242 4242`, n’importe quelle date future, n’importe quel code.',
      'Garde ton `npm start` ouvert : la page de paiement te ramène sur `http://localhost:8081`.',
      '',
      '**Le relais des événements Stripe doit tourner** jusqu’à la fin des trois paiements',
      '(`npm run relais:stripe`, dans un autre terminal ; ces liens n’ont été créés que parce',
      'qu’il tournait). Sans lui, le paiement réussit chez Stripe mais l’abonnement n’est jamais',
      'créé : le projet de dev n’a aucun point de terminaison Stripe (docs/backend.md §12).',
      '',
    );
    liens.forEach(({ def, url, deja }, i) => {
      lignes.push(
        deja
          ? `${i + 1}. \`${emailDe(def.cle)}\` : déjà abonné, rien à payer.`
          : `${i + 1}. \`${emailDe(def.cle)}\` (${def.usage}) : ${url}`,
      );
    });
    lignes.push(
      '',
      '**Après les trois paiements**, relance `npm run comptes:scenarios` : il met en pause',
      `l’abonnement de \`${emailDe('client-pause')}\`, résilie celui de`,
      `\`${emailDe('client-resilie')}\` et dépose son avis.`,
    );
  }
  writeFileSync(FICHIER_LISIBLE, lignes.join('\n') + '\n', { mode: 0o600 });
}

async function supprimer(cfg) {
  const cibles = (await listerComptes(cfg)).filter(
    (u) =>
      (u.email ?? '').startsWith(PREFIXE_EMAIL) && (u.email ?? '').endsWith(`@${DOMAINE_EMAIL}`),
  );
  for (const u of cibles) {
    try {
      await appel(cfg, `/auth/v1/admin/users/${u.id}`, { methode: 'DELETE' });
      console.log(`supprimé : ${u.email}`);
    } catch (e) {
      console.error(`NON supprimé : ${u.email} — ${e.message}`);
      process.exitCode = 1;
    }
  }
}

const cfg = chargerConfiguration();
const mode = process.argv[2];
if (mode === '--supprimer') {
  await supprimer(cfg);
} else if (mode === '--paiements') {
  // En tout premier : refuser AVANT toute connexion ni écriture (trouvé le 3 novembre 2026, la
  // garde passait après une quinzaine de connexions, jusqu'à la limite de débit de Supabase).
  exigerRelaisStripe();
  const etat = await construire(cfg);
  const liens = await ouvrirPaiements(cfg);
  ecrireFichier(cfg, etat, liens);
  console.log(`Liens de paiement écrits dans ${path.basename(FICHIER_LISIBLE)} (valables 31 min).`);
} else {
  const etat = await construire(cfg);
  ecrireFichier(cfg, etat);
  for (const { def, journal, abonnement } of etat.resultats) {
    console.log(
      `${emailDe(def.cle)} : ${journal.length ? journal.join(' ; ') : 'déjà à jour'}${abonnement ? ` — ${abonnement}` : ''}`,
    );
  }
  console.log(`Adresses et mot de passe : ${path.basename(FICHIER_LISIBLE)}`);
}
