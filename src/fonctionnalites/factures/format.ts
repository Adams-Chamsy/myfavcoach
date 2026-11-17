// Mise en forme des montants et des dates des factures et des revenus (L5). Aucun calcul : le
// serveur rend les montants en centimes et les dates, l'écran ne fait que les écrire en français.

export function euros(centimes: number): string {
  return `${(centimes / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function versDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
}

// « 18 novembre »
export function dateCourte(iso: string): string {
  return versDate(iso).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
  });
}

// « 18 novembre 2026 »
export function dateLongue(iso: string): string {
  return versDate(iso).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function majuscule(texte: string): string {
  return `${texte.charAt(0).toLocaleUpperCase('fr-FR')}${texte.slice(1)}`;
}
