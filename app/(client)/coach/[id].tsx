import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Badge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { EtatVide } from '@/composants/etats/etat-vide';
import { Onglets } from '@/composants/onglets';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
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
  const { port } = useDonnees();
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
          paddingTop: theme.espace[6],
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
        {onglet === 'avis' ? <OngletAvis /> : null}
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
        {/* Affiché mais inatteignable (L2-12, Règles) : le tunnel (04a) est L4. Aucun appel
            réseau de paiement n'est déclenché par ce bouton à ce lot. */}
        <Bouton
          libelle={
            offres[0]
              ? `S’abonner · ${(offres[0].prixCentimes / 100).toFixed(0)} €/mois`
              : 'S’abonner'
          }
          variante="primaire"
          onPress={() => {}}
          desactive
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

// L2-13 : aucun avis réel n'existe au jalon 1 (aucune table `avis`, docs/domaine.md §3.11 non
// implémentée à ce lot) — le seul cas atteignable en production est donc "0 avis". Révisé le
// 12 septembre 2026 (docs/domaine.md §5.1) : plus de badge « Nouveau » dans aucun des trois cas
// (0, 1-4, 5+ avis) — à 0 avis, ni note ni compteur, un état honnête comme OngletOffres/
// OngletParcours juste au-dessus. La date de vérification qui accompagne ce cas (§5.1) est déjà
// affichée dans l'en-tête, pas répétée ici (voir « Vérifié depuis le » plus haut).
function OngletAvis() {
  return (
    <EtatVide
      titre="Aucun avis pour l’instant"
      explication="Ce coach n’a pas encore reçu d’avis."
    />
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
