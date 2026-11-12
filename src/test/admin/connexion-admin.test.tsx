import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ConnexionAdmin from '../../../app/(admin)/admin/connexion';
import Verification from '../../../app/(admin)/admin/verification';

// Le back-office (L2-10, docs/backend.md §9) : la porte d'entrée de l'examinateur. Trouvé le 11
// novembre 2026 par le navigateur piloté : ouverte seule à son adresse (posée le 2 novembre),
// /admin/connexion plantait après la connexion (`onConnecte is not a function`), et
// /admin/verification ne regardait jamais si une session existait déjà — elle repartait toujours
// du formulaire. verif:serveur ne voyait rien : il lit le texte servi, pas ce que fait le bouton.
const mockRemplacer = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRemplacer, push: jest.fn(), back: jest.fn() }),
}));

const mockConnexion = jest.fn();
const mockSession = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/services/supabase/client-admin', () => ({
  supabaseAdmin: {
    auth: {
      signInWithPassword: (...a: unknown[]) => mockConnexion(...a),
      getSession: () => mockSession(),
    },
    rpc: (...a: unknown[]) => mockRpc(...a),
  },
}));

beforeEach(() => {
  mockRemplacer.mockReset();
  mockConnexion.mockReset().mockResolvedValue({ error: null });
  mockSession.mockReset().mockResolvedValue({ data: { session: null } });
  mockRpc.mockReset().mockResolvedValue({ data: [], error: null });
});

it('/admin/connexion ouverte seule : une connexion réussie mène à la file de vérification', async () => {
  await render(<ConnexionAdmin />);
  await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'examinateur@mfc.test');
  await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'un-mot-de-passe');
  await fireEvent.press(screen.getByText('Se connecter'));

  await waitFor(() => expect(mockRemplacer).toHaveBeenCalledWith('/admin/verification'));
});

it('/admin/verification avec une session déjà ouverte : la file, pas le formulaire', async () => {
  mockSession.mockResolvedValue({ data: { session: { access_token: 'jeton' } } });

  await render(<Verification />);

  await waitFor(() => expect(screen.queryByText('File d’attente — vérification')).toBeTruthy());
  expect(screen.queryByText('Se connecter')).toBeNull();
});
