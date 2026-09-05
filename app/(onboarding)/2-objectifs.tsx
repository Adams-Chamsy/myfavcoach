import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Chip } from '@/composants/chip';
import { Icone } from '@/composants/icones';
import { EnteteOnboarding } from '@/fonctionnalites/identite/entete-onboarding';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { objectifsOnboarding, rythmesOnboarding } from '@/fixtures/demonstration';
import { useTheme, type ThemeResolu } from '@/theme/fournisseur';

// docs/ecrans/L1-05-onboarding-client.md, étape 2/4 — reprend l'écran 22 de la maquette au
// pixel (structure, couleurs, rayons), avec le texte EXACT de la fiche (qui diffère par
// endroits du texte de démonstration de la maquette — docs/design-system.md, la fiche gagne)
// et les 8 objectifs / 3 rythmes de src/fixtures/demonstration.ts, jamais une chaîne écrite ici.
export default function OnboardingObjectifs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port } = useDonnees();

  const [objectifs, setObjectifs] = useState<string[]>([]);
  const [rythme, setRythme] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Reprise via le bouton retour depuis l'étape 3 (P1.11) : relit ce qui a déjà été choisi
  // plutôt que de reproposer une sélection vide, sinon "retour" ferait perdre un choix pourtant
  // déjà enregistré côté serveur.
  useEffect(() => {
    let monte = true;
    port.lireProfilOnboarding().then((profil) => {
      if (!monte) return;
      if (profil.objectifs.length > 0) setObjectifs(profil.objectifs);
      if (profil.rythme) setRythme(profil.rythme);
    });
    return () => {
      monte = false;
    };
  }, [port]);

  function basculerObjectif(cle: string) {
    setObjectifs((actuels) =>
      actuels.includes(cle) ? actuels.filter((c) => c !== cle) : [...actuels, cle],
    );
  }

  async function enregistrerEtAvancer(objectifsChoisis: string[], rythmeChoisi: string | null) {
    setErreur(null);
    setChargement(true);
    const resultat = await port.enregistrerObjectifsEtRythme(objectifsChoisis, rythmeChoisi);
    setChargement(false);

    if (!resultat.succes) {
      setErreur(resultat.erreur);
      return;
    }
    router.push('/(onboarding)/3-poids');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <EnteteOnboarding
        etape={2}
        desactive={chargement}
        onPasser={() => enregistrerEtAvancer([], null)}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[2],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <View style={{ gap: theme.espace[2] }}>
          <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
            Qu’est-ce que tu veux faire bouger ?
          </Text>
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
            Choisis-en autant que tu veux.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[3] }}>
          {objectifsOnboarding.map((objectif) => (
            <Chip
              key={objectif.cle}
              libelle={objectif.libelle}
              variante="selection"
              selectionne={objectifs.includes(objectif.cle)}
              onPress={() => basculerObjectif(objectif.cle)}
            />
          ))}
        </View>

        <View style={{ height: 1, backgroundColor: theme.couleur.bordure.discrete }} />

        <View style={{ gap: theme.espace[3] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Ton rythme réaliste
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.espace[3] }}>
            {rythmesOnboarding.map((option) => (
              <TuileRythme
                key={option.cle}
                libelle={option.libelle}
                selectionne={rythme === option.cle}
                onPress={() => setRythme((actuel) => (actuel === option.cle ? null : option.cle))}
                theme={theme}
              />
            ))}
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: theme.espace[3],
            padding: theme.espace[4],
            borderRadius: theme.rayon.carte,
            backgroundColor: theme.couleur.marque.secondaire,
            alignItems: 'flex-start',
          }}
        >
          <Icone
            nom="securite"
            taille={theme.taille.icone}
            couleur={theme.couleur.texte.principal}
          />
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.principal, flex: 1 }}>
            Tes réponses restent privées jusqu’à ce que tu t’abonnes à un coach. Aucune donnée de
            santé n’est partagée sans ton accord.
          </Text>
        </View>

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
          libelle={`Continuer · ${objectifs.length} objectif${objectifs.length > 1 ? 's' : ''}`}
          variante="primaire"
          onPress={() => enregistrerEtAvancer(objectifs, rythme)}
          desactive={objectifs.length === 0 || chargement}
        />
      </View>
    </View>
  );
}

function TuileRythme({
  libelle,
  selectionne,
  onPress,
  theme,
}: {
  libelle: string;
  selectionne: boolean;
  onPress: () => void;
  theme: ThemeResolu;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: selectionne }}
      style={{
        flex: 1,
        minHeight: theme.taille.tapMin,
        paddingVertical: theme.espace[3],
        paddingHorizontal: theme.espace[2],
        borderRadius: theme.rayon.carte,
        backgroundColor: selectionne
          ? theme.couleur.marque.primaireTeinte
          : theme.couleur.fond.surface,
        borderWidth: selectionne ? 2 : 1,
        borderColor: selectionne ? theme.couleur.marque.primaire : theme.couleur.bordure.marquee,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          ...theme.texte.actionAccent,
          textAlign: 'center',
          color: selectionne ? theme.couleur.marque.primaireSurvol : theme.couleur.texte.principal,
        }}
      >
        {libelle}
      </Text>
    </Pressable>
  );
}
