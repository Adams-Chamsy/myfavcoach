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

export type ProprietesChip =
  ProprietesChipCategorie | ProprietesChipFiltre | ProprietesChipFiltreRetirable;

// docs/design-system.md §6 : "croix 16 dans une cible de 44". Aucun token de taille d'icone
// ne vaut 16 (seul taille.icone = 24 existe) : constante locale documentee plutot qu'un
// ajout muet a design/tokens.json. Voir docs/dette.md.
const TAILLE_CROIX = 16;

function couleursChip(theme: ThemeResolu, proprietes: ProprietesChip) {
  const { couleur } = theme;
  if (proprietes.variante === 'filtre' || proprietes.variante === 'filtreRetirable') {
    return proprietes.selectionne
      ? { fond: couleur.marque.primaireTeinte2, texte: couleur.marque.primaireSurvol }
      : { fond: couleur.fond.creux, texte: couleur.texte.secondaire };
  }
  return { fond: couleur.marque.primaireTeinte, texte: couleur.marque.primaireSurvol };
}

export function Chip(proprietes: ProprietesChip) {
  const theme = useTheme();
  const { libelle } = proprietes;
  const { fond, texte } = couleursChip(theme, proprietes);

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
      }}
    >
      <Text style={{ ...theme.texte.legende, fontFamily: font.uiBold, color: texte }}>
        {libelle}
      </Text>
    </View>
  );

  if (proprietes.variante !== 'filtre' && proprietes.variante !== 'filtreRetirable') {
    return etiquette;
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
          <Icone nom="fermer" taille={TAILLE_CROIX} couleur={texte} />
        </Pressable>
      ) : null}
    </View>
  );
}
