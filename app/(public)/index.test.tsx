import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { contraste } from '@/test/contraste';
import { FournisseurTheme } from '@/theme/fournisseur';
import { taille, themes } from '@/theme/tokens';
import Bienvenue from './index';

type Noeud = ReactTestRendererJSON | string | null;

// Même motif que src/composants/barre-navigation.test.tsx : parcours simple de l'arbre rendu,
// pas de dépendance à une API RTL plus haut niveau pour retrouver un noeud par type/props natifs.
function trouver(
  noeud: Noeud,
  predicat: (noeud: ReactTestRendererJSON) => boolean,
): ReactTestRendererJSON | null {
  if (!noeud || typeof noeud === 'string') return null;
  if (predicat(noeud)) return noeud;
  for (const enfant of noeud.children ?? []) {
    const trouve = trouver(enfant, predicat);
    if (trouve) return trouve;
  }
  return null;
}

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

    // "MF" : initiales de "My Fav Coach" (src/composants/initiales.ts), masquées du lecteur
    // d'écran — le conteneur porte déjà accessibilityLabel="My Fav Coach".
    expect(screen.getByText('MF', { includeHiddenElements: true })).toBeTruthy();
    // Deux éléments distincts portent désormais ce même libellé : le repli de la photo héroïque
    // (celui-ci) ET le symbole de marque au-dessus des actions (assets/marque/README.md,
    // "Écran 21 · Bienvenue") — chacun porte du sens pour le lecteur d'écran, jamais de la
    // décoration, voir le test dédié plus bas.
    expect(screen.getAllByLabelText('My Fav Coach')).toHaveLength(2);
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
  // le titre n'est jamais tronqué par numberOfLines, et le panneau d'actions n'est pas
  // enveloppé dans un défilement — sa hauteur suit son contenu, jamais une hauteur fixe qui
  // couperait à 200 %. Ce que ce test NE prouve PAS : que le texte tient réellement sans
  // chevauchement visuel à 200 % — cela demande un moteur de rendu réel.
  it("le titre n'est jamais tronqué, et le panneau d'actions n'a pas de hauteur fixe", async () => {
    await rendreBienvenue();

    const titre = screen.getByText('Un meilleur toi, chaque jour.');
    expect(titre.props.numberOfLines).toBeUndefined();
  });

  it('aucune valeur en dur : le titre utilise display, pas 38', async () => {
    await rendreBienvenue();

    const titre = screen.getByText('Un meilleur toi, chaque jour.');
    expect(titre.props.style.fontSize).toBe(44);
  });

  // Révision du 19 septembre 2026 (planche de marque, écran de lancement) : l'ancienne accroche
  // disparaît, remplacée par ce titre en haut d'écran et un trait sable dessous.
  it("l'ancienne accroche n'apparaît plus", async () => {
    await rendreBienvenue();

    expect(screen.queryByText('Le bon coach, pas le plus bruyant')).toBeNull();
  });

  it('le trait sous le titre utilise le token de marque, jamais une couleur en dur', async () => {
    const { toJSON } = await rendreBienvenue();

    const trait = trouver(
      toJSON(),
      (n) => n.type === 'View' && n.props?.style?.backgroundColor === themes.clair.marque.ruban,
    );
    expect(trait).toBeTruthy();
  });

  // assets/marque/README.md, "Écran 21 · Bienvenue" : le symbole remplace le bloc de titre,
  // environ 88 px, jamais le verrouillage complet (symbole + nom) — le nom est déjà porté par
  // l'icône de l'app et par le système au lancement.
  it('le symbole de marque fait 88 px et porte le nom pour le lecteur d’écran, sans le répéter en texte', async () => {
    const { toJSON } = await rendreBienvenue();

    // Le symbole seul (accessibilityRole="image") se distingue du repli d'EmplacementImage
    // (accessibilityRole absent, testé au-dessus) : les deux partagent le même libellé, pas le
    // même rôle.
    const conteneur = trouver(
      toJSON(),
      (n) =>
        n.props?.accessibilityLabel === 'My Fav Coach' && n.props?.accessibilityRole === 'image',
    );
    expect(conteneur).toBeTruthy();

    const svg = trouver(conteneur, (n) => n.type === 'RNSVGSvgView');
    expect(svg?.props.width).toBe(88);
    expect(svg?.props.height).toBe(88);

    // Le nom ne doit jamais réapparaître en texte à côté du symbole (verrouillage complet
    // écarté, README) : "My Fav Coach" ne doit exister nulle part comme contenu de <Text>.
    expect(screen.queryByText('My Fav Coach')).toBeNull();
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
