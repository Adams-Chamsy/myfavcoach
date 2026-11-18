import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
  isAvailableAsync,
} from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';

import logoGoogle from '../../../assets/marque/google-g-connexion.png';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { optionsSociales } from '@/services/auth/options-sociales';
import type { FournisseurConnexion } from '@/services/auth/port';
import { useTheme } from '@/theme/fournisseur';

export function BoutonsConnexionSociale({
  mode,
  desactive,
  surOccupation,
}: {
  mode: 'connexion' | 'liaison';
  desactive?: boolean;
  surOccupation?: (occupe: boolean) => void;
}) {
  const theme = useTheme();
  const { port, session } = useSession();
  const cours = useRef(false);
  const [attente, setAttente] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [appleDisponible, setAppleDisponible] = useState(false);
  useEffect(() => {
    if (!optionsSociales.apple) return;
    let monte = true;
    void isAvailableAsync()
      .then((disponible) => {
        if (monte) setAppleDisponible(disponible);
      })
      .catch(() => {});
    return () => {
      monte = false;
    };
  }, []);
  const dejaAssocies = mode === 'liaison' ? session?.fournisseurs : undefined;
  const proposerApple = appleDisponible && !dejaAssocies?.includes('apple');
  const proposerGoogle =
    optionsSociales.google &&
    (Platform.OS === 'android' || appleDisponible) &&
    !dejaAssocies?.includes('google');
  if (!proposerApple && !proposerGoogle && !message) return null;

  async function ouvrir(fournisseur: FournisseurConnexion, libelle: string) {
    if (cours.current) return;
    cours.current = true;
    setAttente(true);
    setMessage(null);
    surOccupation?.(true);
    try {
      const resultat = await port.connexionSociale(fournisseur, mode);
      if (resultat === 'echec') setMessage('La connexion n’a pas abouti. Réessaie.');
      if (resultat === 'reussie' && mode === 'liaison') setMessage(`Compte ${libelle} associé.`);
    } catch {
      setMessage('La connexion n’a pas abouti. Réessaie.');
    } finally {
      cours.current = false;
      setAttente(false);
      surOccupation?.(false);
    }
  }

  return (
    <View style={{ gap: theme.espace[3] }}>
      {mode === 'liaison' && (proposerApple || proposerGoogle) ? (
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
          Associer un autre moyen de connexion
        </Text>
      ) : null}
      {proposerApple ? (
        <View pointerEvents={desactive || attente ? 'none' : 'auto'}>
          <AppleAuthenticationButton
            buttonType={AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={theme.rayon.saisie}
            style={{ height: theme.taille.controle, width: '100%' }}
            accessibilityState={{ disabled: desactive || attente }}
            onPress={() => {
              if (!desactive && !attente) void ouvrir('apple', 'Apple');
            }}
          />
        </View>
      ) : null}
      {proposerGoogle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: desactive || attente }}
          accessibilityLabel="Continuer avec Google"
          disabled={desactive || attente}
          onPress={() => void ouvrir('google', 'Google')}
          style={{
            minHeight: theme.taille.controle,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.espace[3],
            paddingHorizontal: theme.espace[4],
            borderWidth: 1,
            borderRadius: theme.rayon.saisie,
            // Couleurs du bouton clair définies par Google Identity.
            backgroundColor: 'rgb(255,255,255)',
            borderColor: 'rgb(116,119,117)',
            opacity: desactive || attente ? 0.65 : 1,
          }}
        >
          <Image
            accessible={false}
            source={logoGoogle}
            style={{ width: 18, height: 18 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgb(31,31,31)' }}>
            Continuer avec Google
          </Text>
        </Pressable>
      ) : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ ...theme.texte.petit, color: theme.couleur.texte.principal }}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
