// docs/ecrans/L2-15-creation-offre-coach.md, Règle 4 : "le passage [euros/centimes] se fait à
// UN seul endroit, testé, avec les cas limites (virgule, point, espace insécable, valeur vide,
// zéro)". Saisie en euros (locale fr-FR : virgule décimale, espace insécable comme séparateur de
// milliers), stockage en centimes (docs/domaine.md §3.3).
export function centimesDepuisSaisieEuros(saisie: string): number | null {
  const nettoyee = saisie
    .trim()
    .replace(/[\s  ]/g, '') // espace normal, insécable, fine insécable
    .replace(',', '.');
  if (nettoyee === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(nettoyee)) return null;
  const centimes = Math.round(parseFloat(nettoyee) * 100);
  return Number.isFinite(centimes) ? centimes : null;
}

// Sens inverse, pour pré-remplir le champ depuis une offre existante (docs/domaine.md §3.3,
// prixMensuelCentimes). Toujours deux décimales, virgule fr-FR — jamais un point, jamais de
// séparateur de milliers (les montants de ce jalon restent sous 1 000 €, 500 € au maximum).
export function saisieEurosDepuisCentimes(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',');
}
