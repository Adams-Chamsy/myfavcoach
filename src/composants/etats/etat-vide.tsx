import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { useTheme } from '@/theme/fournisseur';

export type ProprietesEtatVide = {
  titre: string;
  explication: string;
  // Une seule action, en bouton secondaire — jamais plus (docs/ecrans/L0-03-etats-systeme.md).
  actionPrincipale?: { libelle: string; onPress: () => void };
  // Permet a un ecran de ne jamais rester nu (« Proches de ta recherche »).
  contenuSecondaire?: ReactNode;
};

// Aucune illustration : ce systeme n'en a pas (docs/ecrans/L0-03-etats-systeme.md). Pas de
// prop icone non plus — le tableau de props de la fiche n'en liste aucune.
export function EtatVide({
  titre,
  explication,
  actionPrincipale,
  contenuSecondaire,
}: ProprietesEtatVide) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.espace[6] }}>
      <View style={{ alignItems: 'center', gap: theme.espace[3], padding: theme.espace[6] }}>
        <Text
          style={{
            ...theme.texte.titre2,
            color: theme.couleur.texte.principal,
            textAlign: 'center',
          }}
        >
          {titre}
        </Text>
        <Text
          style={{
            ...theme.texte.corps,
            color: theme.couleur.texte.secondaire,
            textAlign: 'center',
          }}
        >
          {explication}
        </Text>
        {actionPrincipale ? (
          <Bouton
            variante="secondaire"
            libelle={actionPrincipale.libelle}
            onPress={actionPrincipale.onPress}
          />
        ) : null}
      </View>

      {contenuSecondaire}
    </View>
  );
}
