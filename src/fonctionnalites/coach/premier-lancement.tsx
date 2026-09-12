import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/composants/avatar';
import { Carte } from '@/composants/carte';
import { Icone } from '@/composants/icones';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

export type LigneMiseEnRoute = { libelle: string; fait: boolean; route: Href };

// L2-11 : écran 19, premier lancement coach. Compteur « N sur 3 » dynamique (fiche, "Ce qui a
// été inventé") — jamais figé à "1 sur 3" comme la maquette le montre pour son cas de
// démonstration.
export function PremierLancement({
  prenom,
  lignes,
}: {
  prenom: string;
  lignes: LigneMiseEnRoute[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const nombreFaits = lignes.filter((l) => l.fait).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      {/* Île fixe, toujours sombre (CLAUDE.md §5) : themes.sombre lu explicitement. */}
      <View
        style={{
          backgroundColor: themes.sombre.fond.canevas,
          paddingTop: insets.top + theme.espace[3],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[4],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.espace[3],
        }}
      >
        <Avatar nom={prenom} taille="md" />
        <Text style={{ ...theme.texte.titre2, color: themes.sombre.texte.surSombre }}>
          Bienvenue {prenom}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[4],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Carte>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Revenus du mois
          </Text>
          <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>0 €</Text>
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            Ton premier abonné apparaîtra ici.
          </Text>
        </Carte>

        <View style={{ alignItems: 'center', gap: theme.espace[2] }}>
          <Icone nom="clients" couleur={theme.couleur.texte.attenue} />
          <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
            Encore aucun client
          </Text>
          <Text
            style={{
              ...theme.texte.petit,
              color: theme.couleur.texte.secondaire,
              textAlign: 'center',
            }}
          >
            Trois étapes et ton profil devient visible dans la marketplace. Compte 15 minutes.
          </Text>
        </View>

        <Carte>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Mise en route — {nombreFaits} sur {lignes.length}
          </Text>
          <View style={{ gap: theme.espace[3] }}>
            {lignes.map((ligne) => (
              <Pressable
                key={ligne.libelle}
                onPress={() => router.push(ligne.route)}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.espace[3],
                  minHeight: theme.taille.tapMin,
                }}
              >
                <Icone
                  nom={ligne.fait ? 'valide' : 'information'}
                  couleur={
                    ligne.fait ? theme.couleur.etat.succesEncre : theme.couleur.texte.attenue
                  }
                />
                <Text
                  style={{ ...theme.texte.corps, color: theme.couleur.texte.principal, flex: 1 }}
                >
                  {ligne.libelle}
                </Text>
              </Pressable>
            ))}
          </View>
        </Carte>

        <View
          style={{
            backgroundColor: theme.couleur.marque.primaireTeinte,
            borderRadius: theme.rayon.carte,
            padding: theme.espace[3],
          }}
        >
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.principal }}>
            Tes 3 premiers mois sont sans commission. Tu restes cliente de tes propres coachs en
            basculant d’espace à tout moment.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
