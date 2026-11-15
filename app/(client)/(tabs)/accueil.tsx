import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/composants/avatar';
import { CanevasEcran, DefilementEcran, useDispositionEcran } from '@/composants/canevas-ecran';
import { Chip } from '@/composants/chip';
import { EmplacementImage } from '@/composants/emplacement-image';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Marque } from '@/composants/marque';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import type { Discipline, ResultatCoachRecherche } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { font, themes } from '@/theme/tokens';

function dateDuJour(): string {
  const date = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return date.charAt(0).toUpperCase() + date.slice(1);
}

export default function Accueil() {
  const theme = useTheme();
  const { large, largeur } = useDispositionEcran();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profils, port } = useDonnees();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [coachs, setCoachs] = useState<ResultatCoachRecherche[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [tentative, setTentative] = useState(0);
  const nom = profils
    ? [profils.identiteActive.prenom, profils.identiteActive.nom].filter(Boolean).join(' ')
    : '';

  useEffect(() => {
    let monte = true;
    void Promise.all([port.lireDisciplines(), port.rechercherCoachs({ limite: 10 })])
      .then(([d, r]) => {
        if (monte) {
          setDisciplines(d);
          setCoachs(r.resultats);
          setChargement(false);
          setErreur(false);
        }
      })
      .catch(() => {
        if (monte) {
          setErreur(true);
          setChargement(false);
        }
      });
    return () => {
      monte = false;
    };
  }, [port, tentative]);

  function ouvrirRecherche(discipline?: string) {
    router.push(
      discipline
        ? { pathname: '/(client)/(tabs)/explorer', params: { discipline } }
        : '/(client)/(tabs)/explorer',
    );
  }
  const largeurCarte = large
    ? (Math.min(largeur, theme.taille.contenu) - theme.espace.gouttiere * 2 - theme.espace[6] * 2) /
      3
    : theme.taille.carteDecouverte;
  const cartes = coachs.map((coach) => {
    const nomCoach = `${coach.prenom} ${coach.nom}`;
    return (
      <Pressable
        key={coach.offreId}
        onPress={() => router.push(`/(client)/coach/${coach.coachId}`)}
        accessibilityRole="button"
        accessibilityLabel={`Voir le profil de ${nomCoach}`}
        style={{ width: largeurCarte, gap: theme.espace[2] }}
      >
        <EmplacementImage nom={nomCoach} ratio="paysage4x3" source={coach.photoUrl ?? undefined} />
        <Text
          style={{
            ...theme.texte.label,
            color: theme.couleur.marque.primaire,
            marginTop: theme.espace[2],
          }}
        >
          {coach.discipline}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: theme.espace[3],
          }}
        >
          <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal, flex: 1 }}>
            {nomCoach}
          </Text>
          <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
            {(coach.prixCentimes / 100).toFixed(0)} €
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}>
              /mois
            </Text>
          </Text>
        </View>
        {coach.titreCourt ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            {coach.titreCourt}
          </Text>
        ) : null}
      </Pressable>
    );
  });
  return (
    <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
      <CanevasEcran ample style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <View
          style={{
            paddingTop: insets.top + theme.espace[2],
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.espace[3],
          }}
        >
          {large ? (
            <View>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {dateDuJour()}
              </Text>
              <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                Salut {profils?.identiteActive.prenom ?? ''}
              </Text>
            </View>
          ) : (
            <Marque />
          )}
          <Pressable
            onPress={() => setFeuilleOuverte(true)}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir la bascule d'espace"
            style={{
              minWidth: theme.taille.tapMin,
              minHeight: theme.taille.tapMin,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Avatar nom={nom} taille="md" />
          </Pressable>
        </View>
        <DefilementEcran
          ample
          contentContainerStyle={{
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace[8],
            gap: theme.espace[6],
          }}
        >
          {!large ? (
            <View>
              <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                Salut {profils?.identiteActive.prenom ?? ''}
              </Text>
              <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}>
                {dateDuJour()}
              </Text>
            </View>
          ) : null}
          <View
            style={{
              borderRadius: theme.rayon.panneau,
              backgroundColor: themes.clair.marque.primaireProfond,
              padding: large ? theme.espace[12] : theme.espace[6],
              flexDirection: 'row',
              gap: theme.espace[8],
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1, gap: theme.espace[6] }}>
              <Text style={{ ...theme.texte.label, color: themes.clair.texte.surMarque }}>
                Des personnes. Des possibles.
              </Text>
              <Text
                style={{
                  ...(large ? theme.texte.heroLarge : theme.texte.display),
                  color: themes.clair.texte.surMarque,
                }}
              >
                Le bon coach.{'\n'}
                <Text style={{ color: themes.clair.marque.ruban }}>Ton prochain déclic.</Text>
              </Text>
              <Text style={{ ...theme.texte.petit, color: themes.clair.texte.surMarque }}>
                Du sport à la cybersécurité, avance avec quelqu’un qui t’accompagne vraiment.
              </Text>
              <Pressable
                onPress={() => ouvrirRecherche()}
                accessibilityRole="button"
                accessibilityLabel="Rechercher un coach"
                style={{
                  minHeight: theme.taille.controle,
                  borderRadius: theme.rayon.saisie,
                  backgroundColor: themes.clair.fond.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: theme.espace[4],
                  paddingVertical: theme.espace[3],
                  gap: theme.espace[3],
                }}
              >
                <Icone nom="recherche" couleur={themes.clair.texte.secondaire} />
                <Text
                  style={{ ...theme.texte.corps, color: themes.clair.texte.secondaire, flex: 1 }}
                >
                  Un coach, une discipline…
                </Text>
                <Icone nom="suivant" couleur={themes.clair.marque.primaire} />
              </Pressable>
            </View>
            {large && coachs[0] ? (
              <View style={{ width: largeurCarte }}>
                <EmplacementImage
                  nom={`${coachs[0].prenom} ${coachs[0].nom}`}
                  ratio="portrait3x4"
                  source={coachs[0].photoUrl ?? undefined}
                  fondRepli={themes.clair.marque.primaire}
                  couleurTexteRepli={themes.clair.texte.surMarque}
                />
              </View>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.espace[2] }}
          >
            <Chip
              variante="filtre"
              libelle="Tout"
              selectionne={false}
              onPress={() => ouvrirRecherche()}
            />
            {disciplines.map((d) => (
              <Chip
                key={d.cle}
                variante="filtre"
                libelle={d.libelle}
                selectionne={false}
                onPress={() => ouvrirRecherche(d.cle)}
              />
            ))}
          </ScrollView>
          {erreur ? (
            <EtatErreur
              {...textesRepliErreur.serveur}
              nombreEchecs={0}
              onReessayer={() => setTentative((v) => v + 1)}
            />
          ) : chargement ? (
            <Squelette forme="carte" />
          ) : coachs.length > 0 ? (
            <View style={{ gap: theme.espace[6] }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.espace[3],
                }}
              >
                <Text
                  style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal, flex: 1 }}
                >
                  Coachs pour toi
                </Text>
                <Pressable
                  onPress={() => ouvrirRecherche()}
                  accessibilityRole="button"
                  style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
                >
                  <Text
                    style={{
                      ...theme.texte.petit,
                      color: theme.couleur.marque.primaire,
                      fontFamily: font.uiBold,
                    }}
                  >
                    Tout explorer →
                  </Text>
                </Pressable>
              </View>
              {large ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[6] }}>
                  {cartes}
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: theme.espace[4] }}
                >
                  {cartes}
                </ScrollView>
              )}
            </View>
          ) : null}
        </DefilementEcran>
      </CanevasEcran>
    </FeuilleBascule>
  );
}
