import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// docs/backend.md §4 : toute vue du schema public est declaree WITH (security_invoker = true),
// sans exception. Sans cette option, une vue s'execute avec les droits de son PROPRIETAIRE et
// contourne les politiques RLS, silencieusement — verifie en conditions reelles avant
// 0001_creer_identite.sql (consentements_courants). La regle vaut plus que la correction
// ponctuelle : c'est la troisieme vue, dans huit mois, qui posera le probleme si personne ne s'en
// souvient.
const DOSSIER_MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations');

function fichiersMigrations(): string[] {
  try {
    return readdirSync(DOSSIER_MIGRATIONS)
      .filter((nom) => nom.endsWith('.sql'))
      .map((nom) => join(DOSSIER_MIGRATIONS, nom));
  } catch {
    // Dossier absent : rien a balayer, ce n'est pas une erreur (avant la toute premiere
    // migration, ou si le dossier est renomme un jour).
    return [];
  }
}

// Isole l'entete de chaque "CREATE [OR REPLACE] VIEW ... AS" — jusqu'au premier AS, le seul
// endroit ou WITH (security_invoker = true) peut apparaitre pour cette vue.
function entetesDeVues(contenuSql: string): string[] {
  const motif = /create\s+(or\s+replace\s+)?view\s+[\s\S]*?\bas\b/gi;
  return contenuSql.match(motif) ?? [];
}

function declareSecurityInvoker(enteteDeVue: string): boolean {
  return /security_invoker\s*=\s*true/i.test(enteteDeVue);
}

describe('toute vue déclare security_invoker = true (docs/backend.md §4)', () => {
  // Le balayage doit pouvoir echouer : ecrit exprès une entete fautive et une entete correcte,
  // avant de faire confiance au meme mecanisme sur les vraies migrations ci-dessous.
  it('détecte une vue écrite exprès sans security_invoker', () => {
    const entetes = entetesDeVues('create view public.exemple as select 1;');
    expect(entetes).toHaveLength(1);
    expect(declareSecurityInvoker(entetes[0])).toBe(false);
  });

  it('laisse passer une vue écrite exprès avec security_invoker', () => {
    const entetes = entetesDeVues(
      'create view public.exemple with (security_invoker = true) as select 1;',
    );
    expect(entetes).toHaveLength(1);
    expect(declareSecurityInvoker(entetes[0])).toBe(true);
  });

  it("aucune vue de supabase/migrations/ n'est déclarée sans security_invoker = true", () => {
    const coupables = fichiersMigrations().flatMap((fichier) => {
      const contenu = readFileSync(fichier, 'utf8');
      const entetesFautives = entetesDeVues(contenu).filter((e) => !declareSecurityInvoker(e));
      return entetesFautives.map((entete) => `${fichier} : ${entete.trim().slice(0, 80)}`);
    });
    expect(coupables).toEqual([]);
  });
});
