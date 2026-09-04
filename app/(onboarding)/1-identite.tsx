import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Champ } from '@/composants/champ';
import { EnteteOnboarding } from '@/fonctionnalites/identite/entete-onboarding';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-05-onboarding-client.md, étape 1/4 : "Prénom | oui | Champ, 2 à 40 caractères".
const LONGUEUR_PRENOM_MIN = 2;
const LONGUEUR_PRENOM_MAX = 40;

// Photo et commune DÉLIBÉRÉMENT absentes de cet écran (décision explicite avant construction,
// voir docs/dette.md) : aucune infrastructure de stockage (Supabase Storage) ni de
// référentiel INSEE des communes n'existe encore dans ce dépôt — les inventer pour ce lot
// aurait été construire au-delà de ce dont ce prompt a besoin. Le prénom, seule donnée
// obligatoire de tout l'onboarding (fiche : "il n'a rien à dire sans lui"), reste seul ici
// avec le nom (facultatif, jamais affiché publiquement au client).
export default function OnboardingIdentite() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port } = useDonnees();

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const prenomValide =
    prenom.trim().length >= LONGUEUR_PRENOM_MIN && prenom.trim().length <= LONGUEUR_PRENOM_MAX;

  async function surContinuer() {
    setErreur(null);
    setChargement(true);
    const resultat = await port.creerProfilClient(prenom.trim(), nom.trim());
    setChargement(false);

    if (!resultat.succes) {
      setErreur(resultat.erreur);
      return;
    }
    router.push('/(onboarding)/2-objectifs');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <EnteteOnboarding etape={1} desactive={chargement} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[2],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          Comment on t’appelle ?
        </Text>

        <Champ libelle="Prénom" valeur={prenom} onChangeTexte={setPrenom} desactive={chargement} />

        <Champ
          libelle="Nom"
          valeur={nom}
          onChangeTexte={setNom}
          desactive={chargement}
          placeholder="Facultatif"
        />

        {erreur ? (
          <View accessibilityLiveRegion="polite">
            <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
              {erreur}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[3],
          paddingBottom: insets.bottom + theme.espace[3],
          borderTopWidth: 1,
          borderTopColor: theme.couleur.bordure.discrete,
          backgroundColor: theme.couleur.fond.canevas,
        }}
      >
        <Bouton
          libelle="Continuer"
          variante="primaire"
          onPress={surContinuer}
          desactive={!prenomValide || chargement}
        />
      </View>
    </View>
  );
}
