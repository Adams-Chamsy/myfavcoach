import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { FeuilleBasse } from '@/composants/feuille-basse';
import { BarreOngletsRoute, type EntreeOnglet } from '@/fonctionnalites/navigation/barre-onglets';
import { useTheme } from '@/theme/fournisseur';

// Ordre et libelles de docs/ecrans/L0-02-coquille-coach.md. "Créer" n'y figure pas : ce n'est
// pas un onglet mais une action, ajoutee via actionCentrale ci-dessous.
const ONGLETS: EntreeOnglet[] = [
  { nomRoute: 'pilotage', icone: 'pilotage', libelle: 'Pilotage' },
  { nomRoute: 'clients', icone: 'clients', libelle: 'Clients' },
  { nomRoute: 'agenda', icone: 'agenda', libelle: 'Agenda' },
  { nomRoute: 'revenus', icone: 'virement', libelle: 'Revenus' },
];

const OPTIONS_CREER: { type: 'programme' | 'seance' | 'offre'; libelle: string }[] = [
  { type: 'programme', libelle: 'Nouveau programme' },
  { type: 'seance', libelle: 'Nouvelle séance' },
  { type: 'offre', libelle: 'Nouvelle offre' },
];

// docs/ecrans/L0-02-coquille-coach.md. La bascule vers l'espace client n'existe pas encore
// (elle arrive en L1, par l'avatar) : ne pas la preparer ici.
export default function LayoutCoach() {
  const theme = useTheme();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  function creer(type: 'programme' | 'seance' | 'offre') {
    setFeuilleOuverte(false);
    // `as Href` : voir le commentaire equivalent dans app/index.tsx — route reelle, type de
    // .expo/types/router.d.ts trop generique hors serveur de developpement.
    router.push(`/(coach)/creer/${type}` as Href);
  }

  return (
    <FeuilleBasse
      ouverte={feuilleOuverte}
      onFermer={() => setFeuilleOuverte(false)}
      enfants={
        <View style={{ gap: theme.espace[1] }}>
          {OPTIONS_CREER.map((option) => (
            <Pressable
              key={option.type}
              onPress={() => creer(option.type)}
              accessibilityRole="button"
              style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
            >
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                {option.libelle}
              </Text>
            </Pressable>
          ))}
        </View>
      }
    >
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <BarreOngletsRoute
            variante="coach"
            entrees={ONGLETS}
            actionCentrale={{
              position: 2,
              icone: 'ajouter',
              libelle: 'Créer',
              onPress: () => setFeuilleOuverte(true),
            }}
            {...props}
          />
        )}
      >
        <Tabs.Screen name="pilotage" />
        <Tabs.Screen name="clients" />
        <Tabs.Screen name="agenda" />
        <Tabs.Screen name="revenus" />
        {/* creer/ (voir son _layout.tsx) reste dans ce groupe pour l'autorisation par profil de
            L1, mais n'est pas un onglet : href:null l'exclut de la barre par defaut. Le rendu
            personnalise ci-dessus ignore de toute facon les routes absentes de ONGLETS
            (BarreOngletsRoute, src/fonctionnalites/navigation/barre-onglets.tsx). */}
        <Tabs.Screen name="creer" options={{ href: null }} />
        {/* moi : ecran 24 « Mon compte », meme route relative que (client)/moi (L1-07). Pas un
            onglet coach — atteint par l'avatar et la feuille de bascule, href:null comme creer. */}
        <Tabs.Screen name="moi" options={{ href: null }} />
      </Tabs>
    </FeuilleBasse>
  );
}
