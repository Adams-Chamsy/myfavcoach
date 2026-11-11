import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { Icone } from '@/composants/icones';
import { Progression } from '@/composants/progression';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { ResultatConstat } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { nouvelleCleIdempotence } from './cle-idempotence';
import type { IntentionEnCours } from './intention-en-cours';

// docs/ecrans/L4-04b-recapitulatif-paiement.md (P4.6b). L'écran montre ce que le client va payer,
// ouvre la page de paiement du prestataire (il ne collecte rien lui-même), puis ne conclut QUE par le
// constat du serveur (critère 5) : un navigateur fermé ne dit rien de ce qui s'est passé.

// Attente bornée (fiche, « Retour sans confirmation ») : un constat toutes les 2 s, dix au plus.
export const INTERVALLE_CONSTAT_MS = 2000;
export const CONSTATS_MAX = 10;
// Page de paiement valable 30 minutes (docs/api.md §7) ; une marge d'une minute pour ne jamais
// ouvrir une page qui expire pendant qu'on la charge.
const DUREE_PAGE_MS = 29 * 60 * 1000;

export type ModePaiement =
  | { type: 'recapitulatif'; enCours: IntentionEnCours }
  // Retour sur web (fiche, « Retour sur web ») : seul l'identifiant revient, par l'adresse de
  // retour ; le récapitulatif n'est pas redemandé, l'écran affiche l'état du constat.
  | { type: 'retour'; intentionId: string };

export type ProprietesEcranPaiement = {
  mode: ModePaiement;
  onRetour: () => void;
  // Ouvre la page de paiement : expo-web-browser sur iOS/Android (la promesse se résout quand le
  // navigateur se ferme), redirection dans le même onglet sur web. Fournie par la route.
  ouvrirPage: (url: string) => Promise<void>;
  // Tant que 04c n'existe pas (P4.7), un constat `abonne` ramène au profil du coach, sans texte
  // inventé (docs/prompts/L4.md, P4.6b).
  onAbonne: () => void;
  onVoirAbonnements: () => void;
  onRevenirProfil: () => void;
  // 404 au constat (intention d'un autre, inexistante, mal formée) : rien à constater, retour à
  // l'accueil client, sans message qui distingue les cas (fiche, Règles).
  onRienAConstater: () => void;
  onOuvrirConditions: () => void;
};

type Etat =
  | { type: 'pret' }
  | { type: 'page_ouverte' }
  | { type: 'constat_en_cours' }
  | { type: 'non_terminee'; urlPaiement: string }
  | { type: 'expiree' }
  | { type: 'paiement_recu'; tentatives: number }
  | { type: 'paiement_recu_depasse' }
  | { type: 'reseau'; tentatives: number }
  | { type: 'reseau_depasse' }
  | { type: 'souscription_impossible' }
  | { type: 'demande_en_cours' }
  | { type: 'demande_sans_reponse' };

function euros(centimes: number): string {
  return (centimes / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateLongue(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function EcranPaiement({
  mode,
  onRetour,
  ouvrirPage,
  onAbonne,
  onVoirAbonnements,
  onRevenirProfil,
  onRienAConstater,
  onOuvrirConditions,
}: ProprietesEcranPaiement) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();

  const [enCours, setEnCours] = useState<IntentionEnCours | null>(
    mode.type === 'recapitulatif' ? mode.enCours : null,
  );
  const [etat, setEtat] = useState<Etat>(
    mode.type === 'retour' ? { type: 'constat_en_cours' } : { type: 'pret' },
  );
  const intentionId = mode.type === 'retour' ? mode.intentionId : enCours?.intention.intentionId;
  // Garde synchrone contre le double appui (« Payer » ouvre la même page, jamais deux) et contre
  // deux constats simultanés (navigateur fermé ET retour au premier plan arrivent ensemble).
  const verrouPayer = useRef(false);
  const constatEnVol = useRef(false);
  // Posé au moment même où la page s'ouvre, effacé au premier signal de retour : un état React
  // ne se relit qu'au rendu suivant, trop tard si le navigateur se referme avant ce rendu.
  const pageOuverte = useRef(false);

  const constater = useCallback(
    async (tentativesPrecedentes: { paiementRecu: number; reseau: number }) => {
      if (!intentionId || constatEnVol.current) return;
      constatEnVol.current = true;
      let resultat: ResultatConstat;
      try {
        resultat = await port.constaterIntention(intentionId);
      } finally {
        constatEnVol.current = false;
      }
      if (resultat.issue === 'sans_reponse') {
        const n = tentativesPrecedentes.reseau + 1;
        setEtat(n >= CONSTATS_MAX ? { type: 'reseau_depasse' } : { type: 'reseau', tentatives: n });
        return;
      }
      if (resultat.issue === 'refusee') {
        onRienAConstater();
        return;
      }
      switch (resultat.etat) {
        case 'abonne':
          onAbonne();
          return;
        case 'non_terminee':
          setEtat({ type: 'non_terminee', urlPaiement: resultat.urlPaiement });
          return;
        case 'expiree':
          setEtat({ type: 'expiree' });
          return;
        case 'paiement_recu': {
          const n = tentativesPrecedentes.paiementRecu + 1;
          setEtat(
            n >= CONSTATS_MAX
              ? { type: 'paiement_recu_depasse' }
              : { type: 'paiement_recu', tentatives: n },
          );
          return;
        }
        case 'souscription_impossible':
          setEtat({ type: 'souscription_impossible' });
          return;
      }
    },
    [intentionId, port, onAbonne, onRienAConstater],
  );

  // Retour sur web : le constat part dès l'ouverture de l'écran, une seule fois (au tour suivant,
  // comme l'attente bornée plus bas : jamais un état posé dans le corps même d'un effet).
  const retourInitial = useRef(mode.type === 'retour');
  useEffect(() => {
    if (!retourInitial.current) return;
    retourInitial.current = false;
    const minuteur = setTimeout(() => void constater({ paiementRecu: 0, reseau: 0 }), 0);
    return () => clearTimeout(minuteur);
  }, [constater]);

  // Attente bornée : un nouveau constat toutes les 2 secondes, tant que l'état l'exige.
  useEffect(() => {
    if (etat.type !== 'paiement_recu' && etat.type !== 'reseau') return;
    const compte =
      etat.type === 'paiement_recu'
        ? { paiementRecu: etat.tentatives, reseau: 0 }
        : { paiementRecu: 0, reseau: etat.tentatives };
    const minuteur = setTimeout(() => void constater(compte), INTERVALLE_CONSTAT_MS);
    return () => clearTimeout(minuteur);
  }, [etat, constater]);

  // Troisième signal de retour (fiche, « Au retour ») : l'application revient au premier plan
  // alors que la page de paiement était ouverte.
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (statut) => {
      if (statut === 'active' && pageOuverte.current) {
        pageOuverte.current = false;
        setEtat({ type: 'constat_en_cours' });
        void constater({ paiementRecu: 0, reseau: 0 });
      }
    });
    return () => abonnement.remove();
  }, [constater]);

  async function ouvrir(url: string) {
    pageOuverte.current = true;
    setEtat({ type: 'page_ouverte' });
    await ouvrirPage(url);
    // Sur iOS/Android, la promesse se résout quand le navigateur se ferme : on constate — sauf si
    // le retour au premier plan l'a déjà fait.
    if (pageOuverte.current) {
      pageOuverte.current = false;
      setEtat({ type: 'constat_en_cours' });
      await constater({ paiementRecu: 0, reseau: 0 });
    }
  }

  async function payer() {
    if (!enCours || verrouPayer.current) return;
    verrouPayer.current = true;
    try {
      // Page expirée (30 minutes, ou constat `expiree`) : nouvelle intention, nouvelle clé,
      // récapitulatif remplacé — jamais une page périmée ouverte (fiche, Règles).
      const perimee = etat.type === 'expiree' || Date.now() - enCours.creeeLe > DUREE_PAGE_MS;
      if (perimee) {
        setEtat({ type: 'demande_en_cours' });
        const resultat = await port.demanderIntention(enCours.offre.id, nouvelleCleIdempotence());
        if (resultat.issue !== 'creee') {
          setEtat({ type: 'demande_sans_reponse' });
          return;
        }
        const nouvelle = { ...enCours, intention: resultat, creeeLe: Date.now() };
        setEnCours(nouvelle);
        setEtat({ type: 'pret' });
        return;
      }
      await ouvrir(enCours.intention.urlPaiement);
    } finally {
      verrouPayer.current = false;
    }
  }

  const recap = enCours?.intention.recapitulatif;
  const payerVisible =
    enCours !== null &&
    (etat.type === 'pret' ||
      etat.type === 'expiree' ||
      etat.type === 'demande_en_cours' ||
      etat.type === 'demande_sans_reponse' ||
      etat.type === 'page_ouverte' ||
      etat.type === 'constat_en_cours');
  const payerActif =
    etat.type === 'pret' || etat.type === 'expiree' || etat.type === 'demande_sans_reponse';

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
              Paiement
            </Text>
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              Étape 2 sur 2
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[1] }}>
            <Icone nom="securite" couleur={theme.couleur.texte.secondaire} />
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}>
              Sécurisé
            </Text>
          </View>
        </View>
        <Progression
          variante="segments"
          segments={['atteint', 'actuel']}
          accessibilityLabel="Étape 2 sur 2"
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        {etat.type === 'non_terminee' || etat.type === 'expiree' ? (
          <Bandeau texte="Paiement non terminé. Rien n’a été débité." />
        ) : null}

        {enCours && recap ? (
          <View
            style={{
              borderRadius: theme.rayon.media,
              backgroundColor: theme.couleur.fond.surface,
              borderWidth: 1,
              borderColor: theme.couleur.bordure.discrete,
              padding: theme.espace[4],
              gap: theme.espace[3],
            }}
          >
            <View style={{ gap: theme.espace[1] }}>
              <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                {enCours.offre.titre}
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {`${enCours.coach.prenom} ${enCours.coach.nom} · ${enCours.coach.discipline}`}
              </Text>
            </View>
            <Ligne libelle="Abonnement mensuel" valeur={`${euros(recap.prixCentimes)} €`} />
            <Ligne libelle="À payer aujourd’hui" valeur={`${euros(recap.totalCentimes)} €`} fort />
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              {`Puis le ${recap.jourPrelevement} de chaque mois · prochain prélèvement le ${dateLongue(recap.prochainPrelevementLe)}`}
            </Text>
          </View>
        ) : null}

        {enCours ? (
          <View style={{ gap: theme.espace[1] }}>
            <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
              Carte bancaire ou prélèvement SEPA
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Tu choisiras sur la page de paiement sécurisée de notre prestataire.
            </Text>
          </View>
        ) : null}

        {/* Information précontractuelle (droit de rétractation) : emplacement réservé, rempli
            seulement avec le texte validé par le juriste — aucun texte provisoire inventé (fiche,
            Règles ; critère 8). Le tunnel ne passe pas en production sans lui. */}
        {enCours ? <View testID="emplacement-retractation" /> : null}

        <EtatRetour
          etat={etat}
          prenom={enCours?.coach.prenom ?? null}
          onVerifier={() => {
            setEtat({ type: 'constat_en_cours' });
            void constater({ paiementRecu: 0, reseau: 0 });
          }}
          onVoirAbonnements={onVoirAbonnements}
          onRevenirProfil={onRevenirProfil}
        />
      </ScrollView>

      {payerVisible || etat.type === 'non_terminee' ? (
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
          {etat.type === 'non_terminee' ? (
            <Bouton
              libelle="Reprendre le paiement"
              variante="primaire"
              onPress={() => void ouvrir(etat.urlPaiement)}
            />
          ) : recap ? (
            <Bouton
              libelle={`Payer ${euros(recap.totalCentimes)} €`}
              variante="primaire"
              onPress={() => void payer()}
              desactive={!payerActif}
            />
          ) : null}
          {etat.type !== 'non_terminee' ? (
            <Text
              style={{
                ...theme.texte.legende,
                color: theme.couleur.texte.attenue,
                textAlign: 'center',
              }}
            >
              En continuant tu acceptes les{' '}
              <Text
                accessibilityRole="link"
                onPress={onOuvrirConditions}
                style={{ textDecorationLine: 'underline' }}
              >
                conditions d’abonnement
              </Text>
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  const theme = useTheme();
  const style = fort ? theme.texte.titre3 : theme.texte.corps;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.espace[2] }}>
      <Text style={{ ...style, flex: 1, color: theme.couleur.texte.principal }}>{libelle}</Text>
      <Text style={{ ...style, color: theme.couleur.texte.principal }}>{valeur}</Text>
    </View>
  );
}

function Bandeau({ texte }: { texte: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        padding: theme.espace[4],
        borderRadius: theme.rayon.carte,
        backgroundColor: theme.couleur.etat.alerteTeinte,
      }}
    >
      <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.alerteEncre }}>{texte}</Text>
    </View>
  );
}

// Les états de retour, textes de la fiche (« Retour sans confirmation »). Jamais « Payer » ni
// « Réessayer le paiement » quand le prestataire a constaté un paiement : ce serait fabriquer un double
// prélèvement.
function EtatRetour({
  etat,
  prenom,
  onVerifier,
  onVoirAbonnements,
  onRevenirProfil,
}: {
  etat: Etat;
  prenom: string | null;
  onVerifier: () => void;
  onVoirAbonnements: () => void;
  onRevenirProfil: () => void;
}) {
  const theme = useTheme();
  const texte = (t: string) => (
    <Text
      accessibilityLiveRegion="polite"
      style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}
    >
      {t}
    </Text>
  );
  switch (etat.type) {
    case 'constat_en_cours':
      return texte('On vérifie ton paiement auprès de notre prestataire…');
    case 'paiement_recu':
      return texte(
        'Ton paiement est bien arrivé chez notre prestataire. On finalise ton abonnement…',
      );
    case 'reseau':
      return texte('Impossible de vérifier pour l’instant.');
    case 'paiement_recu_depasse':
      return (
        <View style={{ gap: theme.espace[3] }}>
          {texte(
            'Ton paiement est bien arrivé, mais la confirmation prend plus de temps que prévu. Tu n’as rien à refaire : ton abonnement apparaîtra dans ton compte, rubrique Mes abonnements.',
          )}
          <Bouton libelle="Voir mes abonnements" variante="primaire" onPress={onVoirAbonnements} />
          {prenom ? (
            <Bouton
              libelle={`Revenir au profil de ${prenom}`}
              variante="secondaire"
              onPress={onRevenirProfil}
            />
          ) : null}
        </View>
      );
    case 'reseau_depasse':
      return (
        <View style={{ gap: theme.espace[3] }}>
          {texte(
            'On n’arrive pas à vérifier ton paiement pour l’instant. Si tu as payé, ton abonnement apparaîtra dans ton compte.',
          )}
          <Bouton libelle="Vérifier à nouveau" variante="primaire" onPress={onVerifier} />
        </View>
      );
    case 'souscription_impossible':
      // Texte à écrire avec les écrans de confirmation (P4.7, docs/api.md §7 ; docs/dette.md) :
      // aucun texte inventé ici, seulement une sortie.
      return prenom ? (
        <Bouton
          libelle={`Revenir au profil de ${prenom}`}
          variante="secondaire"
          onPress={onRevenirProfil}
        />
      ) : (
        <Bouton libelle="Voir mes abonnements" variante="secondaire" onPress={onVoirAbonnements} />
      );
    case 'demande_sans_reponse':
      return texte('Pas de connexion. Réessaie.');
    default:
      return null;
  }
}
