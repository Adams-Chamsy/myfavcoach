import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// docs/backend.md §4 : toute fonction du schema public appelable directement est suivie d'un
// REVOKE EXECUTE ... FROM PUBLIC, puis d'un GRANT EXECUTE explicite. Postgres accorde EXECUTE
// a PUBLIC a la creation d'une fonction — sans ce REVOKE, la fonction est appelable par anon,
// c'est-a-dire par quiconque possede la cle publique de l'application (.env.exemple).
//
// Exception structurelle, pas de confort : une fonction declencheur (RETURNS TRIGGER) n'a pas
// besoin de ce REVOKE, Postgres refuse deja de l'executer hors d'un declencheur — verifie en
// conditions reelles (Postgres local) avant d'ecrire cette regle : "ERROR: trigger functions
// can only be called as triggers", quel que soit le role appelant.
const DOSSIER_MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations');

function fichiersMigrations(): string[] {
  try {
    return readdirSync(DOSSIER_MIGRATIONS)
      .filter((nom) => nom.endsWith('.sql'))
      .map((nom) => join(DOSSIER_MIGRATIONS, nom));
  } catch {
    // Dossier absent : rien a balayer, ce n'est pas une erreur.
    return [];
  }
}

type EnteteFonction = { entete: string; nom: string; estDeclencheur: boolean };

// Isole l'entete de chaque "CREATE [OR REPLACE] FUNCTION nom(...) ... AS" — jusqu'au premier
// AS qui ouvre le corps de la fonction, le seul endroit ou "RETURNS TRIGGER" peut apparaitre
// pour cette fonction precise.
function entetesDeFonctions(contenuSql: string): EnteteFonction[] {
  const motif =
    /create\s+(or\s+replace\s+)?function\s+([a-z0-9_.]+)\s*\([\s\S]*?\)[\s\S]*?\bas\b/gi;
  const resultats: EnteteFonction[] = [];
  let correspondance: RegExpExecArray | null;
  while ((correspondance = motif.exec(contenuSql))) {
    resultats.push({
      entete: correspondance[0],
      nom: correspondance[2],
      estDeclencheur: /returns\s+trigger/i.test(correspondance[0]),
    });
  }
  return resultats;
}

function echapperRegex(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function estRevoqueDePublic(contenuSql: string, nomFonction: string): boolean {
  const motif = new RegExp(
    `revoke\\s+execute\\s+on\\s+function\\s+${echapperRegex(nomFonction)}\\s*\\(`,
    'i',
  );
  return motif.test(contenuSql);
}

describe('toute fonction appelable directement révoque EXECUTE de PUBLIC (docs/backend.md §4)', () => {
  // Le balayage doit pouvoir echouer : ecrit exprès une fonction fautive, une fonction correcte
  // et une fonction declencheur exemptee, avant de faire confiance au meme mecanisme sur les
  // vraies migrations ci-dessous.
  it('détecte une fonction écrite exprès sans REVOKE', () => {
    const sql = 'create function public.exemple() returns int language sql as $$ select 1; $$;';
    const fonctions = entetesDeFonctions(sql);
    expect(fonctions).toHaveLength(1);
    expect(fonctions[0].estDeclencheur).toBe(false);
    expect(estRevoqueDePublic(sql, fonctions[0].nom)).toBe(false);
  });

  it('laisse passer une fonction écrite exprès avec REVOKE', () => {
    const sql = [
      'create function public.exemple() returns int language sql as $$ select 1; $$;',
      'revoke execute on function public.exemple() from public;',
    ].join('\n');
    const fonctions = entetesDeFonctions(sql);
    expect(estRevoqueDePublic(sql, fonctions[0].nom)).toBe(true);
  });

  it('exempte une fonction déclencheur, sans exiger de REVOKE', () => {
    const sql =
      'create function public.exemple() returns trigger language plpgsql as $$ begin return new; end; $$;';
    const fonctions = entetesDeFonctions(sql);
    expect(fonctions[0].estDeclencheur).toBe(true);
  });

  it("aucune fonction appelable directement de supabase/migrations/ n'omet son REVOKE", () => {
    const coupables = fichiersMigrations().flatMap((fichier) => {
      const contenu = readFileSync(fichier, 'utf8');
      return entetesDeFonctions(contenu)
        .filter((f) => !f.estDeclencheur && !estRevoqueDePublic(contenu, f.nom))
        .map((f) => `${fichier} : ${f.nom}`);
    });
    expect(coupables).toEqual([]);
  });
});
