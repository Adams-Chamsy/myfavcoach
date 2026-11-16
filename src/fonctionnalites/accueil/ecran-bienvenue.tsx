import { useState, type ReactElement } from 'react';
import { Image, Platform, Pressable, Text, View, type TextStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CanevasEcran, DefilementEcran, useDispositionEcran } from '@/composants/canevas-ecran';
import { SymboleMarque } from '@/composants/marque';
import { useTheme } from '@/theme/fournisseur';
import { accueil as mesure } from '@/theme/tokens';
import { etapesPresentation, type EtapePresentation } from './contenus';
import { useParcoursVisiteur } from './fournisseur-parcours-visiteur';

function PhotoPresentation({
  etape,
  large,
  presentation,
}: {
  etape: EtapePresentation;
  large: boolean;
  presentation: boolean;
}): ReactElement {
  const theme = useTheme();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const largeur = dimensions.width;
  const [erreur, setErreur] = useState(false);
  const hauteur = large
    ? dimensions.height || theme.taille.photoBienvenueLarge
    : theme.taille.photoBienvenue;
  // Même object-fit / object-position que la V2, calculés aussi pour les plateformes natives.
  const rapport = 1122 / 1402;
  const largeurImage = Math.max(largeur, hauteur * rapport);
  const hauteurImage = largeurImage / rapport;
  return (
    <View
      testID="bienvenue-photo"
      onLayout={(e) => setDimensions(e.nativeEvent.layout)}
      style={{
        height: large ? '100%' : hauteur,
        minHeight: large ? mesure.photoLargeMin : undefined,
        overflow: 'hidden',
        backgroundColor: theme.couleur.marque.primaireTeinte,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {erreur ? (
        <Text
          style={{
            ...theme.texte.titre2,
            color: theme.couleur.marque.primaire,
            padding: theme.espace[6],
          }}
        >
          Un vrai coach. Pour avancer.
        </Text>
      ) : (
        <Image
          source={etape.image}
          accessibilityLabel={etape.alternative}
          onError={() => setErreur(true)}
          resizeMode="cover"
          style={{
            position: 'absolute',
            width: largeurImage,
            height: hauteurImage,
            left: (largeur - largeurImage) / 2,
            top: -(hauteurImage - hauteur) * etape.cadrageVertical,
          }}
        />
      )}
      <View
        testID="bienvenue-pastille"
        style={{
          position: 'absolute',
          left: large ? mesure.photoEtiquetteLarge : mesure.photoEtiquetteGauche,
          bottom: large ? mesure.photoEtiquetteLarge : mesure.photoEtiquetteBas,
          flexDirection: 'row',
          alignItems: 'center',
          gap: mesure.marqueEspace,
          paddingHorizontal: mesure.photoEtiquetteHorizontal,
          paddingVertical: mesure.photoEtiquetteVertical,
          borderRadius: mesure.photoEtiquetteRayon,
          backgroundColor: theme.couleur.fond.accueilEtiquette,
        }}
      >
        <View
          style={{
            width: mesure.photoEtiquettePoint,
            height: mesure.photoEtiquettePoint,
            borderRadius: theme.rayon.pilule,
            backgroundColor: theme.couleur.marque.primaire,
          }}
        />
        <Text
          style={{
            fontFamily: theme.texte.marque.fontFamily,
            fontSize: mesure.legende,
            lineHeight: mesure.legende * mesure.interligne,
            color: theme.couleur.marque.primaire,
          }}
        >
          {presentation ? etape.pastille : 'Le prochain cap commence ici'}
        </Text>
      </View>
      {!large && (
        <View
          pointerEvents="none"
          accessible={false}
          style={{
            position: 'absolute',
            bottom: mesure.vagueBas,
            left: '-4%',
            width: '108%',
            height: mesure.vagueHauteur,
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Polygon
              points="0,70 12,35 24,28 36,54 48,77 60,78 72,45 84,23 100,50 100,100 0,100"
              fill={theme.couleur.fond.canevas}
            />
          </Svg>
        </View>
      )}
    </View>
  );
}

function ActionBienvenue({
  libelle,
  onPress,
  variante = 'primaire',
  fleche = false,
}: {
  libelle: string;
  onPress: () => void;
  variante?: 'primaire' | 'secondaire' | 'discret';
  fleche?: boolean;
}): ReactElement {
  const theme = useTheme();
  const [survol, setSurvol] = useState(false);
  const primaire = variante === 'primaire',
    secondaire = variante === 'secondaire';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      onHoverIn={() => setSurvol(true)}
      onHoverOut={() => setSurvol(false)}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: primaire ? mesure.actionHauteur : theme.taille.tapMin,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: mesure.actionHorizontal,
        paddingVertical: primaire
          ? mesure.actionVertical
          : secondaire
            ? mesure.secondaireVertical
            : mesure.discretPadding,
        borderRadius: mesure.rayon,
        borderWidth: secondaire ? theme.taille.bordureFine : 0,
        borderColor: theme.couleur.bordure.accueilSecondaire,
        backgroundColor: primaire
          ? pressed
            ? theme.couleur.marque.primaireAppui
            : survol
              ? theme.couleur.marque.accueilSurvol
              : theme.couleur.marque.primaire
          : 'transparent',
      })}
    >
      <Text
        style={{
          fontFamily:
            primaire || secondaire ? theme.texte.marque.fontFamily : theme.texte.corps.fontFamily,
          fontSize: variante === 'discret' ? mesure.lien : mesure.action,
          lineHeight: (variante === 'discret' ? mesure.lien : mesure.action) * mesure.interligne,
          color: primaire ? theme.couleur.texte.surMarque : theme.couleur.marque.primaire,
          textAlign: 'center',
          textDecorationLine: variante === 'discret' ? 'underline' : 'none',
          ...(Platform.OS === 'web' ? { textUnderlineOffset: theme.espace[1] } : {}),
        }}
      >
        {libelle}
        {fleche ? <Text accessible={false}> ↗</Text> : null}
      </Text>
    </Pressable>
  );
}

export function EcranBienvenue({ presentation = false }: { presentation?: boolean }): ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { largeur } = useDispositionEcran();
  const large = Platform.OS === 'web' && largeur > mesure.seuilMobile;
  const largeEtroit = large && largeur <= mesure.seuilLargeEtroit;
  const router = useRouter();
  const { oublierRetour } = useParcoursVisiteur();
  const [index, setIndex] = useState(0);
  const [depart, setDepart] = useState<{ x: number; y: number } | null>(null);
  const etape = etapesPresentation[index];
  const mobileEtendu = !large && largeur > mesure.seuilMobile;
  const tailleTitre = large
    ? largeEtroit
      ? mesure.titreLargeEtroit
      : mesure.titreLarge
    : mobileEtendu
      ? mesure.titreMobileEtendu
      : mesure.titre;
  const texteLien: TextStyle = {
    fontFamily: theme.texte.corps.fontFamily,
    fontSize: mesure.action,
    lineHeight: mesure.action * mesure.interligne,
    color: theme.couleur.marque.primaire,
    textDecorationLine: 'underline',
    ...(Platform.OS === 'web' ? { textUnderlineOffset: theme.espace[1] } : {}),
  };
  function quitterPresentation() {
    if (router.canGoBack?.()) router.back();
    else router.replace('/(public)' as Href);
  }
  function decouvrir() {
    oublierRetour();
    if (presentation) router.replace('/(public)/decouvrir' as Href);
    else router.push('/(public)/decouvrir' as Href);
  }
  function inscription(coach = false) {
    oublierRetour();
    router.push((coach ? '/(public)/inscription?viaCoach=1' : '/(public)/inscription') as Href);
  }
  return (
    <CanevasEcran
      ample
      style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.couleur.fond.canevas }}
    >
      <DefilementEcran ample contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom }}>
        <View
          testID="bienvenue-entete"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: mesure.entete,
            gap: theme.espace[3],
            paddingHorizontal: large ? mesure.enteteHorizontalLarge : mesure.enteteHorizontal,
            paddingVertical: large ? mesure.enteteVerticalLarge : mesure.enteteVertical,
          }}
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="MyFavCoach, accueil"
            onPress={() => {
              if (presentation) quitterPresentation();
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: mesure.marqueEspace,
              minHeight: theme.taille.tapMin,
            }}
          >
            <SymboleMarque taille={mesure.logo} couleur={theme.couleur.marque.primaire} />
            <Text
              style={{
                fontFamily: theme.texte.marque.fontFamily,
                fontSize: large || mobileEtendu ? mesure.marqueLarge : mesure.marque,
                lineHeight:
                  (large || mobileEtendu ? mesure.marqueLarge : mesure.marque) * mesure.interligne,
                letterSpacing: mesure.marqueInterlettrage,
                color: theme.couleur.marque.primaire,
              }}
            >
              MyFav<Text style={{ color: theme.couleur.marque.accueilNom }}>Coach</Text>
            </Text>
          </Pressable>
          <Pressable
            testID="lien-connexion"
            accessibilityRole="button"
            onPress={() =>
              presentation ? quitterPresentation() : router.push('/(public)/connexion' as Href)
            }
            style={{
              minHeight: theme.taille.tapMin,
              justifyContent: 'center',
              paddingHorizontal: theme.espace[1],
            }}
          >
            <Text style={texteLien}>{presentation ? 'Passer' : 'Se connecter'}</Text>
          </Pressable>
        </View>
        <View
          style={{
            flexDirection: large ? 'row' : 'column',
            flex: 1,
            minHeight: large ? mesure.grilleHauteur : undefined,
          }}
          onTouchStart={(e) => setDepart({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
          onTouchEnd={(e) => {
            if (!presentation || !depart) return;
            const x = e.nativeEvent.pageX - depart.x,
              y = e.nativeEvent.pageY - depart.y;
            if (Math.abs(x) > theme.taille.tapMin && Math.abs(x) > Math.abs(y) * 1.4)
              setIndex((i) => Math.max(0, Math.min(2, i + (x < 0 ? 1 : -1))));
            setDepart(null);
          }}
        >
          <View
            style={
              large
                ? {
                    width: `${(100 * mesure.grillePhoto) / (mesure.grillePhoto + mesure.grilleContenu)}%`,
                  }
                : undefined
            }
          >
            <PhotoPresentation
              key={presentation ? index : 'accueil'}
              etape={presentation ? etape : etapesPresentation[0]}
              large={large}
              presentation={presentation}
            />
          </View>
          <View
            testID="bienvenue-contenu"
            style={{
              flex: large ? mesure.grilleContenu : 1,
              minWidth: 0,
              paddingHorizontal: large
                ? largeEtroit
                  ? mesure.contenuLargeEtroit
                  : mesure.contenuLargeHorizontal
                : mobileEtendu
                  ? mesure.contenuHorizontal
                  : mesure.contenu,
              paddingTop: large
                ? largeEtroit
                  ? mesure.contenuLargeEtroit
                  : mesure.contenuLargeVertical
                : mobileEtendu
                  ? mesure.contenuHaut
                  : mesure.contenu,
              paddingBottom: large
                ? largeEtroit
                  ? mesure.contenuLargeEtroit
                  : mesure.contenuLargeVertical
                : mobileEtendu
                  ? mesure.contenuBas
                  : mesure.contenu,
              gap: large ? mesure.contenuEspaceLarge : mesure.contenuEspace,
              justifyContent: large ? 'center' : undefined,
            }}
          >
            <Text
              testID="bienvenue-surtitre"
              style={{
                fontFamily: theme.texte.marque.fontFamily,
                fontSize: mesure.surtitre,
                lineHeight: mesure.surtitre * mesure.interligne,
                letterSpacing: mesure.surtitreInterlettrage,
                color: theme.couleur.marque.primaire,
              }}
            >
              {presentation ? etape.surtitre : 'UN OBJECTIF. UN COACH. TON ÉLAN.'}
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: theme.texte.titre1.fontFamily,
                fontSize: tailleTitre,
                lineHeight: tailleTitre * mesure.titreInterligne,
                letterSpacing: mesure.titreInterlettrage,
                color: theme.couleur.texte.principal,
              }}
            >
              {presentation ? etape.titre : 'Un vrai coach.\nPour avancer.'}
            </Text>
            <Text
              style={{
                fontFamily: theme.texte.corps.fontFamily,
                fontSize: large ? mesure.corpsLarge : mesure.corps,
                lineHeight: (large ? mesure.corpsLarge : mesure.corps) * mesure.corpsInterligne,
                color: theme.couleur.texte.secondaire,
                maxWidth: mesure.texteLargeur,
              }}
            >
              {presentation
                ? etape.texte
                : 'Reprendre le sport, gagner en confiance, aller plus loin : trouve le coach qui te correspond.'}
            </Text>
            {presentation ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: large ? 'flex-start' : 'center',
                    gap: mesure.pointEspace,
                  }}
                >
                  {etapesPresentation.map((e, i) => (
                    <Pressable
                      key={e.titre}
                      accessibilityRole="button"
                      accessibilityLabel={`Étape ${i + 1} : ${e.titre}`}
                      accessibilityState={{ selected: i === index }}
                      onPress={() => setIndex(i)}
                      style={{
                        width: theme.taille.tapMin,
                        minHeight: theme.taille.tapMin,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          height: mesure.point,
                          width: i === index ? mesure.pointActif : mesure.point,
                          borderRadius: theme.rayon.pilule,
                          backgroundColor:
                            i === index
                              ? theme.couleur.marque.primaire
                              : theme.couleur.bordure.accueilPoint,
                        }}
                      />
                    </Pressable>
                  ))}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: mesure.navigationEspace,
                    marginTop: large ? mesure.actionLargeHaut : 'auto',
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={index === 0 ? 'Revenir à l’accueil' : 'Étape précédente'}
                    onPress={() => (index === 0 ? quitterPresentation() : setIndex((i) => i - 1))}
                    style={{
                      minWidth: theme.taille.tapMin,
                      minHeight: mesure.actionHauteur,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{ ...texteLien, fontSize: mesure.retour, textDecorationLine: 'none' }}
                    >
                      ←
                    </Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <ActionBienvenue
                      libelle={index === 2 ? 'Découvrir les coachs' : 'Suivant'}
                      onPress={() => (index === 2 ? decouvrir() : setIndex((i) => i + 1))}
                    />
                  </View>
                </View>
                <View
                  accessibilityLiveRegion="polite"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.espace[3],
                  }}
                >
                  <Text
                    accessibilityLabel={`Étape ${index + 1} sur 3`}
                    style={{
                      ...texteLien,
                      fontSize: mesure.legende,
                      lineHeight: mesure.legende * mesure.interligne,
                      color: theme.couleur.texte.secondaire,
                      textDecorationLine: 'none',
                    }}
                  >{`${index + 1} sur 3 · À ton rythme`}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/(public)/connexion' as Href)}
                    style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
                  >
                    <Text style={{ ...texteLien, fontSize: mesure.legende }}>Se connecter</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View
                  testID="bienvenue-actions"
                  style={{
                    gap: mesure.actionEspace,
                    marginTop: large ? mesure.actionLargeHaut : 'auto',
                    paddingTop: mesure.actionHaut,
                  }}
                >
                  <ActionBienvenue libelle="Découvrir les coachs" fleche onPress={decouvrir} />
                  <ActionBienvenue
                    libelle="Comment ça marche ?"
                    variante="secondaire"
                    onPress={() => router.push('/(public)/presentation' as Href)}
                  />
                  <ActionBienvenue
                    libelle="Créer mon compte"
                    variante="discret"
                    onPress={() => inscription()}
                  />
                </View>
                <View
                  testID="bienvenue-pied"
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: mesure.piedEspace,
                    borderTopWidth: theme.taille.bordureFine,
                    borderTopColor: theme.couleur.bordure.marquee,
                    paddingTop: mesure.piedHaut,
                    marginTop: large ? mesure.piedLargeHaut : 0,
                  }}
                >
                  <Pressable
                    testID="lien-porte-coach"
                    accessibilityRole="link"
                    onPress={() => inscription(true)}
                    style={{
                      minHeight: theme.taille.tapMin,
                      marginVertical: mesure.piedMargeCible,
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        ...texteLien,
                        fontSize: mesure.legende,
                        lineHeight: mesure.legende * mesure.interligne,
                        color: theme.couleur.texte.secondaire,
                        textDecorationLine: 'none',
                      }}
                    >
                      Je suis coach
                    </Text>
                  </Pressable>
                  {(['cgu', 'confidentialite'] as const).map((document) => (
                    <Pressable
                      key={document}
                      accessibilityRole="link"
                      onPress={() => router.push(`/(public)/documents/${document}` as Href)}
                      style={{
                        minHeight: theme.taille.tapMin,
                        marginVertical: mesure.piedMargeCible,
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          ...texteLien,
                          fontSize: mesure.legende,
                          lineHeight: mesure.legende * mesure.interligne,
                          color: theme.couleur.texte.secondaire,
                          textDecorationLine: 'none',
                        }}
                      >
                        {document === 'cgu' ? 'CGU' : 'Confidentialité'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </DefilementEcran>
    </CanevasEcran>
  );
}
