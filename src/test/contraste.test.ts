import { contraste, melangerCouleur } from './contraste';

describe('contraste', () => {
  it('noir sur blanc vaut 21:1 (cas de reference WCAG)', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('une couleur sur elle-meme vaut 1:1', () => {
    expect(contraste('#0F5140', '#0F5140')).toBeCloseTo(1, 5);
  });

  it("l'ordre des deux couleurs ne change pas le resultat", () => {
    expect(contraste('#17211E', '#F4F0E9')).toBeCloseTo(contraste('#F4F0E9', '#17211E'), 5);
  });

  it('accepte les hex courts (#RGB)', () => {
    expect(contraste('#000', '#fff')).toBeCloseTo(21, 1);
  });

  // Valeurs recalculees a la main dans src/composants/barre-navigation.tsx (commentaire "opacite
  // 70 % de l'inactif coach") : sert de non-regression sur ce calcul precis.
  it('themes.sombre.marque.primaire sur fond.inverse (barre coach, actif) mesure environ 7,58:1', () => {
    expect(contraste('#58C2A2', '#17211E')).toBeCloseTo(7.58, 1);
  });
});

describe('melangerCouleur', () => {
  it('a opacite 1, rend la couleur de premier plan telle quelle', () => {
    expect(melangerCouleur('#F4F0E9', '#17211E', 1)).toBe('#f4f0e9');
  });

  it('a opacite 0, rend la couleur de fond telle quelle', () => {
    expect(melangerCouleur('#F4F0E9', '#17211E', 0)).toBe('#17211e');
  });

  // docs/ecrans/L0-02-coquille-coach.md : "inactif : texte.surSombre à 70 % d'opacité".
  it('texte.surSombre a 70 % sur fond.inverse mesure environ 7,74:1', () => {
    const melange = melangerCouleur('#F4F0E9', '#17211E', 0.7);
    expect(contraste(melange, '#17211E')).toBeCloseTo(7.74, 1);
  });
});
