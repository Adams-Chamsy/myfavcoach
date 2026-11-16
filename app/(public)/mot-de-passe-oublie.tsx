import { CadreAuthentificationV2 } from '@/composants/presentation-v2';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';

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
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
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
    <CadreAuthentificationV2
      titre={'On te renvoie\nune clé.'}
      description="Indique ton adresse e-mail pour recevoir un lien."
      onRetour={() => {
        if (router.canGoBack?.()) router.back();
        else router.replace('/(public)/connexion');
      }}
      actions={
        <>
          {/* "Un champ, une action" (docs/ecrans/L1-04-connexion.md). Après l'envoi, une sortie :
          « Retour à la connexion » (B2, décidé par le développeur le 2 novembre 2026 — « un écran
          sans sortie est un défaut quelle que soit la façon dont on y arrive »). Arrivé par « Ce
          lien a expiré » (un remplacement), aucun geste système ne ramenait nulle part. */}
          <>
            {!envoye ? (
              <Bouton
                libelle="Envoyer le lien"
                variante="primaire"
                onPress={surEnvoyer}
                desactive={email.trim() === '' || chargement}
              />
            ) : (
              <Bouton
                libelle="Retour à la connexion"
                variante="primaire"
                onPress={() => router.replace('/(public)/connexion')}
              />
            )}
          </>
        </>
      }
    >
      {erreur ? (
        <EtatErreur
          titre="On a un souci de notre côté"
          explication={messageErreur(erreur)}
          nombreEchecs={nombreEchecs}
          onReessayer={surEnvoyer}
          code={erreur.code}
        />
      ) : null}

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
    </CadreAuthentificationV2>
  );
}
