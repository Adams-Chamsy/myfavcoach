// La clé d'idempotence d'une demande d'intention (docs/backend.md §13) : un UUID v4, format
// exigé par abonnement-intention.
//
// Seule son UNICITÉ compte, pas son imprévisibilité : le serveur range les clés par compte (clé
// primaire (compte_id, cle), 0034_creer_cles_idempotence.sql) — deviner la clé d'un autre compte
// ne donne rien. D'où, faute de crypto.randomUUID (absent de certains moteurs JavaScript mobiles),
// un repli sur Math.random plutôt qu'une dépendance de plus.
export function nouvelleCleIdempotence(): string {
  const natif = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  if (typeof natif === 'function') return natif.call(globalThis.crypto);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
