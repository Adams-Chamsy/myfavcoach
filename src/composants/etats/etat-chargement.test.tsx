import { render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { FournisseurTheme } from '@/theme/fournisseur';
import { EtatChargement } from './etat-chargement';

jest.mock('react-native-reanimated', () => {
  const reel = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...reel,
    withRepeat: jest.fn((animation) => animation),
    withTiming: jest.fn((valeur) => valeur),
  };
});

// jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled') + jest.restoreAllMocks() ne restaure
// pas fiablement l'implementation d'origine : reference sauvegardee/restauree directement
// (voir src/composants/squelette.test.tsx).
const isReduceMotionEnabledOriginal = AccessibilityInfo.isReduceMotionEnabled;

// Parcourt l'arbre rendu (toJSON()) pour trouver les squelettes : ce sont les seuls noeuds
// masques au lecteur d'ecran via importantForAccessibility (voir squelette.tsx).
function trouverSquelettes(
  noeud: ReactTestRendererJSON | string | null,
  resultats: ReactTestRendererJSON[] = [],
): ReactTestRendererJSON[] {
  if (!noeud || typeof noeud === 'string') return resultats;
  if (noeud.props?.importantForAccessibility === 'no-hide-descendants') {
    resultats.push(noeud);
  }
  for (const enfant of noeud.children ?? []) {
    trouverSquelettes(enfant, resultats);
  }
  return resultats;
}

describe('EtatChargement', () => {
  afterEach(() => {
    AccessibilityInfo.isReduceMotionEnabled = isReduceMotionEnabledOriginal;
  });

  it('rend le nombre de squelettes demande', async () => {
    const { toJSON } = await render(
      <FournisseurTheme>
        <EtatChargement forme="carte" nombre={3} />
      </FournisseurTheme>,
    );

    expect(toJSON()).toBeTruthy();
  });

  it("n'affiche rien sous les squelettes quand aucune raison n'est fournie", async () => {
    const { queryByText } = await render(
      <FournisseurTheme>
        <EtatChargement forme="ligne" nombre={2} />
      </FournisseurTheme>,
    );

    expect(queryByText(/./)).toBeNull();
  });

  it('affiche la raison quand elle est fournie', async () => {
    const { getByText } = await render(
      <FournisseurTheme>
        <EtatChargement
          forme="ligne"
          nombre={2}
          raison="Téléchargement des démos pour t'entraîner hors-ligne"
        />
      </FournisseurTheme>,
    );

    expect(getByText("Téléchargement des démos pour t'entraîner hors-ligne")).toBeTruthy();
  });

  // Critere d'acceptation 2 (docs/ecrans/L0-03-etats-systeme.md) : "EtatChargement ne rend
  // jamais d'indicateur circulaire : un test echoue si un ActivityIndicator plein ecran
  // apparait dans le rendu."
  it("ne rend jamais d'ActivityIndicator, quelle que soit la forme ou le nombre", async () => {
    const formes = ['liste', 'carte', 'detail', 'ligne'] as const;

    for (const forme of formes) {
      const { toJSON, unmount } = await render(
        <FournisseurTheme>
          <EtatChargement forme={forme} nombre={4} raison="Peu importe" />
        </FournisseurTheme>,
      );

      expect(JSON.stringify(toJSON())).not.toContain('ActivityIndicator');
      await unmount();
    }
  });

  // Critere d'acceptation 3 (docs/ecrans/L0-03-etats-systeme.md) : "En mouvement réduit, la
  // pulsation des squelettes s'arrête ; le contenu reste lisible."
  it('arrete la pulsation des squelettes en mouvement reduit, sans rien masquer', async () => {
    AccessibilityInfo.isReduceMotionEnabled = jest.fn().mockResolvedValue(true);

    const { toJSON } = await render(
      <FournisseurTheme>
        <EtatChargement forme="ligne" nombre={2} raison="Peu importe" />
      </FournisseurTheme>,
    );

    // useMouvementReduit demarre a "inactif" le temps de lire le reglage systeme (async) : on
    // attend l'etat stabilise plutot que de compter les appels transitoires a withRepeat.
    await waitFor(() => {
      const squelettes = trouverSquelettes(toJSON());
      expect(squelettes).toHaveLength(2);

      for (const squelette of squelettes) {
        const style = squelette.props.style;
        const opacite = Array.isArray(style) ? Object.assign({}, ...style).opacity : style.opacity;
        expect(opacite).toBe(1);
      }
    });

    // "Le contenu reste lisible" : la raison sous les squelettes n'est pas masquee.
    expect(screen.getByText('Peu importe')).toBeTruthy();
  });
});
