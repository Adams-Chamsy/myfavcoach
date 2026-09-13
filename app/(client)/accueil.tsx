import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/composants/avatar';
import { Chip } from '@/composants/chip';
import { EmplacementImage } from '@/composants/emplacement-image';
import { Icone } from '@/composants/icones';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import type { Discipline, ResultatCoachRecherche } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// Écran 01 (docs/ecrans/L3-01-accueil-decouverte.md). L'avatar et la bascule d'espace sont
// livrés depuis P1.12 — cette fiche construit tout le reste : salutation, recherche, disciplines,
// carrousel « Coachs pour toi ».
//
// Trois corrections à la maquette (fiche, Règles) : aucune note/avis nulle part (docs/domaine.md
// §5.1/§5.6) ; aucun bloc « séance du jour »/« reprends là où tu t'es arrêtée » (dépend de
// Programme, L6, absent) ; les puces de discipline viennent de la vraie table `disciplines`
// (port.lireDisciplines()), jamais des trois valeurs choisies par la maquette.
function dateDuJour(): string {
  const texte = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export default function Accueil() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profils, port } = useDonnees();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [coachsPourToi, setCoachsPourToi] = useState<ResultatCoachRecherche[]>([]);

  const nom = profils
    ? [profils.identiteActive.prenom, profils.identiteActive.nom].filter(Boolean).join(' ')
    : '';

  useEffect(() => {
    let monte = true;
    // Aucune commune imposée : le profil client ne l'expose pas encore par ce port (fiche,
    // « Ce qui a été inventé ») — proximité neutre pour tout le monde, comme une recherche sans
    // filtre de commune sur L3-02.
    void Promise.all([port.lireDisciplines(), port.rechercherCoachs({ limite: 10 })]).then(
      ([d, r]) => {
        if (!monte) return;
        setDisciplines(d);
        setCoachsPourToi(r.resultats);
      },
    );
    return () => {
      monte = false;
    };
  }, [port]);

  function ouvrirRecherche(disciplineCle?: string) {
    router.push(
      disciplineCle
        ? { pathname: '/(client)/explorer', params: { discipline: disciplineCle } }
        : '/(client)/explorer',
    );
  }

  return (
    <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
      <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        {/* Zone sûre du haut portée par CE View, en style direct — jamais par
            contentContainerStyle du ScrollView plus bas, que le balayage de zone sûre
            (src/test/accessibilite.test.tsx, verifierOffsetHautZoneSure) ne voit pas : il
            n'inspecte que la prop "style", pas les props propres à ScrollView. Même angle mort
            déjà documenté pour moi.tsx/pilotage.tsx (CLAUDE.md §8). */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: insets.top + theme.espace[2],
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace[2],
          }}
        >
          <View style={{ gap: theme.espace[1] }}>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
              {dateDuJour()}
            </Text>
            <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
              Salut {profils?.identiteActive.prenom ?? ''}
            </Text>
          </View>
          <Pressable
            onPress={() => setFeuilleOuverte(true)}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir la bascule d'espace"
          >
            <Avatar nom={nom} taille="md" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingBottom: theme.espace[8],
            gap: theme.espace[4],
          }}
        >
          <Pressable
            onPress={() => ouvrirRecherche()}
            accessibilityRole="button"
            accessibilityLabel="Rechercher un coach"
            style={{
              marginHorizontal: theme.espace.gouttiere,
              minHeight: theme.taille.controle,
              borderRadius: theme.rayon.saisie,
              borderWidth: 1,
              borderColor: theme.couleur.bordure.discrete,
              backgroundColor: theme.couleur.fond.surface,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.espace[2],
              paddingHorizontal: theme.espace[4],
            }}
          >
            <Icone nom="recherche" couleur={theme.couleur.texte.attenue} />
            <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.attenue }}>
              Un coach, une discipline…
            </Text>
          </Pressable>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: theme.espace[2],
              paddingHorizontal: theme.espace.gouttiere,
            }}
          >
            <Chip
              variante="filtre"
              libelle="Tout"
              selectionne={false}
              onPress={() => ouvrirRecherche()}
            />
            {disciplines.map((discipline) => (
              <Chip
                key={discipline.cle}
                variante="filtre"
                libelle={discipline.libelle}
                selectionne={false}
                onPress={() => ouvrirRecherche(discipline.cle)}
              />
            ))}
          </ScrollView>

          {coachsPourToi.length > 0 ? (
            <View style={{ gap: theme.espace[3] }}>
              <Text
                style={{
                  ...theme.texte.titre3,
                  color: theme.couleur.texte.principal,
                  paddingHorizontal: theme.espace.gouttiere,
                }}
              >
                Coachs pour toi
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: theme.espace[3],
                  paddingHorizontal: theme.espace.gouttiere,
                }}
              >
                {coachsPourToi.map((coach) => {
                  const nomCoach = `${coach.prenom} ${coach.nom}`;
                  return (
                    <Pressable
                      key={coach.offreId}
                      onPress={() => router.push(`/(client)/coach/${coach.coachId}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Voir le profil de ${nomCoach}`}
                      style={{ width: 200, gap: theme.espace[2] }}
                    >
                      <EmplacementImage
                        nom={nomCoach}
                        ratio="paysage4x3"
                        source={coach.photoUrl ?? undefined}
                      />
                      <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
                        {coach.discipline}
                      </Text>
                      <Text
                        style={{ ...theme.texte.petit, color: theme.couleur.texte.principal }}
                        numberOfLines={1}
                      >
                        {nomCoach}
                      </Text>
                      {coach.titreCourt ? (
                        <Text
                          style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}
                          numberOfLines={1}
                        >
                          {coach.titreCourt}
                        </Text>
                      ) : null}
                      <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.principal }}>
                        {(coach.prixCentimes / 100).toFixed(0)} €/mois
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </FeuilleBascule>
  );
}
