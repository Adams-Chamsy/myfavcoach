// docs/ecrans/L4-27a-depot-avis.md, États, « 27a, succès : retour à l'onglet Avis, avis visible ».
// Le profil du coach reste monté SOUS l'écran de dépôt (pile de navigation) : au retour, rien ne
// le remonte, donc rien ne relit ses avis. L'écran de dépôt signale ici qu'un avis vient d'être
// enregistré pour un coach ; l'onglet Avis de ce coach, s'il est monté, relit.
//
// Un signal en mémoire, sans donnée : ni stockage, ni contenu de l'avis. Même forme que
// intention-en-cours.ts (src/fonctionnalites/abonnement/).
type Ecouteur = (coachId: string) => void;

const ecouteurs = new Set<Ecouteur>();

export function signalerAvisEnregistre(coachId: string): void {
  for (const ecouteur of ecouteurs) ecouteur(coachId);
}

// Rend la fonction qui retire l'écoute (à rendre telle quelle depuis un useEffect).
export function ecouterAvisEnregistre(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}
