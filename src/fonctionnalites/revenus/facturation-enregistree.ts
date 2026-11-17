// docs/ecrans/L5-13-revenus.md : une fois les informations de facturation enregistrées, retour à
// Revenus, qui relit. Revenus reste monté SOUS le formulaire (pile de navigation) : au retour,
// rien ne le remonte, donc rien ne relit. Trouvé dans le navigateur le 17 novembre 2026 : la carte
// « Tes informations de facturation » restait affichée après l'enregistrement. Le formulaire
// signale ici ; Revenus, s'il est monté, relit.
//
// Un signal en mémoire, sans donnée. Même forme que avis-enregistre.ts (src/fonctionnalites/avis/).
type Ecouteur = () => void;

const ecouteurs = new Set<Ecouteur>();

export function signalerFacturationEnregistree(): void {
  for (const ecouteur of ecouteurs) ecouteur();
}

// Rend la fonction qui retire l'écoute (à rendre telle quelle depuis un useEffect).
export function ecouterFacturationEnregistree(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}
