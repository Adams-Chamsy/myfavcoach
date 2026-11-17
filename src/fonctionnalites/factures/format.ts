// Mise en forme des montants et des dates, en français. Né avec les factures et les revenus (L5),
// partagé depuis la porte de L5 par les écrans d'abonnement et d'invitation : un seul endroit où
// écrire « 1er février ». Aucun calcul : le serveur rend les montants en centimes et les dates.

export function euros(centimes: number): string {
  return `${(centimes / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function versDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
}

// Le premier du mois s'écrit « 1er » en français (« 1er février »), ce que toLocaleDateString ne
// fait pas. Trouvé dans le navigateur le 17 novembre 2026, sur le rappel de commission de I-01.
function premier(texte: string): string {
  return texte.replace(/^1 /, '1er ');
}

// « 18 novembre », « 1er février »
export function dateCourte(iso: string): string {
  return premier(
    versDate(iso).toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris',
      day: 'numeric',
      month: 'long',
    }),
  );
}

// « 18 novembre 2026 », « 1er février 2027 »
export function dateLongue(iso: string): string {
  return premier(
    versDate(iso).toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );
}

export function majuscule(texte: string): string {
  return `${texte.charAt(0).toLocaleUpperCase('fr-FR')}${texte.slice(1)}`;
}

// « 147 € », « 132,30 € » : sans décimales quand le montant est rond (maquette I-01, rappel de
// commission).
export function eurosCourts(centimes: number): string {
  return centimes % 100 === 0 ? `${(centimes / 100).toLocaleString('fr-FR')} €` : euros(centimes);
}
