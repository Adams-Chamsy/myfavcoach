import { CadreTunnelV2 } from '@/composants/cadre-tunnel-v2';
import { useDispositionReferenceV2 } from '@/composants/presentation-v2';
import { presentationV2 as mesure } from '@/theme/tokens';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Avatar } from '@/composants/avatar';
import { Bouton } from '@/composants/bouton';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { DetailAbonnement } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L4-04c-confirmation-abonnement.md (P4.7). Dire ce qui vient de se passer : combien
// a été payé (ou va l'être), quand aura lieu le prochain prélèvement, et comment arrêter. Tout
// vient du serveur (detail_abonnement, 0060/0062) : aucun montant ni aucune date calculés ici.
//
// La variante vient de l'ÉTAT SERVEUR, jamais du moyen choisi dans la page de paiement : tant que
// l'abonnement est `en_attente_confirmation` (prélèvement SEPA pas encore confirmé par la banque),
// l'écran ne dit jamais « Payé ». Un abonnement SEPA déjà confirmé lit la variante « payé », avec
// sa ligne « Prélèvement SEPA » (la ligne du moyen suit le moyen, le titre suit l'état).

export type ProprietesEcranConfirmation = {
  abonnementId: string;
  onVoirProfil: (coachId: string) => void;
};

type Etat =
  | { type: 'lecture' }
  | { type: 'erreur'; echecs: number }
  | { type: 'pret'; detail: DetailAbonnement };

function euros(centimes: number): string {
  return (centimes / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// « 12 octobre » (fiche) : jour et mois, Europe/Paris.
function dateCourte(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
  });
}

// L'engagement humain de l'offre, « en une phrase » (fiche) : les engagements déclarés par le
// coach, tels qu'il les a choisis (ecran-creation-offre.tsx), première lettre en capitale.
export function phraseEngagement(engagements: string[]): string | null {
  const propres = engagements.map((e) => e.trim()).filter((e) => e.length > 0);
  if (propres.length === 0) return null;
  const phrase = propres.join(', ');
  return `${phrase.charAt(0).toLocaleUpperCase('fr-FR')}${phrase.slice(1)}.`;
}

export function EcranConfirmation({ abonnementId, onVoirProfil }: ProprietesEcranConfirmation) {
  const theme = useTheme();
  const { large } = useDispositionReferenceV2();
  const { port } = useDonnees();
  const [etat, setEtat] = useState<Etat>({ type: 'lecture' });

  const lire = useCallback(
    async (echecs: number) => {
      try {
        const detail = await port.lireDetailAbonnement(abonnementId);
        setEtat({ type: 'pret', detail });
      } catch {
        setEtat({ type: 'erreur', echecs: echecs + 1 });
      }
    },
    [abonnementId, port],
  );

  useEffect(() => {
    let monte = true;
    void port
      .lireDetailAbonnement(abonnementId)
      .then((detail) => {
        if (monte) setEtat({ type: 'pret', detail });
      })
      .catch(() => {
        if (monte) setEtat({ type: 'erreur', echecs: 1 });
      });
    return () => {
      monte = false;
    };
  }, [abonnementId, port]);

  const contenu = (() => {
    if (etat.type === 'lecture') return <Squelette forme="detail" />;
    if (etat.type === 'erreur') {
      const echecs = etat.echecs;
      return (
        <EtatErreur
          titre={textesRepliErreur.serveur.titre}
          explication={textesRepliErreur.serveur.explication}
          nombreEchecs={echecs}
          onReessayer={() => {
            setEtat({ type: 'lecture' });
            void lire(echecs);
          }}
        />
      );
    }
    const d = etat.detail;
    const enAttente = d.statut === 'en_attente_confirmation';
    const montant = enAttente
      ? d.prixFigeCentimes
      : (d.derniereFactureMontantCentimes ?? d.prixFigeCentimes);
    const chiffres = d.moyenDerniersChiffres ? ` •••• ${d.moyenDerniersChiffres}` : '';
    const ligneMoyen =
      d.moyen === 'sepa'
        ? { libelle: 'Prélèvement SEPA', valeur: `IBAN${chiffres}`.trim() }
        : { libelle: 'Carte', valeur: chiffres.trim() || '—' };
    const engagement = phraseEngagement(d.offreEngagementHumain);
    return (
      <View
        style={{
          flexDirection: large ? 'row' : 'column',
          gap: large ? mesure.tunnelColonnes : theme.espace[6],
        }}
      >
        <View style={{ flex: 1, gap: theme.espace[3] }}>
          <View
            style={{
              width: large ? mesure.confirmationPastilleLarge : mesure.confirmationPastille,
              height: large ? mesure.confirmationPastilleLarge : mesure.confirmationPastille,
              marginBottom: large
                ? mesure.confirmationPastilleLargeApres
                : mesure.confirmationPastilleApres,
              borderRadius: theme.rayon.pilule,
              backgroundColor: enAttente
                ? theme.couleur.marque.secondaire
                : theme.couleur.marque.primaire,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icone
              nom={enAttente ? 'agenda' : 'valide'}
              couleur={
                enAttente ? theme.couleur.marque.secondaireEncre : theme.couleur.texte.surMarque
              }
            />
          </View>
          <Text style={{ ...theme.texte.v2Surtitre, color: theme.couleur.marque.primaire }}>
            {enAttente ? 'DEMANDE ENREGISTRÉE' : 'ABONNEMENT CONFIRMÉ'}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              ...(large ? theme.texte.v2TitreConfirmationLarge : theme.texte.v2TitreConfirmation),
              color: theme.couleur.texte.principal,
            }}
          >
            {enAttente ? 'Ta demande\nest enregistrée.' : `C’est parti\navec ${d.coachPrenom}.`}
          </Text>
          {enAttente ? (
            <Text
              style={{
                ...theme.texte.v2Corps,
                color: theme.couleur.texte.secondaire,
              }}
            >
              {`Ton prélèvement de ${euros(montant)} € est en cours auprès de ta banque. Ton suivi avec ${d.coachPrenom} commence dès qu’elle l’a confirmé.`}
            </Text>
          ) : engagement ? (
            <Text
              style={{
                ...theme.texte.v2Corps,
                color: theme.couleur.texte.secondaire,
              }}
            >
              {engagement}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.espace[3],
              marginTop: mesure.confirmationCoachAvant,
              paddingTop: mesure.confirmationCoachHaut,
              borderTopWidth: mesure.bordure,
              borderTopColor: theme.couleur.bordure.marquee,
            }}
          >
            <Avatar nom={`${d.coachPrenom} ${d.coachNom}`} taille="lg" />
            <View style={{ flex: 1 }}>
              <Text
                style={{ ...theme.texte.v2NomResultat, color: theme.couleur.texte.principal }}
              >{`${d.coachPrenom} ${d.coachNom}`}</Text>
              {d.coachCommuneBase ? (
                <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.secondaire }}>
                  {d.coachCommuneBase}
                </Text>
              ) : null}
            </View>
          </View>
          {large ? (
            <Bouton
              libelle={`Voir le profil de ${d.coachPrenom}`}
              variante="primaire"
              onPress={() => onVoirProfil(d.coachId)}
            />
          ) : null}
        </View>

        <View
          style={{
            width: large ? mesure.tunnelAside : undefined,
            borderRadius: mesure.tunnelOffreRayon,
            backgroundColor: theme.couleur.fond.surface,
            borderWidth: mesure.bordure,
            borderColor: theme.couleur.bordure.discrete,
            padding: theme.espace[6],
            gap: theme.espace[3],
          }}
        >
          {/* En tête du récapitulatif, pas en bas (fiche : une résiliation facile à trouver
              produit moins d'oppositions bancaires). Même phrase que 04a. */}
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            Tu peux arrêter quand tu veux, l’arrêt prend effet à la fin du mois payé.
          </Text>
          <View style={{ gap: theme.espace[1] }}>
            <Text style={{ ...theme.texte.v2TitreOffre, color: theme.couleur.texte.principal }}>
              {d.offreTitre}
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              {[`${d.coachPrenom} ${d.coachNom}`, d.coachCommuneBase].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Ligne
            libelle={enAttente ? 'Prélèvement en cours' : 'Payé aujourd’hui'}
            valeur={`${euros(montant)} €`}
            fort
          />
          {d.prochainPrelevementLe ? (
            <Ligne libelle="Prochain prélèvement" valeur={dateCourte(d.prochainPrelevementLe)} />
          ) : null}
          <Ligne libelle={ligneMoyen.libelle} valeur={ligneMoyen.valeur} />
        </View>
        {!large ? (
          <Bouton
            libelle={`Voir le profil de ${d.coachPrenom}`}
            variante="primaire"
            onPress={() => onVoirProfil(d.coachId)}
          />
        ) : null}
      </View>
    );
  })();

  return <CadreTunnelV2>{contenu}</CadreTunnelV2>;
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
