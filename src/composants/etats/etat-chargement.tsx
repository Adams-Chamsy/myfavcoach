import { Text, View } from 'react-native';

import { Squelette, type FormeSquelette } from '@/composants/squelette';
import { useTheme } from '@/theme/fournisseur';

export type ProprietesEtatChargement = {
  forme: FormeSquelette;
  nombre: number;
  // Affiche une phrase sous les squelettes quand l'attente est explicable. Sinon rien : ne
  // jamais meubler (docs/ecrans/L0-03-etats-systeme.md).
  raison?: string;
};

// Jamais de spinner plein ecran : ce composant ne rend que des squelettes (Squelette gere
// deja sa pulsation d'opacite, 1200 ms, desactivee en mouvement reduit) — aucun
// ActivityIndicator n'apparait ici, ni directement ni via une dependance.
export function EtatChargement({ forme, nombre, raison }: ProprietesEtatChargement) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.espace[3] }}>
      {Array.from({ length: nombre }, (_, index) => (
        // squelettes sans identifiant propre, ordre stable
        <Squelette key={index} forme={forme} />
      ))}

      {raison ? (
        <Text
          style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue, textAlign: 'center' }}
        >
          {raison}
        </Text>
      ) : null}
    </View>
  );
}
