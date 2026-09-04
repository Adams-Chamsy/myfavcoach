import { Pressable, Text, View } from 'react-native';

import { Icone } from '@/composants/icones';
import { useTheme, type ThemeResolu } from '@/theme/fournisseur';
import { font } from '@/theme/tokens';

type ProprietesChipCategorie = {
  libelle: string;
  variante?: 'categorie';
};

type ProprietesChipFiltre = {
  libelle: string;
  variante: 'filtre';
  selectionne: boolean;
  onPress: () => void;
};

type ProprietesChipFiltreRetirable = {
  libelle: string;
  variante: 'filtreRetirable';
  selectionne: boolean;
  onPress: () => void;
  onRetirer: () => void;
  // Pas de "?" : la croix seule, sans libelle de lecteur d'ecran, ne doit pas exister
  // (meme logique que ProprietesBoutonIcone dans src/composants/bouton-icone.tsx).
  accessibilityLabelRetirer: string;
};

// docs/ecrans/L1-05-onboarding-client.md, etape 2/4 : "Chips multi-selection, hauteur 44,
// selectionnee en fond.inverse + coche" — distinct de 'filtre' (marque.primaireTeinte2), qui
// sert un usage different (filtres de recherche, jamais construits a ce lot).
type ProprietesChipSelection = {
  libelle: string;
  variante: 'selection';
  selectionne: boolean;
  onPress: () => void;
};

export type ProprietesChip =
  | ProprietesChipCategorie
  | ProprietesChipFiltre
  | ProprietesChipFiltreRetirable
  | ProprietesChipSelection;

function couleursChip(theme: ThemeResolu, proprietes: ProprietesChip) {
  const { couleur } = theme;
  if (proprietes.variante === 'filtre' || proprietes.variante === 'filtreRetirable') {
    return proprietes.selectionne
      ? { fond: couleur.marque.primaireTeinte2, texte: couleur.marque.primaireSurvol }
      : { fond: couleur.fond.creux, texte: couleur.texte.secondaire };
  }
  if (proprietes.variante === 'selection') {
    return proprietes.selectionne
      ? { fond: couleur.fond.inverse, texte: couleur.texte.surMarque }
      : { fond: couleur.fond.surface, texte: couleur.texte.principal };
  }
  return { fond: couleur.marque.primaireTeinte, texte: couleur.marque.primaireSurvol };
}

export function Chip(proprietes: ProprietesChip) {
  const theme = useTheme();
  const { libelle } = proprietes;
  const { fond, texte } = couleursChip(theme, proprietes);
  const estSelection = proprietes.variante === 'selection';

  const etiquette = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.espace[1],
        paddingVertical: theme.espace[2],
        paddingHorizontal: theme.espace[3],
        borderRadius: theme.rayon.badge,
        backgroundColor: fond,
        borderWidth: estSelection && !proprietes.selectionne ? 1 : 0,
        borderColor: theme.couleur.bordure.marquee,
        minHeight: estSelection ? theme.taille.tapMin : undefined,
        justifyContent: 'center',
      }}
    >
      {estSelection && proprietes.selectionne ? (
        <Icone nom="valide" taille={theme.taille.croixChip} couleur={texte} />
      ) : null}
      <Text style={{ ...theme.texte.legende, fontFamily: font.uiBold, color: texte }}>
        {libelle}
      </Text>
    </View>
  );

  if (
    proprietes.variante !== 'filtre' &&
    proprietes.variante !== 'filtreRetirable' &&
    proprietes.variante !== 'selection'
  ) {
    return etiquette;
  }

  if (proprietes.variante === 'selection') {
    return (
      <Pressable
        onPress={proprietes.onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: proprietes.selectionne }}
      >
        {etiquette}
      </Pressable>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[1] }}>
      <Pressable
        onPress={proprietes.onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: proprietes.selectionne }}
      >
        {etiquette}
      </Pressable>

      {proprietes.variante === 'filtreRetirable' ? (
        <Pressable
          onPress={proprietes.onRetirer}
          accessibilityRole="button"
          accessibilityLabel={proprietes.accessibilityLabelRetirer}
          style={{
            minWidth: theme.taille.tapMin,
            minHeight: theme.taille.tapMin,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icone nom="fermer" taille={theme.taille.croixChip} couleur={texte} />
        </Pressable>
      ) : null}
    </View>
  );
}
