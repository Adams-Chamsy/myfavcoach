import { CadreFormulaireV2 } from '@/composants/presentation-v2';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { Chip } from '@/composants/chip';
import { Icone } from '@/composants/icones';
import { textesRepliErreur } from '@/composants/etats/textes';
import { EnteteOnboarding } from '@/fonctionnalites/identite/entete-onboarding';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { objectifsOnboarding, rythmesOnboarding } from '@/fixtures/demonstration';
import { presentationV2 as mesure } from '@/theme/tokens';
import { useTheme, type ThemeResolu } from '@/theme/fournisseur';

// docs/ecrans/L1-05-onboarding-client.md, étape 2/4 — reprend l'écran 22 de la maquette au
// pixel (structure, couleurs, rayons), avec le texte EXACT de la fiche (qui diffère par
// endroits du texte de démonstration de la maquette — docs/design-system.md, la fiche gagne)
// et les 8 objectifs / 3 rythmes de src/fixtures/demonstration.ts, jamais une chaîne écrite ici.
export default function OnboardingObjectifs() {
  const theme = useTheme();
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
    <CadreFormulaireV2
      reference="objectifs"
      surtitre="TES ENVIES"
      titre="Qu’est-ce que tu veux faire bouger ?"
      description="Choisis-en autant que tu veux."
      entete={
        <>
          <EnteteOnboarding
            etape={2}
            desactive={chargement}
            onPasser={() => enregistrerEtAvancer([], null)}
          />
        </>
      }
      alerte={
        erreur ? (
          <View
            accessibilityLiveRegion="polite"
            style={{ paddingHorizontal: theme.espace.gouttiere, paddingTop: theme.espace[2] }}
          >
            <Text style={{ ...theme.texte.label, color: theme.couleur.etat.erreurEncre }}>
              {textesRepliErreur.serveur.titre}
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
              {textesRepliErreur.serveur.explication}
            </Text>
          </View>
        ) : null
      }
      actions={
        <>
          {/* Hors de la zone de défilement : un message d'erreur doit être dans le champ de vision
          (2 novembre 2026, docs/prompts/defauts-L2-iphone.md, partie B). Le repli serveur, titre et
          détail, jamais le texte du port. */}

          <>
            <Bouton
              libelle={`Continuer · ${objectifs.length} objectif${objectifs.length > 1 ? 's' : ''}`}
              variante="primaire"
              onPress={() => enregistrerEtAvancer(objectifs, rythme)}
              desactive={objectifs.length === 0 || chargement}
            />
          </>
        </>
      }
    >
      <Text
        style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.secondaire }}
      >{`${objectifs.length} objectif${objectifs.length > 1 ? 's' : ''}`}</Text>
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
      <View style={{ gap: theme.espace[3] }}>
        <Text style={{ ...theme.texte.actionAccent, color: theme.couleur.texte.principal }}>
          Ton rythme, sans pression.
        </Text>
        <View style={{ gap: mesure.radioEspace }}>
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
        <Icone nom="securite" taille={theme.taille.icone} couleur={theme.couleur.texte.principal} />
        <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.principal, flex: 1 }}>
          Tes réponses restent privées jusqu’à ce que tu t’abonnes à un coach. Aucune donnée de
          santé n’est partagée sans ton accord.
        </Text>
      </View>
    </CadreFormulaireV2>
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
        flexDirection: 'row',
        gap: mesure.radioEspace,
        minHeight: mesure.radioHauteur,
        paddingVertical: mesure.radioVertical,
        paddingHorizontal: mesure.radioHorizontal,
        borderRadius: mesure.radioRayon,
        backgroundColor: selectionne
          ? theme.couleur.marque.primaireTeinte
          : theme.couleur.fond.canevas,
        borderWidth: mesure.bordure,
        borderColor: selectionne ? theme.couleur.marque.primaire : theme.couleur.bordure.marquee,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: mesure.radioDiametre,
          height: mesure.radioDiametre,
          borderRadius: theme.rayon.pilule,
          borderWidth: mesure.bordure,
          borderColor: selectionne ? theme.couleur.marque.primaire : theme.couleur.texte.secondaire,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selectionne ? (
          <View
            style={{
              width: mesure.radioCentre,
              height: mesure.radioCentre,
              borderRadius: theme.rayon.pilule,
              backgroundColor: theme.couleur.marque.primaire,
            }}
          />
        ) : null}
      </View>
      <Text
        style={{
          ...theme.texte.v2Corps,
          color: selectionne ? theme.couleur.marque.primaireSurvol : theme.couleur.texte.principal,
        }}
      >
        {libelle}
      </Text>
    </Pressable>
  );
}
