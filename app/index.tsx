import { useEffect, useState } from 'react';
import { Redirect, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { EtatErreur } from '@/composants/etats/etat-erreur';
import { lireSession } from '@/services/trousseau/trousseau';
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

// Route de redirection (docs/ecrans/L0-04-demarrage.md, sequence 6) : ecran de developpement,
// route reelle en L1.
export default function Index() {
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>('lecture');
  const [destination, setDestination] = useState<Href | null>(null);
  const [nombreEchecs, setNombreEchecs] = useState(0);
  const [cleTentative, setCleTentative] = useState(0);

  useEffect(() => {
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

    // Aucun appel reseau au demarrage (docs/ecrans/L0-04-demarrage.md, regle) : la redirection
    // se decide entierement sur le contenu local du trousseau securise ; la validation du
    // jeton se fera au premier appel reel, en L1.
    lireSession()
      .then(({ jeton, profilActif }) => {
        if (!monte) return;
        clearTimeout(minuteurAttente);
        clearTimeout(minuteurErreur);
        // `as Href` : .expo/types/router.d.ts, genere hors serveur de developpement (via
        // `expo export`), ne produit qu'un type de route generique sans les chemins absolus
        // litteraux — ces trois routes existent bel et bien (verifie par le rendu de
        // `expo export -p web`, docs/ecrans/L0-01/L0-02/L0-04). Le vrai serveur `expo start`
        // regenere un fichier plus precis qui rendrait ce cast inutile.
        setDestination(
          (!jeton
            ? '/(public)/accueil'
            : profilActif === 'coach'
              ? '/(coach)/pilotage'
              : '/(client)/accueil') as Href,
        );
      })
      .catch(() => {
        if (!monte) return;
        clearTimeout(minuteurAttente);
        clearTimeout(minuteurErreur);
        setPhase('erreur');
        setNombreEchecs((n) => n + 1);
      });

    return () => {
      monte = false;
      clearTimeout(minuteurAttente);
      clearTimeout(minuteurErreur);
    };
  }, [cleTentative]);

  if (destination) {
    return <Redirect href={destination} />;
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
