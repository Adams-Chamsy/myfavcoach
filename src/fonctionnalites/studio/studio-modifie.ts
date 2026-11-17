// docs/ecrans/L6-11-studio.md : les écrans du studio s'empilent (mes programmes → un programme →
// une séance). Un écran resté dessous n'est pas remonté au retour : sans signal, il montre l'état
// d'avant. Trouvé dans le navigateur le 17 novembre 2026 : une séance renommée restait « Séance
// sans titre » sur son programme. Chaque écriture réussie du studio signale ici ; les écrans
// montés relisent. Même forme que avis-enregistre.ts et facturation-enregistree.ts.
type Ecouteur = () => void;

const ecouteurs = new Set<Ecouteur>();

export function signalerStudioModifie(): void {
  for (const ecouteur of ecouteurs) ecouteur();
}

// Rend la fonction qui retire l'écoute (à rendre telle quelle depuis un useEffect).
export function ecouterStudioModifie(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}
