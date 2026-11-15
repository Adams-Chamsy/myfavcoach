import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { DetailAbonnement, MotifBanque, RefusServeur } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L4-20-paiement-refuse.md (P4.7). Un seul contexte : l'échec d'une échéance
// (abonnement `impaye` ou `suspendu`). L'écran dit pourquoi la banque a refusé, que rien n'a été
// débité, jusqu'à quand le suivi continue, et ouvre la page du prestataire où enregistrer un
// nouveau moyen. Aucun paiement n'est engagé d'ici : c'est la tentative planifiée suivante qui
// prélève (fiche, Règles). Toutes les dates viennent du serveur (detail_abonnement, 0060).
//
// Le motif n'est jamais journalisé (fiche, Règles) : il n'est lu que pour être affiché.

// Les six motifs (docs/api.md §7, liste close). `authentification_echouee` dit ce qui s'est
// vraiment passé (docs/prompts/L4.md, P4.7 point 2, décision du 1er novembre 2026) : la banque
// exige le client présent, ce qu'un prélèvement d'échéance ne permet pas.
export const LIBELLES_MOTIF: Record<MotifBanque, string> = {
  fonds_insuffisants: 'fonds insuffisants',
  carte_expiree: 'carte expirée',
  opposition: 'carte en opposition',
  plafond_atteint: 'plafond de carte atteint',
  authentification_echouee: 'ta banque demande que tu confirmes toi-même le paiement',
  inconnu: 'ta banque n’a pas précisé de motif',
};

export type ProprietesEcranPaiementRefuse = {
  abonnementId: string;
  // Retour de la page du prestataire sur web (`/?moyen={id}`, relayé par app/index.tsx) : l'écran
  // commence par demander le constat au serveur.
  auRetourDeLaPage: boolean;
  onRetour: () => void;
  // Même contrat que 04b : expo-web-browser sur iOS/Android (la promesse se résout quand le
  // navigateur se ferme), redirection dans le même onglet sur web. Fournie par la route.
  ouvrirPage: (url: string) => Promise<void>;
  // L'abonnement n'est ni `impaye` ni `suspendu` (régularisé entre-temps, adresse ouverte à la
  // main) : rien à régler ici, la route ramène au compte.
  onRienARegler: () => void;
};

type Lecture =
  | { type: 'lecture' }
  | { type: 'erreur'; echecs: number }
  | { type: 'pret'; detail: DetailAbonnement };

type Action =
  | { type: 'repos' }
  | { type: 'demande' }
  | { type: 'page_ouverte' }
  | { type: 'constat' }
  | { type: 'enregistre'; prochaineTentativeLe: string | null }
  | { type: 'non_enregistre' }
  | { type: 'refus'; refus: RefusServeur }
  | { type: 'sans_reponse' };

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

// Fiche, États, « Moyen de paiement changé » : la date est servie par le serveur.
function phraseNouveauMoyen(prochaineTentativeLe: string | null): string {
  return prochaineTentativeLe
    ? `Nouveau moyen enregistré, le prochain essai aura lieu le ${dateLongue(prochaineTentativeLe)}.`
    : 'Nouveau moyen enregistré.';
}

export function EcranPaiementRefuse({
  abonnementId,
  auRetourDeLaPage,
  onRetour,
  ouvrirPage,
  onRienARegler,
}: ProprietesEcranPaiementRefuse) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();
  const [lecture, setLecture] = useState<Lecture>({ type: 'lecture' });
  const [action, setAction] = useState<Action>(
    auRetourDeLaPage ? { type: 'constat' } : { type: 'repos' },
  );
  // Mêmes gardes synchrones que 04b : un seul appel à la fois, et un seul constat par retour
  // (navigateur fermé ET retour au premier plan arrivent ensemble).
  const verrou = useRef(false);
  const constatEnVol = useRef(false);
  const pageOuverte = useRef(false);

  const lire = useCallback(
    async (echecs: number) => {
      try {
        const detail = await port.lireDetailAbonnement(abonnementId);
        setLecture({ type: 'pret', detail });
      } catch {
        setLecture({ type: 'erreur', echecs: echecs + 1 });
      }
    },
    [abonnementId, port],
  );

  useEffect(() => {
    let monte = true;
    void port
      .lireDetailAbonnement(abonnementId)
      .then((detail) => {
        if (monte) setLecture({ type: 'pret', detail });
      })
      .catch(() => {
        if (monte) setLecture({ type: 'erreur', echecs: 1 });
      });
    return () => {
      monte = false;
    };
  }, [abonnementId, port]);

  const constater = useCallback(async () => {
    if (constatEnVol.current) return;
    constatEnVol.current = true;
    try {
      const resultat = await port.constaterNouveauMoyen(abonnementId);
      if (resultat.issue === 'sans_reponse') {
        setAction({ type: 'sans_reponse' });
        return;
      }
      if (resultat.issue === 'refusee') {
        setAction({ type: 'refus', refus: resultat.refus });
        return;
      }
      if (resultat.etat === 'enregistre') {
        // Fiche, États : « retour de la page → relecture de l'abonnement ».
        await lire(0);
        setAction({ type: 'enregistre', prochaineTentativeLe: resultat.prochaineTentativeLe });
        return;
      }
      // Page quittée sans rien enregistrer, expirée, ou jamais ouverte : l'action principale
      // reste disponible et redemande une page (jamais une page périmée rouverte).
      setAction({ type: 'non_enregistre' });
    } finally {
      constatEnVol.current = false;
    }
  }, [abonnementId, port, lire]);

  // Retour sur web : le constat part à l'ouverture, une seule fois.
  const retourInitial = useRef(auRetourDeLaPage);
  useEffect(() => {
    if (!retourInitial.current) return;
    retourInitial.current = false;
    const minuteur = setTimeout(() => void constater(), 0);
    return () => clearTimeout(minuteur);
  }, [constater]);

  // L'application revient au premier plan alors que la page était ouverte.
  useEffect(() => {
    const ecoute = AppState.addEventListener('change', (statut) => {
      if (statut === 'active' && pageOuverte.current) {
        pageOuverte.current = false;
        setAction({ type: 'constat' });
        void constater();
      }
    });
    return () => ecoute.remove();
  }, [constater]);

  async function changerDeMoyen() {
    if (verrou.current) return;
    verrou.current = true;
    try {
      setAction({ type: 'demande' });
      const resultat = await port.demanderNouveauMoyen(abonnementId);
      if (resultat.issue === 'sans_reponse') {
        setAction({ type: 'sans_reponse' });
        return;
      }
      if (resultat.issue === 'refusee') {
        setAction({ type: 'refus', refus: resultat.refus });
        return;
      }
      pageOuverte.current = true;
      setAction({ type: 'page_ouverte' });
      await ouvrirPage(resultat.urlPaiement);
      if (pageOuverte.current) {
        pageOuverte.current = false;
        setAction({ type: 'constat' });
        await constater();
      }
    } finally {
      verrou.current = false;
    }
  }

  const detail = lecture.type === 'pret' ? lecture.detail : null;
  const aRegler = detail !== null && (detail.statut === 'impaye' || detail.statut === 'suspendu');

  // Rien à régler : la route ramène au compte (jamais un écran de refus sur un abonnement à jour).
  const rienARegler = detail !== null && !aRegler;
  useEffect(() => {
    if (rienARegler) onRienARegler();
  }, [rienARegler, onRienARegler]);

  const occupe =
    action.type === 'demande' || action.type === 'page_ouverte' || action.type === 'constat';

  return (
    <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <View
        style={{
          paddingTop: insets.top + theme.espace[2],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.espace[3],
        }}
      >
        <BoutonIcone nom="retour" accessibilityLabel="Retour" onPress={onRetour} />
        <Text
          accessibilityRole="header"
          style={{ ...theme.texte.label, flex: 1, color: theme.couleur.texte.principal }}
        >
          Paiement refusé
        </Text>
      </View>

      <DefilementEcran
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        {lecture.type === 'lecture' ? <Squelette forme="detail" /> : null}
        {lecture.type === 'erreur' ? (
          <EtatErreur
            titre={textesRepliErreur.serveur.titre}
            explication={textesRepliErreur.serveur.explication}
            nombreEchecs={lecture.echecs}
            onReessayer={() => {
              const echecs = lecture.echecs;
              setLecture({ type: 'lecture' });
              void lire(echecs);
            }}
          />
        ) : null}

        {detail && aRegler ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                gap: theme.espace[3],
                padding: theme.espace[4],
                borderRadius: theme.rayon.carte,
                backgroundColor: theme.couleur.etat.erreurTeinte,
              }}
            >
              <Icone nom="alerte" couleur={theme.couleur.etat.erreurEncre} />
              <View style={{ flex: 1, gap: theme.espace[1] }}>
                <Text
                  accessibilityRole="header"
                  style={{ ...theme.texte.titre3, color: theme.couleur.etat.erreurEncre }}
                >
                  Ta banque a refusé le paiement
                </Text>
                <Text style={{ ...theme.texte.corps, color: theme.couleur.etat.erreurEncre }}>
                  {`Motif transmis : ${LIBELLES_MOTIF[detail.dernierEchecMotif ?? 'inconnu'] ?? LIBELLES_MOTIF.inconnu}.`}
                </Text>
                {/* Toujours affichée, quel que soit le motif (fiche, Contenu ; critère 2). */}
                <Text style={{ ...theme.texte.corps, color: theme.couleur.etat.erreurEncre }}>
                  Rien n’a été débité.
                </Text>
              </View>
            </View>

            {/* Période de grâce (impaye) ou suivi interrompu (suspendu) : dates du serveur. */}
            {detail.statut === 'impaye' && detail.graceJusquAu ? (
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                {`Ton suivi continue jusqu’au ${dateLongue(detail.graceJusquAu)}.`}
              </Text>
            ) : null}
            {detail.statut === 'suspendu' ? (
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                {detail.regularisationAvantLe
                  ? `Suivi interrompu. Règle le paiement avant le ${dateLongue(detail.regularisationAvantLe)} pour le reprendre.`
                  : 'Suivi interrompu.'}
              </Text>
            ) : null}

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
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.espace[2],
                }}
              >
                <Text
                  style={{ ...theme.texte.titre3, flex: 1, color: theme.couleur.texte.principal }}
                >
                  {detail.offreTitre}
                </Text>
                <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                  {`${euros(detail.prixFigeCentimes)} €`}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.espace[2],
                }}
              >
                <Text
                  style={{ ...theme.texte.corps, flex: 1, color: theme.couleur.texte.principal }}
                >
                  {[
                    detail.moyen === 'sepa' ? 'Prélèvement SEPA · IBAN' : 'Carte',
                    detail.moyenDerniersChiffres ? `•••• ${detail.moyenDerniersChiffres}` : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </Text>
                {/* Le statut est un texte, jamais la seule couleur (critère 3). Un nouveau moyen
                    enregistré depuis le refus n'est pas le moyen refusé (0063) : pas d'étiquette. */}
                {detail.nouveauMoyenEnregistre ? null : (
                  <Text style={{ ...theme.texte.label, color: theme.couleur.etat.erreurEncre }}>
                    REFUSÉ
                  </Text>
                )}
              </View>
            </View>

            {detail.moyen === 'carte' && !detail.nouveauMoyenEnregistre ? (
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                Tu peux aussi payer par prélèvement SEPA.
              </Text>
            ) : null}

            {/* Dit à chaque ouverture, pas seulement au retour de la page (fiche, États : « Moyen
                de paiement changé ») : l'état vient du serveur. */}
            {detail.nouveauMoyenEnregistre && action.type !== 'enregistre' ? (
              <Text style={{ ...theme.texte.corps, color: theme.couleur.etat.succesEncre }}>
                {phraseNouveauMoyen(detail.prochaineTentativeLe)}
              </Text>
            ) : null}

            <RetourAction action={action} />
          </>
        ) : null}
      </DefilementEcran>

      {detail && aRegler ? (
        <View
          style={{
            paddingHorizontal: theme.espace.gouttiere,
            paddingTop: theme.espace[3],
            paddingBottom: insets.bottom + theme.espace[3],
            borderTopWidth: 1,
            borderTopColor: theme.couleur.bordure.discrete,
          }}
        >
          <Bouton
            libelle="Changer de moyen de paiement"
            variante="primaire"
            onPress={() => void changerDeMoyen()}
            desactive={occupe}
          />
        </View>
      ) : null}
    </CanevasEcran>
  );
}

// Ce que l'écran dit après un geste. Le refus du serveur s'affiche avec son `title` et son
// `detail`, tels quels (docs/api.md §1) ; l'absence de réponse est le seul cas où l'écran écrit
// son propre texte (même phrase que 04b).
function RetourAction({ action }: { action: Action }) {
  const theme = useTheme();
  const phrase = (texte: string, couleur: string) => (
    <Text accessibilityLiveRegion="polite" style={{ ...theme.texte.corps, color: couleur }}>
      {texte}
    </Text>
  );
  switch (action.type) {
    case 'constat':
      return phrase('On vérifie auprès de notre prestataire…', theme.couleur.texte.principal);
    case 'enregistre':
      return phrase(
        phraseNouveauMoyen(action.prochaineTentativeLe),
        theme.couleur.etat.succesEncre,
      );
    case 'non_enregistre':
      return phrase(
        'Aucun nouveau moyen n’a été enregistré. Rien n’a été débité.',
        theme.couleur.texte.principal,
      );
    case 'sans_reponse':
      return phrase('Pas de connexion. Réessaie.', theme.couleur.etat.erreurEncre);
    case 'refus':
      return (
        <View accessibilityLiveRegion="polite" style={{ gap: theme.espace[1] }}>
          <Text style={{ ...theme.texte.titre3, color: theme.couleur.etat.erreurEncre }}>
            {action.refus.title}
          </Text>
          <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
            {action.refus.detail}
          </Text>
        </View>
      );
    default:
      return null;
  }
}
