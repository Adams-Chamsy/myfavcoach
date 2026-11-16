import { notesPresentationV2 } from './notes-presentation-v2';
import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import portraitEditorial from '../../assets/ambiance/portraits-editoriaux.png';
import { SymboleMarque } from './marque';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/fournisseur';
import { presentationV2 as mesure, themes } from '@/theme/tokens';

export function useDispositionReferenceV2() {
  const { width } = useWindowDimensions();
  return { large: Platform.OS === 'web' && width > mesure.seuilMobile };
}

function PhotoEditorialeV2({
  hauteur = mesure.histoirePhotoHauteur,
  dansAside = false,
}: { hauteur?: number; dansAside?: boolean } = {}) {
  const [largeur, setLargeur] = useState(0);
  return (
    <View
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
      style={{
        height: hauteur,
        maxWidth: mesure.histoirePhotoMax,
        marginTop: dansAside ? 0 : mesure.histoirePhotoMarge,
        marginBottom: dansAside ? mesure.asidePhotoApres : 0,
        borderRadius: dansAside ? mesure.asidePhotoRayon : mesure.histoirePhotoRayon,
        overflow: 'hidden',
      }}
    >
      <Image
        source={portraitEditorial}
        accessibilityLabel="Portrait d’ambiance de coaching"
        style={{
          position: 'absolute',
          width: largeur * 3,
          height: largeur * 2,
          top: -(largeur * 2 - hauteur) * 0.24,
          left: 0,
        }}
      />
    </View>
  );
}

export function FlecheV2({ couleur, retour = false }: { couleur: string; retour?: boolean }) {
  return (
    <Svg
      width={mesure.icone}
      height={mesure.icone}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth={mesure.iconeTrait}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false })}
    >
      <Path d={retour ? 'M20 12H4m6-6-6 6 6 6' : 'M4 12h16m-6-6 6 6-6 6'} />
    </Svg>
  );
}

const ContextePresentationV2 = createContext(false);
export function FournisseurPresentationV2({ children }: { children: ReactNode }) {
  return <ContextePresentationV2.Provider value>{children}</ContextePresentationV2.Provider>;
}

export function usePresentationV2(): boolean {
  return useContext(ContextePresentationV2);
}

export function EntetePublicV2({
  accessoire,
  navigation,
  destination,
}: { accessoire?: ReactNode; navigation?: ReactNode; destination?: Href } = {}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { large } = useDispositionReferenceV2();
  const router = useRouter();
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: theme.couleur.fond.canevas,
      }}
    >
      <View
        style={{
          borderBottomWidth: mesure.bordure,
          borderBottomColor: theme.couleur.bordure.marquee,
          height: large ? mesure.enteteLarge : mesure.entete,
          justifyContent: 'space-between',
          flexDirection: 'row',
          alignItems: 'center',
          gap: mesure.enteteEspace,
          paddingHorizontal: large ? '5%' : mesure.enteteHorizontal,
          paddingVertical: 0,
        }}
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="MyFavCoach, accueil"
          onPress={() => router.push(destination ?? ('/(public)' as Href))}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'center',
            gap: mesure.enteteEspace,
            minHeight: theme.taille.tapMin,
            marginVertical: 0,
          }}
        >
          <SymboleMarque
            taille={large ? mesure.enteteLogoLarge : mesure.enteteLogo}
            couleur={theme.couleur.marque.primaire}
          />
          <Text
            style={{
              ...(large ? theme.texte.v2MarqueLarge : theme.texte.v2Marque),
              color: theme.couleur.texte.principal,
            }}
          >
            MyFavCoach
          </Text>
        </Pressable>
        {navigation}
        {accessoire}
      </View>
    </View>
  );
}

export function CadreAuthentificationV2({
  titre,
  description,
  onRetour,
  actions,
  children,
}: {
  titre: string;
  description: string;
  onRetour: () => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { large } = useDispositionReferenceV2();
  const insets = useSafeAreaInsets();
  return (
    <ContextePresentationV2.Provider value>
      <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <EntetePublicV2 />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flexDirection: large ? 'row' : 'column', flex: 1 }}>
            {large ? (
              <View
                style={{
                  flex: 1,
                  backgroundColor: themes.clair.marque.primaireProfond,
                  paddingVertical: mesure.formulaireLargePadding,
                  paddingHorizontal: `${mesure.formulaireLargeRatio}%`,
                  justifyContent: 'space-between',
                  gap: mesure.histoireEspace,
                }}
              >
                <View>
                  <Text
                    style={{
                      ...theme.texte.v2Surtitre,
                      color: themes.clair.marque.v2HistoireSurtitre,
                    }}
                  >
                    DES PERSONNES. DES POSSIBLES.
                  </Text>
                  <Text
                    style={{
                      fontFamily: theme.texte.titre1.fontFamily,
                      fontSize: mesure.histoireTitre,
                      lineHeight: mesure.histoireTitre,
                      marginTop: mesure.histoireTitreMarge,
                      color: themes.clair.texte.surMarque,
                    }}
                  >
                    Le bon coach.{'\n'}
                    <Text style={{ color: themes.clair.marque.v2HistoireAccent }}>
                      Ton prochain{'\n'}déclic.
                    </Text>
                  </Text>
                  <Text
                    style={{
                      ...theme.texte.v2CorpsLarge,
                      color: themes.clair.marque.v2HistoireTexte,
                      maxWidth: mesure.histoireCorpsMax,
                      marginTop: mesure.histoireTitreMarge,
                    }}
                  >
                    Du sport à la cybersécurité, avance avec quelqu’un qui t’accompagne vraiment.
                  </Text>
                  <PhotoEditorialeV2 />
                </View>
                <Text
                  style={{ ...theme.texte.v2Petit, color: themes.clair.marque.v2HistoireTexte }}
                >
                  MyFavCoach · À chacun son élan.
                </Text>
              </View>
            ) : null}
            <View
              style={{
                flex: large ? 1 : undefined,
                alignSelf: large ? 'center' : undefined,
                width: large ? '50%' : '100%',
                maxWidth: large ? mesure.formulaireLargeMax : undefined,
                paddingHorizontal: large
                  ? mesure.formulaireLargePadding
                  : mesure.formulaireHorizontal,
                paddingTop: large ? mesure.formulaireLargePadding : mesure.formulaireHaut,
                paddingBottom:
                  (large ? mesure.formulaireLargePadding : mesure.formulaireBas) + insets.bottom,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retour"
                onPress={onRetour}
                style={{
                  minHeight: theme.taille.tapMin,
                  marginVertical: mesure.retourMargeCible,
                  marginBottom: mesure.retourBas + mesure.retourMargeCible,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.espace[2],
                  alignSelf: 'flex-start',
                }}
              >
                <FlecheV2 retour couleur={theme.couleur.marque.primaire} />
                <Text style={{ ...theme.texte.v2Retour, color: theme.couleur.marque.primaire }}>
                  Retour
                </Text>
              </Pressable>
              <View style={{ marginBottom: mesure.enteteBas }}>
                <Text
                  style={{
                    ...theme.texte.v2Surtitre,
                    color: theme.couleur.marque.primaire,
                    marginBottom: mesure.titreHaut,
                  }}
                >
                  TON ESPACE COMMENCE ICI
                </Text>
                <Text
                  accessibilityRole="header"
                  style={{
                    ...(large ? theme.texte.v2TitreAuthLarge : theme.texte.v2TitreAuth),
                    color: theme.couleur.texte.principal,
                  }}
                >
                  {titre}
                </Text>
                <Text
                  style={{
                    ...(large ? theme.texte.v2CorpsLarge : theme.texte.v2Corps),
                    color: theme.couleur.texte.secondaire,
                    marginTop: mesure.descriptionHaut,
                  }}
                >
                  {description}
                </Text>
              </View>
              <View style={{ gap: mesure.champEspace }}>{children}</View>
              <View
                style={{
                  marginTop: mesure.actionMarge,
                  paddingTop: mesure.actionHaut,
                  borderTopWidth: mesure.bordure,
                  borderTopColor: theme.couleur.bordure.marquee,
                  gap: mesure.actionEspace,
                }}
              >
                {actions}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </ContextePresentationV2.Provider>
  );
}

export function CadreFormulaireV2({
  surtitre,
  reference,
  titre,
  description,
  enteteGlobal,
  navigation,
  alerte,
  entete,
  actions,
  children,
}: {
  surtitre: string;
  reference?: string;
  titre?: ReactNode;
  description?: string;
  enteteGlobal?: ReactNode;
  navigation?: ReactNode;
  alerte?: ReactNode;
  entete?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { large } = useDispositionReferenceV2();
  const insets = useSafeAreaInsets();
  return (
    <ContextePresentationV2.Provider value>
      <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        {enteteGlobal === undefined ? <EntetePublicV2 /> : enteteGlobal}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: mesure.contenuBas + insets.bottom }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: mesure.largeurContenu,
              alignSelf: 'center',
              paddingHorizontal: large ? '5%' : mesure.enteteHorizontal,
              paddingTop: large ? mesure.contenuLargePadding : theme.espace[6],
              flexDirection: large ? 'row' : 'column',
              gap: large ? mesure.colonnesEspace : 0,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              {entete}
              <Text
                style={{
                  ...theme.texte.v2Surtitre,
                  color: theme.couleur.marque.primaire,
                  marginTop: entete ? mesure.enteteBas : 0,
                  marginBottom: mesure.titreHaut,
                }}
              >
                {surtitre}
              </Text>
              {titre ? (
                <View style={{ marginBottom: mesure.enteteBas }}>
                  <Text
                    accessibilityRole="header"
                    style={{
                      ...(large ? theme.texte.v2TitreAuthLarge : theme.texte.v2TitreAuth),
                      color: theme.couleur.texte.principal,
                    }}
                  >
                    {titre}
                  </Text>
                  {description ? (
                    <Text
                      style={{
                        ...theme.texte.v2Corps,
                        color: theme.couleur.texte.secondaire,
                        marginTop: mesure.descriptionHaut,
                      }}
                    >
                      {description}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <View style={{ gap: mesure.champEspace }}>{children}</View>
              {actions ? (
                <View
                  style={{
                    marginTop: mesure.actionMarge,
                    paddingTop: mesure.actionHaut,
                    borderTopWidth: mesure.bordure,
                    borderTopColor: theme.couleur.bordure.marquee,
                    gap: mesure.actionEspace,
                  }}
                >
                  {actions}
                </View>
              ) : null}
            </View>
            {large ? <PanneauEditorialV2 reference={reference} /> : null}
          </View>
        </ScrollView>
        {alerte ? (
          <View style={{ paddingBottom: navigation ? 0 : insets.bottom + theme.espace[3] }}>
            {alerte}
          </View>
        ) : null}
        {navigation}
      </View>
    </ContextePresentationV2.Provider>
  );
}

export function PanneauEditorialV2({ reference }: { reference?: string }) {
  const theme = useTheme();
  const note = notesPresentationV2[reference ?? ''] ?? {
    titre: 'Ton espace.\nTes choix.',
    texte: 'Tu gardes la main sur ton profil, tes autorisations et ton accompagnement.',
    photo: false,
  };
  return (
    <View
      style={{
        width: mesure.asideLargeur,
        marginTop: mesure.asideMarge,
        borderLeftWidth: mesure.bordure,
        borderLeftColor: theme.couleur.bordure.marquee,
        paddingLeft: mesure.asidePadding,
      }}
    >
      {note.photo ? <PhotoEditorialeV2 hauteur={mesure.asidePhotoHauteur} dansAside /> : null}
      <Text style={{ ...theme.texte.v2Surtitre, color: theme.couleur.marque.primaire }}>
        À TON RYTHME
      </Text>
      <Text
        style={{
          ...theme.texte.v2TitreAside,
          color: theme.couleur.texte.principal,
          marginVertical: mesure.asideTitreMarge,
        }}
      >
        {note.titre}
      </Text>
      <Text
        style={{
          ...theme.texte.v2Corps,
          color: theme.couleur.texte.secondaire,
          marginTop: mesure.asideTexteMarge,
        }}
      >
        {note.texte}
      </Text>
    </View>
  );
}
