// L2-09 : « 48 h ouvrées » — le calendrier exact (jours fériés compris ou non, fuseau) n'est
// précisé nulle part ailleurs (fiche, "Ce qui a été inventé"). Simplification assumée : on
// saute les week-ends (samedi, dimanche), aucun jour férié — chaque jour ouvré compte pour 24 h
// pleines, pas une plage d'heures de bureau. Fuseau Europe/Paris (CLAUDE.md §2), mais la date de
// dépôt est déjà un instant serveur (timestamptz) : aucune conversion de fuseau supplémentaire
// n'est faite ici.
export function echeanceQuaranteHuitHeuresOuvrees(deposeLe: string): Date {
  let restantes = 48;
  let date = new Date(deposeLe);
  while (restantes > 0) {
    date = new Date(date.getTime() + 60 * 60 * 1000);
    // 0 = dimanche, 6 = samedi.
    const jour = date.getDay();
    if (jour !== 0 && jour !== 6) restantes -= 1;
  }
  return date;
}
