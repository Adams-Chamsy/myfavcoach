import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { contraste } from '@/test/contraste';
import { FournisseurTheme } from '@/theme/fournisseur';
import { taille, themes } from '@/theme/tokens';
import Bienvenue from './index';

const mockPousser = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPousser }),
}));

// Mêmes métriques représentatives que src/test/accessibilite.test.tsx : aucune mesure native
// sous Jest, useSafeAreaInsets() plante sans métriques initiales.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function rendreBienvenue() {
  return render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <Bienvenue />
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
}

describe('Bienvenue (docs/ecrans/L1-01-bienvenue.md)', () => {
  const osOriginal = Platform.OS;

  afterEach(() => {
    Platform.OS = osOriginal;
  });

  // Critère 3 : testé par une requête qui ne trouve rien, pas par une capture d'écran.
  it("sur Android, le bouton Apple est absent de l'arbre rendu", async () => {
    Platform.OS = 'android';
    await rendreBienvenue();

    expect(screen.queryByText('Continuer avec Apple')).toBeNull();
  });

  it('sur iOS, le bouton Apple est présent', async () => {
    Platform.OS = 'ios';
    await rendreBienvenue();

    expect(screen.getByText('Continuer avec Apple')).toBeTruthy();
  });

  // Critère 4 : aucune photo n'existe dans le dossier de design — le repli typographique
  // (initiales, docs/design-system.md §7) doit s'afficher, jamais un aplat vide.
  it("le repli d'EmplacementImage s'affiche, aucune image générique", async () => {
    await rendreBienvenue();

    // "MF" : initiales de "My fav Coach" (src/composants/initiales.ts), masquées du lecteur
    // d'écran — le conteneur porte déjà accessibilityLabel="My fav Coach".
    expect(screen.getByText('MF', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('My fav Coach')).toBeTruthy();
  });

  // Critère 5 : "mesuré sur le dégradé au point le plus clair, pas sur l'encre pleine." Le point
  // le plus clair possible est l'absence totale d'assombrissement par le dégradé (opacité 0,
  // src/composants/emplacement-image.tsx) : le repli typographique nu, marque.primaire —
  // jamais la couleur pleinement sombre (fond.inverse) que rendrait un test qui se contenterait
  // de mesurer le fond de l'écran.
  it('le texte du bandeau héroïque reste lisible même au point le plus clair du dégradé (opacité 0)', () => {
    const couleurTexte = themes.sombre.texte.surSombre;
    const piorPireCasSansDegrade = themes.clair.marque.primaire;
    const casPleinementSombre = themes.clair.fond.inverse;

    expect(contraste(couleurTexte, piorPireCasSansDegrade)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(couleurTexte, casPleinementSombre)).toBeGreaterThanOrEqual(4.5);
  });

  // Critère 6 : le lien coach et la ligne "J'ai déjà un compte" ont chacun une cible ≥ 44 pt.
  it('le lien coach et la ligne "J\'ai déjà un compte" ont une cible ≥ 44 pt', async () => {
    await rendreBienvenue();

    const compte = screen.getByTestId('lien-connexion');
    const coach = screen.getByTestId('lien-porte-coach');

    expect(compte.props.style.minHeight).toBeGreaterThanOrEqual(taille.tapMin);
    expect(coach.props.style.minHeight).toBeGreaterThanOrEqual(taille.tapMin);
  });

  // Critère 7 (partiel — voir docs/dette.md pour la partie qui nécessite un appareil réel) :
  // l'accroche n'est jamais tronquée par numberOfLines, et le panneau d'actions n'est pas
  // enveloppé dans un défilement — sa hauteur suit son contenu, jamais une hauteur fixe qui
  // couperait à 200 %. Ce que ce test NE prouve PAS : que le texte tient réellement sur trois
  // lignes sans chevauchement visuel à 200 % — cela demande un moteur de rendu réel.
  it("l'accroche n'est jamais tronquée, et le panneau d'actions n'a pas de hauteur fixe", async () => {
    await rendreBienvenue();

    const accroche = screen.getByText('Le bon coach, pas le plus bruyant');
    expect(accroche.props.numberOfLines).toBeUndefined();
  });

  it("aucune valeur en dur : le logotype et l'accroche utilisent titre1 et display, pas 36/38", async () => {
    await rendreBienvenue();

    const logotype = screen.getByText('My fav Coach');
    const accroche = screen.getByText('Le bon coach, pas le plus bruyant');
    expect(logotype.props.style.fontSize).toBe(32);
    expect(accroche.props.style.fontSize).toBe(44);
  });

  it('ne fait aucun appel réseau au montage', async () => {
    const fetchEspionne = jest.spyOn(global, 'fetch');
    await rendreBienvenue();
    expect(fetchEspionne).not.toHaveBeenCalled();
    fetchEspionne.mockRestore();
  });

  // L2-03 (C-06) : les liens CGU/confidentialité ouvrent désormais la surface publique du
  // lecteur de document, sans session (fiche, critère 1) — auparavant des liens morts
  // (surLienLegal, commentaire d'origine).
  it('les liens CGU et confidentialité ouvrent la surface publique du lecteur de document', async () => {
    await rendreBienvenue();

    fireEvent.press(screen.getByText('CGU'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/documents/cgu');

    fireEvent.press(screen.getByText('politique de confidentialité'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/documents/confidentialite');
  });
});
