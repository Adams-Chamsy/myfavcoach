import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { EtatVide } from '@/composants/etats/etat-vide';
import {
  TEXTES_DOCUMENTS,
  TITRES_DOCUMENTS,
  VERSIONS_DOCUMENTS,
  formaterVersionDocument,
  type TypeDocumentLegal,
} from '@/fonctionnalites/identite/documents-legaux';
import { useTheme } from '@/theme/fournisseur';

const TYPES_CONNUS = new Set<string>(Object.keys(TITRES_DOCUMENTS));

function estTypeConnu(valeur: string | undefined): valeur is TypeDocumentLegal {
  return valeur != null && TYPES_CONNUS.has(valeur);
}

// Corps de l'écran, séparé de la lecture du paramètre de route : un paramètre dynamique
// ([type]) ne se résout qu'à travers un vrai match de route, jamais depuis app/_galerie.tsx (le
// même trou existe, non résolu, sur app/(client)/coach/[id].tsx). Exporté pour que la galerie
// exerce les quatre documents et l'état "introuvable" sans dépendre d'un routeur réel.
export function CorpsDocumentLegal({ type }: { type: string | undefined }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (!estTypeConnu(type)) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.couleur.fond.canevas,
          padding: theme.espace.gouttiere,
          justifyContent: 'center',
        }}
      >
        <EtatVide titre="Document introuvable" explication="Ce lien ne mène à aucun document." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: insets.top + theme.espace[4],
          paddingBottom: theme.espace[6],
          gap: theme.espace[3],
        }}
      >
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          {TITRES_DOCUMENTS[type]}
        </Text>
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
          Version du {formaterVersionDocument(VERSIONS_DOCUMENTS[type])}
        </Text>
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
          {TEXTES_DOCUMENTS[type]}
        </Text>
      </ScrollView>

      {/* Retour uniquement : aucune action d'acceptation ici, l'acceptation reste portée par le
          geste qui la déclenche ailleurs (inscription, activation coach) — fiche, "Contenu —
          surface publique". */}
      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[3],
          paddingBottom: insets.bottom + theme.espace[3],
          borderTopWidth: 1,
          borderTopColor: theme.couleur.bordure.discrete,
        }}
      >
        <Bouton libelle="Retour" variante="secondaire" onPress={() => router.back()} />
      </View>
    </View>
  );
}

// L2-03 (C-06), surface publique : ouverte SANS session par les liens de L1-01 et de
// l'inscription. Lit un document, un seul à la fois, jamais une liste, jamais une mention de
// ce qu'un compte a accepté — un visiteur non connecté n'a rien accepté. Vit dans (public),
// jamais derrière la garde de session (src/fonctionnalites/identite/garde.ts).
export default function DocumentLegalPublic() {
  const { type } = useLocalSearchParams<{ type: string }>();
  return <CorpsDocumentLegal type={type} />;
}
