import { Text, View } from 'react-native';

import { useTheme } from '@/theme/fournisseur';
import { weight } from '@/theme/tokens';

export type TailleAvatar = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type ProprietesAvatar = {
  nom: string;
  taille?: TailleAvatar;
  // Petit indicateur en surimpression (presence, role...). Couleur ET libelle requis
  // ensemble : un statut ne se porte jamais par la seule couleur (docs/design-system.md §2).
  pastille?: { couleur: string; accessibilityLabel: string };
};

const TAILLES: Record<
  TailleAvatar,
  'avatarXs' | 'avatarSm' | 'avatarMd' | 'avatarLg' | 'avatarXl'
> = {
  xs: 'avatarXs',
  sm: 'avatarSm',
  md: 'avatarMd',
  lg: 'avatarLg',
  xl: 'avatarXl',
};

// Aucune photo n'est fournie par le dossier de design : l'avatar n'affiche jamais que ce
// repli en initiales, sur marque.primaire (docs/design-system.md §7).
function initiales(nom: string) {
  return nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join('');
}

export function Avatar({ nom, taille = 'md', pastille }: ProprietesAvatar) {
  const theme = useTheme();
  const dimension = theme.taille[TAILLES[taille]];
  // Pas de token pour une echelle de police par taille d'avatar : approximation
  // proportionnelle a la dimension, documentee ici plutot que codee en dur ailleurs.
  const tailleTexte = Math.round(dimension * 0.36);

  // Un seul element accessible pour tout l'avatar : la pastille imbriquee n'est pas
  // annoncee separement par un lecteur d'ecran, son libelle est donc fusionne ici.
  const nomAccessible = pastille ? `${nom}, ${pastille.accessibilityLabel}` : nom;

  return (
    <View
      accessible
      accessibilityLabel={nomAccessible}
      style={{ width: dimension, height: dimension }}
    >
      <View
        style={{
          width: dimension,
          height: dimension,
          borderRadius: theme.rayon.pilule,
          backgroundColor: theme.couleur.marque.primaire,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: theme.texte.corps.fontFamily,
            fontSize: tailleTexte,
            fontWeight: weight.bold,
            color: theme.couleur.texte.surMarque,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {initiales(nom)}
        </Text>
      </View>

      {pastille ? (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: theme.espace[3],
            height: theme.espace[3],
            borderRadius: theme.rayon.pilule,
            backgroundColor: pastille.couleur,
            borderWidth: 2,
            borderColor: theme.couleur.fond.surface,
          }}
        />
      ) : null}
    </View>
  );
}
