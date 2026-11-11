import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { EtatVide } from '@/composants/etats/etat-vide';
import { Icone } from '@/composants/icones';
import { Progression } from '@/composants/progression';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { Offre, RefusServeur, ResultatIntention } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { nouvelleCleIdempotence } from './cle-idempotence';

// docs/ecrans/L4-04a-choix-offre.md (P4.6a). Le client confirme QUELLE offre du coach il prend,
// avant tout appel au prestataire de paiement. Corrections de la maquette appliquées (fiche,
// Règles) : ni « Programme seul », ni statistique d'abonnés, une phrase de sortie exacte, aucun
// jour de prélèvement (il n'est connu qu'en 04b, rendu par le serveur).
//
// Ce que l'écran affiche d'un refus vient du serveur, tel quel (`title`, `detail` — docs/api.md
// §1, règle du 31 octobre 2026). Un seul texte est à lui : l'absence de réponse, dont le serveur
// ne peut rien dire puisqu'il n'a rien reçu.

type IntentionCreee = Extract<ResultatIntention, { issue: 'creee' }>;

// Ce que 04b nomme dans son récapitulatif (« Titre de l'offre, coach · discipline ») et que le
// serveur ne rend pas avec l'intention.
export type ChoixOffre = {
  offre: { id: string; titre: string };
  coach: { id: string; prenom: string; nom: string; discipline: string };
};

export type ProprietesEcranChoixOffre = {
  coachId: string;
  onRetour: () => void;
  // L'URL de paiement ne quitte l'écran que par ce rappel, en mémoire : jamais une route, un
  // journal ni un stockage (CLAUDE.md §10). 04b la reçoit (P4.6b).
  onIntentionCreee: (resultat: IntentionCreee, choix: ChoixOffre) => void;
};

type Erreur = { type: 'refus'; refus: RefusServeur } | { type: 'reseau' };

const TEXTE_RESEAU = 'Pas de connexion. Réessaie.';

function prixMensuel(centimes: number): string {
  return `${(centimes / 100).toFixed(0)} €/mois`;
}

// Présélection (fiche, Contenu) : l'offre mise en avant, sinon la première.
function offrePreselectionnee(offres: Offre[]): string | null {
  return (offres.find((o) => o.estMiseEnAvant) ?? offres[0])?.id ?? null;
}

export function EcranChoixOffre({
  coachId,
  onRetour,
  onIntentionCreee,
}: ProprietesEcranChoixOffre) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();

  const [coach, setCoach] = useState<ChoixOffre['coach'] | null>(null);
  const prenom = coach?.prenom ?? null;
  const [offres, setOffres] = useState<Offre[] | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<Erreur | null>(null);
  // Une clé par demande (docs/backend.md §13). Gardée après une absence de réponse : le nouvel
  // essai est LA MÊME demande. Effacée dès que le serveur a répondu : la demande est close.
  const cle = useRef<string | null>(null);
  // Garde synchrone contre le double appui : l'état React ne se met à jour qu'au rendu suivant.
  const verrou = useRef(false);

  // Pose la liste lue et garde la sélection si l'offre choisie y est encore ; sinon, présélection.
  const appliquerOffres = useCallback((lues: Offre[]) => {
    setOffres(lues);
    setChoisie((actuelle) =>
      actuelle && lues.some((o) => o.id === actuelle) ? actuelle : offrePreselectionnee(lues),
    );
  }, []);

  useEffect(() => {
    let monte = true;
    void Promise.all([
      port.lireProfilCoachPublic(coachId),
      port.lireOffresPublieesDeCoach(coachId),
    ]).then(([p, lues]) => {
      if (!monte) return;
      setCoach({
        id: coachId,
        prenom: p?.prenom ?? '',
        nom: p?.nom ?? '',
        discipline: p?.discipline ?? '',
      });
      appliquerOffres(lues);
    });
    return () => {
      monte = false;
    };
  }, [coachId, port, appliquerOffres]);

  const offre = offres?.find((o) => o.id === choisie) ?? null;

  async function continuer() {
    if (!offre || verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    setErreur(null);
    cle.current ??= nouvelleCleIdempotence();
    try {
      const resultat = await port.demanderIntention(offre.id, cle.current);
      if (resultat.issue === 'sans_reponse') {
        setErreur({ type: 'reseau' });
        return;
      }
      cle.current = null;
      if (resultat.issue === 'refusee') {
        setErreur({ type: 'refus', refus: resultat.refus });
        // L'offre a pu être retirée entre-temps (fiche, Règles) : la liste est relue.
        if (resultat.refus.code === 'offre_indisponible') {
          appliquerOffres(await port.lireOffresPublieesDeCoach(coachId));
        }
        return;
      }
      onIntentionCreee(resultat, {
        offre: { id: offre.id, titre: offre.titre },
        coach: coach ?? { id: coachId, prenom: '', nom: '', discipline: '' },
      });
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <View
        style={{
          paddingTop: insets.top + theme.espace[2],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[3],
          gap: theme.espace[3],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}>
          <BoutonIcone nom="retour" accessibilityLabel="Retour" onPress={onRetour} />
          <View style={{ flex: 1 }}>
            <Text
              accessibilityRole="header"
              style={{ ...theme.texte.label, color: theme.couleur.texte.principal }}
            >
              {prenom ? `S’abonner à ${prenom}` : 'S’abonner'}
            </Text>
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              Étape 1 sur 2
            </Text>
          </View>
        </View>
        <Progression
          variante="segments"
          segments={['actuel', 'reste']}
          accessibilityLabel="Étape 1 sur 2"
        />
      </View>

      {offres === null || prenom === null ? (
        <View style={{ paddingHorizontal: theme.espace.gouttiere }}>
          <Squelette forme="carte" />
        </View>
      ) : offres.length === 0 ? (
        <View style={{ flex: 1, padding: theme.espace.gouttiere }}>
          <EtatVide
            titre="Aucune formule ouverte"
            explication={`${prenom} n’a pas d’offre ouverte pour le moment.`}
          />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.espace.gouttiere,
              paddingBottom: theme.espace[6],
              gap: theme.espace[4],
            }}
          >
            <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
              Quelle formule te ressemble ?
            </Text>

            {offres.map((o) => (
              <CarteOffre
                key={o.id}
                offre={o}
                selectionnee={o.id === choisie}
                onPress={() => setChoisie(o.id)}
              />
            ))}

            <View
              style={{
                flexDirection: 'row',
                gap: theme.espace[2],
                padding: theme.espace[4],
                borderRadius: theme.rayon.media,
                backgroundColor: theme.couleur.marque.secondaire,
              }}
            >
              <Icone nom="information" couleur={theme.couleur.marque.secondaireEncre2} />
              <Text
                style={{
                  ...theme.texte.petit,
                  flex: 1,
                  color: theme.couleur.marque.secondaireEncre,
                }}
              >
                Sans engagement de durée : tu peux arrêter quand tu veux, l’arrêt prend effet à la
                fin du mois payé.
              </Text>
            </View>

            {erreur ? <BlocErreur erreur={erreur} /> : null}
          </ScrollView>

          <View
            style={{
              paddingHorizontal: theme.espace.gouttiere,
              paddingTop: theme.espace[3],
              paddingBottom: insets.bottom + theme.espace[3],
              gap: theme.espace[2],
              borderTopWidth: 1,
              borderTopColor: theme.couleur.bordure.discrete,
            }}
          >
            {offre ? (
              <Bouton
                libelle={`Continuer · ${prixMensuel(offre.prixCentimes)}`}
                variante="primaire"
                onPress={() => void continuer()}
                desactive={enCours}
              />
            ) : null}
            <Text
              style={{
                ...theme.texte.legende,
                color: theme.couleur.texte.attenue,
                textAlign: 'center',
              }}
            >
              Premier prélèvement aujourd’hui, puis une fois par mois.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function CarteOffre({
  offre,
  selectionnee,
  onPress,
}: {
  offre: Offre;
  selectionnee: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const engagement = offre.engagementHumain.join(' · ');
  return (
    // Sélection annoncée par son état d'accessibilité, jamais par la seule couleur (fiche,
    // critère 7). Le libellé lu porte titre, prix et engagement : ce que le client achète.
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: selectionnee, checked: selectionnee }}
      accessibilityLabel={`${offre.titre}, ${prixMensuel(offre.prixCentimes)}, ${engagement}`}
      onPress={onPress}
      style={{
        borderRadius: theme.rayon.media,
        backgroundColor: theme.couleur.fond.surface,
        borderWidth: selectionnee ? 2 : 1,
        borderColor: selectionnee ? theme.couleur.marque.primaire : theme.couleur.bordure.discrete,
        padding: theme.espace[4],
        gap: theme.espace[2],
      }}
    >
      <View style={{ flexDirection: 'row', gap: theme.espace[3], alignItems: 'flex-start' }}>
        <View
          style={{
            width: theme.espace[6],
            height: theme.espace[6],
            borderRadius: theme.rayon.pilule,
            borderWidth: 2,
            borderColor: selectionnee
              ? theme.couleur.marque.primaire
              : theme.couleur.bordure.marquee,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selectionnee ? (
            <View
              style={{
                width: theme.espace[3],
                height: theme.espace[3],
                borderRadius: theme.rayon.pilule,
                backgroundColor: theme.couleur.marque.primaire,
              }}
            />
          ) : null}
        </View>
        <View style={{ flex: 1, gap: theme.espace[1] }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.espace[2] }}
          >
            <Text style={{ ...theme.texte.titre3, flex: 1, color: theme.couleur.texte.principal }}>
              {offre.titre}
            </Text>
            <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
              {prixMensuel(offre.prixCentimes)}
            </Text>
          </View>
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            {engagement}
          </Text>
        </View>
      </View>
      {offre.estMiseEnAvant ? <Badge statut="accent" libelle="LE PLUS CHOISI" /> : null}
    </Pressable>
  );
}

function BlocErreur({ erreur }: { erreur: Erreur }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: theme.espace[4],
        gap: theme.espace[1],
        borderRadius: theme.rayon.carte,
        borderWidth: 1,
        borderColor: theme.couleur.etat.erreurBordure,
        backgroundColor: theme.couleur.etat.erreurTeinte,
      }}
    >
      {erreur.type === 'refus' ? (
        <>
          <Text style={{ ...theme.texte.label, color: theme.couleur.etat.erreurEncre }}>
            {erreur.refus.title}
          </Text>
          <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
            {erreur.refus.detail}
          </Text>
        </>
      ) : (
        <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
          {TEXTE_RESEAU}
        </Text>
      )}
    </View>
  );
}
