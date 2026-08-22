import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { FournisseurTheme } from '@/theme/fournisseur';
import { espace } from '@/theme/tokens';
import { BarreOngletsRoute, type ActionCentrale, type EntreeOnglet } from './barre-onglets';

const ENTREES: EntreeOnglet[] = [
  { nomRoute: 'pilotage', icone: 'pilotage', libelle: 'Pilotage' },
  { nomRoute: 'clients', icone: 'clients', libelle: 'Clients' },
  { nomRoute: 'agenda', icone: 'agenda', libelle: 'Agenda' },
  { nomRoute: 'revenus', icone: 'virement', libelle: 'Revenus' },
];

function creerBottomTabBarProps(indexActif = 0, emetDefaultPrevented = false) {
  // "creer" n'est dans aucune entree de ONGLETS : une route href:null du meme genre que
  // app/(coach)/creer/ (voir barre-onglets.tsx), presente dans state.routes mais qui ne doit
  // jamais apparaitre comme un onglet.
  const routes = [
    ...ENTREES.map((entree) => ({ key: `${entree.nomRoute}-key`, name: entree.nomRoute })),
    { key: 'creer-key', name: 'creer' },
  ];
  const navigate = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented: emetDefaultPrevented }));

  return {
    // Double minimal de BottomTabBarProps : seuls state.index/routes, navigation.navigate/emit
    // et insets.bottom sont lus par BarreOngletsRoute. Le reste de l'interface de React
    // Navigation (des dizaines de champs) n'a pas de sens pour ce test.
    props: {
      state: { index: indexActif, routes },
      descriptors: {},
      navigation: { navigate, emit },
      insets: { top: 0, left: 0, right: 0, bottom: 34 },
    } as unknown as BottomTabBarProps,
    navigate,
    emit,
  };
}

async function rendre(
  indexActif = 0,
  actionCentrale?: ActionCentrale,
  emetDefaultPrevented = false,
) {
  const { props, navigate, emit } = creerBottomTabBarProps(indexActif, emetDefaultPrevented);
  await render(
    <FournisseurTheme>
      <BarreOngletsRoute
        variante="coach"
        entrees={ENTREES}
        actionCentrale={actionCentrale}
        {...props}
      />
    </FournisseurTheme>,
  );
  return { navigate, emit };
}

describe('BarreOngletsRoute', () => {
  it('navigue vers la route pressee quand elle est inactive', async () => {
    const { navigate, emit } = await rendre(0);

    await fireEvent.press(screen.getByLabelText('Clients, onglet, 2 sur 4'));

    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'clients-key',
      canPreventDefault: true,
    });
    expect(navigate).toHaveBeenCalledWith('clients');
  });

  // docs/ecrans/L0-01-coquille-client.md : "l'appui sur l'onglet deja actif" doit tout de meme
  // emettre l'evenement (futur point d'accroche pour remonter la vue), sans re-naviguer.
  it("emet tabPress mais ne navigue pas quand l'onglet presse est deja actif", async () => {
    const { navigate, emit } = await rendre(0);

    await fireEvent.press(screen.getByLabelText('Pilotage, onglet, sélectionné, 1 sur 4'));

    expect(emit).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ne navigue pas si un ecouteur de tabPress annule la navigation par defaut', async () => {
    const { navigate } = await rendre(0, undefined, true);

    await fireEvent.press(screen.getByLabelText('Clients, onglet, 2 sur 4'));

    expect(navigate).not.toHaveBeenCalled();
  });

  // Critere 1 (docs/ecrans/L0-02-coquille-coach.md) : "Créer" ouvre une feuille basse, ce n'est
  // pas une route. Insere en position 2 : Agenda (route reelle) se retrouve donc en 4 sur 5.
  it("insere l'action centrale sans qu'elle soit une route, en decalant la position des suivantes", async () => {
    const onPress = jest.fn();
    await rendre(0, { position: 2, icone: 'ajouter', libelle: 'Créer', onPress });

    const creer = screen.getByLabelText('Créer');
    expect(creer.props.accessibilityRole).toBe('button');

    await fireEvent.press(creer);
    expect(onPress).toHaveBeenCalledTimes(1);

    expect(screen.getByLabelText('Agenda, onglet, 4 sur 5')).toBeTruthy();
  });

  it('transmet insets.bottom comme marge basse de la barre', async () => {
    await rendre(0);

    const conteneur = screen.getByLabelText('Pilotage, onglet, sélectionné, 1 sur 4').parent!;
    expect(conteneur.props.style.paddingBottom).toBe(espace[4] + 34);
  });

  // Une route presente dans le groupe mais absente de ONGLETS (ex. app/(coach)/creer/, une
  // pile imbriquee marquee href:null) ne doit jamais devenir un onglet.
  it('ignore une route du groupe qui ne figure pas dans les entrees configurees', async () => {
    await rendre(0);

    expect(screen.queryByLabelText(/creer/i)).toBeNull();
    expect(screen.getByLabelText('Revenus, onglet, 4 sur 4')).toBeTruthy();
  });
});
