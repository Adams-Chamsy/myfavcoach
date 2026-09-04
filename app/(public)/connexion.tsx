import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Champ } from '@/composants/champ';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-04-connexion.md, États : "Après trois échecs consécutifs sur le même appareil,
// ajoute... une aide, pas un blocage" — compteur local, jamais transmis au service (qui porte
// sa propre limitation de débit, voir Règles de la fiche).
const SEUIL_ECHECS_AVANT_AIDE_REINITIALISATION = 3;

function lienMotDePasseOublie(email: string): Href {
  const suffixe = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : '';
  return `/(public)/mot-de-passe-oublie${suffixe}` as Href;
}

export default function Connexion() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { port } = useSession();

  const [email, setEmail] = useState(params.email ?? '');
  const [motDePasse, setMotDePasse] = useState('');
  const [messageEchec, setMessageEchec] = useState<string | undefined>();
  const [nombreEchecs, setNombreEchecs] = useState(0);
  const [chargement, setChargement] = useState(false);

  // docs/ecrans/L1-04, États : "le focus va au mot de passe" — geste clavier réel, distinct de
  // l'annonce lecteur d'écran ci-dessous (critère 6, "sans voler le focus").
  const refMotDePasse = useRef<TextInput>(null);

  const formulaireRempli = email.trim() !== '' && motDePasse !== '';

  async function surConnecter() {
    setMessageEchec(undefined);
    setChargement(true);
    const resultat = await port.connecter(email.trim(), motDePasse);
    setChargement(false);

    if (resultat.type === 'connecte') {
      // Jamais determinerDestination(resultat.session) directement ici : depuis P1.10, la
      // destination dépend AUSSI des profils serveur (src/services/donnees/), pas seulement de
      // la session — les lire prendrait un aller-retour réseau que cet écran n'a pas à gérer
      // lui-même. "/" (app/index.tsx) attend déjà les deux fournisseurs avant de trancher :
      // un seul endroit qui calcule la vraie destination, jamais dupliqué ici.
      router.replace('/');
      return;
    }

    // docs/ecrans/L1-04, Règles : "n'est pas rejeté : il arrive sur L1-03, pas sur un message
    // d'erreur."
    if (resultat.type === 'email_non_verifie') {
      router.replace(`/(public)/verification?email=${encodeURIComponent(email.trim())}` as Href);
      return;
    }

    // Échec — un seul message, quelle que soit la cause réelle (Règles : "ce serait publier la
    // liste des comptes existants"), sauf la limitation de débit, qui a son propre message
    // traduit du service (docs/ecrans/L1-04, États).
    setNombreEchecs((n) => n + 1);
    const message =
      resultat.erreur.code === 'limite_debit'
        ? 'Trop d’essais. Réessaie dans quelques minutes.'
        : 'Adresse ou mot de passe incorrect.';
    setMessageEchec(message);
    AccessibilityInfo.announceForAccessibility(message);
    refMotDePasse.current?.focus();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + theme.espace[6],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          Content de te revoir.
        </Text>

        <Champ
          libelle="Adresse e-mail"
          type="email"
          valeur={email}
          onChangeTexte={setEmail}
          desactive={chargement}
        />

        <View style={{ gap: theme.espace[2] }}>
          <Champ
            ref={refMotDePasse}
            libelle="Mot de passe"
            type="motDePasse"
            valeur={motDePasse}
            onChangeTexte={setMotDePasse}
            desactive={chargement}
          />
          <Pressable
            onPress={() => router.push(lienMotDePasseOublie(email))}
            disabled={chargement}
            accessibilityRole="link"
            style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
          >
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Mot de passe oublié
            </Text>
          </Pressable>
        </View>

        {messageEchec ? (
          <View accessibilityLiveRegion="polite" style={{ gap: theme.espace[1] }}>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
              {messageEchec}
            </Text>
            {nombreEchecs >= SEUIL_ECHECS_AVANT_AIDE_REINITIALISATION ? (
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                Tu peux réinitialiser ton mot de passe.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[3],
          paddingBottom: insets.bottom + theme.espace[3],
          borderTopWidth: 1,
          borderTopColor: theme.couleur.bordure.discrete,
          backgroundColor: theme.couleur.fond.canevas,
          gap: theme.espace[3],
        }}
      >
        <Bouton
          libelle="Se connecter"
          variante="primaire"
          onPress={surConnecter}
          desactive={!formulaireRempli || chargement}
        />
        <View style={{ alignItems: 'center' }}>
          <Pressable
            onPress={() => router.push('/(public)/inscription' as Href)}
            disabled={chargement}
            accessibilityRole="link"
            style={{
              minHeight: theme.taille.tapMin,
              justifyContent: 'center',
              paddingHorizontal: theme.espace[3],
            }}
          >
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Pas encore de compte ·{' '}
              <Text style={{ color: theme.couleur.marque.primaire, fontWeight: '700' }}>
                Créer un compte
              </Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
