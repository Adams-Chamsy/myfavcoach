import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';

import { EmplacementImage } from '@/composants/emplacement-image';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

// Île sombre (docs/ecrans/L1-01-bienvenue.md) : ce contenu lit directement themes.sombre et
// themes.clair (jamais useTheme().couleur, qui SUIT le thème ambiant du FournisseurTheme
// englobant — sombre sous le variateur de la galerie, ou un jour un vrai thème sombre). Cet
// écran doit rester une île fixe quel que soit ce thème ambiant : lire via le contexte a
// produit un vrai bug ici (texte et fond confondus au même blanc cassé pendant le passage
// sombre de npm run test:a11y) avant cette correction. Même motif que BarreNavigation pour la
// barre coach (src/composants/barre-navigation.tsx) — le deuxième et dernier endroit du jalon 1
// où c'est autorisé. theme.espace/rayon/taille/texte restent lus via useTheme() : ces groupes
// sont globaux, identiques dans les deux thèmes (src/theme/tokens.ts), jamais sujets au bug.
const sombre = themes.sombre;
const clair = themes.clair;

// Ni le logo Apple ni une enveloppe ne font partie des 36 pictogrammes fermés du système
// d'icônes (docs/design-system.md §5, src/composants/icones/) : la marque Apple obéit à ses
// propres règles de rendu, l'enveloppe ne sert probablement qu'ici au jalon 1. SVG one-off,
// jamais ajoutés à src/composants/icones/. Tracés Apple et enveloppe repris tels quels de
// maquettes/MyFavCoach-Parcours_dc.html (écran "21 Bienvenue").
function IconeApple({ couleur }: { couleur: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill={couleur}>
      <Path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.7-1.8-3.3-1.8-1.4-.1-2.6.8-3.3.8s-1.7-.8-2.9-.8c-1.5 0-2.9.9-3.6 2.3-1.6 2.7-.4 6.7 1.1 8.9.7 1 1.6 2.2 2.8 2.2 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7 2-1.1 2.7-2.1c.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.5-1-2.5-3.5zM14.2 5.9c.6-.7 1-1.7.9-2.7-.9.1-2 .6-2.6 1.3-.6.6-1 1.6-.9 2.6 1 .1 2-.4 2.6-1.2z" />
    </Svg>
  );
}

function IconeEnveloppe({ couleur }: { couleur: string }) {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth={1.9}
      strokeLinecap="round"
    >
      <Rect x={2.5} y={5} width={19} height={14} rx={3} />
      <Path d="m3.5 7 8.5 6 8.5-6" />
    </Svg>
  );
}

// Dégradé du bas de la photo vers fond.inverse, sur les 55 % inférieurs (docs/ecrans/
// L1-01-bienvenue.md). react-native-svg (déjà une dépendance, déjà utilisée par tout le système
// d'icônes) porte nativement les dégradés SVG : aucune dépendance supplémentaire
// (expo-linear-gradient) n'est nécessaire pour ce seul dégradé.
function DegradeVersEncre({ couleur }: { couleur: string }) {
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="degradeAccueil" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.45" stopColor={couleur} stopOpacity={0} />
          <Stop offset="1" stopColor={couleur} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#degradeAccueil)" />
    </Svg>
  );
}

type ProprietesActionBienvenue = {
  libelle: string;
  icone: ReactNode;
  fond: string;
  couleurTexte: string;
  bordure?: string;
  onPress: () => void;
};

// Bespoke plutôt que src/composants/bouton.tsx : Bouton n'accepte une icône que parmi les 36
// pictogrammes du système (prop `icone: NomIcone`), jamais un élément arbitraire — exactement
// ce que IconeApple/IconeEnveloppe ci-dessus ne sont pas. Reprend les mêmes règles essentielles
// (cible ≥ taille.controle, pilule, rôle bouton) sans les cinq variantes qui ne s'appliquent pas
// ici (fond clair sur île sombre pour l'une, contour clair pour l'autre — docs/ecrans/L1-01).
function ActionBienvenue({
  libelle,
  icone,
  fond,
  couleurTexte,
  bordure,
  onPress,
}: ProprietesActionBienvenue) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.espace[2],
        minHeight: theme.taille.controle,
        borderRadius: theme.rayon.pilule,
        backgroundColor: fond,
        borderWidth: bordure ? 1.5 : 0,
        borderColor: bordure,
      }}
    >
      {icone}
      <Text style={{ ...theme.texte.actionAccent, color: couleurTexte }}>{libelle}</Text>
    </Pressable>
  );
}

export default function Bienvenue() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Espaces réservés, documentés dans docs/dette.md — voir chaque commentaire ci-dessous pour
  // la raison précise de chacun.
  function surContinuerAvecApple() {
    // Aucune méthode de src/services/auth/port.ts pour Apple (P1.6 ne couvre que l'e-mail/mot
    // de passe) ; expo-apple-authentication n'est pas une dépendance du dépôt ; le parcours
    // complet n'est de toute façon pas testable dans Expo Go (docs/ecrans/L1-01-bienvenue.md,
    // "En attente de build de développement"). Espace réservé assumé, voir docs/dette.md.
  }

  function surContinuerParEmail() {
    // app/(public)/inscription.tsx n'existe pas encore (docs/ecrans/L1-02-creation-compte.md,
    // P1.8 — le prompt suivant). Cast Href : même motif que app/index.tsx pour une route dont
    // le fichier n'existe pas encore au moment où ce code est écrit.
    router.push('/(public)/inscription' as Href);
  }

  function surPorteCoach() {
    // Mémorise une intention (viaCoach), pas un compte différent (docs/ecrans/L1-01-bienvenue.md,
    // Règles). Portée en paramètre de route vers l'inscription : mécanisme provisoire, à
    // confirmer quand L1-08 (activation espace coach, qui consomme cette intention) sera écrit —
    // voir docs/dette.md.
    router.push('/(public)/inscription?viaCoach=1' as Href);
  }

  function surSeConnecter() {
    // app/(public)/connexion.tsx n'existe pas encore (docs/ecrans/L1-04-connexion.md).
    router.push('/(public)/connexion' as Href);
  }

  function surLienLegal(_document: 'cgu' | 'confidentialite') {
    // "Tant que les textes ne sont pas rédigés (lot L2, C-06), ils pointent vers une version de
    // développement datée" (docs/ecrans/L1-01-bienvenue.md, Règles) — cette version n'existe
    // pas encore. Aucune URL n'est inventée ici : espace réservé, voir docs/dette.md.
  }

  return (
    <View style={{ flex: 1, backgroundColor: clair.fond.inverse }}>
      <View style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {/* Repli EXPLICITE en tokens sombre : cet écran est une île fixe et son dégradé va vers
            l'encre. Sans ça, EmplacementImage prend marque.primaire par le contexte — vert
            foncé en clair, vert CLAIR sous la passe sombre de npm run test:a11y — et le texte
            de l'écran (surSombre, clair) devient illisible au point le plus transparent du
            dégradé (docs/ecrans/L1-01-bienvenue.md, critère 5 ; CLAUDE.md §5). */}
        <EmplacementImage
          nom="My fav Coach"
          ratio="pleinCadre"
          remplir
          fondRepli={sombre.fond.canevas}
          couleurTexteRepli={sombre.texte.surSombre}
        />
        <DegradeVersEncre couleur={clair.fond.inverse} />
        <View
          style={{
            position: 'absolute',
            left: theme.espace.gouttiere,
            right: theme.espace.gouttiere,
            bottom: theme.espace.gouttiere,
            gap: theme.espace[2],
          }}
        >
          <Text style={{ ...theme.texte.titre1, color: sombre.texte.surSombre }}>My fav Coach</Text>
          <Text style={{ ...theme.texte.display, color: sombre.texte.surSombre }}>
            Le bon coach, pas le plus bruyant
          </Text>
        </View>
      </View>

      <View
        style={{
          padding: theme.espace.gouttiere,
          paddingBottom: insets.bottom + theme.espace[6],
          gap: theme.espace[3],
        }}
      >
        {Platform.OS === 'ios' ? (
          <ActionBienvenue
            libelle="Continuer avec Apple"
            icone={<IconeApple couleur={clair.texte.principal} />}
            fond={clair.fond.canevas}
            couleurTexte={clair.texte.principal}
            onPress={surContinuerAvecApple}
          />
        ) : null}

        <ActionBienvenue
          libelle="Continuer par e-mail"
          icone={<IconeEnveloppe couleur={sombre.texte.surSombre} />}
          fond="transparent"
          couleurTexte={sombre.texte.surSombre}
          bordure={sombre.bordure.marquee}
          onPress={surContinuerParEmail}
        />

        <Text
          style={{
            ...theme.texte.legende,
            color: sombre.texte.attenue,
            textAlign: 'center',
            paddingHorizontal: theme.espace[2],
          }}
        >
          En continuant tu acceptes les{' '}
          <Text onPress={() => surLienLegal('cgu')} style={{ textDecorationLine: 'underline' }}>
            CGU
          </Text>{' '}
          et la{' '}
          <Text
            onPress={() => surLienLegal('confidentialite')}
            style={{ textDecorationLine: 'underline' }}
          >
            politique de confidentialité
          </Text>
          . Aucune donnée de santé n’est partagée sans ton accord.
        </Text>

        <View style={{ alignItems: 'center' }}>
          <Pressable
            testID="lien-connexion"
            onPress={surSeConnecter}
            accessibilityRole="link"
            style={{
              minHeight: theme.taille.tapMin,
              justifyContent: 'center',
              paddingHorizontal: theme.espace[3],
            }}
          >
            <Text style={{ ...theme.texte.legende, color: sombre.texte.attenue }}>
              J’ai déjà un compte ·{' '}
              <Text style={{ color: sombre.texte.surSombre, fontWeight: '700' }}>Se connecter</Text>
            </Text>
          </Pressable>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Pressable
            testID="lien-porte-coach"
            onPress={surPorteCoach}
            accessibilityRole="link"
            style={{
              minHeight: theme.taille.tapMin,
              justifyContent: 'center',
              paddingHorizontal: theme.espace[3],
            }}
          >
            <Text
              style={{ ...theme.texte.petit, fontWeight: '700', color: sombre.marque.primaire }}
            >
              Je suis coach, je veux publier
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
