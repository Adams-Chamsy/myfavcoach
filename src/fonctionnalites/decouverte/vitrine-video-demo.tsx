import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { useTheme } from '@/theme/fournisseur';

const CHEMIN_VIDEO = '/demo/presentation-coach.mp4';

export function VitrineVideoDemo() {
  const theme = useTheme();
  const [erreur, setErreur] = useState(false);
  const [transcription, setTranscription] = useState(false);

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
        <LecteurVideoNatif onErreur={setErreur} />
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

function LecteurVideoNatif({ onErreur }: { onErreur: (erreur: boolean) => void }) {
  const theme = useTheme();
  // Metro transforme la référence au MP4 en identifiant de ressource native.
  const lecteur = useVideoPlayer(require('../../../public/demo/presentation-coach.mp4') as number);
  useEventListener(lecteur, 'statusChange', ({ status }) => onErreur(status === 'error'));

  return (
    <VideoView
      player={lecteur}
      nativeControls
      accessibilityLabel="Présentation du suivi en trois étapes"
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: theme.rayon.carte,
        backgroundColor: theme.couleur.fond.inverse,
      }}
    />
  );
}
