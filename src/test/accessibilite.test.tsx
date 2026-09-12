import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import Galerie from '../../app/_galerie';
import Accueil from '../../app/(client)/accueil';
import Explorer from '../../app/(client)/explorer';
import Seance from '../../app/(client)/seance';
import Messages from '../../app/(client)/messages';
import Moi from '../../app/(client)/moi';
import MoiCoach from '../../app/(coach)/moi';
import Pilotage from '../../app/(coach)/pilotage';
import Clients from '../../app/(coach)/clients';
import Agenda from '../../app/(coach)/agenda';
import Revenus from '../../app/(coach)/revenus';
import Bienvenue from '../../app/(public)/index';
import Inscription from '../../app/(public)/inscription';
import Verification from '../../app/(public)/verification';
import Connexion from '../../app/(public)/connexion';
import MotDePasseOublie from '../../app/(public)/mot-de-passe-oublie';
import NouveauMotDePasse from '../../app/(public)/nouveau-mot-de-passe';
import Confidentialite from '../../app/(compte)/confidentialite';
import Documents from '../../app/(compte)/documents';
import Export from '../../app/(compte)/export';
import Identifiants from '../../app/(compte)/identifiants';
import Informations from '../../app/(compte)/informations';
import Suppression from '../../app/(compte)/suppression';
import DevenirCoach from '../../app/(onboarding)/devenir-coach';
import OnboardingIdentite from '../../app/(onboarding)/1-identite';
import OnboardingObjectifs from '../../app/(onboarding)/2-objectifs';
import OnboardingPoids from '../../app/(onboarding)/3-poids';
import OnboardingCestParti from '../../app/(onboarding)/4-cest-parti';
import { creerSessionDemonstration } from '@/fixtures/session-demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import { taille, themes } from '@/theme/tokens';
import { contraste, melangerCouleur } from './contraste';

// EnteteOnboarding (P1.11) appelle router.canGoBack() PENDANT le rendu (pas seulement dans un
// gestionnaire) pour décider si le bouton retour s'affiche — le seul appel de router.* de ce
// corpus qui s'exécute synchronement au montage, plutôt que dans un onPress jamais déclenché
// ici. La vraie implémentation lève ("Cannot read properties of undefined (reading 'isReady')")
// hors d'un vrai conteneur de navigation, qu'aucun écran de ce corpus n'a — pas seulement les
// quatre d'onboarding. push/back/replace restent réels (jamais appelés pendant un rendu
// statique par aucun écran ici) : seul canGoBack est réécrit, à false — honnête hors navigation
// réelle, rien à quoi revenir.
jest.mock('expo-router', () => {
  const reel = jest.requireActual('expo-router');
  return {
    ...reel,
    useRouter: () => ({ ...reel.useRouter(), canGoBack: () => false }),
    // useGardeSortie (app/(compte)/informations.tsx) appelle useNavigation().addListener
    // ('beforeRemove', ...) — l'implémentation réelle lève hors d'un vrai conteneur de
    // navigation, qu'aucun écran de ce corpus n'a. Stub inerte : le listener n'est jamais
    // notifié ici (aucune sortie n'est jouée), on vérifie seulement le rendu.
    useNavigation: () => ({ addListener: () => () => {}, dispatch: () => {} }),
  };
});

// npm run test:a11y (docs/prompts/L0.md, P0.14). Parcourt un corpus de rendu couvrant
// src/composants/ (la galerie, app/_galerie.tsx, en exerce a peu pres 100 %) et app/ (les
// ecrans provisoires des trois coquilles). Volontairement hors corpus : app/_layout.tsx et
// app/index.tsx (polices, ecran de demarrage, splash screen — necessitent de simuler
// expo-font/expo-splash-screen/expo-secure-store sans rien apporter de nouveau : leurs seules
// couleurs, marque.primaire sur fond.canevas et texte.secondaire sur fond.canevas, sont deja
// couvertes ailleurs dans ce corpus) et les _layout.tsx de (client)/(coach) (Tabs a besoin d'un
// contexte de navigation reel ; leur seul contenu propre, BarreNavigation, est deja exerce par
// la section 9 de la galerie avec des props equivalentes).
//
// Deux passes, theme clair puis theme sombre (docs/dette.md) : un bug de barre coach releve en
// galerie (fond ambiant croise avec un contenu fixe, voir barre-navigation.tsx) n'existait que
// sous themeForce="sombre" et cette suite ne l'a pas vu tant qu'elle ne rendait qu'en clair. Le
// mode sombre systeme (`useColorScheme`) reste hors perimetre du jalon 1 (docs/perimetre.md §3) :
// ce n'est pas ce qui est teste ici. `themeForce` est le mecanisme existant qui force une valeur
// independamment du systeme, deja utilise par la galerie elle-meme pour se previsualiser.
const SEUIL_CONTRASTE = 4.5;
type ThemeAVerifier = 'clair' | 'sombre';
const THEMES_A_VERIFIER: ThemeAVerifier[] = ['clair', 'sombre'];

type Noeud = ReactTestRendererJSON | string | null;

function fusionnerStyle(style: unknown): Record<string, unknown> | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean)) as Record<string, unknown>;
  }
  if (typeof style === 'object') return style as Record<string, unknown>;
  return undefined;
}

function estHex(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && valeur.startsWith('#');
}

function collecterTexte(noeud: Noeud): string {
  if (!noeud) return '';
  if (typeof noeud === 'string') return noeud;
  return (noeud.children ?? []).map(collecterTexte).join('');
}

function contientTexte(noeud: Noeud): boolean {
  return collecterTexte(noeud).trim().length > 0;
}

// Écrans qui posent leur propre chrome en haut (barre d'avatar, bloc encre) sous une navigation
// « headerShown: false » : rien au-dessus d'eux ne réserve la zone sûre, donc chacun doit
// pousser son premier contenu vers le bas d'au moins l'inset haut, via useSafeAreaInsets().
// moi.tsx ne le faisait pas (P1.12) — « Devenir coach » passait sous l'heure et l'encoche, sans
// qu'aucun test ne le voie. P1.13a a réécrit les deux écrans « moi » (même EcranCompte partagé,
// src/fonctionnalites/compte/) : cette liste les y tient, côté client ET côté coach.
// Portée assumée : ce contrôle ne prouve PAS la géométrie réelle (débordement, inset bas, barre
// Android à 3 boutons) — voir docs/dette.md, il reste un angle mort manuel sur appareil.
const ECRANS_CHROME_HAUT = new Set([
  'app/(client)/accueil.tsx',
  'app/(coach)/pilotage.tsx',
  'app/(client)/moi.tsx',
  'app/(coach)/moi.tsx',
  'app/(compte)/informations.tsx',
  'app/(compte)/identifiants.tsx',
  'app/(compte)/confidentialite.tsx',
  'app/(compte)/suppression.tsx',
  'app/(compte)/documents.tsx',
  'app/(compte)/export.tsx',
]);

type OffsetHaut = { ancre: boolean; offset: number };

// Descend en ordre de rendu jusqu'au premier nœud qui, soit centre / pousse son contenu hors du
// bord haut (rien à vérifier, `ancre: false`), soit fixe un retrait vertical
// (paddingTop / padding / marginTop / margin), soit EST déjà du contenu visible (texte, cible
// tactile, icône) — dans ce dernier cas le contenu touche le bord haut, offset 0.
// react-test-renderer ne fait aucune mise en page : la valeur numérique du style est la seule
// mesure possible ici, jamais une position réelle à l'écran.
function verifierOffsetHautZoneSure(noeud: Noeud): OffsetHaut | null {
  if (!noeud || typeof noeud === 'string') return null;

  const style = fusionnerStyle(noeud.props?.style);

  const centreOuPousse =
    (style?.flex === 1 || style?.flexGrow === 1) &&
    (style?.justifyContent === 'center' ||
      style?.justifyContent === 'flex-end' ||
      style?.justifyContent === 'space-around' ||
      style?.justifyContent === 'space-evenly');
  if (centreOuPousse) return { ancre: false, offset: 0 };

  const retrait = [style?.paddingTop, style?.padding, style?.marginTop, style?.margin].find(
    (valeur): valeur is number => typeof valeur === 'number',
  );
  if (retrait !== undefined) return { ancre: true, offset: retrait };

  const role = noeud.props?.accessibilityRole;
  if (
    (noeud.type === 'Text' && contientTexte(noeud)) ||
    role === 'button' ||
    role === 'tab' ||
    noeud.type === 'RNSVGSvgView'
  ) {
    return { ancre: true, offset: 0 };
  }

  for (const enfant of noeud.children ?? []) {
    const trouve = verifierOffsetHautZoneSure(enfant);
    if (trouve) return trouve;
  }
  return null;
}

type ConstatContraste = {
  texte: string;
  couleurTexte: string;
  couleurFond: string;
  ratio: number;
  desactive: boolean;
};
type ConstatCible = { libelle: string; hauteur: number | undefined; largeur: number | undefined };
type ConstatIcone = { pere: string };

type Resultats = {
  contrastes: ConstatContraste[];
  cibles: ConstatCible[];
  iconesSansLabel: ConstatIcone[];
  // Renseigné seulement pour les écrans de ECRANS_CHROME_HAUT ; null ailleurs.
  offsetHautZoneSure: OffsetHaut | null;
};

type Contexte = {
  fond: string;
  opaciteDepuisFond: number;
  ancetreAvecLabel: boolean;
  // Fenetre glissante sur deux generations : une icone dans un badge colore a cote d'un bloc de
  // texte (icone -> badge -> ligne -> [badge, bloc-texte], motif courant des cartes coach/
  // seance/programme de app/_galerie.tsx) a son texte compagnon chez un cousin, pas un frere
  // direct — s'arreter aux freres directs le manquerait a tort.
  texteFreresDirects: boolean;
  texteFreresGrandParent: boolean;
  // docs/ecrans/L0-00-galerie-systeme.md, critère 7 : "hors texte désactivé" — exempté du seuil
  // de contraste. Détecté via accessibilityState.disabled (ex. le TextInput de Bouton/Champ),
  // pas via une couleur précise : un composant désactivé peut légitimement utiliser des tons
  // différents.
  dansZoneDesactivee: boolean;
};

// Fond racine de l'application, jamais posé explicitement par les écrans provisoires eux-mêmes,
// qui héritent du fond de la fenêtre — dépend du thème de la passe en cours (voir
// THEMES_A_VERIFIER).
function fondRacine(theme: ThemeAVerifier) {
  return themes[theme].fond.canevas;
}
// Second signal de "texte désactivé", complémentaire à accessibilityState.disabled : un
// libellé (ex. le <Text> d'étiquette de Champ) peut annoncer un champ désactivé sans être
// lui-même le noeud interactif qui porte accessibilityState — mais texte.desactive est le seul
// token du design system réservé à cet usage (design/tokens.json), donc l'utiliser suffit à
// s'auto-désigner comme du texte désactivé.
function couleurTexteDesactive(theme: ThemeAVerifier) {
  return themes[theme].texte.desactive.toLowerCase();
}

function analyserArbre(
  noeud: Noeud,
  contexte: Contexte,
  resultats: Resultats,
  couleurTexteDesactivee: string,
) {
  if (!noeud || typeof noeud === 'string') return;

  const style = fusionnerStyle(noeud.props?.style);
  // Exemption ciblée, trouvée en ajoutant la section "13 · Feuille de bascule d'espace" (P1.12) :
  // le corps de FeuilleBasse (src/composants/feuille-basse.tsx) anime son opacité via Reanimated
  // (progressionFeuille, un SharedValue) à l'OUVERTURE. Cette mutation ne passe jamais par un
  // rendu React observable : ni un vrai temps d'attente (setTimeout réel), ni un rendu forcé
  // (rerender), ni le mock officiel du paquet (react-native-reanimated/mock, dont useSharedValue
  // recrée d'ailleurs une valeur neuve à chaque rendu, perdant la mutation de l'effet) ne
  // parviennent à faire apparaître autre chose que l'opacité 0 du tout premier rendu dans
  // l'arbre capturé par react-test-renderer — les trois vérifiés en écrivant cette suite,
  // documentés dans l'historique de P1.12. Ce n'est pas un défaut visuel réel (une vraie feuille,
  // sur un vrai appareil, atteint 380 ms plus tard une opacité de 1, docs/design-system.md §4) :
  // c'est une limite structurelle de ce harnais de test, jamais rencontrée avant parce
  // qu'aucune autre entrée de la galerie ne gardait de FeuilleBasse ouverte par défaut
  // (docs/ecrans/L0-00-galerie-systeme.md, section 10 : fermée tant qu'on ne clique pas) — la
  // feuille de bascule, elle, doit l'être pour que ses deux variantes soient exercées sans
  // interaction (docs/ecrans/L1-06-bascule-espace.md, critère 9). Repéré par le testID que
  // FeuilleBasse pose elle-même sur ce nœud précis (`${testID}-feuille`), jamais par la forme du
  // style (une correspondance sur {opacity, transform:[{translateY}]} attraperait aussi une
  // vraie animation d'entrée non liée à cette feuille, docs/design-system.md §4 "Entrée de
  // contenu", et masquerait alors un vrai défaut de contraste ailleurs).
  const estCorpsFeuilleBasseAnimee =
    typeof noeud.props?.testID === 'string' && noeud.props.testID.endsWith('-feuille');
  const opaciteNoeud = estCorpsFeuilleBasseAnimee
    ? 1
    : typeof style?.opacity === 'number'
      ? (style.opacity as number)
      : 1;

  const contexteEnfant: Contexte = estHex(style?.backgroundColor)
    ? { ...contexte, fond: style.backgroundColor, opaciteDepuisFond: opaciteNoeud }
    : { ...contexte, opaciteDepuisFond: contexte.opaciteDepuisFond * opaciteNoeud };
  contexteEnfant.ancetreAvecLabel =
    contexte.ancetreAvecLabel || Boolean(noeud.props?.accessibilityLabel);
  contexteEnfant.dansZoneDesactivee =
    contexte.dansZoneDesactivee || noeud.props?.accessibilityState?.disabled === true;

  // Critere "couple couleur texte / couleur fond" : uniquement les Text avec un contenu reel
  // et une couleur resolue (un token de theme, jamais une valeur en dur ailleurs dans le code —
  // regle eslint no-hex-color-literal).
  if (noeud.type === 'Text' && contientTexte(noeud) && estHex(style?.color)) {
    const couleurEffective =
      contexteEnfant.opaciteDepuisFond < 1
        ? melangerCouleur(style.color, contexteEnfant.fond, contexteEnfant.opaciteDepuisFond)
        : style.color;
    resultats.contrastes.push({
      texte: collecterTexte(noeud).trim().slice(0, 60),
      couleurTexte: couleurEffective,
      couleurFond: contexteEnfant.fond,
      ratio: contraste(couleurEffective, contexteEnfant.fond),
      desactive:
        contexteEnfant.dansZoneDesactivee ||
        couleurEffective.toLowerCase() === couleurTexteDesactivee,
    });
  }

  // Critere "cible tactile" : tout noeud qui porte un role interactif.
  const role = noeud.props?.accessibilityRole;
  if (role === 'button' || role === 'tab') {
    const hauteur = (style?.minHeight ?? style?.height) as number | undefined;
    const largeur = (style?.minWidth ?? style?.width) as number | undefined;
    resultats.cibles.push({
      libelle: (noeud.props?.accessibilityLabel as string | undefined) ?? '(sans libellé)',
      hauteur,
      largeur,
    });
  }

  // Critere "icone seule sans accessibilityLabel" : une icone (RNSVGSvgView, la racine rendue
  // par IconeBase) est couverte si un ancetre porte accessibilityLabel (ex. BoutonIcone) ou si
  // un texte l'accompagne a proximite (freres directs ou cousins via le grand-parent commun).
  if (
    noeud.type === 'RNSVGSvgView' &&
    !contexteEnfant.ancetreAvecLabel &&
    !contexte.texteFreresDirects &&
    !contexte.texteFreresGrandParent
  ) {
    resultats.iconesSansLabel.push({ pere: JSON.stringify(noeud.props).slice(0, 80) });
  }

  const enfants = noeud.children ?? [];
  const texteParmiEnfants = enfants.some(contientTexte);
  for (const enfant of enfants) {
    analyserArbre(
      enfant,
      {
        ...contexteEnfant,
        texteFreresDirects: texteParmiEnfants,
        // Ce qui etait "mes freres directs" pour ce noeud devient "grand-parent" pour ses
        // propres enfants : fenetre de deux generations, jamais cumulative au-dela.
        texteFreresGrandParent: contexte.texteFreresDirects,
      },
      resultats,
      couleurTexteDesactivee,
    );
  }
}

type OptionsAnalyse = {
  // La galerie gere son propre FournisseurTheme (bascule "Sombre" en pied de page) : on la
  // laisse telle quelle et on simule l'interrupteur plutot que d'en injecter un second par
  // au-dessus, ce qui casserait la vraie logique testee.
  dejaEnveloppe?: boolean;
  themeForce: ThemeAVerifier;
  // Action a jouer une fois le rendu monte, avant l'analyse — ex. basculer l'interrupteur
  // "Sombre" de la galerie pour la passe sombre.
  apresRendu?: (rendu: RenderResult) => Promise<void>;
  // Fond de reference impose pour les Text sans ancetre a fond hex — a la place du fond racine
  // de l'application. Pour L1-01 (docs/ecrans/L1-01-bienvenue.md, critere 5) : le texte flotte
  // au-dessus d'un degrade SVG que react-test-renderer ne compose pas ; on impose alors le
  // POINT LE PLUS CLAIR du degrade (le repli d'EmplacementImage, sombre.fond.canevas), jamais
  // l'encre pleine du bas.
  fondReference?: string;
};

// react-native-safe-area-context n'a pas de mesure native sous Jest (aucun onLayout ne se
// déclenche) : sans métriques initiales, tout composant qui appelle useSafeAreaInsets()
// (docs/ecrans/L1-01-bienvenue.md) plante avec "No safe area value available" plutôt que de
// rendre 0 partout. Valeurs représentatives d'un iPhone à encoche — jamais mesurées à l'écran
// par ce corpus, seulement suffisantes pour que le rendu ne plante pas.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function analyser(element: ReactElement, options: OptionsAnalyse): Promise<Resultats> {
  const { dejaEnveloppe = false, themeForce, apresRendu, fondReference } = options;
  const resultats: Resultats = {
    contrastes: [],
    cibles: [],
    iconesSansLabel: [],
    offsetHautZoneSure: null,
  };
  const rendu = await render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      {dejaEnveloppe ? (
        element
      ) : (
        <FournisseurTheme themeForce={themeForce}>{element}</FournisseurTheme>
      )}
    </SafeAreaProvider>,
  );
  if (apresRendu) await apresRendu(rendu);
  const arbre = rendu.toJSON();
  resultats.offsetHautZoneSure = verifierOffsetHautZoneSure(arbre);
  analyserArbre(
    arbre,
    {
      fond: fondReference ?? fondRacine(themeForce),
      opaciteDepuisFond: 1,
      ancetreAvecLabel: false,
      texteFreresDirects: false,
      texteFreresGrandParent: false,
      dansZoneDesactivee: false,
    },
    resultats,
    couleurTexteDesactive(themeForce),
  );
  return resultats;
}

// Bascule l'interrupteur "Sombre" de la galerie (voir accessibilityLabel ajoute dans
// app/_galerie.tsx, Interrupteur) plutot que d'envelopper Galerie dans un second
// FournisseurTheme : c'est le mecanisme reellement utilise a l'ecran, celui qui a revele le bug.
async function basculerGalerieEnSombre(rendu: RenderResult) {
  await fireEvent(rendu.getByLabelText('Sombre'), 'valueChange', true);
}

// Un facteur par entree, pas un element deja construit : chaque theme de THEMES_A_VERIFIER rend
// sa propre instance, jamais la meme entre deux passes.
type EntreeCorpus = {
  nom: string;
  creerElement: () => ReactElement;
  dejaEnveloppe?: boolean;
  // Seule la galerie a besoin d'agir apres le montage, et seulement pour la passe sombre.
  apresRenduParTheme?: Partial<Record<ThemeAVerifier, (rendu: RenderResult) => Promise<void>>>;
  // Voir OptionsAnalyse.fondReference. Une fonction du theme : le fond impose peut differer
  // entre les deux passes.
  fondReference?: (theme: ThemeAVerifier) => string;
};

const CORPUS: EntreeCorpus[] = [
  {
    nom: 'app/_galerie.tsx',
    creerElement: () => <Galerie key="galerie" />,
    dejaEnveloppe: true,
    apresRenduParTheme: { sombre: basculerGalerieEnSombre },
  },
  {
    // P1.12 : accueil.tsx a désormais un avatar (FeuilleBascule, useDonnees()) — a besoin d'une
    // session ÉTABLIE, contrairement au reste des coquilles provisoires. Réutilise les mêmes
    // ports que les écrans d'onboarding ci-dessous (préparés une fois, beforeAll) : la feuille
    // reste fermée par défaut ici, seul l'avatar-déclencheur est exercé (le contenu de la
    // feuille elle-même est exercé par la section 13 de la galerie, toujours ouverte).
    nom: 'app/(client)/accueil.tsx',
    creerElement: () => (
      <FournisseurSession key="accueil" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <Accueil />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  { nom: 'app/(client)/explorer.tsx', creerElement: () => <Explorer key="explorer" /> },
  { nom: 'app/(client)/seance.tsx', creerElement: () => <Seance key="seance" /> },
  { nom: 'app/(client)/messages.tsx', creerElement: () => <Messages key="messages" /> },
  {
    // Même besoin que accueil.tsx ci-dessus : EcranCompte appelle useDonnees() et useSession().
    nom: 'app/(client)/moi.tsx',
    creerElement: () => (
      <FournisseurSession key="moi" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <Moi />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    // Même écran partagé que (client)/moi, réexporté côté coach (L1-07 : même route relative).
    nom: 'app/(coach)/moi.tsx',
    creerElement: () => (
      <FournisseurSession key="moi-coach" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <MoiCoach />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    // Même besoin : l'avatar de pilotage.tsx appelle useDonnees() lui aussi.
    nom: 'app/(coach)/pilotage.tsx',
    creerElement: () => (
      <FournisseurSession key="pilotage" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <Pilotage />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  { nom: 'app/(coach)/clients.tsx', creerElement: () => <Clients key="clients" /> },
  { nom: 'app/(coach)/agenda.tsx', creerElement: () => <Agenda key="agenda" /> },
  { nom: 'app/(coach)/revenus.tsx', creerElement: () => <Revenus key="revenus" /> },
  {
    // Écran L1-09 « Mes informations » : lit le profil actif via useDonnees(). Le faux partagé
    // n'a pas d'informations posées → variante client, champs vides — suffisant pour vérifier
    // contraste, cibles et zone sûre du haut (l'écran pose son propre chrome).
    nom: 'app/(compte)/informations.tsx',
    creerElement: () => (
      <FournisseurSession key="informations" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <Informations />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    // Écran L1-09 « Adresse e-mail et mot de passe » : useSession() + lecture de l'adresse en
    // attente (null ici). Pose son propre chrome haut.
    nom: 'app/(compte)/identifiants.tsx',
    creerElement: () => (
      <FournisseurSession key="identifiants" port={portAuthOnboarding}>
        <Identifiants />
      </FournisseurSession>
    ),
  },
  {
    // Écran L1-09 « Confidentialité » : useDonnees() → lecture du consentement (faux partagé,
    // accorde=false par défaut). Pose son propre chrome haut.
    nom: 'app/(compte)/confidentialite.tsx',
    creerElement: () => (
      <FournisseurSession key="confidentialite" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <Confidentialite />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    // L2-01 « Suppression de compte » : useDonnees() + useSession(). Le faux partagé a un profil
    // client sans profil coach → aucun bandeau (ni coach ni abonnement). Pose son propre chrome
    // haut.
    nom: 'app/(compte)/suppression.tsx',
    creerElement: () => (
      <FournisseurSession key="suppression" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <Suppression />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    // L2-03 « Documents » (surface authentifiée) : useDonnees() → lireDatesDocuments (faux
    // partagé, valeurs par défaut). Pose son propre chrome haut.
    nom: 'app/(compte)/documents.tsx',
    creerElement: () => (
      <FournisseurSession key="documents" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <Documents />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    // L2-04 « Exporter mes données » : useDonnees() → lireDernierExport (faux partagé, aucun
    // export demandé). Pose son propre chrome haut.
    nom: 'app/(compte)/export.tsx',
    creerElement: () => (
      <FournisseurSession key="export" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <Export />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    // Écran L1-08 « Activation de l'espace coach » : EnteteOnboarding + chips de discipline +
    // champ téléphone. Le faux partagé a un profil client (Camille Dupont) → prénom/nom repris,
    // pas de champ pour eux.
    nom: 'app/(onboarding)/devenir-coach.tsx',
    creerElement: () => (
      <FournisseurSession key="devenir-coach" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <DevenirCoach />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    // docs/ecrans/L1-01-bienvenue.md, critère 5 : « couples texte/fond mesurés sur le dégradé
    // AU POINT LE PLUS CLAIR, pas sur l'encre pleine ». Le dégradé va de son extrémité
    // transparente (au-dessus du repli de l'EmplacementImage de fond) vers clair.fond.inverse.
    // Depuis la correction de l'île, le repli est EXPLICITEMENT sombre (sombre.fond.canevas,
    // #14120F) : il n'existe donc plus AUCUN point du dégradé plus clair que clair.fond.inverse
    // (#17211E). On épingle cette valeur comme fond de référence : react-test-renderer ne
    // compose pas le SVG, et si un jour le fond racine de l'écran cessait de la poser, la
    // mesure retomberait sinon sur le canevas clair de l'app — un faux vert.
    nom: 'app/(public)/index.tsx',
    creerElement: () => <Bienvenue key="bienvenue" />,
    fondReference: () => themes.clair.fond.inverse,
  },
  {
    nom: 'app/(public)/inscription.tsx',
    creerElement: () => (
      <FournisseurSession key="inscription" port={creerFauxPortAuth()}>
        <Inscription />
      </FournisseurSession>
    ),
  },
  {
    nom: 'app/(public)/verification.tsx',
    creerElement: () => (
      <FournisseurSession key="verification" port={creerFauxPortAuth()}>
        <Verification />
      </FournisseurSession>
    ),
  },
  {
    nom: 'app/(public)/connexion.tsx',
    creerElement: () => (
      <FournisseurSession key="connexion" port={creerFauxPortAuth()}>
        <Connexion />
      </FournisseurSession>
    ),
  },
  {
    nom: 'app/(public)/mot-de-passe-oublie.tsx',
    creerElement: () => (
      <FournisseurSession key="mot-de-passe-oublie" port={creerFauxPortAuth()}>
        <MotDePasseOublie />
      </FournisseurSession>
    ),
  },
  {
    nom: 'app/(public)/nouveau-mot-de-passe.tsx',
    creerElement: () => (
      <FournisseurSession key="nouveau-mot-de-passe" port={creerFauxPortAuth()}>
        <NouveauMotDePasse />
      </FournisseurSession>
    ),
  },
];

// Les quatre écrans d'onboarding (P1.11) ont besoin d'une session VÉRIFIÉE ET connectée
// (useDonnees() en dépend, via useSession()) — contrairement aux écrans publics ci-dessus, qui
// se rendent sans aucune session. inscrire()/connecter() sont asynchrones (même en mémoire) :
// préparés une seule fois dans un beforeAll, jamais dans creerElement() lui-même (synchrone,
// appelé à chaque passe de thème).
let portAuthOnboarding: ReturnType<typeof creerFauxPortAuth>;
let portDonneesOnboarding: ReturnType<typeof creerFauxPortDonnees>;

async function preparerSessionOnboarding() {
  // Même mise en scène que la section « Écrans du lot L1 » de la galerie : un profil client
  // déjà rempli, pour que les étapes 2 à 4 aient un contenu réel à analyser (chips
  // sélectionnées, récapitulatif) et pas seulement leur état vide. Partagée via
  // src/fixtures/session-demonstration.ts.
  const session = await creerSessionDemonstration();
  portAuthOnboarding = session.portAuth;
  portDonneesOnboarding = session.portDonnees;
}

CORPUS.push(
  {
    nom: 'app/(onboarding)/1-identite.tsx',
    creerElement: () => (
      <FournisseurSession key="onboarding-1" port={creerFauxPortAuth()}>
        <FournisseurDonnees port={creerFauxPortDonnees()}>
          <OnboardingIdentite />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    nom: 'app/(onboarding)/2-objectifs.tsx',
    creerElement: () => (
      <FournisseurSession key="onboarding-2" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <OnboardingObjectifs />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    nom: 'app/(onboarding)/3-poids.tsx',
    creerElement: () => (
      <FournisseurSession key="onboarding-3" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <OnboardingPoids />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
  {
    nom: 'app/(onboarding)/4-cest-parti.tsx',
    creerElement: () => (
      <FournisseurSession key="onboarding-4" port={portAuthOnboarding}>
        <FournisseurDonnees port={portDonneesOnboarding}>
          <OnboardingCestParti />
        </FournisseurDonnees>
      </FournisseurSession>
    ),
  },
);

describe('accessibilité automatisée (npm run test:a11y)', () => {
  beforeAll(preparerSessionOnboarding);

  it.each(THEMES_A_VERIFIER)(
    'respecte le contraste, la taille des cibles tactiles et les libellés d’icônes sur toute la galerie et les écrans des coquilles — thème %s',
    async (themeForce) => {
      const echecsContraste: string[] = [];
      const echecsCible: string[] = [];
      const echecsIcone: string[] = [];
      const echecsZoneSure: string[] = [];

      // Rendu sequentiel, un fichier a la fois : les erreurs restent attribuables a une seule
      // source, et chaque render() partage le meme act() de testing-library sans se chevaucher.
      for (const {
        nom,
        creerElement,
        dejaEnveloppe,
        apresRenduParTheme,
        fondReference,
      } of CORPUS) {
        const resultats = await analyser(creerElement(), {
          dejaEnveloppe,
          themeForce,
          apresRendu: apresRenduParTheme?.[themeForce],
          fondReference: fondReference?.(themeForce),
        });

        for (const c of resultats.contrastes) {
          const ratioAffiche = c.ratio.toFixed(2);
          console.log(
            `[test:a11y:${themeForce}] ${nom} — "${c.texte}" ${c.couleurTexte} sur ${c.couleurFond} = ` +
              `${ratioAffiche}:1${c.desactive ? ' (désactivé, hors seuil)' : ''}`,
          );
          if (!c.desactive && c.ratio < SEUIL_CONTRASTE) {
            echecsContraste.push(
              `${nom} — "${c.texte}" : ${ratioAffiche}:1 (seuil ${SEUIL_CONTRASTE}:1)`,
            );
          }
        }

        for (const cible of resultats.cibles) {
          const insuffisante =
            (cible.hauteur !== undefined && cible.hauteur < taille.tapMin) ||
            (cible.largeur !== undefined && cible.largeur < taille.tapMin);
          if (insuffisante) {
            echecsCible.push(
              `${nom} — "${cible.libelle}" : ${cible.hauteur ?? '?'}×${cible.largeur ?? '?'} pt (minimum ${taille.tapMin})`,
            );
          }
        }

        for (const icone of resultats.iconesSansLabel) {
          echecsIcone.push(`${nom} — icône sans accessibilityLabel (${icone.pere})`);
        }

        if (ECRANS_CHROME_HAUT.has(nom)) {
          const z = resultats.offsetHautZoneSure;
          if (z && z.ancre && z.offset < METRIQUES_ZONES_SURES.insets.top) {
            echecsZoneSure.push(
              `${nom} — contenu du haut à ${z.offset} pt, sous l'inset haut de ` +
                `${METRIQUES_ZONES_SURES.insets.top} pt : la zone sûre du haut n'est pas appliquée`,
            );
          }
        }
      }

      expect(echecsContraste).toEqual([]);
      expect(echecsCible).toEqual([]);
      expect(echecsIcone).toEqual([]);
      expect(echecsZoneSure).toEqual([]);
    },
    // Délai explicite au-delà du défaut Jest (5000 ms) : le corpus s'est alourdi lot après lot
    // (L2-01/03/04 ajoutés à P2.13) et a dépassé le défaut une fois sous `npm test` complet (88
    // suites en parallèle) alors qu'il passait large en isolé (~1,5 s/thème) — contention de
    // charge, pas une régression du test lui-même. 15 s garde une marge confortable sans cacher
    // une vraie dérive de performance future.
    15000,
  );
});
