import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Champ } from '@/composants/champ';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { EnteteOnboarding } from '@/fonctionnalites/identite/entete-onboarding';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';

// L2-05 — étape 2/4. Titre court et bio, mêmes colonnes et même écriture que « Mes
// informations » (L1-09, enregistrerInformations) : pas de duplication de mécanisme. Longueurs
// non trouvées dans le dossier (fiche, « Ce qui a été inventé ») — 80/600 caractères choisis
// ici, à confirmer.
const LONGUEUR_MAX_TITRE_COURT = 80;
const LONGUEUR_MAX_BIO = 600;

export default function DevenirCoachProfil() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { enregistrerInformations, profils } = useDonnees();

  const [titreCourt, setTitreCourt] = useState('');
  const [bio, setBio] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const pretAValider = titreCourt.trim() !== '' && bio.trim() !== '';

  async function surValider() {
    if (!profils || profils.profilActif !== 'coach') return;
    setErreur(null);
    setChargement(true);
    const resultat = await enregistrerInformations({
      profil: 'coach',
      prenom: profils.identiteActive.prenom,
      nom: profils.identiteActive.nom ?? '',
      titreCourt: titreCourt.trim(),
      bio: bio.trim(),
    });
    setChargement(false);
    if (!resultat.succes) {
      setErreur(resultat.erreur);
      return;
    }
    router.push('/(onboarding)/devenir-coach-verification');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <EnteteOnboarding etape={2} desactive={chargement} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[2],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          Présente-toi.
        </Text>
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
          C’est ce que les clients verront en premier sur ton profil.
        </Text>

        <Champ
          libelle="Titre court"
          placeholder="Préparateur physique certifié"
          valeur={titreCourt}
          onChangeTexte={(v) => setTitreCourt(v.slice(0, LONGUEUR_MAX_TITRE_COURT))}
          desactive={chargement}
        />
        <Champ
          libelle="Bio"
          valeur={bio}
          onChangeTexte={(v) => setBio(v.slice(0, LONGUEUR_MAX_BIO))}
          desactive={chargement}
        />

        {erreur ? (
          <View accessibilityLiveRegion="polite">
            <EtatErreur
              titre={textesRepliErreur.serveur.titre}
              explication={erreur}
              nombreEchecs={0}
              onReessayer={() => {}}
              onNousEcrire={() => {}}
            />
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
          onPress={surValider}
          desactive={!pretAValider || chargement}
        />
      </View>
    </View>
  );
}
