import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { DefilementEcran } from '@/composants/canevas-ecran';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { Squelette } from '@/composants/squelette';
import { CarteImporterClients } from '@/fonctionnalites/coach/carte-importer-clients';
import { euros } from '@/fonctionnalites/factures/format';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';
import { nomClient, texteBadge, useLectureCoach } from './donnees-coach';

export function PilotageCoach({ prenom }: { prenom: string }) {
  const { port } = useDonnees();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const lirePilotage = useCallback(() => port.lirePilotage(), [port]);
  const lireRevenus = useCallback(async () => {
    const jour = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    const mois = jour.slice(0, 7) + '-01';
    const revenus = await port.lireRevenus(mois);
    return { mois, net: revenus.find((r) => r.mois === mois)?.netCentimes ?? 0 };
  }, [port]);
  const pilotage = useLectureCoach(lirePilotage);
  const revenus = useLectureCoach(lireRevenus);
  const donnees = pilotage.donnees;
  const titre = { ...theme.texte.titre3, color: theme.couleur.texte.principal };
  const detail = { ...theme.texte.corps, color: theme.couleur.texte.secondaire };
  const clients = () =>
    router.push({
      pathname: '/(coach)/(tabs)/clients',
      params: { filtre: 'tous', visite: String(Date.now()) },
    });

  return (
    <DefilementEcran
      contentContainerStyle={{
        paddingHorizontal: theme.espace.gouttiere,
        paddingBottom: insets.bottom + theme.espace[4],
        gap: theme.espace[3],
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}
      >
        Bonjour {prenom}
      </Text>
      {revenus.erreur ? (
        <EtatErreur
          titre="Revenus indisponibles"
          explication="Réessaie dans un instant."
          nombreEchecs={0}
          onReessayer={revenus.relire}
        />
      ) : revenus.donnees ? (
        <Bouton
          libelle={`Revenus de ${new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'long' }).format(new Date(revenus.donnees.mois))} · ${euros(revenus.donnees.net)}`}
          variante="secondaire"
          onPress={() => router.push('/(coach)/(tabs)/revenus')}
        />
      ) : (
        <Squelette forme="ligne" />
      )}
      {pilotage.erreur ? (
        <EtatErreur
          titre="Pilotage indisponible"
          explication="Réessaie dans un instant."
          nombreEchecs={0}
          onReessayer={pilotage.relire}
        />
      ) : donnees === null ? (
        <Squelette forme="carte" />
      ) : donnees.aucunClient ? (
        <Text style={detail}>Tes premiers clients apparaîtront ici dès leur abonnement.</Text>
      ) : (
        <>
          <Bouton
            libelle={`Clients · ${donnees.clientsAvecAcces} avec accès au suivi`}
            variante="secondaire"
            onPress={clients}
          />
          <Text style={titre}>
            Assiduité · {donnees.assiduiteMoyenne === null ? '—' : `${donnees.assiduiteMoyenne} %`}
          </Text>
          <Text accessibilityRole="header" style={titre}>
            À traiter · {donnees.aTraiterTotal}
          </Text>
          {donnees.aTraiterTotal === 0 ? (
            <Text style={detail}>Rien à traiter. Tes clients sont à jour.</Text>
          ) : null}
          {donnees.aTraiter.map((c) => (
            <Bouton
              key={c.profilClientId}
              libelle={`${nomClient(c.prenom, c.nom ? c.nom[0] + '.' : null)} · ${texteBadge(c.badge, c.badgeN)}`}
              variante="secondaire"
              onPress={() =>
                router.push(`/(coach)/client/${encodeURIComponent(c.profilClientId)}` as Href)
              }
            />
          ))}
          {donnees.aTraiterTotal > donnees.aTraiter.length ? (
            <Bouton
              libelle={`Voir les ${donnees.aTraiterTotal}`}
              variante="secondaire"
              onPress={() =>
                router.push({
                  pathname: '/(coach)/(tabs)/clients',
                  params: { filtre: 'a-relancer', visite: String(Date.now()) },
                })
              }
            />
          ) : null}
        </>
      )}
      <CarteImporterClients onPress={() => router.push('/(coach)/invitations')} />
    </DefilementEcran>
  );
}
