// Préférences d'interface et destination publique uniquement. Aucun jeton de session,
// identifiant de paiement ou contenu d'onboarding n'entre dans ce stockage.
export type RetourCoach = { coachId: string; creeLe: number; intention?: 'suivre' };
export type PreferencesAccueil = { marqueVue: boolean; retourCoach: RetourCoach | null };
export type PortAccueil = {
  lire(): Promise<PreferencesAccueil>;
  marquerOuvertureVue(): Promise<void>;
  enregistrerRetour(retour: RetourCoach | null): Promise<void>;
};

// Une destination de reprise n'est jamais une URL : uniquement l'identifiant UUID d'un
// profil public. L'expiration borne un contexte oublié après annulation de connexion.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUREE_REPRISE_MS = 60 * 60 * 1000;

export function estIdentifiantCoach(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && UUID.test(valeur);
}

export function lireRetourCoach(brut: string | null, maintenant = Date.now()): RetourCoach | null {
  try {
    const valeur: unknown = JSON.parse(brut ?? 'null');
    if (!valeur || typeof valeur !== 'object') return null;
    if (!('coachId' in valeur) || !estIdentifiantCoach(valeur.coachId)) return null;
    if (!('creeLe' in valeur) || typeof valeur.creeLe !== 'number') return null;
    const age = maintenant - valeur.creeLe;
    return Number.isFinite(age) && age >= 0 && age < DUREE_REPRISE_MS
      ? {
          coachId: valeur.coachId,
          creeLe: valeur.creeLe,
          ...('intention' in valeur && valeur.intention === 'suivre'
            ? { intention: 'suivre' }
            : {}),
        }
      : null;
  } catch {
    return null;
  }
}
