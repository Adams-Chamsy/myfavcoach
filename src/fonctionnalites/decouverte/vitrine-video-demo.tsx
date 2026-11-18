import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { useTheme } from '@/theme/fournisseur';

const CHEMIN_VIDEO = '/demo/presentation-coach.mp4';

export function VitrineVideoDemo() {
  const theme = useTheme();
  const [erreur, setErreur] = useState(false);
  const [transcription, setTranscription] = useState(false);

  async function ouvrirVideo() {
    try {
      const origine = process.env.EXPO_PUBLIC_ORIGINE_VITRINE_DEMO;
      if (!origine) {
        setErreur(true);
        return;
      }
      await Linking.openURL(new URL(CHEMIN_VIDEO, origine).href);
      setErreur(false);
    } catch {
      setErreur(true);
    }
  }

  return (
    <View style={{ gap: theme.espace[3] }}>
      <Text
        accessibilityRole="header"
        style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}
      >
        Comment se passe le premier mois ?
      </Text>
      {Platform.OS === 'web' ? (
        <video
          aria-label="Présentation du suivi en trois étapes"
          controls
          playsInline
          preload="metadata"
          onError={() => setErreur(true)}
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: theme.rayon.carte,
            background: theme.couleur.fond.inverse,
          }}
        >
          <source src={CHEMIN_VIDEO} type="video/mp4" />
        </video>
      ) : (
        <Bouton
          libelle="Lire la vidéo de démonstration"
          variante="secondaire"
          onPress={ouvrirVideo}
        />
      )}
      {erreur ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.couleur.etat.erreurEncre }}>
          La vidéo est indisponible ici. Tu peux lire la transcription.
        </Text>
      ) : null}
      <View style={{ alignItems: 'flex-start' }}>
        <Bouton
          libelle={transcription ? 'Masquer la transcription' : 'Lire la transcription'}
          variante="discret"
          onPress={() => setTranscription((ouverte) => !ouverte)}
        />
      </View>
      {transcription ? (
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
          On fait le point sur ton niveau et le temps dont tu disposes. Je te propose des séances
          qui s’intègrent à ta semaine. On ajuste le programme selon tes retours et tes progrès.
        </Text>
      ) : null}
    </View>
  );
}
