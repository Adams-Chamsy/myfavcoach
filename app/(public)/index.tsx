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

// Symbole de marque (assets/marque/mfc-symbole.svg, assets/marque/README.md "Symbole seul") :
// hors des 36 pictogrammes fermés du système d'icônes (docs/design-system.md §5) — un logo, pas
// un pictogramme d'interface. SVG one-off, jamais ajouté à src/composants/icones/, même motif
// que IconeApple/IconeEnveloppe ci-dessus. Tracés repris tels quels du fichier vectorisé
// (viewBox 200×200), colonnes couleur en tokens plutôt qu'en dur : themes.clair.marque.primaire
// (vert sapin) coïncide avec le hex source par construction (assets/marque/README.md, tableau
// Couleurs — "aucune valeur inventée"), mais le sable du ruban n'avait aucun token existant qui
// lui corresponde (entre marque.secondaire et gris.300, jamais égal à l'un ou l'autre) : ajouté
// à design/tokens.json (marque.ruban, régénéré par npm run tokens) plutôt qu'écrit en dur ici —
// CLAUDE.md §3, "si une valeur manque, elle s'ajoute dans le JSON". Lu explicitement sur
// themes.clair (jamais via useTheme()) : c'est une constante graphique de la marque, pas une
// couleur d'interface qui doit suivre le thème ambiant — même motif que clair/sombre en tête de
// fichier, et vrai même le jour où un thème sombre existera réellement (le symbole ne se
// recolore pas avec l'écran qui l'entoure).
function SymboleMarque({ taille }: { taille: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 200 200">
      <Path
        d="M125.53,143.65L124.71,143.65L115.34,150.44L104.21,158.18L103.67,158.86L102.58,158.86L102.85,166.06L102.58,174.21L102.72,191.18L103.67,191.18L117.92,178.28L123.22,173.93L124.85,171.90L125.26,170.13Z M195.86,35.71L161.10,54.44L147.25,62.73L131.77,74.13L122.68,83.09L113.85,94.36L108.15,104.96L104.89,114.19L103.39,120.57L102.58,128.31L102.99,130.08L103.80,130.08L103.67,128.04L104.62,125.32L110.46,117.04L118.87,108.08L126.07,101.70L143.59,89.34L176.99,68.97L182.69,64.76L188.40,59.47L195.19,50.78L195.86,50.64Z"
        fill={clair.marque.ruban}
        fillRule="evenodd"
      />
      <Path
        d="M50.17,113.10L50.17,141.62L50.44,143.52L51.93,146.91L54.38,149.49L86.69,178.14L87.51,178.14L87.51,146.91L87.24,145.01L86.29,142.70L84.79,140.67L52.20,114.05L50.98,113.10Z M154.72,95.86L153.77,95.86L133.67,109.17L107.06,128.04L103.12,131.30L102.85,132.25L102.85,158.18L103.67,158.18L149.56,125.05L152.41,122.07L153.91,119.35L154.72,116.36Z M6.58,156.69L32.24,178.01L32.65,84.32L75.83,117.72L108.15,84.45L121.05,72.91L154.72,50.23L137.21,51.46L117.11,57.97L100.27,67.62L74.61,87.03L22.60,44.12L15.00,41.41L7.94,43.31L5.49,45.89L4.14,50.10L4.00,149.77Z M161.51,8.96L158.66,8.68L154.45,8.96L151.46,9.91L148.61,11.40L146.71,12.89L143.99,15.75L142.64,18.05L141.55,20.63L140.87,23.76L140.74,26.20L141.01,29.05L142.36,33.13L144.13,35.98L145.90,37.88L148.07,39.51L151.73,41.14L155.81,41.82L158.25,41.68L161.51,41.00L165.18,39.37L168.57,36.93L170.34,34.89L171.83,32.45L172.92,29.73L173.60,26.61L173.73,24.16L172.92,19.55L171.97,17.10L169.79,13.98L167.21,11.54L164.36,9.91Z"
        fill={clair.marque.primaire}
        fillRule="evenodd"
      />
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

  // L2-03 (C-06) : ouvre la surface publique du lecteur de document, sans session — même route
  // que celle wirée depuis app/(public)/inscription.tsx.
  function surLienLegal(document: 'cgu' | 'confidentialite') {
    router.push(`/(public)/documents/${document}` as Href);
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
          {/* Symbole seul, jamais le verrouillage complet (assets/marque/README.md, "Écran 21 ·
              Bienvenue") : le nom est déjà porté par l'icône de l'application et par le système
              au lancement — le répéter ici prendrait la place de l'accroche, qui est ce qui doit
              se lire. Le symbole porte du sens (c'est la marque), pas de la décoration : rôle et
              libellé explicites, comme EmplacementImage le fait déjà pour une vraie photo sur cet
              écran, jamais accessibilityElementsHidden. */}
          <View accessible accessibilityRole="image" accessibilityLabel="My fav Coach">
            <SymboleMarque taille={88} />
          </View>
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
