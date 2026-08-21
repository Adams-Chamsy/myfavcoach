import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/fournisseur';

export type ProprietesChamp = {
  libelle: string;
  valeur: string;
  onChangeTexte: (texte: string) => void;
  messageErreur?: string;
  placeholder?: string;
};

export function Champ({
  libelle,
  valeur,
  onChangeTexte,
  messageErreur,
  placeholder,
}: ProprietesChamp) {
  const theme = useTheme();
  const [estFocus, setEstFocus] = useState(false);
  const enErreur = Boolean(messageErreur);

  const couleurLabel = enErreur
    ? theme.couleur.etat.erreurEncre
    : estFocus
      ? theme.couleur.marque.primaire
      : theme.couleur.gris[500];

  const couleurBordure = enErreur
    ? theme.couleur.etat.erreur
    : estFocus
      ? theme.couleur.bordure.focus
      : theme.couleur.bordure.marquee;

  // Composition explicite plutot que accessibilityLabelledBy : ce dernier REMPLACE
  // accessibilityLabel des qu'il resout un texte (verifie via le calcul de nom accessible de
  // React Native Testing Library, identique a VoiceOver/TalkBack) — un champ en erreur
  // s'annoncerait alors par son message et perdrait son identification. Ici le libelle reste
  // toujours present, le message d'erreur s'y ajoute.
  const nomAccessible = enErreur ? `${libelle}, erreur : ${messageErreur}` : libelle;

  // Pas de accessibilityState.invalid : ce champ n'existe pas en React Native
  // (AccessibilityState ne definit que disabled, selected, checked, busy, expanded — aucun
  // equivalent a aria-invalid du web). Le nom accessible compose ci-dessus est le seul
  // vecteur disponible pour porter l'information d'erreur au lecteur d'ecran.
  return (
    <View style={{ gap: theme.espace[2] }}>
      <Text style={{ ...theme.texte.label, color: couleurLabel }}>{libelle}</Text>

      <View
        style={
          estFocus && {
            borderRadius: theme.rayon.saisie + theme.taille.focusHalo,
            padding: theme.taille.focusHalo,
            backgroundColor: theme.couleur.bordure.focusHalo,
          }
        }
      >
        <TextInput
          value={valeur}
          onChangeText={onChangeTexte}
          onFocus={() => setEstFocus(true)}
          onBlur={() => setEstFocus(false)}
          placeholder={placeholder}
          placeholderTextColor={theme.couleur.gris[400]}
          accessibilityLabel={nomAccessible}
          style={{
            height: theme.taille.controle,
            borderRadius: theme.rayon.saisie,
            borderWidth: theme.taille.focusContour,
            borderColor: couleurBordure,
            backgroundColor:
              estFocus || enErreur ? theme.couleur.fond.surface : theme.couleur.fond.canevas,
            paddingHorizontal: theme.espace[4],
            ...theme.texte.corps,
            color: theme.couleur.texte.principal,
          }}
        />
      </View>

      {/* Message d'erreur sous le champ, jamais en surimpression : espace reserve dans le
          flux normal, pas une bulle positionnee par-dessus le contenu suivant. Affiche tel
          quel visuellement ; c'est nomAccessible ci-dessus qui porte l'info au lecteur
          d'ecran, pas ce Text (qui n'est pas lie au champ par un accessibilityLabelledBy). */}
      {enErreur ? (
        <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
          {messageErreur}
        </Text>
      ) : null}
    </View>
  );
}
