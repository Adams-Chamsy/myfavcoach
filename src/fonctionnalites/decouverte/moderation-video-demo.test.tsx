import { fireEvent, render, screen } from '@testing-library/react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { ModerationVideoDemo } from './moderation-video-demo';

jest.mock('./vitrine-video-demo', () => ({
  VitrineVideoDemo: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Clip de démonstration</Text>;
  },
}));

it('rend le clip visible au visiteur seulement après validation et jusqu’au retrait', async () => {
  await render(
    <FournisseurTheme>
      <ModerationVideoDemo />
    </FournisseurTheme>,
  );
  const ouvrir = (nom: string) => fireEvent.press(screen.getByRole('tab', { name: nom }));
  const appuyer = (nom: string) => fireEvent.press(screen.getByRole('button', { name: nom }));

  await appuyer('Choisir le clip de démonstration');
  expect(
    screen.getByRole('button', { name: 'Soumettre à validation' }).props.accessibilityState,
  ).toMatchObject({ disabled: true });
  await fireEvent(
    screen.getByLabelText('Confirmer les autorisations des personnes filmées'),
    'valueChange',
    true,
  );
  await appuyer('Soumettre à validation');
  await ouvrir('Visiteur');
  expect(screen.queryByText('Clip de démonstration')).toBeNull();

  await ouvrir('Modération');
  await appuyer('Refuser pour droit à l’image');
  await ouvrir('Coach');
  expect(screen.getByText(/Motif du refus/)).toBeTruthy();
  await appuyer('Choisir le clip de démonstration');
  await fireEvent(
    screen.getByLabelText('Confirmer les autorisations des personnes filmées'),
    'valueChange',
    true,
  );
  await appuyer('Soumettre à validation');

  await ouvrir('Modération');
  await appuyer('Valider la publication');
  await ouvrir('Visiteur');
  expect(screen.getByText('Clip de démonstration')).toBeTruthy();

  await ouvrir('Modération');
  await appuyer('Retirer du profil public');
  await ouvrir('Visiteur');
  expect(screen.queryByText('Clip de démonstration')).toBeNull();
});
