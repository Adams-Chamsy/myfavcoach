import { RETOUR_CONNEXION_SOCIALE } from '@/services/auth/retour-social';

export function redirectSystemPath({ path }: { path: string | null }) {
  // La fenêtre d'authentification traite le retour et échange le code PKCE.
  if (path?.split(/[?#]/, 1)[0] === RETOUR_CONNEXION_SOCIALE) return null;
  return path;
}
