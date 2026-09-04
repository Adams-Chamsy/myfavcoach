import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { objectifsOnboarding, rythmesOnboarding } from '@/fixtures/demonstration';
import { EnteteOnboarding } from '@/fonctionnalites/identite/entete-onboarding';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { ProfilOnboarding } from '@/services/donnees/port';
import { useTheme, type ThemeResolu } from '@/theme/fournisseur';

const NON_RENSEIGNE = 'Non renseigné';

function libellesObjectifs(cles: string[]): string {
  if (cles.length === 0) return NON_RENSEIGNE;
  return cles
    .map((cle) => objectifsOnboarding.find((o) => o.cle === cle)?.libelle ?? cle)
    .join(', ');
}

function libelleRythme(cle: string | null): string {
  if (!cle) return NON_RENSEIGNE;
  return rythmesOnboarding.find((r) => r.cle === cle)?.libelle ?? cle;
}

// "en kilogrammes avec une décimale" (étape 3/4) : même format à l'affichage.
function formaterKg(grammes: number): string {
  return `${(grammes / 1000).toFixed(1).replace('.', ',')} kg`;
}

function libellePointDeDepart(profil: ProfilOnboarding): string {
  if (profil.poidsDepartGrammes == null && profil.poidsCibleGrammes == null) return NON_RENSEIGNE;
  const depart = profil.poidsDepartGrammes != null ? formaterKg(profil.poidsDepartGrammes) : '?';
  const cible = profil.poidsCibleGrammes != null ? formaterKg(profil.poidsCibleGrammes) : '?';
  return `${depart} → ${cible}`;
}

// docs/ecrans/L1-05-onboarding-client.md, étape 4/4 — dernière étape, jamais de "Passer" (rien
// à sauter sur un récapitulatif) : EnteteOnboarding reçoit onPasser=undefined, comme à
// l'étape 1, mais pour une raison différente (documentée là où ça compte, pas ici en double).
export default function OnboardingCestParti() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port } = useDonnees();

  const [profil, setProfil] = useState<ProfilOnboarding | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let monte = true;
    port.lireProfilOnboarding().then((valeur) => {
      if (monte) setProfil(valeur);
    });
    return () => {
      monte = false;
    };
  }, [port]);

  async function surDecouvrirDesCoachs() {
    setErreur(null);
    setChargement(true);
    const resultat = await port.terminerOnboarding();
    setChargement(false);

    if (!resultat.succes) {
      setErreur(resultat.erreur);
      return;
    }
    // Fixe, pas determinerDestination() : L1-05 ne connaît qu'une seule sortie possible
    // (garde.ts est pour le ROUTAGE au démarrage, pas pour la navigation intra-onboarding).
    router.replace('/(client)/accueil' as Href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <EnteteOnboarding etape={4} desactive={chargement} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[2],
          paddingBottom: theme.espace[6],
          gap: theme.espace[6],
        }}
      >
        <Text style={{ ...theme.texte.display, color: theme.couleur.texte.principal }}>
          Bienvenue{profil?.prenom ? `, ${profil.prenom}` : ''}.
        </Text>

        {profil ? (
          <View style={{ gap: theme.espace[4] }}>
            <LigneRecap
              theme={theme}
              titre="Objectifs"
              valeur={libellesObjectifs(profil.objectifs)}
              onModifier={() => router.push('/(onboarding)/2-objectifs')}
            />
            <LigneRecap
              theme={theme}
              titre="Rythme"
              valeur={libelleRythme(profil.rythme)}
              onModifier={() => router.push('/(onboarding)/2-objectifs')}
            />
            <LigneRecap
              theme={theme}
              titre="Point de départ"
              valeur={libellePointDeDepart(profil)}
              onModifier={() => router.push('/(onboarding)/3-poids')}
            />
          </View>
        ) : null}

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
          libelle="Découvrir des coachs"
          variante="primaire"
          onPress={surDecouvrirDesCoachs}
          desactive={chargement}
        />
      </View>
    </View>
  );
}

function LigneRecap({
  theme,
  titre,
  valeur,
  onModifier,
}: {
  theme: ThemeResolu;
  titre: string;
  valeur: string;
  onModifier: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.espace[3],
      }}
    >
      <View style={{ flex: 1, gap: theme.espace[1] }}>
        <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>{titre}</Text>
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>{valeur}</Text>
      </View>
      <Pressable
        onPress={onModifier}
        accessibilityRole="button"
        style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
      >
        <Text style={{ ...theme.texte.petit, color: theme.couleur.marque.primaire }}>Modifier</Text>
      </Pressable>
    </View>
  );
}
