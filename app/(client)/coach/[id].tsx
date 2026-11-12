import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { EtatVide } from '@/composants/etats/etat-vide';
import { Onglets } from '@/composants/onglets';
import { OngletAvis } from '@/fonctionnalites/avis/onglet-avis';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { Offre, ProfilCoachPublic } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// L2-12/13/14 (écrans 03/27/28) : trois onglets sur un même écran (fiche L2-13/14, "à
// réconcilier si l'implémentation choisit un seul écran à onglets internes" — choix fait ici).
// Lecture PUBLIQUE (docs/backend.md §8) : aucune session requise, testé par le port lui-même
// (lireProfilCoachPublic/lireOffresPublieesDeCoach n'utilisent jamais compteIdCourant()).
type Onglet = 'offres' | 'avis' | 'parcours';

// Séparé de la lecture du paramètre de route : un paramètre dynamique ([id]) ne se résout
// qu'à travers un vrai match de route, jamais depuis app/_galerie.tsx (même technique que
// CorpsDocumentLegal, app/(public)/documents/[type].tsx). Exporté pour que la galerie exerce
// cet écran sans dépendre d'un routeur réel — trouvé absent de la galerie à P2.13 (docs/dette.md
// avant correction).
export function CorpsProfilCoachPublic({ id }: { id: string | undefined }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();
  const { session, chargement: sessionEnChargement } = useSession();
  const router = useRouter();
  const [profil, setProfil] = useState<ProfilCoachPublic | null | undefined>(undefined);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [onglet, setOnglet] = useState<Onglet>('offres');

  useEffect(() => {
    if (!id) return;
    let monte = true;
    void Promise.all([port.lireProfilCoachPublic(id), port.lireOffresPublieesDeCoach(id)]).then(
      ([p, o]) => {
        if (!monte) return;
        setProfil(p);
        setOffres(o);
      },
    );
    return () => {
      monte = false;
    };
  }, [id, port]);

  if (profil === undefined) return null;
  if (profil === null) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.couleur.fond.canevas,
          padding: theme.espace.gouttiere,
        }}
      >
        <EtatVide titre="Profil introuvable" explication="Ce profil n’existe plus." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          // Zone sûre du haut : la pile client masque l'en-tête système, rien d'autre ne réserve
          // l'encoche. Oubliée jusqu'au 2 novembre 2026 : un nom long passait sous l'heure (iPhone).
          paddingTop: insets.top + theme.espace[6],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}>
          <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
            {profil.prenom} {profil.nom}
          </Text>
          {profil.verifiee ? <Badge statut="succes" libelle="Vérifié" /> : null}
        </View>
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
          {profil.discipline} {profil.titreCourt ? `· ${profil.titreCourt}` : ''}
        </Text>
        {/* docs/domaine.md §5.1, révisé le 12 septembre 2026 : information réelle à la place
            d'une note ou d'un badge « Nouveau », plutôt utile quel que soit le nombre d'avis. */}
        {profil.verifiee && profil.verifieeDepuisLe ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
            Vérifié depuis le {new Date(profil.verifieeDepuisLe).toLocaleDateString('fr-FR')}
          </Text>
        ) : null}
        {profil.bio ? (
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
            {profil.bio}
          </Text>
        ) : null}

        <Onglets
          options={[
            { valeur: 'offres', libelle: 'Offres' },
            { valeur: 'avis', libelle: 'Avis' },
            { valeur: 'parcours', libelle: 'Parcours' },
          ]}
          valeurActive={onglet}
          onChangement={setOnglet}
        />

        {onglet === 'offres' ? <OngletOffres offres={offres} /> : null}
        {/* L2-13 et 27b (L4, 12 novembre 2026) : src/fonctionnalites/avis/onglet-avis.tsx. */}
        {onglet === 'avis' ? <OngletAvis coachId={profil.id} prenom={profil.prenom} /> : null}
        {onglet === 'parcours' ? <OngletParcours profil={profil} /> : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingVertical: theme.espace[3],
          borderTopWidth: 1,
          borderTopColor: theme.couleur.bordure.discrete,
        }}
      >
        {/* Le seul point d'entrée du tunnel (docs/ecrans/L4-04a-choix-offre.md, critère 1 ;
            P4.6a). Sans session : la connexion d'abord, jamais le tunnel directement (décidé le
            31 octobre 2026). Aucune offre publiée : rien à quoi s'abonner, bouton inactif — 04a
            garde son propre état vide pour une offre retirée pendant la lecture du profil. */}
        <Bouton
          libelle={
            offres[0]
              ? `S’abonner · ${(offres[0].prixCentimes / 100).toFixed(0)} €/mois`
              : 'S’abonner'
          }
          variante="primaire"
          onPress={() =>
            router.push(
              (session ? `/(client)/souscription/${profil.id}` : '/(public)/connexion') as Href,
            )
          }
          // Tant que la session n'est pas connue, on ne sait pas où mener : jamais une personne
          // connectée envoyée vers la connexion parce qu'elle a appuyé trop tôt.
          desactive={offres.length === 0 || sessionEnChargement}
        />
      </View>
    </View>
  );
}

export default function ProfilCoachPublicEcran() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CorpsProfilCoachPublic id={id} />;
}

function OngletOffres({ offres }: { offres: Offre[] }) {
  const theme = useTheme();
  if (offres.length === 0) {
    return (
      <EtatVide
        titre="Aucune offre publiée"
        explication="Ce coach n’a rien publié pour l’instant."
      />
    );
  }
  // Une seule nature d'offre au jalon 1 (docs/domaine.md §3.3) : jamais de "Programme seul"
  // (correction à la maquette, L2-12 Règles).
  return (
    <View style={{ gap: theme.espace[3] }}>
      {offres.map((o) => (
        <View
          key={o.id}
          style={{
            borderWidth: 1,
            borderColor: theme.couleur.bordure.discrete,
            borderRadius: theme.rayon.carte,
            padding: theme.espace[4],
            gap: theme.espace[2],
          }}
        >
          {o.estMiseEnAvant ? <Badge statut="accent" libelle="LE PLUS CHOISI" /> : null}
          <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
            {o.titre}
          </Text>
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
            {(o.prixCentimes / 100).toFixed(0)} €/mois
          </Text>
          {o.benefices.map((b) => (
            <Text key={b} style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              · {b}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function OngletParcours({ profil }: { profil: ProfilCoachPublic }) {
  const theme = useTheme();
  if (!profil.parcoursTexte) {
    return (
      <EtatVide
        titre="Rien pour l’instant"
        explication="Ce coach n’a pas encore rédigé son parcours."
      />
    );
  }
  return (
    <View style={{ gap: theme.espace[3] }}>
      <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
        {profil.parcoursTexte}
      </Text>
      {profil.langues.length > 0 ? (
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
          Langues : {profil.langues.join(', ')}
        </Text>
      ) : null}
    </View>
  );
}
