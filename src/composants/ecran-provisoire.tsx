import { Text, View } from 'react-native';

import { useTheme } from '@/theme/fournisseur';

export type ProprietesEcranProvisoire = {
  titre: string;
  lot: string;
};

// Delibrement laid (docs/ecrans/L0-01-coquille-client.md) : evite de confondre un ecran
// provisoire avec un ecran fini. Reutilise par tous les onglets des coquilles de navigation.
export function EcranProvisoire({ titre, lot }: ProprietesEcranProvisoire) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.espace[2],
        backgroundColor: theme.couleur.fond.canevas,
      }}
    >
      <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>{titre}</Text>
      <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>Lot {lot}</Text>
    </View>
  );
}
