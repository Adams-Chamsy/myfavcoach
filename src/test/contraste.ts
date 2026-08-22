// Calcul de contraste WCAG 2.x reel (formule officielle de luminance relative), pas les valeurs
// annoncees dans le dossier de design — docs/design-system.md §1 : "les ratios annonces dans le
// dossier de handoff sont systematiquement optimistes de 0,3 a 0,8 point. Ne jamais les reprendre
// sans recalcul." Utilise par npm run test:a11y (src/test/accessibilite.test.tsx).

function hexVersRgb(hex: string): [number, number, number] {
  const nettoye = hex.replace('#', '');
  const complet =
    nettoye.length === 3
      ? nettoye
          .split('')
          .map((c) => c + c)
          .join('')
      : nettoye;
  const valeur = parseInt(complet.slice(0, 6), 16);
  return [(valeur >> 16) & 255, (valeur >> 8) & 255, valeur & 255];
}

function canalLineaire(canal: number): number {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminanceRelative(rgb: [number, number, number]): number {
  const [r, g, b] = rgb;
  return 0.2126 * canalLineaire(r) + 0.7152 * canalLineaire(g) + 0.0722 * canalLineaire(b);
}

// Ratio de contraste WCAG entre deux couleurs hexadecimales (#RGB ou #RRGGBB), toujours >= 1.
export function contraste(hex1: string, hex2: string): number {
  const l1 = luminanceRelative(hexVersRgb(hex1));
  const l2 = luminanceRelative(hexVersRgb(hex2));
  const [clair, sombre] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (clair + 0.05) / (sombre + 0.05);
}

// Melange fg sur bg a l'opacite donnee (1 = fg plein, 0 = bg plein), canal par canal — pour les
// textes en opacite reduite (ex. BarreNavigation, onglet coach inactif a 70 %), dont la couleur
// affichee reellement n'est pas la couleur de base mais son melange avec le fond.
export function melangerCouleur(fg: string, bg: string, opacite: number): string {
  const [fr, fgv, fb] = hexVersRgb(fg);
  const [br, bgv, bb] = hexVersRgb(bg);
  const melange = (f: number, b: number) => Math.round(opacite * f + (1 - opacite) * b);
  const versHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${versHex(melange(fr, br))}${versHex(melange(fgv, bgv))}${versHex(melange(fb, bb))}`;
}
