import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Champ } from '@/composants/champ';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { ErreurAuth } from '@/services/auth/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-04-connexion.md, "Mot de passe oublié" : réponse constante, quelle que soit
// l'adresse. Même texte que src/services/auth/faux.ts/supabase.ts garantissent déjà côté port —
// cet écran ne fait qu'afficher ce que le port renvoie, jamais "amélioré" ici.
const MESSAGE_CONFIRMATION = 'Si un compte existe avec cette adresse, le lien est parti.';

function messageErreur(erreur: ErreurAuth): string {
  if (erreur.code === 'limite_debit') return 'Trop d’essais. Réessaie dans quelques minutes.';
  if (erreur.code === 'reseau') return 'Pas de connexion. Réessaie.';
  return 'On a un souci de notre côté. Ce n’est pas toi.';
}

export default function MotDePasseOublie() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const { port } = useSession();

  const [email, setEmail] = useState(params.email ?? '');
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<ErreurAuth | undefined>();
  const [nombreEchecs, setNombreEchecs] = useState(0);
  const [chargement, setChargement] = useState(false);

  async function surEnvoyer() {
    if (email.trim() === '') return;
    setErreur(undefined);
    setChargement(true);
    const resultat = await port.demanderReinitialisation(email.trim());
    setChargement(false);

    if (!resultat.succes) {
      setNombreEchecs((n) => n + 1);
      setErreur(resultat.erreur);
      return;
    }

    // Aucune énumération de comptes : même écran, même texte, adresse existante ou non — c'est
    // le port lui-même qui garantit cette réponse constante, jamais amélioré ici.
    setEnvoye(true);
    AccessibilityInfo.announceForAccessibility(MESSAGE_CONFIRMATION);
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
        {erreur ? (
          <EtatErreur
            titre="On a un souci de notre côté"
            explication={messageErreur(erreur)}
            nombreEchecs={nombreEchecs}
            onReessayer={surEnvoyer}
            onNousEcrire={() => {}}
            code={erreur.code}
          />
        ) : null}

        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          On te renvoie une clé.
        </Text>

        {envoye ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}
          >
            {MESSAGE_CONFIRMATION}
          </Text>
        ) : (
          <Champ
            libelle="Adresse e-mail"
            type="email"
            valeur={email}
            onChangeTexte={setEmail}
            desactive={chargement}
          />
        )}
      </ScrollView>

      {/* "Un champ, une action" (docs/ecrans/L1-04-connexion.md) : la fiche ne décrit rien
          après l'envoi — aucun bouton de retour inventé ici, voir docs/dette.md. Le geste
          système (glissement iOS, bouton matériel Android) reste disponible. */}
      {!envoye ? (
        <View
          style={{
            paddingHorizontal: theme.espace.gouttiere,
            paddingTop: theme.espace[3],
            paddingBottom: insets.bottom + theme.espace[3],
            borderTopWidth: 1,
            borderTopColor: theme.couleur.bordure.discrete,
            backgroundColor: theme.couleur.fond.canevas,
          }}
        >
          <Bouton
            libelle="Envoyer le lien"
            variante="primaire"
            onPress={surEnvoyer}
            desactive={email.trim() === '' || chargement}
          />
        </View>
      ) : null}
    </View>
  );
}
