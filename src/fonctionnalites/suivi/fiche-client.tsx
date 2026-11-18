import { useRouter, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { Carte } from '@/composants/carte';
import { Champ } from '@/composants/champ';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { Modale } from '@/composants/modale';
import { Squelette } from '@/composants/squelette';
import { dateLongue, euros } from '@/fonctionnalites/factures/format';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useGardeSortie } from '@/fonctionnalites/navigation/garde-sortie';
import type { FicheClient, SeanceHistorique } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { nomClient, texteBadge, useLectureCoach } from './donnees-coach';
import { SemainesSuivi } from './semaines-suivi';

function libelleSeance(seance: SeanceHistorique) {
  if (seance.statut === 'faite') return seance.rattrapee ? 'Faite (rattrapée)' : 'Faite';
  if (seance.statut === 'partielle') return 'Partielle';
  return 'Non réalisée';
}

export function EcranFicheClient({ clientId }: { clientId: string }) {
  const { port } = useDonnees();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const lire = useCallback(() => port.lireFicheClient(clientId), [port, clientId]);
  const { donnees, erreur, relire } = useLectureCoach(lire);
  const introuvable =
    typeof erreur === 'object' &&
    erreur !== null &&
    'message' in erreur &&
    erreur.message === 'client_introuvable';
  const titre = { ...theme.texte.titre2, color: theme.couleur.texte.principal };
  return (
    <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.espace.gouttiere }}>
        <BoutonIcone
          nom="retour"
          accessibilityLabel="Retour"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(coach)/(tabs)/clients')
          }
        />
      </View>
      {introuvable ? (
        <Text style={[titre, { paddingHorizontal: theme.espace.gouttiere }]}>
          Ce client n’est pas dans ta liste.
        </Text>
      ) : erreur ? (
        <EtatErreur
          titre="Impossible de charger cette fiche"
          explication="Réessaie dans un instant."
          nombreEchecs={0}
          onReessayer={relire}
        />
      ) : donnees ? (
        <ContenuFiche key={donnees.mode} fiche={donnees} />
      ) : (
        <Squelette forme="carte" />
      )}
    </CanevasEcran>
  );
}

function ContenuFiche({ fiche }: { fiche: FicheClient }) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const titre = { ...theme.texte.titre3, color: theme.couleur.texte.principal };
  const detail = { ...theme.texte.corps, color: theme.couleur.texte.secondaire };
  return (
    <DefilementEcran
      contentContainerStyle={{
        paddingHorizontal: theme.espace.gouttiere,
        paddingBottom: insets.bottom + theme.espace[4],
        gap: theme.espace[4],
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}
      >
        {nomClient(fiche.prenom, fiche.nom)}
      </Text>
      <Text style={detail}>
        {fiche.mode === 'ancien'
          ? `${fiche.offre} · du ${dateLongue(fiche.debuteLe)} au ${dateLongue(fiche.finAccesLe)}`
          : `${fiche.offre} · client depuis le ${dateLongue(fiche.debuteLe)} · ${euros(fiche.prixCentimes)} par mois`}
      </Text>
      {fiche.mode === 'actuel' ? (
        <>
          <Badge statut="neutre" libelle={texteBadge(fiche.badge, fiche.badgeN)} />
          <Text style={detail}>
            {fiche.derniereSeanceLe
              ? `Dernière séance le ${dateLongue(fiche.derniereSeanceLe)}`
              : 'Aucune séance faite'}
          </Text>
        </>
      ) : null}
      <Carte>
        <View style={{ padding: theme.espace[3], gap: theme.espace[2] }}>
          <Text style={titre}>Séances · {fiche.seancesFaites}</Text>
          {fiche.mode === 'actuel' ? (
            <Text style={detail}>
              Assiduité ·{' '}
              {fiche.assiduite === null
                ? 'Pas encore assez de séances'
                : `${fiche.assiduite} % sur 28 jours`}
            </Text>
          ) : null}
        </View>
      </Carte>
      {fiche.mode === 'actuel' ? (
        <>
          <SemainesSuivi semaines={fiche.semaines} />
          <Text accessibilityRole="header" style={titre}>
            Programme
          </Text>
          {fiche.programme ? (
            <Bouton
              libelle={`${fiche.programme.titre} · semaine ${fiche.programme.semaine} sur ${fiche.programme.semaines}`}
              variante="secondaire"
              onPress={() =>
                router.push(`/(coach)/studio/${encodeURIComponent(fiche.programme!.id)}` as Href)
              }
            />
          ) : (
            <>
              <Text style={detail}>Aucun programme en cours.</Text>
              <Bouton
                libelle="Affecter un programme"
                variante="secondaire"
                onPress={() => router.push('/(coach)/studio')}
              />
            </>
          )}
        </>
      ) : null}
      <Text accessibilityRole="header" style={titre}>
        Historique
      </Text>
      {fiche.historique.length === 0 ? (
        <Text style={detail}>Aucune séance dans l’historique.</Text>
      ) : null}
      {fiche.historique.map((s) => (
        <Carte key={s.id}>
          <View style={{ padding: theme.espace[3], gap: theme.espace[1] }}>
            <Text style={titre}>{s.titre || 'Séance'}</Text>
            <Text style={detail}>
              {dateLongue(s.datePrevue)} · {s.dureeMinutes} min · {libelleSeance(s)}
            </Text>
            {fiche.mode === 'actuel' && s.commentaire ? (
              <Text style={detail}>« {s.commentaire} »</Text>
            ) : null}
          </View>
        </Carte>
      ))}
      {fiche.mode === 'actuel' ? <NotesPrivees fiche={fiche} /> : null}
    </DefilementEcran>
  );
}

function NotesPrivees({ fiche }: { fiche: Extract<FicheClient, { mode: 'actuel' }> }) {
  const { port } = useDonnees();
  const theme = useTheme();
  const [initial, setInitial] = useState(fiche.notes ?? '');
  const [notes, setNotes] = useState(initial);
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState<'ok' | 'erreur' | null>(null);
  const enCours = useRef(false);
  const { sortieEnAttente, annulerSortie } = useGardeSortie(initial !== notes);

  async function enregistrer() {
    if (enCours.current) return;
    enCours.current = true;
    setEnvoi(true);
    setRetour(null);
    try {
      const r = await port.enregistrerNotesClient(fiche.profilClientId, notes);
      if (r.issue === 'ok') {
        setInitial(notes);
        setRetour('ok');
      } else setRetour('erreur');
    } catch {
      setRetour('erreur');
    } finally {
      enCours.current = false;
      setEnvoi(false);
    }
  }

  return (
    <Modale
      ouverte={sortieEnAttente !== null}
      titre="Modifications non enregistrées"
      corps="Tu as des modifications non enregistrées."
      onFermer={annulerSortie}
      libelleAction="Rester"
      onAction={annulerSortie}
      libelleDestructeur="Quitter"
      onDestructeur={() => sortieEnAttente?.reprendre()}
    >
      <View style={{ gap: theme.espace[2] }}>
        <Text
          accessibilityRole="header"
          style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}
        >
          Notes privées
        </Text>
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
          Visibles uniquement par toi dans l’application.
        </Text>
        <Champ
          libelle="Tes notes"
          valeur={notes}
          onChangeTexte={(texte) => {
            setNotes(texte);
            setRetour(null);
          }}
          multiligne
          longueurMax={2000}
          desactive={envoi}
        />
        {retour === 'ok' ? (
          <Text accessibilityLiveRegion="polite" style={{ color: theme.couleur.etat.succesEncre }}>
            Notes enregistrées.
          </Text>
        ) : null}
        {retour === 'erreur' ? (
          <EtatErreur
            titre="Impossible d’enregistrer tes notes"
            explication="Ton texte est conservé."
            nombreEchecs={0}
            onReessayer={() => void enregistrer()}
          />
        ) : null}
        <Bouton
          libelle={envoi ? 'Enregistrement…' : 'Enregistrer'}
          variante="primaire"
          desactive={envoi || initial === notes}
          onPress={() => void enregistrer()}
        />
      </View>
    </Modale>
  );
}
