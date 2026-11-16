import { CadreTunnelV2 } from '@/composants/cadre-tunnel-v2';
import { initiales } from '@/composants/initiales';
import { presentationV2 as mesure } from '@/theme/tokens';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { EtatVide } from '@/composants/etats/etat-vide';
import { Icone } from '@/composants/icones';
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

function prixEuros(centimes: number): string {
  const euros = Math.floor(centimes / 100);
  const reste = centimes % 100;
  return reste ? `${euros},${String(reste).padStart(2, '0')}` : String(euros);
}

function prixMensuel(centimes: number): string {
  return `${prixEuros(centimes)} €/mois`;
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
  const { port } = useDonnees();

  const [coach, setCoach] = useState<ChoixOffre['coach'] | null>(null);
  const prenom = coach?.prenom ?? null;
  const [photo, setPhoto] = useState<string | null>(null);
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
      setPhoto(p?.photoUrl ?? null);
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
    <CadreTunnelV2
      etape={1}
      surtitre={prenom ? `S’abonner à ${prenom}` : 'S’abonner'}
      titre={'Un accompagnement.\nÀ ton rythme.'}
      description="Prends le temps de regarder ce qui est inclus avant de continuer."
      onRetour={onRetour}
      pied={
        offre ? (
          <>
            <Bouton
              libelle={`Continuer · ${prixMensuel(offre.prixCentimes)}`}
              onPress={() => void continuer()}
              desactive={enCours}
            />
            <Text
              style={{
                ...theme.texte.v2Petit,
                color: theme.couleur.texte.secondaire,
                textAlign: 'center',
              }}
            >
              Premier prélèvement aujourd’hui, puis une fois par mois.
            </Text>
          </>
        ) : null
      }
      complement={
        offre ? (
          <>
            <Text style={{ ...theme.texte.v2Surtitre, color: theme.couleur.marque.primaire }}>
              CE QUE TU CHOISIS
            </Text>
            <Text style={{ ...theme.texte.v2TitreOffre, color: theme.couleur.texte.principal }}>
              {offre.titre}
            </Text>
            <Text style={{ ...theme.texte.v2TitreTunnel, color: theme.couleur.texte.principal }}>
              {prixMensuel(offre.prixCentimes)}
            </Text>
            <Text style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.secondaire }}>
              Sans engagement de durée : tu peux arrêter quand tu veux, l’arrêt prend effet à la fin
              du mois payé.
            </Text>
          </>
        ) : null
      }
    >
      {offres === null || prenom === null ? (
        <Squelette forme="carte" />
      ) : offres.length === 0 ? (
        <EtatVide
          titre="Aucune formule ouverte"
          explication={`${prenom} n’a pas d’offre ouverte pour le moment.`}
        />
      ) : (
        <>
          {coach ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.espace[3],
                marginBottom: mesure.tunnelCoachApres,
              }}
            >
              <View
                style={{
                  width: mesure.tunnelPortraitLargeur,
                  height: mesure.tunnelPortraitHauteur,
                  borderRadius: theme.rayon.badge,
                  backgroundColor: theme.couleur.marque.primaireTeinte,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    accessibilityLabel={`${coach.prenom} ${coach.nom}`}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <Text
                    style={{ ...theme.texte.v2LabelChamp, color: theme.couleur.marque.primaire }}
                  >
                    {initiales(`${coach.prenom} ${coach.nom}`)}
                  </Text>
                )}
              </View>
              <View>
                <Text style={{ ...theme.texte.v2LabelChamp, color: theme.couleur.texte.principal }}>
                  {`${coach.prenom} ${coach.nom}`.trim()}
                </Text>
                <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.secondaire }}>
                  {coach.discipline}
                </Text>
              </View>
            </View>
          ) : null}
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
              gap: theme.espace[3],
              paddingVertical: theme.espace[4],
              borderTopWidth: mesure.bordure,
              borderTopColor: theme.couleur.bordure.marquee,
            }}
          >
            <Icone
              nom="information"
              couleur={theme.couleur.marque.primaire}
              taille={mesure.icone}
            />
            <Text
              style={{ ...theme.texte.v2Corps, flex: 1, color: theme.couleur.texte.secondaire }}
            >
              Sans engagement de durée : tu peux arrêter quand tu veux, l’arrêt prend effet à la fin
              du mois payé.
            </Text>
          </View>
          {erreur ? <BlocErreur erreur={erreur} /> : null}
        </>
      )}
    </CadreTunnelV2>
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
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: selectionnee, checked: selectionnee }}
      accessibilityLabel={`${offre.titre}, ${prixMensuel(offre.prixCentimes)}, ${engagement}`}
      onPress={onPress}
      style={{
        position: 'relative',
        borderRadius: mesure.tunnelOffreRayon,
        backgroundColor: theme.couleur.fond.surface,
        borderWidth: theme.taille.focusContour,
        borderColor: selectionnee ? theme.couleur.marque.primaire : theme.couleur.bordure.v2Etape,
        paddingVertical: mesure.tunnelOffreVertical,
        paddingHorizontal: mesure.tunnelOffreHorizontal,
      }}
    >
      <View
        style={{
          position: 'absolute',
          right: mesure.tunnelOffreHorizontal,
          top: mesure.tunnelOffreVertical,
          width: mesure.tunnelRadio,
          height: mesure.tunnelRadio,
          borderWidth: theme.taille.focusContour,
          borderColor: theme.couleur.marque.primaire,
          borderRadius: theme.rayon.pilule,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selectionnee ? (
          <View
            style={{
              width: mesure.tunnelRadioCentre,
              height: mesure.tunnelRadioCentre,
              borderRadius: theme.rayon.pilule,
              backgroundColor: theme.couleur.marque.primaire,
            }}
          />
        ) : null}
      </View>
      {offre.estMiseEnAvant ? (
        <View
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: mesure.tunnelBadgeHorizontal,
            paddingVertical: mesure.tunnelBadgeVertical,
            borderRadius: mesure.tunnelBadgeRayon,
            backgroundColor: theme.couleur.marque.primaireTeinte,
            marginBottom: mesure.tunnelBadgeApres,
          }}
        >
          <Text
            style={{
              ...theme.texte.v2Surtitre,
              fontSize: mesure.tunnelBadgeTexte,
              letterSpacing: mesure.tunnelBadgeInterlettrage,
              color: theme.couleur.marque.primaire,
            }}
          >
            LE PLUS CHOISI
          </Text>
        </View>
      ) : null}
      <Text
        style={{
          ...theme.texte.v2TitreOffre,
          color: theme.couleur.texte.principal,
          paddingRight: theme.taille.tapMin,
        }}
      >
        {offre.titre}
      </Text>
      <Text
        accessibilityLabel={prixMensuel(offre.prixCentimes)}
        style={{
          fontFamily: theme.texte.titre1.fontFamily,
          fontSize: mesure.tunnelPrix,
          lineHeight: mesure.tunnelPrixInterligne,
          color: theme.couleur.texte.principal,
          marginTop: mesure.tunnelPrixAvant,
        }}
      >
        {prixEuros(offre.prixCentimes)} €{' '}
        <Text style={{ ...theme.texte.v2Engagement, color: theme.couleur.texte.secondaire }}>
          / mois
        </Text>
      </Text>
      <Text
        style={{
          ...theme.texte.v2Engagement,
          color: theme.couleur.texte.secondaire,
          marginTop: theme.espace[3],
        }}
      >
        {engagement}
      </Text>
      {offre.benefices.length > 0 ? (
        <View
          style={{
            borderTopWidth: mesure.bordure,
            borderTopColor: theme.couleur.bordure.marquee,
            paddingTop: theme.espace[4],
            marginTop: theme.espace[6],
            gap: theme.espace[4],
          }}
        >
          {offre.benefices.map((benefice, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', gap: theme.espace[3], alignItems: 'flex-start' }}
            >
              <View
                style={{
                  width: theme.espace[6],
                  height: theme.espace[6],
                  borderRadius: theme.rayon.pilule,
                  backgroundColor: theme.couleur.marque.primaireTeinte,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icone
                  nom="valide"
                  taille={theme.espace[4]}
                  couleur={theme.couleur.marque.primaire}
                />
              </View>
              <Text
                style={{ ...theme.texte.v2Corps, flex: 1, color: theme.couleur.texte.principal }}
              >
                {benefice}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
