import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurTheme } from '@/theme/fournisseur';
import { espace } from '@/theme/tokens';
import { calculerDecalageEntree, FeuilleBasse } from './feuille-basse';

function rendreFeuille(ouverte: boolean, onFermer = () => {}) {
  return render(
    <FournisseurTheme>
      <FeuilleBasse
        ouverte={ouverte}
        onFermer={onFermer}
        enfants={<Text>Contenu feuille</Text>}
        testID="feuille"
      >
        <Text>Contenu ecran</Text>
      </FeuilleBasse>
    </FournisseurTheme>,
  );
}

describe('FeuilleBasse', () => {
  it('masque le contenu de fond du lecteur d’ecran quand la feuille est ouverte', async () => {
    await rendreFeuille(true);

    // Contenu masque du lecteur d'ecran par definition : includeHiddenElements pour le retrouver.
    const arrierePlan = screen.getByText('Contenu ecran', { includeHiddenElements: true }).parent!;
    expect(arrierePlan.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(arrierePlan.props.accessibilityElementsHidden).toBe(true);
  });

  it('laisse le contenu de fond accessible quand la feuille est fermee', async () => {
    await rendreFeuille(false);

    const arrierePlan = screen.getByText('Contenu ecran').parent!;
    expect(arrierePlan.props.importantForAccessibility).toBe('auto');
    expect(arrierePlan.props.accessibilityElementsHidden).toBe(false);
  });

  it('appelle onFermer quand le bouton retour Android est presse (onRequestClose)', async () => {
    const onFermer = jest.fn();
    await rendreFeuille(true, onFermer);

    const modal = screen.getByTestId('feuille');
    modal.props.onRequestClose();

    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  it("ne rend pas le Modal quand la feuille n'a jamais ete ouverte", async () => {
    await rendreFeuille(false);

    expect(screen.queryByTestId('feuille')).toBeNull();
  });
});

describe('calculerDecalageEntree', () => {
  it("vaut 0 quel que soit l'avancement de l'animation quand le mouvement reduit est actif", () => {
    expect(calculerDecalageEntree(true, 0, 400)).toBe(0);
    expect(calculerDecalageEntree(true, 0.5, 400)).toBe(0);
    expect(calculerDecalageEntree(true, 1, 400)).toBe(0);
  });

  it('translate depuis la hauteur mesuree jusqu’a 0 quand le mouvement reduit est inactif', () => {
    expect(calculerDecalageEntree(false, 0, 400)).toBe(400);
    expect(calculerDecalageEntree(false, 0.5, 400)).toBe(200);
    expect(calculerDecalageEntree(false, 1, 400)).toBe(0);
  });

  // Trouvé sur iPhone le 2 novembre 2026 : la dernière ligne de la feuille de bascule
  // (« Réglages du compte ») commençait dans la zone de la barre d'accueil, où le système
  // intercepte les gestes. La feuille, collée au bas de l'écran, ajoute donc l'inset bas à son
  // propre retrait — pour toutes les feuilles de l'application, pas seulement celle-là.
  it('ajoute la zone sûre du bas à son retrait (barre d’accueil)', async () => {
    const metriques: Metrics = {
      insets: { top: 59, right: 0, bottom: 34, left: 0 },
      frame: { x: 0, y: 0, width: 393, height: 852 },
    };
    render(
      <SafeAreaProvider initialMetrics={metriques}>
        <FournisseurTheme>
          <FeuilleBasse
            ouverte
            onFermer={() => {}}
            enfants={<Text>Contenu feuille</Text>}
            testID="feuille"
          >
            <Text>Contenu ecran</Text>
          </FeuilleBasse>
        </FournisseurTheme>
      </SafeAreaProvider>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('feuille-feuille')).toHaveStyle({
        paddingBottom: espace[6] + 34,
      }),
    );
  });
});
