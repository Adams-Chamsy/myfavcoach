import { readFileSync } from 'fs';
import { join } from 'path';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { FournisseurTheme } from '@/theme/fournisseur';
import { font, taille, themes } from '@/theme/tokens';
import {
  BarreNavigation,
  type ElementNavigation,
  type ProprietesBarreNavigation,
} from './barre-navigation';

type Noeud = ReactTestRendererJSON | string | null;

function elementsClient(indexActif = 0): ElementNavigation[] {
  const base: Omit<ElementNavigation, 'actif' | 'onPress'>[] = [
    { icone: 'accueil', libelle: 'Accueil' },
    { icone: 'recherche', libelle: 'Explorer' },
    { icone: 'seance', libelle: 'Séance' },
    { icone: 'message', libelle: 'Messages' },
    { icone: 'profil', libelle: 'Moi' },
  ];
  return base.map((element, index) => ({
    ...element,
    actif: index === indexActif,
    onPress: jest.fn(),
  }));
}

function elementsCoach(): ElementNavigation[] {
  return [
    { icone: 'pilotage', libelle: 'Pilotage', actif: true, onPress: jest.fn() },
    { icone: 'clients', libelle: 'Clients', onPress: jest.fn() },
    { icone: 'ajouter', libelle: 'Créer', misEnAvant: true, onPress: jest.fn() },
    { icone: 'agenda', libelle: 'Agenda', onPress: jest.fn() },
    { icone: 'virement', libelle: 'Revenus', onPress: jest.fn() },
  ];
}

async function rendreBarre(proprietes: ProprietesBarreNavigation) {
  return render(
    <FournisseurTheme>
      <BarreNavigation {...proprietes} />
    </FournisseurTheme>,
  );
}

// Traverse toJSON() a la recherche du premier noeud dont les props correspondent au filtre :
// utilise pour lire le strokeWidth pose par IconeBase (src/composants/icones/icone-base.tsx),
// non expose autrement par le composant.
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

describe('BarreNavigation', () => {
  // Critere 2 (docs/ecrans/L0-01-coquille-client.md) : "chaque cible tactile mesure au moins
  // 44 pt de haut". La largeur vient de flex:1 sur 5 colonnes d'une barre pleine largeur —
  // toujours tres au-dessus de 44 pt sur un appareil reel, non mesurable en layout simule.
  it('donne a chaque onglet une hauteur minimale de 44 pt, y compris "Créer"', async () => {
    const { toJSON } = await rendreBarre({ variante: 'coach', elements: elementsCoach() });

    const onglets: ReactTestRendererJSON[] = [];
    function collecter(noeud: Noeud) {
      if (!noeud || typeof noeud === 'string') return;
      if (noeud.props?.accessibilityRole === 'tab' || noeud.props?.accessibilityRole === 'button') {
        onglets.push(noeud);
      }
      for (const enfant of noeud.children ?? []) collecter(enfant);
    }
    collecter(toJSON());

    expect(onglets).toHaveLength(5);
    for (const onglet of onglets) {
      expect(onglet.props.style.minHeight).toBeGreaterThanOrEqual(taille.tapMin);
    }
  });

  // Critere 3 (docs/ecrans/L0-01-coquille-client.md) : identifiable "sans la couleur" —
  // epaisseur de trait de l'icone (iconeTraitActif vs iconeTrait) et graisse du libelle.
  it("distingue l'onglet actif par l'epaisseur du trait et le poids du libelle, pas par la seule couleur", async () => {
    const { toJSON } = await rendreBarre({ variante: 'client', elements: elementsClient(0) });

    const arbre = toJSON();
    const traitActif = trouver(
      arbre,
      (n) => n.type === 'RNSVGSvgView' && n.props?.strokeWidth === taille.iconeTraitActif,
    );
    const traitsInactifs: ReactTestRendererJSON[] = [];
    function collecterTraits(noeud: Noeud) {
      if (!noeud || typeof noeud === 'string') return;
      // RNSVGSvgView seulement : le RNSVGGroup interne repete le meme strokeWidth et compterait deux fois.
      if (noeud.type === 'RNSVGSvgView' && noeud.props?.strokeWidth === taille.iconeTrait) {
        traitsInactifs.push(noeud);
      }
      for (const enfant of noeud.children ?? []) collecterTraits(enfant);
    }
    collecterTraits(arbre);

    expect(traitActif).toBeTruthy();
    expect(traitsInactifs).toHaveLength(4);

    expect(screen.getByText('Accueil').props.style.fontFamily).toBe(font.uiBold);
    expect(screen.getByText('Explorer').props.style.fontFamily).toBe(font.uiSemibold);
  });

  // Critere 4 (docs/ecrans/L0-01-coquille-client.md) : "VoiceOver annonce « Accueil, onglet,
  // sélectionné, 1 sur 5 »" — phrase reprise a l'identique.
  it('expose le role, l’etat selectionne et le libelle accessible attendus par VoiceOver', async () => {
    await rendreBarre({ variante: 'client', elements: elementsClient(0) });

    const accueil = screen.getByLabelText('Accueil, onglet, sélectionné, 1 sur 5');
    expect(accueil.props.accessibilityRole).toBe('tab');
    expect(accueil.props.accessibilityState).toEqual({ selected: true });

    const explorer = screen.getByLabelText('Explorer, onglet, 2 sur 5');
    expect(explorer.props.accessibilityState).toEqual({ selected: false });
  });

  // Critere 7 (docs/ecrans/L0-01-coquille-client.md) : le libelle accessible de la pastille de
  // non-lus contient le nombre.
  it('fusionne le nombre de non-lus dans le libelle accessible de la pastille', async () => {
    const elements = elementsClient(0);
    elements[3] = { ...elements[3], pastilleNonLus: 3 };
    await rendreBarre({ variante: 'client', elements });

    expect(screen.getByLabelText('Messages, 3 non lus, onglet, 4 sur 5')).toBeTruthy();
  });

  it('appelle onPress au toucher', async () => {
    const elements = elementsClient(0);
    await rendreBarre({ variante: 'client', elements });

    await fireEvent.press(screen.getByLabelText('Explorer, onglet, 2 sur 5'));

    expect(elements[1].onPress).toHaveBeenCalledTimes(1);
  });

  // Critere 2 (docs/ecrans/L0-02-coquille-coach.md) : "Créer" n'est jamais annonce comme
  // selectionne, role "bouton", pas "onglet".
  it('"Créer" a le role bouton, jamais selectionne', async () => {
    await rendreBarre({ variante: 'coach', elements: elementsCoach() });

    const creer = screen.getByLabelText('Créer');
    expect(creer.props.accessibilityRole).toBe('button');
    expect(creer.props.accessibilityState?.selected).toBeUndefined();
  });

  // Critere 3 (docs/ecrans/L0-02-coquille-coach.md) : "tous les couples texte/fond de la barre
  // atteignent 4,5:1". texte.surSombre a 70 % sur themes.sombre.fond.canevas mesure 7,74:1,
  // l'actif plein 7,58:1 (calcul WCAG manuel ; couvert aussi par npm run test:a11y, qui rend la
  // galerie sous les deux valeurs de themeForce).
  // "La barre encre est une île sombre... elle utilise les tokens sombre pour son contenu."
  it('utilise les tokens du theme sombre pour le contenu de la barre coach, quel que soit le theme ambiant', async () => {
    await rendreBarre({ variante: 'coach', elements: elementsCoach() });

    const pilotage = screen.getByLabelText('Pilotage, onglet, sélectionné, 1 sur 5');
    expect(pilotage.props.style.opacity).toBe(1);
    expect(screen.getByText('Pilotage').props.style.color).toBe(themes.sombre.marque.primaire);

    const clients = screen.getByLabelText('Clients, onglet, 2 sur 5');
    expect(clients.props.style.opacity).toBe(0.7);
    expect(screen.getByText('Clients').props.style.color).toBe(themes.sombre.texte.surSombre);
  });

  // Bug releve en galerie (section 9, theme sombre) : le fond de la barre coach suivait le theme
  // ambiant (theme.couleur.fond.inverse) alors que son contenu restait fixe (themes.sombre) —
  // des que le theme ambiant passait en sombre, "inverse" bascule vers un fond clair, donne un
  // fond clair sous un texte clair, illisible. La barre coach est une ile encre : fond ET
  // contenu doivent rester identiques sous les deux valeurs de themeForce. La barre client, elle,
  // doit suivre le theme ambiant de bout en bout — c'est la seule qui doit changer.
  it('garde la barre coach identique quel que soit themeForce, et fait suivre la barre client au theme ambiant', async () => {
    const { rerender } = await render(
      <FournisseurTheme themeForce="clair">
        <BarreNavigation variante="coach" elements={elementsCoach()} />
      </FournisseurTheme>,
    );
    const fondCoachClair = screen.getByLabelText('Pilotage, onglet, sélectionné, 1 sur 5').parent!
      .props.style.backgroundColor;
    const texteCoachClair = screen.getByText('Clients').props.style.color;

    await rerender(
      <FournisseurTheme themeForce="sombre">
        <BarreNavigation variante="coach" elements={elementsCoach()} />
      </FournisseurTheme>,
    );
    const fondCoachSombre = screen.getByLabelText('Pilotage, onglet, sélectionné, 1 sur 5').parent!
      .props.style.backgroundColor;
    const texteCoachSombre = screen.getByText('Clients').props.style.color;

    expect(fondCoachClair).toBe(themes.sombre.fond.canevas);
    expect(fondCoachSombre).toBe(themes.sombre.fond.canevas);
    expect(texteCoachClair).toBe(themes.sombre.texte.surSombre);
    expect(texteCoachSombre).toBe(themes.sombre.texte.surSombre);

    await rerender(
      <FournisseurTheme themeForce="clair">
        <BarreNavigation variante="client" elements={elementsClient(0)} />
      </FournisseurTheme>,
    );
    const fondClientClair = screen.getByLabelText('Accueil, onglet, sélectionné, 1 sur 5').parent!
      .props.style.backgroundColor;
    const texteClientClair = screen.getByText('Explorer').props.style.color;

    await rerender(
      <FournisseurTheme themeForce="sombre">
        <BarreNavigation variante="client" elements={elementsClient(0)} />
      </FournisseurTheme>,
    );
    const fondClientSombre = screen.getByLabelText('Accueil, onglet, sélectionné, 1 sur 5').parent!
      .props.style.backgroundColor;
    const texteClientSombre = screen.getByText('Explorer').props.style.color;

    expect(fondClientClair).toBe(themes.clair.fond.canevas);
    expect(fondClientSombre).toBe(themes.sombre.fond.canevas);
    expect(texteClientClair).toBe(themes.clair.texte.secondaire);
    expect(texteClientSombre).toBe(themes.sombre.texte.secondaire);
    expect(fondClientClair).not.toBe(fondClientSombre);
    expect(texteClientClair).not.toBe(texteClientSombre);
  });

  // Critere 6 (docs/ecrans/L0-02-coquille-coach.md) : "aucune valeur de couleur écrite en dur
  // dans le fichier de la barre" — verifie par lecture directe du fichier source, en plus de la
  // regle eslint no-hex-color-literal deja active sur src/.
  it('ne contient aucune couleur hexadecimale en dur dans son fichier source', () => {
    const source = readFileSync(join(__dirname, 'barre-navigation.tsx'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('ajoute la marge basse fournie (zones sures du systeme) a la marge de base', async () => {
    const theme = { espace: { 4: 16 } };
    const { toJSON } = await rendreBarre({
      variante: 'client',
      elements: elementsClient(0),
      paddingBas: 34,
    });

    const conteneur = toJSON()!;
    expect(conteneur.props.style.paddingBottom).toBe(theme.espace[4] + 34);
  });

  // Critere 7 (docs/ecrans/L0-02-coquille-coach.md) : basculer (client) -> (coach) change le
  // fond de la barre. Le "sans remontage complet de l'arbre" est une garantie de structure
  // (deux ecrans freres d'un meme Stack racine, docs/dette.md) : non mesurable par ce test, qui
  // verifie seulement la moitie visuelle.
  it('change de fond selon la variante', async () => {
    const { rerender } = await rendreBarre({ variante: 'client', elements: elementsClient(0) });
    const fondClient = screen.getByLabelText('Accueil, onglet, sélectionné, 1 sur 5').parent!.props
      .style.backgroundColor;

    await rerender(
      <FournisseurTheme>
        <BarreNavigation variante="coach" elements={elementsCoach()} />
      </FournisseurTheme>,
    );
    const fondCoach = screen.getByLabelText('Pilotage, onglet, sélectionné, 1 sur 5').parent!.props
      .style.backgroundColor;

    expect(fondClient).not.toBe(fondCoach);
  });
});
