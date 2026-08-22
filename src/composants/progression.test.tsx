import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { mouvement } from '@/theme/tokens';
import { Progression, type EtatSegment } from './progression';

// withTiming reel demarre une animation asynchrone (voir src/composants/bouton.test.tsx) :
// mocke pour renvoyer sa cible directement et pouvoir verifier QUEL appel est fait.
jest.mock('react-native-reanimated', () => {
  const reel = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...reel, withTiming: jest.fn((valeur) => valeur) };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- doit suivre le jest.mock ci-dessus
const { withTiming } = require('react-native-reanimated');

// jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled') suivi de jest.restoreAllMocks() ne
// restaure PAS correctement l'implementation d'origine ici (le mock du preset RN est deja
// un jest.fn() ; restoreAllMocks() ne revient pas dessus fiablement) : verifie en pratique,
// un test "mouvement reduit actif" pollue alors tous les tests suivants du fichier. On
// sauvegarde/restaure la reference directement plutot que de compter sur spyOn/restore.
const isReduceMotionEnabledOriginal = AccessibilityInfo.isReduceMotionEnabled;

afterEach(() => {
  AccessibilityInfo.isReduceMotionEnabled = isReduceMotionEnabledOriginal;
  withTiming.mockClear();
});

function ProgressionControlee({ valeurInitiale }: { valeurInitiale: number }) {
  const [valeur, setValeur] = useState(valeurInitiale);
  return (
    <>
      <Progression variante="barre" valeur={valeur} accessibilityLabel="Semaine 3" />
      <Pressable onPress={() => setValeur(90)} accessibilityRole="button">
        <Text>Changer la valeur</Text>
      </Pressable>
    </>
  );
}

describe('Progression — variante barre', () => {
  it("n'anime pas au montage", async () => {
    await render(
      <FournisseurTheme>
        <Progression variante="barre" valeur={80} accessibilityLabel="Semaine 3" />
      </FournisseurTheme>,
    );

    expect(withTiming).not.toHaveBeenCalled();
  });

  it('anime vers la nouvelle valeur quand elle change apres le montage', async () => {
    await render(
      <FournisseurTheme>
        <ProgressionControlee valeurInitiale={20} />
      </FournisseurTheme>,
    );

    expect(withTiming).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Changer la valeur'));

    expect(withTiming).toHaveBeenCalledWith(90, {
      duration: mouvement.valeur,
      easing: expect.anything(),
    });
  });

  it("n'anime pas (withTiming jamais appele) quand le mouvement reduit est actif, meme si la valeur change", async () => {
    AccessibilityInfo.isReduceMotionEnabled = jest.fn().mockResolvedValue(true);
    await render(
      <FournisseurTheme>
        <ProgressionControlee valeurInitiale={20} />
      </FournisseurTheme>,
    );
    // Le passage a l'etat "actif" du hook est asynchrone : on attend le re-rendu.
    await screen.findByLabelText('Semaine 3');

    await fireEvent.press(screen.getByText('Changer la valeur'));

    expect(withTiming).not.toHaveBeenCalled();
  });

  it('expose accessibilityValue avec la valeur courante', async () => {
    await render(
      <FournisseurTheme>
        <Progression variante="barre" valeur={80} accessibilityLabel="Semaine 3" />
      </FournisseurTheme>,
    );

    const barre = screen.getByLabelText('Semaine 3');
    expect(barre.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 80 });
  });
});

const SEGMENTS_INITIAUX: EtatSegment[] = ['atteint', 'atteint', 'atteint', 'actuel', 'reste'];
const SEGMENTS_APRES_VALIDATION: EtatSegment[] = [
  'atteint',
  'atteint',
  'atteint',
  'atteint',
  'actuel',
];

function ProgressionSegmentsControlee() {
  const [segments, setSegments] = useState(SEGMENTS_INITIAUX);
  return (
    <>
      <Progression variante="segments" segments={segments} accessibilityLabel="4 séances sur 5" />
      <Pressable onPress={() => setSegments(SEGMENTS_APRES_VALIDATION)} accessibilityRole="button">
        <Text>Valider la séance</Text>
      </Pressable>
    </>
  );
}

describe('Progression — variante segments', () => {
  it('rend les segments sans erreur, avec le libelle attendu', async () => {
    await render(
      <FournisseurTheme>
        <Progression
          variante="segments"
          segments={SEGMENTS_INITIAUX}
          accessibilityLabel="4 séances sur 5"
        />
      </FournisseurTheme>,
    );

    expect(screen.getByLabelText('4 séances sur 5')).toBeTruthy();
  });

  it("n'anime aucun segment au montage", async () => {
    await render(
      <FournisseurTheme>
        <Progression
          variante="segments"
          segments={SEGMENTS_INITIAUX}
          accessibilityLabel="4 séances sur 5"
        />
      </FournisseurTheme>,
    );

    expect(withTiming).not.toHaveBeenCalled();
  });

  it('anime le remplissage des segments qui changent apres le montage, sur mouvement.valeur', async () => {
    await render(
      <FournisseurTheme>
        <ProgressionSegmentsControlee />
      </FournisseurTheme>,
    );

    expect(withTiming).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Valider la séance'));

    // Deux segments changent d'etat (index 3 : actuel -> atteint reste a 1, ne bouge pas ;
    // index 4 : reste -> actuel passe de 0 a 1) : seul celui dont la fraction cible change anime.
    expect(withTiming).toHaveBeenCalledTimes(1);
    expect(withTiming).toHaveBeenCalledWith(1, {
      duration: mouvement.valeur,
      easing: expect.anything(),
    });
  });

  it("n'anime aucun segment (withTiming jamais appele) quand le mouvement reduit est actif", async () => {
    AccessibilityInfo.isReduceMotionEnabled = jest.fn().mockResolvedValue(true);
    await render(
      <FournisseurTheme>
        <ProgressionSegmentsControlee />
      </FournisseurTheme>,
    );
    // Le passage a l'etat "actif" du hook est asynchrone : on attend le re-rendu.
    await screen.findByLabelText('4 séances sur 5');

    await fireEvent.press(screen.getByText('Valider la séance'));

    expect(withTiming).not.toHaveBeenCalled();
  });
});
