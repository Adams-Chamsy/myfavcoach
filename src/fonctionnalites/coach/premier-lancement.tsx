import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { type Href, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icone } from '@/composants/icones';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

export type LigneMiseEnRoute = { libelle: string; fait: boolean; route: Href };

// L2-11 : écran 19, premier lancement coach. Compteur « N sur 3 » dynamique (fiche, "Ce qui a
// été inventé") — jamais figé à "1 sur 3" comme la maquette le montre pour son cas de
// démonstration.
export function PremierLancement({ lignes }: { lignes: LigneMiseEnRoute[] }) {
  const theme = useTheme();
  const router = useRouter();
  const nombreFaits = lignes.filter((l) => l.fait).length;

  return (
    <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <DefilementEcran
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[4],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <View
          style={{
            padding: theme.espace[6],
            gap: theme.espace[3],
            borderRadius: theme.rayon.carte,
            backgroundColor: themes.clair.marque.primaireProfond,
          }}
        >
          <Text style={{ ...theme.texte.label, color: themes.clair.texte.surMarque }}>
            Revenus du mois
          </Text>
          <Text style={{ ...theme.texte.heroLarge, color: themes.clair.texte.surMarque }}>0 €</Text>
          <Text style={{ ...theme.texte.petit, color: themes.clair.texte.surMarque }}>
            Ton premier abonné apparaîtra ici.
          </Text>
        </View>

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

        <View
          style={{
            padding: theme.espace[6],
            gap: theme.espace[3],
            borderRadius: theme.rayon.carte,
            backgroundColor: theme.couleur.fond.surface,
          }}
        >
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
        </View>

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
      </DefilementEcran>
    </CanevasEcran>
  );
}
