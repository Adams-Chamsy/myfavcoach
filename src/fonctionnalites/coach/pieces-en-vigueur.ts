// La pièce en vigueur de chaque type, dans un dossier de vérification : le dépôt le plus récent.
// Le serveur garde chaque dépôt (0012 : « l'ancien dépôt reste une preuve ») ; « Remplacer »
// (L2-06, règle 6) ajoute une ligne, il n'en efface aucune. Pour le coach (étape 3) comme pour
// l'examinateur (back-office), l'ancienne version cesse de compter dès l'envoi de la nouvelle.
export function piecesEnVigueur<T extends { type: string; deposeLe: string }>(pieces: T[]): T[] {
  const parType = new Map<string, T>();
  for (const piece of pieces) {
    const retenue = parType.get(piece.type);
    if (!retenue || piece.deposeLe > retenue.deposeLe) parType.set(piece.type, piece);
  }
  return [...parType.values()];
}
