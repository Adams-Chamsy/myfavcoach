import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Path, Svg } from 'react-native-svg';

import splashLogoClair from '../assets/marque/splash-logo-clair.png';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { Progression } from '@/composants/progression';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { determinerDestination } from '@/fonctionnalites/identite/garde';
import { useTheme } from '@/theme/fournisseur';

// Seuils de docs/ecrans/L0-04-demarrage.md, section "Contenu" : au-dela de 3 s, message
// d'attente ; au-dela de 10 s, EtatErreur.
const DELAI_ATTENTE_MS = 3000;
const DELAI_ERREUR_MS = 10000;

// Doit rester synchronisee AVEC ios.imageWidth (app.json, plugin expo-splash-screen) : c'est la
// largeur exacte a laquelle le splash natif iOS affiche assets/marque/splash-logo-clair.png,
// centre sur l'ecran -- verifie empiriquement (pas suppose) dans le SplashScreen.storyboard
// genere par `npx expo prebuild` : EXPO-SplashScreen porte des contraintes centerX/centerY vers
// EXPO-ContainerView, un cadre de 260x260 avec contentMode scaleAspectFit. Reprendre exactement
// cette valeur ici, au meme point de l'ecran, est ce qui evite un saut visible au retrait du
// splash natif (docs/ecrans/L0-04-demarrage.md, critere 1). Aucune lecture automatique possible
// entre app.json et ce fichier : a verifier a la main si l'un des deux change.
const LARGEUR_LOGO_DEMARRAGE = 260;
// Proportions reelles du fichier (verifiees : `sips -g pixelWidth -g pixelHeight`), pas
// supposees depuis le README.
const RATIO_LOGO_DEMARRAGE = 880 / 1200;

// Aucun token ne couvre une hauteur de vague decorative (theme.espace s'arrete a 64,
// design/tokens.json) : constante locale documentee, meme motif que TAILLE_PASTILLE
// (app/(public)/verification.tsx). Voir docs/dette.md.
const HAUTEUR_VAGUE = 96;

type Phase = 'lecture' | 'attente' | 'erreur';

// Vague sable en deux couches superposees (assets/marque/README.md, planche de marque -- "splash
// clair"). Geometrie dessinee pour cet ecran, jamais tracee depuis une maquette HTML : aucune
// n'existe pour L0-04 (docs/ecrans/L0-04-demarrage.md, "Ce qui a ete invente"). Purement
// decorative, jamais exposee au lecteur d'ecran -- meme motif que DegradeVersEncre
// (app/(public)/index.tsx).
function VagueSable({
  couleurArriere,
  couleurAvant,
}: {
  couleurArriere: string;
  couleurAvant: string;
}) {
  return (
    <View testID="vague-sable" accessibilityElementsHidden importantForAccessibility="no">
      <Svg width="100%" height={HAUTEUR_VAGUE} viewBox="0 0 400 120" preserveAspectRatio="none">
        <Path
          d="M0,40 C100,10 200,70 300,35 C350,15 380,45 400,40 L400,120 L0,120 Z"
          fill={couleurArriere}
        />
        <Path
          d="M0,70 C90,95 180,45 280,75 C340,95 370,60 400,70 L400,120 L0,120 Z"
          fill={couleurAvant}
        />
      </Svg>
    </View>
  );
}

// docs/ecrans/L0-04-demarrage.md : "verrouillage logo (splash-logo-clair.png), vague sable,
// barre de progression". Remplace la lettre M en Instrument Serif (revision du 19 septembre
// 2026, voir docs/dette.md pour l'ancienne constante TAILLE_LOGO retiree).
//
// Route de redirection (docs/ecrans/L0-04-demarrage.md, sequence 6). La session vient du
// fournisseur (useSession, src/fonctionnalites/identite/fournisseur-session.tsx), qui restaure
// depuis le stockage chiffré du client Supabase — c'est le comportement normal du client, pas
// un contournement. AUCUNE deuxieme memoire locale (src/services/trousseau/, lot L0, supprime
// en preparant P1.8) : une session fraichement etablie ailleurs (inscription, lien profond)
// n'a qu'une seule source, jamais deux qui pourraient diverger.
export default function Index() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

  // Barre de progression, docs/ecrans/L0-04-demarrage.md, "Contenu" : trois etapes REELLES,
  // jamais une minuterie. "Polices" est toujours acquise des l'instant ou cet ecran existe --
  // app/_layout.tsx (sequence 1-2 de la meme fiche) ne rend jamais cet arbre tant que useFonts()
  // n'a pas resolu (charge ou en echec) : un fait garanti par la structure du fournisseur
  // racine, pas une supposition posee ici. "Session" et "profil" restent les deux etapes
  // reellement observables depuis ce composant, via les deux memes booleens qui pilotent deja
  // la redirection ci-dessus. Reduction de mouvement deja geree par <Progression> elle-meme
  // (src/composants/progression.tsx, useMouvementReduit) : rien a repeter ici.
  const etapesTerminees = 1 + (chargementSession ? 0 : 1) + (chargementDonnees ? 0 : 1);
  const valeurProgression = Math.round((etapesTerminees / 3) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      {/* Logo centre plein ecran, position absolue : ne doit JAMAIS etre deplace par la vague ou
          la barre ci-dessous -- c'est la position exacte du splash natif iOS (voir
          LARGEUR_LOGO_DEMARRAGE). */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={splashLogoClair}
          accessibilityLabel="My Fav Coach"
          style={{
            width: LARGEUR_LOGO_DEMARRAGE,
            height: LARGEUR_LOGO_DEMARRAGE * RATIO_LOGO_DEMARRAGE,
          }}
          resizeMode="contain"
        />
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <VagueSable
          couleurArriere={theme.couleur.marque.secondaire}
          couleurAvant={theme.couleur.marque.ruban}
        />
        <View
          style={{
            paddingHorizontal: theme.espace.gouttiere,
            paddingTop: theme.espace[4],
            paddingBottom: insets.bottom + theme.espace[6],
            gap: theme.espace[3],
          }}
        >
          <Progression
            variante="barre"
            valeur={valeurProgression}
            accessibilityLabel="Préparation de l'application"
          />
          {phase === 'attente' ? (
            <Text
              style={{
                ...theme.texte.petit,
                color: theme.couleur.texte.secondaire,
                textAlign: 'center',
              }}
            >
              On prépare ton espace
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
