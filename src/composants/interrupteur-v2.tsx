import { Platform, Pressable, Switch, View, type SwitchProps } from 'react-native';
import { useTheme } from '@/theme/fournisseur';
import { presentationV2 as mesure } from '@/theme/tokens';

/** Le contrôle web suit la V2 ; le contrôle natif conserve le geste système. */
export function InterrupteurV2(props: SwitchProps) {
  const theme = useTheme();
  if (Platform.OS !== 'web') return <Switch {...props} />;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityHint={props.accessibilityHint}
      accessibilityState={{ checked: !!props.value, disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={() => props.onValueChange?.(!props.value)}
      style={{
        minWidth: mesure.interrupteurLargeur,
        minHeight: theme.taille.tapMin,
        justifyContent: 'center',
        opacity: props.disabled ? mesure.actionOpaciteDesactivee : 1,
      }}
    >
      <View
        style={{
          width: mesure.interrupteurLargeur,
          height: mesure.interrupteurHauteur,
          borderRadius: theme.rayon.pilule,
          backgroundColor: props.value ? theme.couleur.marque.primaire : theme.couleur.gris[300],
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: mesure.interrupteurDecalage,
            left: props.value ? mesure.interrupteurDecalageActif : mesure.interrupteurDecalage,
            width: mesure.interrupteurCurseur,
            height: mesure.interrupteurCurseur,
            borderRadius: theme.rayon.pilule,
            backgroundColor: theme.couleur.fond.surface,
          }}
        />
      </View>
    </Pressable>
  );
}
