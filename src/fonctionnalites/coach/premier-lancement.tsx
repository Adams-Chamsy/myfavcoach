import { CadreFormulaireV2 } from '@/composants/presentation-v2';
import { Bouton } from '@/composants/bouton';
import { type Href, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icone } from '@/composants/icones';
import { useTheme } from '@/theme/fournisseur';
import { themes, presentationV2 as mesure } from '@/theme/tokens';

export type LigneMiseEnRoute = { libelle: string; fait: boolean; route: Href };

// L2-11 : écran 19, premier lancement coach. Compteur « N sur 3 » dynamique (fiche, "Ce qui a
// été inventé") — jamais figé à "1 sur 3" comme la maquette le montre pour son cas de
// démonstration.
export function PremierLancement({
  lignes,
  prenom,
}: {
  lignes: LigneMiseEnRoute[];
  prenom?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const nombreFaits = lignes.filter((l) => l.fait).length;

  return (
    <CadreFormulaireV2
      enteteGlobal={null}
      reference="mise-en-route"
      surtitre={prenom ? `BIENVENUE ${prenom.toUpperCase()}` : 'BIENVENUE'}
      titre={'Ton savoir-faire.\nLeur prochain déclic.'}
      description="Prépare les premiers repères de ton activité."
      actions={
        <Bouton
          libelle="Créer ma première offre"
          onPress={() => router.push('/(coach)/creer/offre' as Href)}
        />
      }
    >
      <View
        style={{
          paddingVertical: mesure.coachPanneauVertical,
          paddingHorizontal: mesure.coachPanneauHorizontal,
          gap: theme.espace[3],
          borderRadius: mesure.histoirePhotoRayon,
          backgroundColor: themes.clair.marque.primaireProfond,
        }}
      >
        <Text style={{ ...theme.texte.label, color: themes.clair.texte.surMarque }}>
          Revenus du mois
        </Text>
        <Text
          style={{
            fontFamily: theme.texte.heroLarge.fontFamily,
            fontSize: mesure.coachZero,
            lineHeight: mesure.coachZeroInterligne,
            color: themes.clair.texte.surMarque,
          }}
        >
          0 €
        </Text>
        <Text style={{ ...theme.texte.v2Petit, color: themes.clair.texte.surMarque }}>
          Ton premier abonné apparaîtra ici.
        </Text>
      </View>

      <View
        style={{
          paddingVertical: mesure.coachPanneauVertical,
          paddingHorizontal: mesure.coachPanneauHorizontal,
          gap: theme.espace[3],
          borderRadius: mesure.histoirePhotoRayon,
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
                couleur={ligne.fait ? theme.couleur.etat.succesEncre : theme.couleur.texte.attenue}
              />
              <Text
                style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.principal, flex: 1 }}
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
          borderRadius: mesure.histoirePhotoRayon,
          padding: theme.espace[3],
        }}
      >
        <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.principal }}>
          Tes 3 premiers mois sont sans commission. Tu restes cliente de tes propres coachs en
          basculant d’espace à tout moment.
        </Text>
      </View>
    </CadreFormulaireV2>
  );
}
