import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { creerFauxPortAuth } from '@/services/auth/faux';
import { FournisseurSession, useSession } from '@/fonctionnalites/identite/fournisseur-session';

const MAJEUR = '2000-01-01';

function envelopper(port: ReturnType<typeof creerFauxPortAuth>) {
  return function Enveloppe({ children }: { children: ReactNode }) {
    return <FournisseurSession port={port}>{children}</FournisseurSession>;
  };
}

// docs/prompts/L1.md, P1.10 : "La déconnexion... RÉUSSIT MÊME HORS LIGNE. Une déconnexion qui
// échoue faute de réseau est un défaut de sécurité."
//
// Ce que ce fichier PEUT prouver avec un faux port en mémoire : le CONTRAT de PortAuth.deconnecter
// — une Promise<void> qui se résout toujours, jamais un rejet — et que FournisseurSession efface
// bien son état dès que le port notifie la déconnexion, sans dépendre d'un quelconque succès
// réseau côté appelant. Ce que ce fichier NE PEUT PAS prouver : le comportement réel de
// @supabase/auth-js hors ligne, qui n'existe pas dans un faux en mémoire. Cette moitié-là a été
// vérifiée en direct contre un vrai compte à P1.10 (fetch intercepté pour simuler une panne
// réseau pendant signOut()) — documentée dans le commentaire de deconnecter(),
// src/services/auth/supabase.ts, pas réexécutable ici sans réintroduire le SDK dans ce fichier.
// Voir docs/dette.md pour le risque de régression que ça laisse (une mise à jour du SDK
// pourrait changer ce comportement sans qu'aucun test automatisé ne le voie).
describe('déconnexion "en mode avion" (docs/prompts/L1.md, P1.10)', () => {
  it('port.deconnecter() se résout toujours, jamais un rejet', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    port.verifierEmailPourTest('camille@exemple.fr');
    await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');

    await expect(port.deconnecter()).resolves.toBeUndefined();
  });

  it('une fois déconnecté, useSession() reflète session: null sans action supplémentaire de l’appelant', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    port.verifierEmailPourTest('camille@exemple.fr');
    await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');

    const { result } = await renderHook(() => useSession(), { wrapper: envelopper(port) });
    await waitFor(() => expect(result.current.session?.email).toBe('camille@exemple.fr'));

    await act(async () => {
      await port.deconnecter();
    });

    expect(result.current.session).toBeNull();
  });
});
