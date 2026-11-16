import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CadreFormulaireV2,
  EntetePublicV2,
  FlecheV2,
  useDispositionReferenceV2,
} from '@/composants/presentation-v2';
import { BarreNavigation, type ElementNavigation } from '@/composants/barre-navigation';
import { Avatar } from '@/composants/avatar';
import { FeuilleBasse } from '@/composants/feuille-basse';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import { useTheme } from '@/theme/fournisseur';
import { presentationV2 as mesure } from '@/theme/tokens';

export function CadreCompteV2({
  titre,
  surtitre,
  description,
  actions,
  alerte,
  children,
}: {
  titre: ReactNode;
  surtitre: string;
  description?: string;
  actions?: ReactNode;
  alerte?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { profils } = useDonnees();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { large } = useDispositionReferenceV2();
  const [bascule, setBascule] = useState(false);
  const [creation, setCreation] = useState(false);
  const coach = profils?.profilActif === 'coach';
  const nom = [profils?.identiteActive.prenom, profils?.identiteActive.nom]
    .filter(Boolean)
    .join(' ');
  const aller = (route: string) => router.push(route as Href);
  const elements: ElementNavigation[] = coach
    ? [
        {
          icone: 'pilotage',
          libelle: 'Pilotage',
          onPress: () => aller('/(coach)/(tabs)/pilotage'),
        },
        { icone: 'clients', libelle: 'Clients', onPress: () => aller('/(coach)/(tabs)/clients') },
        { icone: 'ajouter', libelle: 'Créer', misEnAvant: true, onPress: () => setCreation(true) },
        { icone: 'agenda', libelle: 'Agenda', onPress: () => aller('/(coach)/(tabs)/agenda') },
        { icone: 'virement', libelle: 'Revenus', onPress: () => aller('/(coach)/(tabs)/revenus') },
      ]
    : [
        { icone: 'accueil', libelle: 'Accueil', onPress: () => aller('/(client)/(tabs)/accueil') },
        {
          icone: 'recherche',
          libelle: 'Explorer',
          onPress: () => aller('/(client)/(tabs)/explorer'),
        },
        { icone: 'seance', libelle: 'Séance', onPress: () => aller('/(client)/(tabs)/seance') },
        {
          icone: 'message',
          libelle: 'Messages',
          onPress: () => aller('/(client)/(tabs)/messages'),
        },
        {
          icone: 'profil',
          libelle: 'Moi',
          actif: true,
          onPress: () => aller('/(client)/(tabs)/moi'),
        },
      ];
  const navigation = (
    <BarreNavigation
      variante={coach ? 'coach' : 'client'}
      elements={elements}
      paddingBas={insets.bottom}
      dansEntete={large}
    />
  );
  const retour = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Retour"
      onPress={() => {
        if (!router.canGoBack || router.canGoBack()) router.back();
        else aller(coach ? '/(coach)/(tabs)/moi' : '/(client)/(tabs)/moi');
      }}
      style={{
        minHeight: theme.taille.tapMin,
        marginVertical: mesure.retourMargeCible,
        flexDirection: 'row',
        alignItems: 'center',
        gap: mesure.retourEspace,
        alignSelf: 'flex-start',
      }}
    >
      <FlecheV2 retour couleur={theme.couleur.marque.primaire} />
      <Text style={{ ...theme.texte.v2Retour, color: theme.couleur.marque.primaire }}>
        Mon compte
      </Text>
    </Pressable>
  );
  return (
    <FeuilleBascule ouverte={bascule} onFermer={() => setBascule(false)}>
      <FeuilleBasse
        ouverte={creation}
        onFermer={() => setCreation(false)}
        enfants={
          <View style={{ gap: theme.espace[1] }}>
            {(['programme', 'seance', 'offre'] as const).map((type, i) => (
              <Pressable
                key={type}
                accessibilityRole="button"
                onPress={() => {
                  setCreation(false);
                  aller(`/(coach)/creer/${type}`);
                }}
                style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
              >
                <Text style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.principal }}>
                  {['Nouveau programme', 'Nouvelle séance', 'Nouvelle offre'][i]}
                </Text>
              </Pressable>
            ))}
          </View>
        }
      >
        <CadreFormulaireV2
          titre={titre}
          surtitre={surtitre}
          description={description}
          entete={retour}
          enteteGlobal={
            <EntetePublicV2
              navigation={large ? navigation : undefined}
              accessoire={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mon compte, changer d’espace"
                  onPress={() => setBascule(true)}
                  style={{
                    minHeight: theme.taille.tapMin,
                    minWidth: theme.taille.tapMin,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Avatar nom={nom || 'Mon compte'} taille="sm" />
                </Pressable>
              }
            />
          }
          navigation={large ? undefined : navigation}
          actions={actions}
          alerte={alerte}
        >
          {children}
        </CadreFormulaireV2>
      </FeuilleBasse>
    </FeuilleBascule>
  );
}

export function AccessoireCompteV2() {
  const theme = useTheme();
  const { profils } = useDonnees();
  const [ouvert, setOuvert] = useState(false);
  const nom = [profils?.identiteActive.prenom, profils?.identiteActive.nom]
    .filter(Boolean)
    .join(' ');
  return (
    <FeuilleBascule ouverte={ouvert} onFermer={() => setOuvert(false)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mon compte, changer d’espace"
        onPress={() => setOuvert(true)}
        style={{
          minWidth: theme.taille.tapMin,
          minHeight: theme.taille.tapMin,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Avatar nom={nom || 'Mon compte'} taille="sm" />
      </Pressable>
    </FeuilleBascule>
  );
}
