// L7, décision 1 (docs/prompts/L7.md) : aucune lecture du coach ne rend de donnée de santé —
// ni poids, ni tour de taille, ni ressenti d'effort, même agrégés. Le banc le prouve sur les
// réponses réelles (src/test/rls.banc.ts, « clients du coach ») ; ce test-ci le complète sur le
// SQL, pour toute fonction écrite plus tard.
//
// Règle balayée : pour la DERNIÈRE définition de chaque fonction qui désigne son appelant par
// mon_profil_coach_en_espace_coach (une fonction du coach), et pour toute fonction qu'elle appelle,
// de proche en proche, le corps ne mentionne aucune colonne ni table de santé.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DOSSIER_MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations');

// Les colonnes et tables de santé (docs/domaine.md §3.7, §3.12), et les fonctions qui les lisent.
const MOTIFS_SANTE = [
  /ressenti_effort/i,
  /mesures_corporelles/i,
  // poids_depart_grammes, poids_cible_grammes (profils_client) ; pas poids_octets (un média).
  /poids_(depart|cible)/i,
  /tour_de_taille/i,
  /\bmes_mesures\b/i,
  /\bserie_mesures\b/i,
];

type Definition = { nom: string; corps: string; fichier: string };

function dernieresDefinitions(): Map<string, Definition> {
  const definitions = new Map<string, Definition>();
  const fichiers = readdirSync(DOSSIER_MIGRATIONS)
    .filter((nom) => nom.endsWith('.sql'))
    .sort();
  const motif =
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\([\s\S]*?\bas\s+\$(\w*)\$([\s\S]*?)\$\2\$/gi;
  for (const fichier of fichiers) {
    const contenu = readFileSync(join(DOSSIER_MIGRATIONS, fichier), 'utf8');
    let correspondance: RegExpExecArray | null;
    while ((correspondance = motif.exec(contenu))) {
      const nom = correspondance[1].toLowerCase();
      definitions.set(nom, { nom, corps: correspondance[3], fichier });
    }
  }
  return definitions;
}

// Les fonctions publiques appelées par un corps : « public.nom( ».
function appelees(corps: string): string[] {
  return [...corps.matchAll(/public\.([a-z0-9_]+)\s*\(/gi)].map((m) => m[1].toLowerCase());
}

describe('aucune fonction du coach n’atteint une donnée de santé (L7, décision 1)', () => {
  const definitions = dernieresDefinitions();
  const duCoach = [...definitions.values()].filter((d) =>
    /mon_profil_coach_en_espace_coach\s*\(/i.test(d.corps),
  );

  it('trouve bien les fonctions du coach de L7 (le balayage n’est pas vide)', () => {
    const noms = duCoach.map((d) => d.nom);
    for (const nom of [
      'mes_clients',
      'mes_anciens_clients',
      'fiche_client',
      'enregistrer_notes_client',
      'mon_pilotage',
    ]) {
      expect(noms).toContain(nom);
    }
  });

  it('suit les appels de proche en proche (le calcul partagé est bien balayé)', () => {
    const atteintes = atteintesDepuis(duCoach.map((d) => d.nom));
    expect(atteintes).toContain('metriques_seances');
    expect(atteintes).toContain('jour_sans_acces');
  });

  it('sait reconnaître une fonction qui lit une donnée de santé (le motif n’est pas aveugle)', () => {
    const fautive = definitions.get('mes_mesures');
    expect(fautive).toBeDefined();
    expect(MOTIFS_SANTE.some((m) => m.test(fautive?.corps ?? ''))).toBe(true);
  });

  it('aucune fonction atteinte depuis une fonction du coach ne mentionne une donnée de santé', () => {
    const fautives = atteintesDepuis(duCoach.map((d) => d.nom))
      .map((nom) => definitions.get(nom))
      .filter((d): d is Definition => d !== undefined)
      .filter((d) => MOTIFS_SANTE.some((m) => m.test(d.corps)))
      .map((d) => `${d.nom} (${d.fichier})`);
    expect(fautives).toEqual([]);
  });

  function atteintesDepuis(depart: string[]): string[] {
    const vues = new Set<string>();
    const pile = [...depart];
    while (pile.length > 0) {
      const nom = pile.pop() as string;
      if (vues.has(nom)) continue;
      vues.add(nom);
      const definition = definitions.get(nom);
      if (definition) pile.push(...appelees(definition.corps));
    }
    return [...vues];
  }
});
