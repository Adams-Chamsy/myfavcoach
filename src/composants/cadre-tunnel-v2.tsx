import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EntetePublicV2,
  FlecheV2,
  FournisseurPresentationV2,
  useDispositionReferenceV2,
} from './presentation-v2';
import { Icone } from './icones';
import { useTheme } from '@/theme/fournisseur';
import { presentationV2 as mesure } from '@/theme/tokens';

export function CadreTunnelV2({
  etape,
  surtitre,
  titre,
  description,
  onRetour,
  libelleRetour,
  pied,
  complement,
  children,
}: {
  etape?: 1 | 2;
  surtitre?: string;
  titre?: string;
  description?: string;
  onRetour?: () => void;
  libelleRetour?: string;
  pied?: ReactNode;
  complement?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { large } = useDispositionReferenceV2();
  const etapes = etape ? (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Étape ${etape} sur 2`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.espace[3],
        marginTop: large ? 0 : mesure.tunnelEtapesAvant,
      }}
    >
      {[1, 2].map((n, i) => (
        <View
          key={n}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: mesure.tunnelEtapeEspace,
            flex: i === 0 ? 1 : undefined,
          }}
        >
          <View
            style={{
              width: mesure.tunnelEtapeDiametre,
              height: mesure.tunnelEtapeDiametre,
              borderRadius: theme.rayon.pilule,
              borderWidth: mesure.bordure,
              borderColor:
                etape >= n ? theme.couleur.marque.primaire : theme.couleur.bordure.v2Etape,
              backgroundColor:
                etape >= n ? theme.couleur.marque.primaire : theme.couleur.fond.canevas,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                ...theme.texte.v2Petit,
                fontSize: mesure.tunnelEtapeTexte,
                color: etape >= n ? theme.couleur.texte.surMarque : theme.couleur.texte.secondaire,
              }}
            >
              {etape > n ? '✓' : n}
            </Text>
          </View>
          <Text
            style={{
              ...theme.texte.v2Petit,
              color: etape === n ? theme.couleur.marque.primaire : theme.couleur.texte.secondaire,
            }}
          >
            {n === 1 ? 'Ton offre' : 'Paiement'}
          </Text>
          {i === 0 ? (
            <View
              style={{
                height: mesure.bordure,
                minWidth: mesure.tunnelEtapeLigne,
                flex: 1,
                marginLeft: mesure.tunnelEtapeLigneMarge,
                backgroundColor: theme.couleur.bordure.v2Etape,
              }}
            />
          ) : null}
        </View>
      ))}
    </View>
  ) : null;
  return (
    <FournisseurPresentationV2>
      <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <EntetePublicV2
          destination="/(client)/(tabs)/accueil"
          accessoire={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[1] }}>
              <Icone
                nom="securite"
                taille={theme.espace[4]}
                couleur={theme.couleur.marque.primaire}
              />
              <Text
                style={{
                  ...theme.texte.v2Petit,
                  fontSize: mesure.tunnelEtapeTexte,
                  color: theme.couleur.marque.primaire,
                }}
              >
                {etape ? 'Paiement sécurisé' : 'Ton espace client'}
              </Text>
            </View>
          }
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + theme.espace[6] }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: mesure.tunnelLargeur,
              alignSelf: 'center',
              paddingHorizontal: large ? '5%' : mesure.enteteHorizontal,
              paddingTop: mesure.tunnelHaut,
            }}
          >
            {onRetour || etapes ? (
              <View
                style={{
                  flexDirection: large ? 'row' : 'column',
                  justifyContent: 'space-between',
                  marginBottom: mesure.tunnelEtapesApres,
                }}
              >
                {onRetour ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                    onPress={onRetour}
                    style={{
                      minHeight: theme.taille.tapMin,
                      marginVertical: mesure.retourMargeCible,
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      gap: mesure.retourEspace,
                    }}
                  >
                    <FlecheV2 retour couleur={theme.couleur.marque.primaire} />
                    <Text
                      style={{
                        ...theme.texte.v2LabelChamp,
                        fontSize: theme.texte.v2Petit.fontSize,
                        color: theme.couleur.marque.primaire,
                      }}
                    >
                      {libelleRetour ?? (etape === 2 ? 'Modifier mon offre' : 'Retour au profil')}
                    </Text>
                  </Pressable>
                ) : null}
                {etapes}
              </View>
            ) : null}
            {titre ? (
              <View style={{ marginBottom: mesure.tunnelTitreApres }}>
                {surtitre || etape ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: theme.espace[1],
                      marginBottom: mesure.tunnelSurtitreApres,
                    }}
                  >
                    {surtitre ? (
                      <Text
                        style={{
                          ...theme.texte.v2Surtitre,
                          textTransform: 'uppercase',
                          color: theme.couleur.marque.primaire,
                        }}
                      >
                        {surtitre}
                      </Text>
                    ) : null}
                    {surtitre && etape ? (
                      <Text
                        style={{ ...theme.texte.v2Surtitre, color: theme.couleur.marque.primaire }}
                      >
                        ·
                      </Text>
                    ) : null}
                    {etape ? (
                      <Text
                        style={{
                          ...theme.texte.v2Surtitre,
                          textTransform: 'uppercase',
                          color: theme.couleur.marque.primaire,
                        }}
                      >{`Étape ${etape} sur 2`}</Text>
                    ) : null}
                  </View>
                ) : null}
                <Text
                  accessibilityRole="header"
                  style={{
                    ...(large ? theme.texte.v2TitreTunnelLarge : theme.texte.v2TitreTunnel),
                    color: theme.couleur.texte.principal,
                  }}
                >
                  {titre}
                </Text>
                {description ? (
                  <Text
                    style={{
                      ...theme.texte.v2Corps,
                      marginTop: mesure.tunnelDescriptionAvant,
                      color: theme.couleur.texte.secondaire,
                    }}
                  >
                    {description}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={{ flexDirection: large ? 'row' : 'column', gap: mesure.tunnelColonnes }}>
              <View style={{ flex: 1, minWidth: 0, gap: theme.espace[4] }}>{children}</View>
              {large && (pied || complement) ? (
                <View
                  style={{
                    width: mesure.tunnelAside,
                    padding: theme.espace[6],
                    borderRadius: mesure.tunnelOffreRayon,
                    borderWidth: mesure.bordure,
                    borderColor: theme.couleur.bordure.v2Etape,
                    backgroundColor: theme.couleur.fond.surface,
                    gap: theme.espace[6],
                  }}
                >
                  {complement}
                  {pied}
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
        {!large && pied ? (
          <View
            style={{
              paddingHorizontal: mesure.enteteHorizontal,
              paddingTop: mesure.tunnelPiedHaut,
              paddingBottom: Math.max(mesure.tunnelPiedBas, insets.bottom),
              borderTopWidth: mesure.bordure,
              borderTopColor: theme.couleur.bordure.v2Etape,
              gap: theme.espace[2],
            }}
          >
            {pied}
          </View>
        ) : null}
      </View>
    </FournisseurPresentationV2>
  );
}
