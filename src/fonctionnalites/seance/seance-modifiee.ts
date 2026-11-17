// docs/ecrans/L6-05-seance-du-jour.md : l'accueil reste monté sous la séance (pile de
// navigation) ; au retour, rien ne le remonte, donc la carte « Ta séance du jour » ne relisait pas.
// Trouvé dans le navigateur le 17 novembre 2026 : une séance terminée y proposait encore
// « Commencer ». Chaque écriture réussie de la séance signale ici ; la carte, montée, relit.
// Même forme que avis-enregistre.ts.
type Ecouteur = () => void;

const ecouteurs = new Set<Ecouteur>();

export function signalerSeanceModifiee(): void {
  for (const ecouteur of ecouteurs) ecouteur();
}

// Rend la fonction qui retire l'écoute (à rendre telle quelle depuis un useEffect).
export function ecouterSeanceModifiee(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}
