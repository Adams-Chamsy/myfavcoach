import { createElement, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { FeuilleBasse } from './feuille-basse';
import { Icone } from './icones';
import { useTheme } from '@/theme/fournisseur';
import { presentationV2 as mesure } from '@/theme/tokens';

export type ProprietesChoix = {
  libelle: string;
  valeur: string;
  options: readonly { valeur: string; libelle: string }[];
  onChanger: (valeur: string) => void;
  desactive?: boolean;
};

/** Liste fermée : même sélection sur web et natif, sans nouvelle dépendance native. */
export function Choix({ libelle, valeur, options, onChanger, desactive = false }: ProprietesChoix) {
  const theme = useTheme();
  const [ouvert, setOuvert] = useState(false);
  const selection = options.find((o) => o.valeur === valeur)?.libelle ?? '';
  const champ = {
    ...theme.texte.v2Champ,
    color: theme.couleur.texte.principal,
    minHeight: mesure.champHauteur,
    borderWidth: mesure.bordure,
    borderStyle: 'solid' as const,
    borderColor: theme.couleur.bordure.v2Champ,
    borderRadius: mesure.rayonChamp,
    paddingHorizontal: mesure.champHorizontal,
    paddingVertical: mesure.champVertical,
    backgroundColor: desactive ? theme.couleur.fond.creux : theme.couleur.fond.surface,
  };
  return (
    <View style={{ gap: mesure.champInterieur }}>
      <Text style={{ ...theme.texte.v2LabelChamp, color: theme.couleur.texte.principal }}>
        {libelle}
      </Text>
      {Platform.OS === 'web' ? (
        createElement(
          'select',
          {
            'aria-label': libelle,
            value: valeur,
            disabled: desactive,
            onChange: (e: { target: { value: string } }) => onChanger(e.target.value),
            style: {
              fontFamily: champ.fontFamily,
              fontSize: champ.fontSize,
              lineHeight: `${champ.lineHeight}px`,
              color: champ.color,
              minHeight: champ.minHeight,
              borderWidth: champ.borderWidth,
              borderStyle: 'solid',
              borderColor: champ.borderColor,
              borderRadius: champ.borderRadius,
              padding: `${mesure.champVertical}px ${mesure.champHorizontal}px`,
              backgroundColor: champ.backgroundColor,
              width: '100%',
            },
          },
          options.map((o) =>
            createElement('option', { key: o.valeur, value: o.valeur }, o.libelle),
          ),
        )
      ) : (
        <FeuilleBasse
          ouverte={ouvert}
          onFermer={() => setOuvert(false)}
          enfants={
            <View style={{ gap: theme.espace[1] }}>
              {options.map((o) => (
                <Pressable
                  key={o.valeur}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: o.valeur === valeur }}
                  onPress={() => {
                    onChanger(o.valeur);
                    setOuvert(false);
                  }}
                  style={{
                    minHeight: theme.taille.tapMin,
                    justifyContent: 'center',
                    paddingHorizontal: theme.espace[3],
                  }}
                >
                  <Text style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.principal }}>
                    {o.libelle}
                  </Text>
                </Pressable>
              ))}
            </View>
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${libelle}, ${selection}`}
            accessibilityState={{ disabled: desactive, expanded: ouvert }}
            disabled={desactive}
            onPress={() => setOuvert(true)}
            style={{
              ...champ,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.espace[3],
            }}
          >
            <Text style={{ ...theme.texte.v2Champ, color: theme.couleur.texte.principal, flex: 1 }}>
              {selection}
            </Text>
            <Icone nom="deplier" taille={mesure.icone} couleur={theme.couleur.texte.principal} />
          </Pressable>
        </FeuilleBasse>
      )}
    </View>
  );
}
