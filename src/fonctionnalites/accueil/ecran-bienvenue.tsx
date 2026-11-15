import { useState, type ReactElement } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran, useDispositionEcran } from '@/composants/canevas-ecran';
import { Marque } from '@/composants/marque';
import { useTheme } from '@/theme/fournisseur';
import { etapesPresentation, type EtapePresentation } from './contenus';
import { useParcoursVisiteur } from './fournisseur-parcours-visiteur';

function PhotoPresentation({
  etape,
  large,
}: {
  etape: EtapePresentation;
  large: boolean;
}): ReactElement {
  const theme = useTheme();
  const [largeur, setLargeur] = useState(0);
  const [erreur, setErreur] = useState(false);
  const hauteur = large ? theme.taille.photoBienvenueLarge : theme.taille.photoBienvenue;
  // Dimensions des JPEG livrés (1122 × 1402). Le recadrage est identique sur web et natif,
  // calculé sur la fenêtre réelle plutôt que confié à un object-position propre au web.
  const rapport = 1122 / 1402;
  const largeurImage = Math.max(largeur, hauteur * rapport);
  const hauteurImage = largeurImage / rapport;
  return (
    <View
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
      style={{
        height: hauteur,
        overflow: 'hidden',
        backgroundColor: theme.couleur.marque.primaireTeinte,
        justifyContent: 'center',
        alignItems: 'center',
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
    </View>
  );
}

export function EcranBienvenue({ presentation = false }: { presentation?: boolean }): ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { large, largeur } = useDispositionEcran();
  const router = useRouter();
  const { oublierRetour } = useParcoursVisiteur();
  const [index, setIndex] = useState(0);
  const [depart, setDepart] = useState<{ x: number; y: number } | null>(null);
  const etape = etapesPresentation[index];
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
      <DefilementEcran
        ample
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + theme.espace[4] }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.espace[3],
            paddingHorizontal: theme.espace.gouttiere,
            paddingVertical: theme.espace[3],
          }}
        >
          <Marque symboleSeul={!large && largeur < theme.taille.formulaire / 2 + theme.espace[8]} />
          <Pressable
            testID="lien-connexion"
            accessibilityRole="button"
            onPress={() =>
              presentation ? quitterPresentation() : router.push('/(public)/connexion' as Href)
            }
            style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
          >
            <Text
              style={{
                ...theme.texte.petit,
                color: theme.couleur.marque.primaire,
                textDecorationLine: 'underline',
              }}
            >
              {presentation ? 'Passer' : 'Se connecter'}
            </Text>
          </Pressable>
        </View>
        <View
          style={{ flexDirection: large ? 'row' : 'column', flex: 1 }}
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
          <View style={large ? { flex: 1 } : undefined}>
            <PhotoPresentation
              key={presentation ? index : 'accueil'}
              etape={presentation ? etape : etapesPresentation[0]}
              large={large}
            />
          </View>
          <View
            style={{
              flex: large ? 1 : undefined,
              padding: large ? theme.espace[12] : theme.espace[6],
              gap: theme.espace[4],
              justifyContent: 'center',
            }}
          >
            <Text style={{ ...theme.texte.label, color: theme.couleur.marque.primaire }}>
              {presentation
                ? `${index + 1} / ${etapesPresentation.length} · COMMENT ÇA MARCHE`
                : 'UN OBJECTIF. UN COACH. TON ÉLAN.'}
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                ...(large ? theme.texte.editorial : theme.texte.titre1),
                color: theme.couleur.texte.principal,
              }}
            >
              {presentation ? etape.titre : 'Un vrai coach. Pour avancer.'}
            </Text>
            <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
              {presentation
                ? etape.texte
                : 'Reprendre le sport, gagner en confiance, aller plus loin : trouve le coach qui te correspond.'}
            </Text>
            {presentation ? (
              <>
                <View accessibilityLiveRegion="polite">
                  <Text
                    style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}
                  >{`Étape ${index + 1} sur ${etapesPresentation.length}`}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
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
                          height: theme.taille.pointEtape,
                          width: i === index ? theme.taille.repereEtape : theme.taille.pointEtape,
                          borderRadius: theme.rayon.pilule,
                          backgroundColor:
                            i === index
                              ? theme.couleur.marque.primaire
                              : theme.couleur.bordure.marquee,
                        }}
                      />
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}>
                  <BoutonIcone
                    nom="retour"
                    accessibilityLabel={index === 0 ? 'Revenir à l’accueil' : 'Étape précédente'}
                    onPress={() => (index === 0 ? quitterPresentation() : setIndex((i) => i - 1))}
                  />
                  <View style={{ flex: 1 }}>
                    <Bouton
                      libelle={index === 2 ? 'Découvrir les coachs' : 'Suivant'}
                      onPress={() => (index === 2 ? decouvrir() : setIndex((i) => i + 1))}
                    />
                  </View>
                </View>
                <Bouton
                  libelle="Se connecter"
                  variante="discret"
                  onPress={() => router.push('/(public)/connexion' as Href)}
                />
              </>
            ) : (
              <>
                <Bouton libelle="Découvrir les coachs" onPress={decouvrir} />
                <Bouton
                  libelle="Comment ça marche ?"
                  variante="secondaire"
                  onPress={() => router.push('/(public)/presentation' as Href)}
                />
                <Bouton
                  libelle="Créer mon compte"
                  variante="discret"
                  onPress={() => inscription()}
                />
                <Pressable
                  testID="lien-porte-coach"
                  accessibilityRole="link"
                  onPress={() => inscription(true)}
                  style={{
                    minHeight: theme.taille.tapMin,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      ...theme.texte.petit,
                      color: theme.couleur.marque.primaire,
                      textDecorationLine: 'underline',
                    }}
                  >
                    Je suis coach
                  </Text>
                </Pressable>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.espace[4] }}
                >
                  {(['cgu', 'confidentialite'] as const).map((document) => (
                    <Pressable
                      key={document}
                      accessibilityRole="link"
                      onPress={() => router.push(`/(public)/documents/${document}` as Href)}
                      style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
                    >
                      <Text
                        style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}
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
