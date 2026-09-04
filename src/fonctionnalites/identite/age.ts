// Calcul d'âge pour L1-02 (docs/ecrans/L1-02-creation-compte.md, "La règle des 18 ans est
// contrôlée deux fois"). Ce module est le contrôle CÔTÉ ÉCRAN, une politesse — la vraie règle
// est le déclencheur SQL de 0001_creer_identite.sql, prouvé par src/test/rls.banc.ts.
//
// Travaille uniquement sur des objets Date déjà construits par le sélecteur natif
// (@react-native-community/datetimepicker), jamais en parsant une chaîne "AAAA-MM-JJ" via
// `new Date(chaine)` : c'est exactement le piège trouvé dans src/services/auth/faux.ts
// (minuit UTC relu avec des accesseurs locaux, décalage d'un jour selon le fuseau de
// l'appareil). Un objet Date venant du sélecteur porte déjà les bons composants locaux —
// getFullYear/getMonth/getDate suffisent, aucun aller-retour par une chaîne ISO.
export const AGE_MINIMUM_ANNEES = 18;

export function calculerAge(dateNaissance: Date, aujourdHui: Date = new Date()): number {
  let age = aujourdHui.getFullYear() - dateNaissance.getFullYear();
  const pasEncoreAnniversaireCetteAnnee =
    aujourdHui.getMonth() < dateNaissance.getMonth() ||
    (aujourdHui.getMonth() === dateNaissance.getMonth() &&
      aujourdHui.getDate() < dateNaissance.getDate());
  if (pasEncoreAnniversaireCetteAnnee) age -= 1;
  return age;
}

export function estMajeur(dateNaissance: Date, aujourdHui: Date = new Date()): boolean {
  return calculerAge(dateNaissance, aujourdHui) >= AGE_MINIMUM_ANNEES;
}

// Sérialise en "AAAA-MM-JJ" à partir des accesseurs LOCAUX de la Date (jamais
// `toISOString()`, qui convertit en UTC et peut faire glisser la date d'un jour) : c'est la
// forme attendue par PortAuth.inscrire (voir src/services/auth/port.ts).
export function formatDateISO(date: Date): string {
  const annee = String(date.getFullYear()).padStart(4, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}
