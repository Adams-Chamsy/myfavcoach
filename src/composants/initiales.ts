// Repli d'initiales partage par Avatar et EmplacementImage (docs/design-system.md §7) : les
// deux composants affichent les memes initiales, calculees de la meme facon, quand aucune
// image n'est fournie.
export function initiales(nom: string): string {
  return nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join('');
}
