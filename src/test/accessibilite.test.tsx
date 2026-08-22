import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import Galerie from '../../app/_galerie';
import Accueil from '../../app/(client)/accueil';
import Explorer from '../../app/(client)/explorer';
import Seance from '../../app/(client)/seance';
import Messages from '../../app/(client)/messages';
import Moi from '../../app/(client)/moi';
import Pilotage from '../../app/(coach)/pilotage';
import Clients from '../../app/(coach)/clients';
import Agenda from '../../app/(coach)/agenda';
import Revenus from '../../app/(coach)/revenus';
import AccueilPublic from '../../app/(public)/accueil';
import { FournisseurTheme } from '@/theme/fournisseur';
import { taille, themes } from '@/theme/tokens';
import { contraste, melangerCouleur } from './contraste';

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
  const opaciteNoeud = typeof style?.opacity === 'number' ? (style.opacity as number) : 1;

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
};

async function analyser(element: ReactElement, options: OptionsAnalyse): Promise<Resultats> {
  const { dejaEnveloppe = false, themeForce, apresRendu } = options;
  const resultats: Resultats = { contrastes: [], cibles: [], iconesSansLabel: [] };
  const rendu = await render(
    dejaEnveloppe ? (
      element
    ) : (
      <FournisseurTheme themeForce={themeForce}>{element}</FournisseurTheme>
    ),
  );
  if (apresRendu) await apresRendu(rendu);
  analyserArbre(
    rendu.toJSON(),
    {
      fond: fondRacine(themeForce),
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
};

const CORPUS: EntreeCorpus[] = [
  {
    nom: 'app/_galerie.tsx',
    creerElement: () => <Galerie key="galerie" />,
    dejaEnveloppe: true,
    apresRenduParTheme: { sombre: basculerGalerieEnSombre },
  },
  { nom: 'app/(client)/accueil.tsx', creerElement: () => <Accueil key="accueil" /> },
  { nom: 'app/(client)/explorer.tsx', creerElement: () => <Explorer key="explorer" /> },
  { nom: 'app/(client)/seance.tsx', creerElement: () => <Seance key="seance" /> },
  { nom: 'app/(client)/messages.tsx', creerElement: () => <Messages key="messages" /> },
  { nom: 'app/(client)/moi.tsx', creerElement: () => <Moi key="moi" /> },
  { nom: 'app/(coach)/pilotage.tsx', creerElement: () => <Pilotage key="pilotage" /> },
  { nom: 'app/(coach)/clients.tsx', creerElement: () => <Clients key="clients" /> },
  { nom: 'app/(coach)/agenda.tsx', creerElement: () => <Agenda key="agenda" /> },
  { nom: 'app/(coach)/revenus.tsx', creerElement: () => <Revenus key="revenus" /> },
  { nom: 'app/(public)/accueil.tsx', creerElement: () => <AccueilPublic key="accueil-public" /> },
];

describe('accessibilité automatisée (npm run test:a11y)', () => {
  it.each(THEMES_A_VERIFIER)(
    'respecte le contraste, la taille des cibles tactiles et les libellés d’icônes sur toute la galerie et les écrans des coquilles — thème %s',
    async (themeForce) => {
      const echecsContraste: string[] = [];
      const echecsCible: string[] = [];
      const echecsIcone: string[] = [];

      // Rendu sequentiel, un fichier a la fois : les erreurs restent attribuables a une seule
      // source, et chaque render() partage le meme act() de testing-library sans se chevaucher.
      for (const { nom, creerElement, dejaEnveloppe, apresRenduParTheme } of CORPUS) {
        const resultats = await analyser(creerElement(), {
          dejaEnveloppe,
          themeForce,
          apresRendu: apresRenduParTheme?.[themeForce],
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
      }

      expect(echecsContraste).toEqual([]);
      expect(echecsCible).toEqual([]);
      expect(echecsIcone).toEqual([]);
    },
  );
});
