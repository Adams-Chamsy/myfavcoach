import { CadreFormulaireV2 } from '@/composants/presentation-v2';
import { CanevasEcran } from '@/composants/canevas-ecran';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { EmplacementImage } from '@/composants/emplacement-image';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { EtatVide } from '@/composants/etats/etat-vide';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { Offre, ProfilCoachPublic } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L3bis-I02-arrivee-par-invitation.md. Sans session, ouverte par un lien
// https://<domaine>/y/<jeton> (Universal Link/App Link, docs/prompts/L3bis.md point 3 —
// docs/dette.md pour ce qui reste hors de portée sans appareil physique).
//
function choisirOffre(offres: Offre[]): Offre | null {
  if (offres.length === 0) return null;
  return offres.find((o) => o.estMiseEnAvant) ?? offres[0];
}

export function CorpsArriveeParInvitation({ jeton }: { jeton: string | undefined }) {
  const theme = useTheme();
  const router = useRouter();
  const { port } = useDonnees();

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [jetonInvalide, setJetonInvalide] = useState(false);
  const [coach, setCoach] = useState<ProfilCoachPublic | null>(null);
  const [offre, setOffre] = useState<Offre | null>(null);

  useEffect(() => {
    let monte = true;
    (async () => {
      if (!jeton) {
        if (monte) {
          setJetonInvalide(true);
          setChargement(false);
        }
        return;
      }
      try {
        const coachId = await port.lireCoachParJetonInvitation(jeton);
        if (!monte) return;
        if (!coachId) {
          setJetonInvalide(true);
          setChargement(false);
          return;
        }
        const [profil, offres] = await Promise.all([
          port.lireProfilCoachPublic(coachId),
          port.lireOffresPublieesDeCoach(coachId),
        ]);
        if (!monte) return;
        if (!profil) {
          // Un jeton qui résout à un coach dont le profil public n'est plus lisible (compte
          // supprimé entre les deux appels, cas rare) se comporte comme un jeton invalide —
          // jamais une distinction visible qui révélerait qu'il "presque" fonctionnait.
          setJetonInvalide(true);
        } else {
          setCoach(profil);
          setOffre(choisirOffre(offres));
        }
      } catch {
        if (monte) setErreur(true);
      }
      if (monte) setChargement(false);
    })();
    return () => {
      monte = false;
    };
  }, [jeton, port]);

  function surCreerCompte() {
    if (!jeton) return;
    router.push(`/(public)/inscription?jeton=${encodeURIComponent(jeton)}` as Href);
  }

  function surVoirProfil() {
    if (!coach) return;
    router.push(`/(client)/coach/${coach.id}` as Href);
  }

  if (chargement) {
    return (
      <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <View style={{ height: 238 }}>
          <Squelette forme="detail" />
        </View>
        <View style={{ padding: theme.espace.gouttiere, gap: theme.espace[3] }}>
          <Squelette forme="ligne" />
          <Squelette forme="carte" />
        </View>
      </CanevasEcran>
    );
  }

  if (erreur) {
    return (
      <CanevasEcran
        style={{
          flex: 1,
          backgroundColor: theme.couleur.fond.canevas,
          padding: theme.espace.gouttiere,
          justifyContent: 'center',
        }}
      >
        <EtatErreur
          titre={textesRepliErreur.serveur.titre}
          explication={textesRepliErreur.serveur.explication}
          nombreEchecs={0}
          onReessayer={() => {}}
        />
      </CanevasEcran>
    );
  }

  if (jetonInvalide || !coach) {
    // Aucune information sur le coach visé, aucune distinction avec un jeton simplement
    // inconnu (docs/ecrans/L3bis-I02, Règles) — un jeton presque correct se comporte comme un
    // jeton absent.
    return (
      <CanevasEcran
        style={{
          flex: 1,
          backgroundColor: theme.couleur.fond.canevas,
          padding: theme.espace.gouttiere,
          justifyContent: 'center',
        }}
      >
        <EtatVide titre="Ce lien n'est plus valide" explication="Il a peut-être expiré." />
      </CanevasEcran>
    );
  }

  const nomCoach = `${coach.prenom} ${coach.nom}`;

  return (
    <CadreFormulaireV2
      reference="invitation"
      surtitre="INVITATION PERSONNELLE"
      titre={`${coach.prenom} t’invite à te suivre ici.`}
      description={`Retrouve ${nomCoach} sur MyFavCoach.`}
      actions={
        <>
          <Bouton libelle="Créer mon compte" variante="primaire" onPress={surCreerCompte} />
          <Bouton libelle="Voir son profil d'abord" variante="secondaire" onPress={surVoirProfil} />
        </>
      }
    >
      <View
        style={{
          padding: theme.espace[6],
          gap: theme.espace[4],
          borderWidth: theme.taille.bordureFine,
          borderColor: theme.couleur.bordure.discrete,
          borderRadius: theme.rayon.carte,
          backgroundColor: theme.couleur.fond.surface,
        }}
      >
        <View style={{ flexDirection: 'row', gap: theme.espace[3], alignItems: 'center' }}>
          <View
            style={{
              width: theme.taille.avatarLg,
              height: theme.taille.avatarXl,
              overflow: 'hidden',
              borderRadius: theme.rayon.saisie,
            }}
          >
            <EmplacementImage
              nom={nomCoach}
              ratio="pleinCadre"
              remplir
              source={coach.photoUrl ?? undefined}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.texte.v2TitreOffre, color: theme.couleur.texte.principal }}>
              {nomCoach}
            </Text>
            <Text style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.secondaire }}>
              {coach.discipline}
            </Text>
          </View>
        </View>
        {offre ? (
          <>
            <Text style={{ ...theme.texte.v2NomResultat, color: theme.couleur.texte.principal }}>
              {offre.titre}
            </Text>
            <Text style={{ ...theme.texte.v2TitreTunnel, color: theme.couleur.marque.primaire }}>
              {(offre.prixCentimes / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €
              <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.secondaire }}>
                {' '}
                /mois
              </Text>
            </Text>
            {offre.benefices.map((benefice) => (
              <Text
                key={benefice}
                style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.principal }}
              >
                {benefice}
              </Text>
            ))}
            <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.secondaire }}>
              C’est le tarif de {coach.prenom}. Tu peux arrêter à tout moment, sans justification.
            </Text>
          </>
        ) : (
          <EtatVide
            titre="Rien à proposer pour l'instant"
            explication={`${coach.prenom} n'a pas encore publié d'offre.`}
          />
        )}
      </View>
      <View
        style={{
          borderRadius: theme.rayon.carte,
          backgroundColor: theme.couleur.marque.secondaire,
          padding: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.principal }}>
          {coach.prenom} ne voit rien de ton compte tant que tu ne t’abonnes pas. Créer un compte ne
          l’engage à rien, et toi non plus.
        </Text>
      </View>
    </CadreFormulaireV2>
  );
}

export default function ArriveeParInvitation() {
  const { jeton } = useLocalSearchParams<{ jeton?: string }>();
  return <CorpsArriveeParInvitation jeton={jeton} />;
}
