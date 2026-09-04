import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { EtatErreur } from '@/composants/etats/etat-erreur';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { determinerDestination } from '@/fonctionnalites/identite/garde';
import { useTheme } from '@/theme/fournisseur';
import { font } from '@/theme/tokens';

// Seuils de docs/ecrans/L0-04-demarrage.md, section "Contenu" : au-dela de 3 s, message
// d'attente ; au-dela de 10 s, EtatErreur.
const DELAI_ATTENTE_MS = 3000;
const DELAI_ERREUR_MS = 10000;

// docs/ecrans/L0-04-demarrage.md : "la lettre M en Instrument Serif, 64 pt". Aucun token de
// taille de texte ne vaut 64 (texte.display, le plus proche, vaut 44) : constante locale
// documentee plutot qu'un ajout muet. Voir docs/dette.md.
const TAILLE_LOGO = 64;

type Phase = 'lecture' | 'attente' | 'erreur';

// Route de redirection (docs/ecrans/L0-04-demarrage.md, sequence 6). La session vient du
// fournisseur (useSession, src/fonctionnalites/identite/fournisseur-session.tsx), qui restaure
// depuis le stockage chiffré du client Supabase — c'est le comportement normal du client, pas
// un contournement. AUCUNE deuxieme memoire locale (src/services/trousseau/, lot L0, supprime
// en preparant P1.8) : une session fraichement etablie ailleurs (inscription, lien profond)
// n'a qu'une seule source, jamais deux qui pourraient diverger.
export default function Index() {
  const theme = useTheme();
  const { chargement: chargementSession, session } = useSession();
  const { chargement: chargementDonnees, profils } = useDonnees();
  // P1.10 : le profil actif vient du serveur (src/services/donnees/), pas seulement la session
  // — determinerDestination attend les DEUX avant de trancher. FournisseurDonnees ne lit
  // jamais le port tant qu'aucune session vérifiée n'existe, donc chargementDonnees se résout
  // vite (false) dans tous les cas où il n'y a rien à attendre.
  const chargement = chargementSession || chargementDonnees;
  const [phase, setPhase] = useState<Phase>('lecture');
  const [nombreEchecs, setNombreEchecs] = useState(0);
  const [cleTentative, setCleTentative] = useState(0);

  useEffect(() => {
    if (!chargement) return;

    let monte = true;
    const minuteurAttente = setTimeout(() => {
      if (monte) setPhase('attente');
    }, DELAI_ATTENTE_MS);
    const minuteurErreur = setTimeout(() => {
      if (monte) {
        setPhase('erreur');
        setNombreEchecs((n) => n + 1);
      }
    }, DELAI_ERREUR_MS);

    return () => {
      monte = false;
      clearTimeout(minuteurAttente);
      clearTimeout(minuteurErreur);
    };
    // cleTentative : rejoue les minuteurs sur "Reessayer", sans quoi une premiere lecture lente
    // laisserait la phase bloquee sur "erreur" indefiniment.
  }, [chargement, cleTentative]);

  // JAMAIS de redirection par defaut vers l'espace public tant que chargement est vrai : sinon
  // un eclair d'ecran public precede l'espace reel d'un utilisateur qui a une session valide.
  // Trouve en preparant P1.8 avec le trousseau (l'ancienne memoire de session, qui ne savait
  // jamais qu'une session Supabase venait d'etre etablie).
  if (!chargement) {
    return <Redirect href={determinerDestination(session, profils)} />;
  }

  if (phase === 'erreur') {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: theme.espace[6],
          backgroundColor: theme.couleur.fond.canevas,
        }}
      >
        <EtatErreur
          titre="Ça prend plus de temps que prévu"
          explication="On continue d'essayer d'ouvrir ton espace."
          nombreEchecs={nombreEchecs}
          onReessayer={() => {
            setPhase('lecture');
            setCleTentative((c) => c + 1);
          }}
          onNousEcrire={() => {
            setPhase('lecture');
            setCleTentative((c) => c + 1);
          }}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.espace[4],
        backgroundColor: theme.couleur.fond.canevas,
      }}
    >
      <Text
        accessibilityLabel="My fav Coach"
        style={{
          fontFamily: font.displayRegular,
          fontSize: TAILLE_LOGO,
          color: theme.couleur.marque.primaire,
        }}
      >
        M
      </Text>
      {phase === 'attente' ? (
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
          On prépare ton espace
        </Text>
      ) : null}
    </View>
  );
}
