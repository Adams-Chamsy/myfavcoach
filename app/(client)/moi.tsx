import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EcranProvisoire } from '@/composants/ecran-provisoire';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

// Écran 24 "Compte et réglages", docs/perimetre.md. PROVISOIRE au-delà du bloc encre : le
// reste de l'écran (identité, liste de réglages, déconnexion) est docs/ecrans/
// L1-07-compte-reglages.md, P1.13. Le bloc encre est ajouté ici par P1.12 (docs/prompts/L1.md)
// — seul point que L1-06 (bascule d'espace) doit poser avant que l'écran réel n'existe.
//
// Asymétrie assumée : app/(coach)/moi.tsx n'existe pas encore (même route relative "moi" dans
// les deux espaces, per L1-07) — P1.13 construit les deux écrans "pour de bon". Rien ici ne le
// remplace par anticipation.
//
// Comportement du bloc encre lui-même : docs/ecrans/L1-06-bascule-espace.md et
// docs/ecrans/L1-07-compte-reglages.md (§Contenu, tranché après une ambiguïté entre les deux
// fiches) sont d'accord — presser le bloc OUVRE FeuilleBascule, au même titre que l'avatar,
// jamais une bascule directe ni une navigation directe vers L1-08. Titre et sous-titre du bloc
// ne sont qu'un aperçu du contenu de la feuille.
//
// Île sombre FIXE (CLAUDE.md §5) : fond ET texte viennent de themes.sombre, jamais de
// useTheme() — fond.inverse s'inverserait sous un thème ambiant sombre (theme forcé de la
// galerie, test:a11y, un futur vrai thème sombre) et rendrait ce texte invisible sur son propre
// fond, exactement le bug déjà trouvé deux fois (barre-navigation.tsx, app/(public)/index.tsx).
export default function Moi() {
  const theme = useTheme();
  // Onglet sous <Tabs headerShown:false> : rien au-dessus ne réserve la barre d'état. Comme
  // accueil.tsx et pilotage.tsx, l'écran pousse lui-même son premier contenu sous l'encoche.
  const insets = useSafeAreaInsets();
  const { profils } = useDonnees();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  const coachExiste = profils?.coachExiste ?? false;

  return (
    <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            paddingTop: insets.top + theme.espace[2],
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace.gouttiere,
          }}
        >
          <Pressable
            onPress={() => setFeuilleOuverte(true)}
            accessibilityRole="button"
            accessibilityLabel={coachExiste ? 'Passer en espace coach' : 'Devenir coach'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.espace[3],
              padding: theme.espace[4],
              borderRadius: theme.rayon.carte,
              backgroundColor: themes.sombre.fond.canevas,
              minHeight: theme.taille.tapMin,
            }}
          >
            <View style={{ flex: 1, gap: theme.espace[1] }}>
              <Text style={{ ...theme.texte.titre3, color: themes.sombre.texte.surSombre }}>
                {coachExiste ? 'Passer en espace coach' : 'Devenir coach'}
              </Text>
              <Text style={{ ...theme.texte.petit, color: themes.sombre.texte.secondaire }}>
                {coachExiste ? 'Tes clients et tes revenus' : 'Publier tes offres et être payé'}
              </Text>
            </View>
          </Pressable>
        </View>

        <EcranProvisoire titre="Moi" lot="L1" />
      </View>
    </FeuilleBascule>
  );
}
