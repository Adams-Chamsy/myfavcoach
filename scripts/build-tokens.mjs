// Genere src/theme/tokens.ts et src/theme/types.ts a partir de design/tokens.json.
// Node seul, aucune dependance externe. Voir npm run tokens.
//
// --check : ne rien ecrire, comparer la generation en memoire aux fichiers du depot et
// echouer (code 1) si l'un des deux est absent ou different. Utilise par le test qui
// verifie que src/theme n'a pas ete edite a la main.
//
// Deux ecarts volontaires entre design/tokens.json et la sortie generee :
//
// 1. "textCase" -> "textTransform" dans les tokens de typographie. React Native n'a pas de
//    propriete de style "textCase" (vocabulaire Tokens Studio) : elle serait silencieusement
//    ignoree. "textTransform" est le nom reel que React Native reconnait pour le meme effet
//    ("uppercase", etc). Voir resoudreValeurToken ci-dessous.
//
// 2. Les tokens "fontWeights" (groupe "weight", et le champ fontWeight qui le reference dans
//    chaque style de "texte") restent des chaines ('400', '700'...) et ne sont PAS convertis
//    en nombre, contrairement au reste des valeurs numeriques du fichier (tailles, espaces,
//    rayons...). React Native type fontWeight en chaine ; lui passer un nombre casse le
//    typecheck de tout composant qui etale un style de src/theme/tokens.ts. Voir
//    resoudreValeurBrute (parametre forcerChaine).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENTETE = '// GÉNÉRÉ — ne pas éditer. Lance npm run tokens.';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cheminTokensJson = path.join(racine, 'design', 'tokens.json');
const cheminTokensTs = path.join(racine, 'src', 'theme', 'tokens.ts');
const cheminTypesTs = path.join(racine, 'src', 'theme', 'types.ts');

function capitaliser(mot) {
  return mot.charAt(0).toUpperCase() + mot.slice(1);
}

function estToken(descripteur) {
  return Boolean(descripteur) && typeof descripteur === 'object' && 'value' in descripteur;
}

function estComposite(valeur) {
  return Boolean(valeur) && typeof valeur === 'object' && !Array.isArray(valeur);
}

// Resout un champ brut de tokens.json : reference "{groupe.nom}", nombre en chaine, ou
// chaine simple (couleur, nom de police, chaine d'easing...). "forcerChaine" desactive la
// conversion en nombre : reserve aux enumerations de style (ex. fontWeights), dont les
// valeurs sont numeriques en apparence ("400") mais doivent rester des chaines.
function resoudreValeurBrute(brut, refs, { forcerChaine = false } = {}) {
  if (typeof brut !== 'string') return brut;
  const texte = brut.trim();
  const reference = /^\{(.+)\}$/.exec(texte);
  if (reference) {
    const chemin = reference[1].trim();
    if (!(chemin in refs)) {
      throw new Error(
        `reference "{${chemin}}" introuvable dans design/tokens.json (section "global"). ` +
          `Verifie l'orthographe du chemin ou que le token vise existe bien.`,
      );
    }
    return refs[chemin];
  }
  if (!forcerChaine && /^-?\d+(\.\d+)?$/.test(texte)) {
    return Number(texte);
  }
  return brut;
}

// Resout la valeur d'un token : scalaire directement, ou objet compose (typographie,
// ombre...) champ par champ.
//
// Deux ecarts volontaires par rapport a une conversion generique :
// - les tokens de type "fontWeights" (groupe "weight") restent des chaines ('400', '700'...)
//   meme si leur valeur est numerique en apparence : React Native attend fontWeight en
//   chaine, jamais en nombre. Un token de typographie qui reference "{weight.x}" herite de
//   ce choix via la table de references, sans traitement particulier ici.
// - "textCase" devient "textTransform" dans les tokens de typographie : c'est le seul nom
//   que reconnait le style React Native, "textCase" (vocabulaire Tokens Studio) n'existe pas
//   cote React Native et serait silencieusement ignore.
function resoudreValeurToken(descripteur, refs) {
  const { value, type } = descripteur;
  if (!estComposite(value)) {
    return resoudreValeurBrute(value, refs, { forcerChaine: type === 'fontWeights' });
  }
  const sortie = {};
  for (const [cle, brut] of Object.entries(value)) {
    const cleSortie = type === 'typography' && cle === 'textCase' ? 'textTransform' : cle;
    sortie[cleSortie] = resoudreValeurBrute(brut, refs);
  }
  return sortie;
}

// Construit les groupes de "global" (police, poids, texte, espace, rayon, ombre, taille,
// mouvement, mouvementReduit, seuil...) en deux passes : les tokens scalaires d'abord (ils
// alimentent la table de references), les tokens composes ensuite (ils peuvent s'y referer).
function construireGlobal(globalJson) {
  const refs = {};
  const groupes = {};
  const nomsGroupes = Object.keys(globalJson);

  for (const groupe of nomsGroupes) {
    groupes[groupe] = {};
    for (const [nom, descripteur] of Object.entries(globalJson[groupe])) {
      if (!estToken(descripteur) || estComposite(descripteur.value)) continue;
      const valeur = resoudreValeurToken(descripteur, refs);
      groupes[groupe][nom] = valeur;
      refs[`${groupe}.${nom}`] = valeur;
    }
  }

  for (const groupe of nomsGroupes) {
    for (const [nom, descripteur] of Object.entries(globalJson[groupe])) {
      if (!estToken(descripteur) || !estComposite(descripteur.value)) continue;
      groupes[groupe][nom] = resoudreValeurToken(descripteur, refs);
    }
  }

  return groupes;
}

function resoudreGroupeCouleurs(groupeJson) {
  const sortie = {};
  for (const [nom, descripteur] of Object.entries(groupeJson)) {
    if (!estToken(descripteur)) continue;
    sortie[nom] = resoudreValeurToken(descripteur, {});
  }
  return sortie;
}

function fusionnerProfond(base, dessus) {
  const resultat = { ...base };
  for (const [cle, valeur] of Object.entries(dessus)) {
    resultat[cle] =
      estComposite(valeur) && estComposite(resultat[cle])
        ? fusionnerProfond(resultat[cle], valeur)
        : valeur;
  }
  return resultat;
}

// Applique $extends a la generation : chaque theme est entierement resolu en memoire,
// aucune surcharge ne subsiste a l'execution.
function construireThemes(json) {
  const bruts = { clair: json.clair, sombre: json.sombre, montre: json.montre };
  const resolus = {};

  function resoudre(nom) {
    if (resolus[nom]) return resolus[nom];
    const brut = bruts[nom];
    if (!brut) {
      throw new Error(`theme "${nom}" introuvable dans design/tokens.json.`);
    }
    const groupesPropres = {};
    for (const [cle, contenu] of Object.entries(brut)) {
      if (cle.startsWith('$')) continue;
      groupesPropres[cle] = resoudreGroupeCouleurs(contenu);
    }
    const resultat = brut.$extends
      ? fusionnerProfond(resoudre(brut.$extends), groupesPropres)
      : groupesPropres;
    resolus[nom] = resultat;
    return resultat;
  }

  return { clair: resoudre('clair'), sombre: resoudre('sombre'), montre: resoudre('montre') };
}

function formatCle(cle) {
  if (/^\d+$/.test(cle) || /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cle)) return cle;
  return JSON.stringify(cle);
}

function formatChaine(valeur) {
  return `'${valeur.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function formatValeur(valeur, profondeur) {
  if (typeof valeur === 'number') return String(valeur);
  if (typeof valeur === 'string') return formatChaine(valeur);
  const indentInterieur = '  '.repeat(profondeur + 1);
  const indent = '  '.repeat(profondeur);
  const lignes = Object.entries(valeur).map(
    ([cle, sousValeur]) =>
      `${indentInterieur}${formatCle(cle)}: ${formatValeur(sousValeur, profondeur + 1)},`,
  );
  return `{\n${lignes.join('\n')}\n${indent}}`;
}

function genererTokensTs(global, themes) {
  const parties = Object.entries(global).map(
    ([nom, valeur]) => `export const ${nom} = ${formatValeur(valeur, 0)} as const;`,
  );
  parties.push(`export const themes = ${formatValeur(themes, 0)} as const;`);
  return `${ENTETE}\n\n${parties.join('\n\n')}\n`;
}

function formatImport(noms, moduleChemin) {
  const surUneLigne = `import { ${noms.join(', ')} } from '${moduleChemin}';`;
  if (surUneLigne.length <= 100) return surUneLigne;
  const lignes = noms.map((nom) => `  ${nom},`);
  return `import {\n${lignes.join('\n')}\n} from '${moduleChemin}';`;
}

function genererTypesTs(global, themes) {
  const nomsGroupesGlobal = Object.keys(global);
  const nomsGroupesCouleur = Object.keys(themes.clair);
  const nomsGroupesComposites = nomsGroupesGlobal.filter((groupe) =>
    estComposite(Object.values(global[groupe])[0]),
  );

  const parties = [];

  parties.push(formatImport([...nomsGroupesGlobal, 'themes'], './tokens'));

  parties.push(
    nomsGroupesGlobal
      .map((groupe) => `export type Nom${capitaliser(groupe)} = keyof typeof ${groupe};`)
      .join('\n'),
  );

  if (nomsGroupesComposites.length > 0) {
    parties.push(
      nomsGroupesComposites
        .map(
          (groupe) =>
            `export type Style${capitaliser(groupe)} = (typeof ${groupe})[Nom${capitaliser(groupe)}];`,
        )
        .join('\n'),
    );
  }

  // "Theme" doit accepter clair, sombre ET montre : ne pas calquer le type sur les
  // litteraux exacts de "clair" (ses couleurs different des deux autres), sinon aucun
  // theme autre que clair n'est assignable au type. On garde la structure (groupes, noms
  // de tokens) et on elargit chaque valeur en "string".
  parties.push(
    [
      'export type NomTheme = keyof typeof themes;',
      'export type Theme = {',
      "  [Groupe in keyof (typeof themes)['clair']]: {",
      "    [Nom in keyof (typeof themes)['clair'][Groupe]]: string;",
      '  };',
      '};',
    ].join('\n'),
  );

  parties.push(
    nomsGroupesCouleur
      .map((groupe) => `export type NomCouleur${capitaliser(groupe)} = keyof Theme['${groupe}'];`)
      .join('\n'),
  );

  const unionCouleur = nomsGroupesCouleur
    .map((groupe) => `NomCouleur${capitaliser(groupe)}`)
    .join('\n  | ');
  parties.push(`export type NomCouleur =\n  | ${unionCouleur};`);

  return `${ENTETE}\n\n${parties.join('\n\n')}\n`;
}

function main() {
  const modeVerification = process.argv.includes('--check');

  let donnees;
  try {
    donnees = JSON.parse(readFileSync(cheminTokensJson, 'utf8'));
  } catch (erreur) {
    console.error(`Erreur : impossible de lire design/tokens.json.\n${erreur.message}`);
    process.exit(1);
  }

  let tokensTs;
  let typesTs;
  try {
    const global = construireGlobal(donnees.global);
    const themes = construireThemes(donnees);
    tokensTs = genererTokensTs(global, themes);
    typesTs = genererTypesTs(global, themes);
  } catch (erreur) {
    console.error(`Erreur de generation des tokens : ${erreur.message}`);
    process.exit(1);
  }

  if (modeVerification) {
    const actuelTokens = existsSync(cheminTokensTs) ? readFileSync(cheminTokensTs, 'utf8') : null;
    const actuelTypes = existsSync(cheminTypesTs) ? readFileSync(cheminTypesTs, 'utf8') : null;
    const perimes = [];
    if (actuelTokens !== tokensTs) perimes.push('src/theme/tokens.ts');
    if (actuelTypes !== typesTs) perimes.push('src/theme/types.ts');
    if (perimes.length > 0) {
      console.error(
        `Fichiers generes absents ou differents de ce que produit design/tokens.json : ${perimes.join(', ')}.\n` +
          `Lance npm run tokens pour les regenerer, et ne les edite jamais a la main.`,
      );
      process.exit(1);
    }
    console.log('src/theme/tokens.ts et src/theme/types.ts sont a jour.');
    return;
  }

  writeFileSync(cheminTokensTs, tokensTs, 'utf8');
  writeFileSync(cheminTypesTs, typesTs, 'utf8');
  console.log('src/theme/tokens.ts et src/theme/types.ts regeneres depuis design/tokens.json.');
}

main();
