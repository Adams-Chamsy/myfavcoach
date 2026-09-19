import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Convention posée par 0006_verrouiller_grants.sql (revoke explicite avant tout grant étroit),
// étendue le 19 septembre 2026 après un troisième trou du même genre, trouvé par la CI sur une
// pile Supabase fraîche (jamais contre le projet de développement distant, dont le baseline est
// déjà vide) : `revoke ... from public` seul, ou `from public, anon, authenticated` sans
// `service_role`, ne retire pas un grant SÉPARÉ posé directement à un rôle nommé sur une pile
// dont le baseline en accorde un. Trouvé trois fois avant ce fichier — 0006 pour anon/
// authenticated sur les TABLES, la règle 11 de docs/prompts/L3bis.md (0009/0010/0014/0021/0023/
// 0025) pour service_role sur les TABLES, et 0030_verrouiller_grants_invitations.sql pour
// service_role sur les FONCTIONS — chaque fois par hasard, chaque fois tard, jamais par un test
// qui balaie tout le dépôt. Ce fichier remplace la mémoire par un balayage systématique de
// supabase/migrations/, trois règles :
//   1. toute fonction accordée (GRANT EXECUTE) à anon ou authenticated a, dans le MÊME fichier,
//      un REVOKE la précédant qui nomme explicitement public, anon, authenticated ET
//      service_role.
//   2. toute table créée (CREATE TABLE) a, quelque part dans supabase/migrations/, un GRANT
//      explicite à service_role (au moins un privilège, sur cette table nommément).
//   3. toute fonction SECURITY DEFINER fixe SET search_path = public dans sa propre définition
//      (docs/backend.md, trouvé à 0026 : sans ça, un appel non qualifié résout dans le schéma de
//      celui qui l'invoque, jamais garanti être `public`).
//
// Complète src/test/fonctions-execute-revoque.test.ts (docs/backend.md §4), qui vérifie une
// version plus faible de la règle 1 (un REVOKE existe, sans exiger la liste de rôles complète) —
// les deux fichiers restent utiles : celui-ci est le sur-ensemble strict, l'autre documente
// aussi l'exemption des fonctions déclencheur.

const DOSSIER_MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations');

function fichiersMigrations(): string[] {
  try {
    return readdirSync(DOSSIER_MIGRATIONS)
      .filter((nom) => nom.endsWith('.sql'))
      .sort()
      .map((nom) => join(DOSSIER_MIGRATIONS, nom));
  } catch {
    // Dossier absent : rien à balayer, ce n'est pas une erreur.
    return [];
  }
}

// Retire les commentaires "-- ligne" avant tout balayage : sans ça, une phrase de commentaire qui
// MENTIONNE "security definer" ou "revoke ... from public" en prose (trouvé réellement deux fois,
// 0024 et 0029, en préparant ce fichier) fausserait chaque règle ci-dessous. Jamais de "--" à
// l'intérieur d'une chaîne littérale dans ce dépôt (vérifié à l'œil) : heuristique sûre ici.
function sansCommentaires(sql: string): string {
  return sql.replace(/--[^\n]*/g, '');
}

const ROLES_REQUIS_AVANT_GRANT = ['public', 'anon', 'authenticated', 'service_role'];

function listeRoles(bloc: string): string[] {
  return bloc
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
// Règle 1 : revoke explicite (public, anon, authenticated, service_role) avant tout grant execute
// à anon/authenticated, dans le même fichier.
// ---------------------------------------------------------------------------------------------

type GrantFonction = { nom: string; roles: string[]; position: number };

function grantsExecuteVersAnonOuAuthenticated(sql: string): GrantFonction[] {
  const motif = /grant\s+execute\s+on\s+function\s+public\.(\w+)\s*\([^)]*\)\s+to\s+([^;]+);/gis;
  const resultats: GrantFonction[] = [];
  let correspondance: RegExpExecArray | null;
  while ((correspondance = motif.exec(sql))) {
    const roles = listeRoles(correspondance[2]);
    if (roles.includes('anon') || roles.includes('authenticated')) {
      resultats.push({ nom: correspondance[1], roles, position: correspondance.index });
    }
  }
  return resultats;
}

function revokesFonctions(sql: string): GrantFonction[] {
  const motif =
    /revoke\s+(?:all|execute)\s+on\s+function\s+public\.(\w+)\s*\([^)]*\)\s+from\s+([^;]+);/gis;
  const resultats: GrantFonction[] = [];
  let correspondance: RegExpExecArray | null;
  while ((correspondance = motif.exec(sql))) {
    resultats.push({
      nom: correspondance[1],
      roles: listeRoles(correspondance[2]),
      position: correspondance.index,
    });
  }
  return resultats;
}

function aUnRevokeCompletAvant(revokes: GrantFonction[], nom: string, position: number): boolean {
  return revokes.some(
    (revoke) =>
      revoke.nom === nom &&
      revoke.position < position &&
      ROLES_REQUIS_AVANT_GRANT.every((role) => revoke.roles.includes(role)),
  );
}

// ---------------------------------------------------------------------------------------------
// Règle 2 : toute table créée a, quelque part dans le dépôt, un grant explicite à service_role.
// ---------------------------------------------------------------------------------------------

function tablesCreees(sql: string): string[] {
  const motif = /create\s+table\s+public\.(\w+)/gi;
  const resultats: string[] = [];
  let correspondance: RegExpExecArray | null;
  while ((correspondance = motif.exec(sql))) {
    resultats.push(correspondance[1]);
  }
  return resultats;
}

function tablesAvecGrantServiceRole(sql: string): Set<string> {
  const motif = /grant\s+[a-z, ]+\s+on\s+public\.(\w+)\s+to\s+([^;]+);/gis;
  const resultats = new Set<string>();
  let correspondance: RegExpExecArray | null;
  while ((correspondance = motif.exec(sql))) {
    if (listeRoles(correspondance[2]).includes('service_role')) {
      resultats.add(correspondance[1]);
    }
  }
  return resultats;
}

// ---------------------------------------------------------------------------------------------
// Règle 3 : toute fonction SECURITY DEFINER fixe SET search_path = public, dans sa propre
// définition (jamais supposée héritée d'une fonction voisine).
// ---------------------------------------------------------------------------------------------

function definitionsDeFonctions(sql: string): string[] {
  // Non-gourmand jusqu'au premier "$$;" : chaque définition de ce dépôt se termine ainsi (jamais
  // de "$$" imbriqué dans le corps). Un balayage par bloc, pas par simple comptage global, pour
  // ne jamais confondre le "security definer" d'UNE fonction avec le search_path d'une AUTRE.
  const motif = /create\s+(?:or\s+replace\s+)?function\s+public\.\w+[\s\S]*?\$\$;/gi;
  return sql.match(motif) ?? [];
}

describe(
  'conventions de grants sur supabase/migrations/ (posées par 0006, étendues le 19 septembre ' +
    '2026 après le trou service_role de 0030)',
  () => {
    describe('règle 1 — revoke explicite (public, anon, authenticated, service_role) avant un grant à anon/authenticated', () => {
      // Le balayage doit pouvoir échouer : une fonction fautive (revoke incomplet), une fonction
      // correcte, et une fonction hors-cible (accordée seulement à service_role, jamais
      // concernée par cette règle) — avant de faire confiance au même mécanisme sur les vraies
      // migrations plus bas.
      it('détecte un grant à authenticated dont le revoke omet service_role', () => {
        const sql = [
          'revoke execute on function public.exemple() from public, anon, authenticated;',
          'grant execute on function public.exemple() to authenticated;',
        ].join('\n');
        const grants = grantsExecuteVersAnonOuAuthenticated(sql);
        const revokes = revokesFonctions(sql);
        expect(grants).toHaveLength(1);
        expect(aUnRevokeCompletAvant(revokes, grants[0].nom, grants[0].position)).toBe(false);
      });

      it('détecte un grant à anon dont le revoke ne nomme que public', () => {
        const sql = [
          'revoke execute on function public.exemple() from public;',
          'grant execute on function public.exemple() to anon, authenticated;',
        ].join('\n');
        const grants = grantsExecuteVersAnonOuAuthenticated(sql);
        const revokes = revokesFonctions(sql);
        expect(aUnRevokeCompletAvant(revokes, grants[0].nom, grants[0].position)).toBe(false);
      });

      it('détecte un revoke complet placé APRÈS le grant (ordre inversé)', () => {
        const sql = [
          'grant execute on function public.exemple() to authenticated;',
          'revoke execute on function public.exemple() from public, anon, authenticated, service_role;',
        ].join('\n');
        const grants = grantsExecuteVersAnonOuAuthenticated(sql);
        const revokes = revokesFonctions(sql);
        expect(aUnRevokeCompletAvant(revokes, grants[0].nom, grants[0].position)).toBe(false);
      });

      it('laisse passer un revoke complet, dans le bon ordre', () => {
        const sql = [
          'revoke execute on function public.exemple() from public, anon, authenticated, service_role;',
          'grant execute on function public.exemple() to authenticated;',
        ].join('\n');
        const grants = grantsExecuteVersAnonOuAuthenticated(sql);
        const revokes = revokesFonctions(sql);
        expect(aUnRevokeCompletAvant(revokes, grants[0].nom, grants[0].position)).toBe(true);
      });

      it('ignore une fonction accordée SEULE à service_role, jamais concernée par cette règle', () => {
        const sql = 'grant execute on function public.exemple() to service_role;';
        expect(grantsExecuteVersAnonOuAuthenticated(sql)).toEqual([]);
      });

      it("aucune migration réelle n'accorde execute à anon/authenticated sans un revoke complet la précédant", () => {
        // Seul le DERNIER grant de chaque fonction compte : une correction vit forcément dans une
        // migration ULTÉRIEURE (jamais une migration déjà appliquée, éditée sur place — docs/
        // backend.md §2), jamais dans le même fichier que le grant d'origine qu'elle corrige
        // (0030/0031 corrigent des fonctions créées par 0002 à 0027, chacune dans son propre
        // fichier). Un fichier plus récent écrase donc le verdict d'un fichier plus ancien pour
        // la même fonction — exactement ce que Postgres fait réellement en rejouant les
        // migrations dans l'ordre : le dernier revoke+grant décide de l'état final, jamais le
        // premier.
        const dernierVerdictParFonction = new Map<string, { fichier: string; conforme: boolean }>();
        for (const fichier of fichiersMigrations()) {
          const contenu = sansCommentaires(readFileSync(fichier, 'utf8'));
          const revokes = revokesFonctions(contenu);
          for (const g of grantsExecuteVersAnonOuAuthenticated(contenu)) {
            dernierVerdictParFonction.set(g.nom, {
              fichier,
              conforme: aUnRevokeCompletAvant(revokes, g.nom, g.position),
            });
          }
        }
        const coupables = [...dernierVerdictParFonction.entries()]
          .filter(([, { conforme }]) => !conforme)
          .map(([nom, { fichier }]) => `${fichier} : ${nom}() (dernier grant, encore fautif)`);
        expect(coupables).toEqual([]);
      });
    });

    describe('règle 2 — toute table créée a un grant explicite à service_role', () => {
      it('détecte une table créée sans aucun grant service_role', () => {
        const sql = 'create table public.exemple (id uuid primary key);';
        expect(tablesCreees(sql)).toEqual(['exemple']);
        expect(tablesAvecGrantServiceRole(sql).has('exemple')).toBe(false);
      });

      it('laisse passer une table avec un grant service_role, même minimal', () => {
        const sql = [
          'create table public.exemple (id uuid primary key);',
          'grant select on public.exemple to service_role;',
        ].join('\n');
        expect(tablesAvecGrantServiceRole(sql).has('exemple')).toBe(true);
      });

      it("aucune table réelle de supabase/migrations/ n'omet son grant service_role", () => {
        const contenus = fichiersMigrations().map((fichier) => ({
          fichier,
          contenu: sansCommentaires(readFileSync(fichier, 'utf8')),
        }));
        const toutesLesTables = contenus.flatMap(({ fichier, contenu }) =>
          tablesCreees(contenu).map((nom) => ({ fichier, nom })),
        );
        const tablesAccordees = new Set(
          contenus.flatMap(({ contenu }) => [...tablesAvecGrantServiceRole(contenu)]),
        );
        const coupables = toutesLesTables
          .filter(({ nom }) => !tablesAccordees.has(nom))
          .map(({ fichier, nom }) => `${fichier} : ${nom}`);
        expect(coupables).toEqual([]);
      });
    });

    describe('règle 3 — toute fonction SECURITY DEFINER fixe SET search_path = public', () => {
      it('détecte une fonction security definer sans search_path', () => {
        const sql =
          'create function public.exemple() returns int language sql security definer as $$ select 1; $$;';
        const [definition] = definitionsDeFonctions(sql);
        expect(/security\s+definer/i.test(definition)).toBe(true);
        expect(/set\s+search_path\s*=\s*public/i.test(definition)).toBe(false);
      });

      it('laisse passer une fonction security definer avec search_path', () => {
        const sql =
          'create function public.exemple() returns int language sql security definer set search_path = public as $$ select 1; $$;';
        const [definition] = definitionsDeFonctions(sql);
        expect(/set\s+search_path\s*=\s*public/i.test(definition)).toBe(true);
      });

      it("n'exige rien d'une fonction qui n'est pas security definer", () => {
        const sql =
          'create function public.exemple() returns int language sql security invoker as $$ select 1; $$;';
        const [definition] = definitionsDeFonctions(sql);
        expect(/security\s+definer/i.test(definition)).toBe(false);
      });

      it('ignore "security definer" mentionné en commentaire, hors de toute vraie définition', () => {
        // Trouvé réellement deux fois (0024, 0029) : un commentaire qui DISCUTE l'hypothèse
        // "si cette fonction passait un jour en security definer" ne doit jamais compter comme
        // une vraie fonction à vérifier -- d'où sansCommentaires() avant tout balayage.
        const sql = [
          '-- Si cette fonction passe un jour en security definer, il faudra revoir ce point.',
          'create function public.exemple() returns int language sql security invoker as $$ select 1; $$;',
        ].join('\n');
        const definitions = definitionsDeFonctions(sansCommentaires(sql));
        expect(definitions).toHaveLength(1);
        expect(/security\s+definer/i.test(definitions[0])).toBe(false);
      });

      it("aucune fonction security definer réelle de supabase/migrations/ n'omet search_path", () => {
        const coupables = fichiersMigrations().flatMap((fichier) => {
          const contenu = sansCommentaires(readFileSync(fichier, 'utf8'));
          return definitionsDeFonctions(contenu)
            .filter(
              (definition) =>
                /security\s+definer/i.test(definition) &&
                !/set\s+search_path\s*=\s*public/i.test(definition),
            )
            .map((definition) => {
              const nom = /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/i.exec(
                definition,
              )?.[1];
              return `${fichier} : ${nom ?? '(nom illisible)'}`;
            });
        });
        expect(coupables).toEqual([]);
      });
    });
  },
);
