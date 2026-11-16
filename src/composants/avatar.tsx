import { Text, View } from 'react-native';

import { initiales } from '@/composants/initiales';
import { useTheme } from '@/theme/fournisseur';
import { usePresentationV2 } from './presentation-v2';
import { font, presentationV2 as mesure } from '@/theme/tokens';

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

export function Avatar({ nom, taille = 'md', pastille }: ProprietesAvatar) {
  const theme = useTheme();
  const presentationV2 = usePresentationV2();
  const dimension =
    presentationV2 && taille === 'sm'
      ? mesure.avatarEntete
      : presentationV2 && taille === 'lg'
        ? mesure.avatarProfil
        : theme.taille[TAILLES[taille]];
  // Pas de token pour une echelle de police par taille d'avatar : approximation
  // proportionnelle a la dimension, documentee ici plutot que codee en dur ailleurs.
  const tailleTexte =
    presentationV2 && taille === 'sm'
      ? theme.texte.v2Petit.fontSize
      : presentationV2 && taille === 'lg'
        ? mesure.avatarProfilTexte
        : Math.round(dimension * 0.36);

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
          backgroundColor: presentationV2
            ? theme.couleur.marque.secondaire
            : theme.couleur.marque.primaire,
          borderWidth: presentationV2 ? mesure.bordure : 0,
          borderColor: theme.couleur.bordure.v2Avatar,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          // Manrope grasse, jamais Instrument Serif : des initiales de repli sont de
          // l'information utilitaire, pas de l'editorial — Instrument Serif est reserve aux
          // titres et aux chiffres cles (docs/design-system.md §3 et §7). Meme traitement dans
          // EmplacementImage (src/composants/emplacement-image.tsx).
          style={{
            fontFamily: font.uiBold,
            fontSize: tailleTexte,
            color: presentationV2
              ? theme.couleur.marque.secondaireEncre
              : theme.couleur.texte.surMarque,
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
