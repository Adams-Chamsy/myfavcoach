import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SymboleMarque } from '@/composants/marque';
import { Avatar } from '@/composants/avatar';
import { CanevasEcran, DefilementEcran, useDispositionEcran } from '@/composants/canevas-ecran';
import { Chip } from '@/composants/chip';
import { EmplacementImage } from '@/composants/emplacement-image';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { EntetePublicV2, FournisseurPresentationV2 } from '@/composants/presentation-v2';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import type { Discipline, ResultatCoachRecherche } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { font, themes, presentationV2 as mesure } from '@/theme/tokens';

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
    ? (Math.min(largeur, mesure.largeurContenu) * 0.9 - mesure.accueilGrilleEspace * 2) / 3
    : mesure.accueilCarteLargeur;
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
        <View
          style={{
            height: large ? mesure.accueilCartePhotoLargeHauteur : mesure.accueilCartePhotoHauteur,
            overflow: 'hidden',
            borderRadius: theme.rayon.media,
          }}
        >
          <EmplacementImage
            nom={nomCoach}
            ratio="paysage4x3"
            source={coach.photoUrl ?? undefined}
          />
        </View>
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
          <Text
            style={{ ...theme.texte.v2NomProfil, color: theme.couleur.texte.principal, flex: 1 }}
          >
            {nomCoach}
          </Text>
          <Text style={{ ...theme.texte.v2PrixCarte, color: theme.couleur.texte.principal }}>
            {(coach.prixCentimes / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €
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
    <FournisseurPresentationV2>
      <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
        <CanevasEcran
          largeurMax={mesure.largeurContenu}
          ample
          style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}
        >
          {!large ? (
            <EntetePublicV2
              accessoire={
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
                  <Avatar nom={nom} taille="sm" />
                </Pressable>
              }
            />
          ) : null}
          <DefilementEcran
            largeurMax={mesure.largeurContenu}
            ample
            contentContainerStyle={{
              paddingHorizontal: large ? '5%' : mesure.enteteHorizontal,
              paddingTop: mesure.accueilHaut,
              paddingBottom: theme.espace[8],
              gap: mesure.enteteHorizontal,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.principal }}>
                Bonjour{' '}
                <Text style={{ fontFamily: font.uiBold }}>
                  {profils?.identiteActive.prenom ?? ''}
                </Text>
                ,
              </Text>
              <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.secondaire }}>
                {dateDuJour()}
              </Text>
            </View>
            <View
              style={{
                borderRadius: large ? mesure.accueilHeroLargeRayon : mesure.accueilHeroRayon,
                backgroundColor: themes.clair.marque.primaireProfond,
                paddingHorizontal: large
                  ? mesure.accueilHeroLargeHorizontal
                  : mesure.accueilHeroHorizontal,
                paddingTop: large ? mesure.accueilHeroLargeHaut : mesure.accueilHeroHaut,
                paddingBottom: large ? mesure.accueilHeroLargeHaut : mesure.accueilHeroBas,
                flexDirection: 'row',
                gap: theme.espace[8],
                alignItems: 'center',
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: mesure.accueilEchoMarge,
                  right: mesure.accueilEchoMarge,
                  opacity: mesure.accueilEchoOpacite,
                }}
              >
                <SymboleMarque
                  taille={mesure.accueilEchoTaille}
                  couleur={themes.clair.texte.surMarque}
                  monochrome
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.texte.v2Surtitre, color: themes.clair.texte.surMarque }}>
                  DES PERSONNES. DES POSSIBLES.
                </Text>
                <Text
                  style={{
                    ...(large ? theme.texte.v2HeroAccueilLarge : theme.texte.v2HeroAccueil),
                    marginTop: mesure.accueilTitreAvant,
                    marginBottom: mesure.accueilTitreApres,
                    color: themes.clair.texte.surMarque,
                  }}
                >
                  Le bon coach.{'\n'}
                  <Text style={{ color: themes.clair.marque.ruban }}>
                    Ton prochain{'\n'}déclic.
                  </Text>
                </Text>
                <Text
                  style={{
                    ...theme.texte.v2Corps,
                    maxWidth: mesure.accueilCarteLargeur,
                    color: themes.clair.texte.surMarque,
                  }}
                >
                  Du sport à la cybersécurité, avance avec quelqu’un qui t’accompagne vraiment.
                </Text>
                <Pressable
                  onPress={() => ouvrirRecherche()}
                  accessibilityRole="button"
                  accessibilityLabel="Rechercher un coach"
                  style={{
                    marginTop: mesure.accueilRechercheAvant,
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
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: true }}
                onPress={() => ouvrirRecherche()}
                style={{
                  minHeight: theme.taille.tapMin,
                  paddingHorizontal: theme.espace[3],
                  justifyContent: 'center',
                  borderRadius: theme.rayon.pilule,
                  backgroundColor: theme.couleur.marque.primaire,
                }}
              >
                <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.surMarque }}>
                  Tout
                </Text>
              </Pressable>
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
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ ...theme.texte.v2Surtitre, color: theme.couleur.marque.primaire }}
                    >
                      UNE RENCONTRE POUR AVANCER
                    </Text>
                    <Text
                      style={{
                        ...theme.texte.v2TitreSection,
                        color: theme.couleur.texte.principal,
                        flex: 1,
                      }}
                    >
                      Coachs pour toi
                    </Text>
                  </View>
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
    </FournisseurPresentationV2>
  );
}
