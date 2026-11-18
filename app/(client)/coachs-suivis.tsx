import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { EtatVide } from '@/composants/etats/etat-vide';
import { Squelette } from '@/composants/squelette';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { PortDonnees } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

type ResultatCoachsSuivis = Awaited<ReturnType<PortDonnees['lireMesCoachsSuivis']>>;

export default function CoachsSuivis() {
  const { session } = useSession();
  return <ListeCoachsSuivis key={session?.compteId ?? 'sans-session'} />;
}

function ListeCoachsSuivis() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port, profils } = useDonnees();
  const [coachs, setCoachs] = useState<ResultatCoachsSuivis | null>(null);
  const [erreur, setErreur] = useState(false);
  const [tentative, setTentative] = useState(0);
  const espaceClient = profils?.profilActif === 'client';

  useFocusEffect(
    useCallback(() => {
      if (!espaceClient) return;
      let actif = true;
      void port.lireMesCoachsSuivis().then(
        (lus) => {
          if (!actif) return;
          setCoachs(lus);
          setErreur(false);
        },
        () => {
          if (actif) setErreur(true);
        },
      );
      return () => {
        actif = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Réessayer relance la lecture tant que la route est au premier plan.
    }, [espaceClient, port, tentative]),
  );

  return (
    <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <DefilementEcran
        contentContainerStyle={{
          paddingTop: insets.top + theme.espace[2],
          paddingBottom: insets.bottom + theme.espace[4],
          paddingHorizontal: theme.espace.gouttiere,
          gap: theme.espace[4],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}>
          <BoutonIcone
            nom="retour"
            accessibilityLabel="Retour"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
          <Text
            accessibilityRole="header"
            style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal, flex: 1 }}
          >
            Coachs suivis
          </Text>
        </View>
        {profils && !espaceClient ? (
          <EtatVide
            titre="Disponible dans l’espace client"
            explication="Bascule vers ton espace client pour retrouver les coachs que tu suis."
          />
        ) : erreur ? (
          <EtatErreur
            titre="Impossible de charger tes coachs suivis"
            explication="Réessaie dans un instant."
            nombreEchecs={0}
            onReessayer={() => setTentative((n) => n + 1)}
          />
        ) : coachs === null ? (
          <Squelette forme="ligne" />
        ) : coachs.length ? (
          coachs.map((coach) => (
            <Bouton
              key={coach.id}
              libelle={`${coach.prenom} ${coach.nom} · ${coach.discipline}`}
              variante="secondaire"
              onPress={() => router.push(`/(client)/coach/${encodeURIComponent(coach.id)}` as Href)}
            />
          ))
        ) : (
          <EtatVide
            titre="Tu ne suis encore aucun coach"
            explication="Retrouve ici les profils qui t’intéressent."
            actionPrincipale={{
              libelle: 'Découvrir les coachs',
              onPress: () => router.push('/(client)/(tabs)/explorer' as Href),
            }}
          />
        )}
      </DefilementEcran>
    </CanevasEcran>
  );
}
