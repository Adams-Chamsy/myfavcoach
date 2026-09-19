import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { EmplacementImage } from '@/composants/emplacement-image';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { EtatVide } from '@/composants/etats/etat-vide';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { Offre, ProfilCoachPublic } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

// docs/ecrans/L3bis-I02-arrivee-par-invitation.md. Sans session, ouverte par un lien
// https://<domaine>/y/<jeton> (Universal Link/App Link, docs/prompts/L3bis.md point 3 —
// docs/dette.md pour ce qui reste hors de portée sans appareil physique).
//
// Le bandeau plein cadre est une île sombre au sens de CLAUDE.md §5 : ses couleurs viennent de
// themes.sombre choisi EXPLICITEMENT, jamais de useTheme() — trouvé deux fois ailleurs
// (barre-navigation.tsx, app/(public)/index.tsx) pour la même raison : un token inversible lu
// via le contexte s'inverse sous un thème ambiant différent de celui prévu pour cette bannière
// précise, qui doit rester lisible sur une photo quel que soit le thème choisi par ailleurs. Le
// reste de l'écran (carte d'offre, bandeau de réassurance, actions) suit le thème ambiant
// normalement, via useTheme().
const sombre = themes.sombre;

function choisirOffre(offres: Offre[]): Offre | null {
  if (offres.length === 0) return null;
  return offres.find((o) => o.estMiseEnAvant) ?? offres[0];
}

export function CorpsArriveeParInvitation({ jeton }: { jeton: string | undefined }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
      <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <View style={{ height: 238 }}>
          <Squelette forme="detail" />
        </View>
        <View style={{ padding: theme.espace.gouttiere, gap: theme.espace[3] }}>
          <Squelette forme="ligne" />
          <Squelette forme="carte" />
        </View>
      </View>
    );
  }

  if (erreur) {
    return (
      <View
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
          onNousEcrire={() => {}}
        />
      </View>
    );
  }

  if (jetonInvalide || !coach) {
    // Aucune information sur le coach visé, aucune distinction avec un jeton simplement
    // inconnu (docs/ecrans/L3bis-I02, Règles) — un jeton presque correct se comporte comme un
    // jeton absent.
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.couleur.fond.canevas,
          padding: theme.espace.gouttiere,
          justifyContent: 'center',
        }}
      >
        <EtatVide titre="Ce lien n'est plus valide" explication="Il a peut-être expiré." />
      </View>
    );
  }

  const nomCoach = `${coach.prenom} ${coach.nom}`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <View style={{ height: 238 }}>
        <EmplacementImage
          nom={nomCoach}
          ratio="pleinCadre"
          remplir
          source={coach.photoUrl ?? undefined}
          fondRepli={sombre.fond.canevas}
          couleurTexteRepli={sombre.texte.surSombre}
        />
        {/* Superposition fixe, île sombre : jamais theme.couleur (voir commentaire de tête de
            fichier). Solide, pas un dégradé (écart à la maquette) : ce système de tokens ne
            définit aucune couleur pré-mélangée avec une opacité arbitraire — en inventer une
            (rgba(...) à la main) serait exactement la couleur en dur que CLAUDE.md §4 interdit. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingTop: insets.top + 24,
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace[4],
            backgroundColor: sombre.fond.canevas,
            gap: theme.espace[2],
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              paddingVertical: theme.espace[1],
              paddingHorizontal: theme.espace[3],
              borderRadius: theme.rayon.badge,
              backgroundColor: sombre.marque.primaireTeinte,
            }}
          >
            <Text
              style={{
                ...theme.texte.legende,
                fontWeight: '800',
                letterSpacing: 1,
                color: sombre.etat.succesEncre,
              }}
            >
              INVITATION PERSONNELLE
            </Text>
          </View>
          <Text
            style={{
              ...theme.texte.titre1,
              color: sombre.texte.surSombre,
            }}
          >
            {coach.prenom} t&apos;invite à te suivre ici
          </Text>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          padding: theme.espace.gouttiere,
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
          Tu travailles déjà avec {nomCoach}. {coach.prenom} regroupe son suivi sur My fav Coach :
          tes séances, tes échanges et ta progression au même endroit.
        </Text>

        {offre ? (
          <View
            style={{
              borderRadius: theme.rayon.carte,
              borderWidth: 1,
              borderColor: theme.couleur.bordure.discrete,
              backgroundColor: theme.couleur.fond.surface,
              padding: theme.espace[4],
              gap: theme.espace[2],
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Text
                style={{
                  ...theme.texte.corps,
                  fontWeight: '800',
                  color: theme.couleur.texte.principal,
                }}
              >
                {offre.titre}
              </Text>
              <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
                {(offre.prixCentimes / 100).toFixed(0)} €
                <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
                  {' '}
                  /mois
                </Text>
              </Text>
            </View>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              C&apos;est le tarif de {coach.prenom}. Tu peux arrêter à tout moment, sans
              justification.
            </Text>
          </View>
        ) : (
          <EtatVide
            titre="Rien à proposer pour l'instant"
            explication={`${coach.prenom} n'a pas encore publié d'offre.`}
          />
        )}

        <View
          style={{
            borderRadius: theme.rayon.carte,
            backgroundColor: theme.couleur.fond.creux,
            padding: theme.espace[3],
          }}
        >
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            {coach.prenom} ne voit rien de ton compte tant que tu ne t&apos;abonnes pas. Créer un
            compte ne l&apos;engage à rien, et toi non plus.
          </Text>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[3],
          paddingBottom: insets.bottom + theme.espace[3],
          borderTopWidth: 1,
          borderTopColor: theme.couleur.bordure.discrete,
          backgroundColor: theme.couleur.fond.canevas,
          gap: theme.espace[2],
        }}
      >
        <Bouton libelle="Créer mon compte" variante="primaire" onPress={surCreerCompte} />
        <Bouton libelle="Voir son profil d'abord" variante="secondaire" onPress={surVoirProfil} />
      </View>
    </View>
  );
}

export default function ArriveeParInvitation() {
  const { jeton } = useLocalSearchParams<{ jeton?: string }>();
  return <CorpsArriveeParInvitation jeton={jeton} />;
}
