import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/composants/avatar';
import { Badge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { Carte } from '@/composants/carte';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { Squelette } from '@/composants/squelette';
import { EnTeteEspaceCoach } from '@/fonctionnalites/coach/en-tete-espace-coach';
import { dateLongue } from '@/fonctionnalites/factures/format';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { ClientDuCoach } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { nomClient, texteBadge, useLectureCoach } from './donnees-coach';

const FILTRES = [
  { cle: 'tous', titre: 'Tous' },
  { cle: 'aRelancer', titre: 'À relancer' },
  { cle: 'nouveaux', titre: 'Nouveaux' },
] as const;

type Filtre = (typeof FILTRES)[number]['cle'];

function normaliser(texte: string) {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .trim();
}

function ligne(c: ClientDuCoach) {
  if (c.statut === 'suspendu') return c.offre + ' · abonnement suspendu';
  if (c.statut === 'en_pause')
    return (
      c.offre +
      (c.pauseJusquLe ? ' · en pause jusqu’au ' + dateLongue(c.pauseJusquLe) : ' · en pause')
    );
  if (c.statut === 'resiliation_programmee' && c.finAccesLe)
    return c.offre + ' · fin le ' + dateLongue(c.finAccesLe);
  const seances = c.programmeEnCours
    ? `${c.semaineEnCours.faites}/${c.semaineEnCours.prevues} séances`
    : 'aucun programme';
  return `${c.offre} · semaine ${c.semaine} · ${seances}`;
}

export function ClientsCoach() {
  const { port, profils } = useDonnees();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { filtre: filtreRoute, visite } = useLocalSearchParams<{
    filtre?: string;
    visite?: string;
  }>();
  const [filtre, setFiltre] = useState<Filtre>(filtreRoute === 'a-relancer' ? 'aRelancer' : 'tous');
  const [recherche, setRecherche] = useState('');
  const [bascule, setBascule] = useState(false);
  const lire = useCallback(() => port.lireMesClients(), [port]);
  const { donnees, erreur, relire } = useLectureCoach(lire);
  const [visitePrecedente, setVisitePrecedente] = useState(visite);
  if (visite !== visitePrecedente) {
    setVisitePrecedente(visite);
    if (filtreRoute === 'a-relancer' || filtreRoute === 'tous') {
      setFiltre(filtreRoute === 'a-relancer' ? 'aRelancer' : 'tous');
      setRecherche('');
    }
  }

  const visibles = donnees?.clients.filter(
    (client) =>
      normaliser(nomClient(client.prenom, client.nom)).includes(normaliser(recherche)) &&
      (filtre === 'tous' ||
        (filtre === 'nouveaux'
          ? client.badge === 'nouveau'
          : client.badge === 'paiement_ko' || client.badge === 'inactive')),
  );
  const inviter = () => router.push('/(coach)/invitations');
  return (
    <FeuilleBascule ouverte={bascule} onFermer={() => setBascule(false)}>
      <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <EnTeteEspaceCoach
          titre="Mes clients"
          nomAvatar={nomClient(
            profils?.identiteActive.prenom ?? '',
            profils?.identiteActive.nom ?? null,
          )}
          onOuvrirBascule={() => setBascule(true)}
        />
        <DefilementEcran
          contentContainerStyle={{
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: insets.bottom + theme.espace[4],
            gap: theme.espace[3],
          }}
        >
          <View style={{ alignItems: 'flex-start' }}>
            <Bouton libelle="Inviter" variante="secondaire" onPress={inviter} />
          </View>
          {erreur ? (
            <ErreurListe onReessayer={relire} />
          ) : !donnees ? (
            <Squelette forme="carte" />
          ) : (
            <>
              <Champ libelle="Chercher un client" valeur={recherche} onChangeTexte={setRecherche} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
                {FILTRES.map((f) => (
                  <Chip
                    key={f.cle}
                    libelle={`${f.titre} · ${donnees.compteurs[f.cle]}`}
                    variante="selection"
                    selectionne={filtre === f.cle}
                    onPress={() => setFiltre(f.cle)}
                  />
                ))}
              </View>
              {donnees.clients.length === 0 ? (
                <>
                  <Text style={{ color: theme.couleur.texte.principal }}>
                    Aucun client pour l’instant.
                  </Text>
                  <Bouton libelle="Inviter mes clients" variante="primaire" onPress={inviter} />
                </>
              ) : visibles?.length === 0 ? (
                <Text style={{ color: theme.couleur.texte.principal }}>
                  Aucun client ne correspond.
                </Text>
              ) : null}
              {visibles?.map((c) => (
                <LigneClient
                  key={c.profilClientId}
                  id={c.profilClientId}
                  nom={nomClient(c.prenom, c.nom)}
                  detail={ligne(c)}
                  badge={texteBadge(c.badge, c.badgeN)}
                />
              ))}
              {donnees.compteurs.anciens > 0 ? (
                <Bouton
                  libelle={`Anciens clients · ${donnees.compteurs.anciens}`}
                  variante="secondaire"
                  onPress={() => router.push('/(coach)/anciens-clients' as Href)}
                />
              ) : null}
            </>
          )}
        </DefilementEcran>
      </CanevasEcran>
    </FeuilleBascule>
  );
}

export function AnciensClientsCoach() {
  const { port } = useDonnees();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [recherche, setRecherche] = useState('');
  const lire = useCallback(() => port.lireMesAnciensClients(), [port]);
  const { donnees, erreur, relire } = useLectureCoach(lire);
  const visibles = donnees?.filter((c) =>
    normaliser(nomClient(c.prenom, c.nom)).includes(normaliser(recherche)),
  );
  return (
    <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <DefilementEcran
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: insets.bottom,
          gap: theme.espace[3],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[2] }}>
          <BoutonIcone
            nom="retour"
            accessibilityLabel="Retour"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(coach)/(tabs)/clients')
            }
          />
          <Text
            accessibilityRole="header"
            style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}
          >
            Anciens clients
          </Text>
        </View>
        {erreur ? (
          <ErreurListe onReessayer={relire} />
        ) : !donnees ? (
          <Squelette forme="carte" />
        ) : (
          <>
            <Champ libelle="Chercher un client" valeur={recherche} onChangeTexte={setRecherche} />
            {visibles?.length === 0 ? (
              <Text style={{ color: theme.couleur.texte.principal }}>
                {donnees.length ? 'Aucun client ne correspond.' : 'Aucun ancien client.'}
              </Text>
            ) : null}
            {visibles?.map((c) => (
              <LigneClient
                key={c.profilClientId}
                id={c.profilClientId}
                nom={nomClient(c.prenom, c.nom)}
                detail={`${c.offre} · du ${dateLongue(c.debuteLe)} au ${dateLongue(c.finAccesLe)}`}
              />
            ))}
          </>
        )}
      </DefilementEcran>
    </CanevasEcran>
  );
}

function LigneClient({
  id,
  nom,
  detail,
  badge,
}: {
  id: string;
  nom: string;
  detail: string;
  badge?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Carte>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[nom, badge, detail].filter(Boolean).join('. ')}
        onPress={() => router.push(`/(coach)/client/${encodeURIComponent(id)}` as Href)}
        style={{
          minHeight: theme.taille.tapMin,
          padding: theme.espace[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.espace[3],
        }}
      >
        <Avatar nom={nom} />
        <View style={{ flex: 1, gap: theme.espace[1] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.principal }}>{nom}</Text>
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            {detail}
          </Text>
          {badge ? <Badge statut="neutre" libelle={badge} /> : null}
        </View>
      </Pressable>
    </Carte>
  );
}

function ErreurListe({ onReessayer }: { onReessayer: () => void }) {
  return (
    <EtatErreur
      titre="Impossible de charger tes clients"
      explication="Réessaie dans un instant."
      nombreEchecs={0}
      onReessayer={onReessayer}
    />
  );
}
