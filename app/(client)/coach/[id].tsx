import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran, useDispositionEcran } from '@/composants/canevas-ecran';
import { Carte } from '@/composants/carte';
import { EmplacementImage } from '@/composants/emplacement-image';
import { EtatVide } from '@/composants/etats/etat-vide';
import { Icone } from '@/composants/icones';
import { Onglets } from '@/composants/onglets';
import { Squelette } from '@/composants/squelette';
import { OngletAvis } from '@/fonctionnalites/avis/onglet-avis';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { Offre, ProfilCoachPublic } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

type Onglet = 'offres' | 'avis' | 'parcours';

export function CorpsProfilCoachPublic({ id }: { id: string | undefined }) {
  const theme = useTheme();
  const { large } = useDispositionEcran();
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
        if (monte) {
          setProfil(p);
          setOffres(o);
        }
      },
    );
    return () => {
      monte = false;
    };
  }, [id, port]);

  if (profil === undefined)
    return (
      <CanevasEcran
        style={{
          flex: 1,
          paddingTop: insets.top + theme.espace[6],
          paddingHorizontal: theme.espace.gouttiere,
          backgroundColor: theme.couleur.fond.canevas,
        }}
      >
        <Squelette forme="detail" />
      </CanevasEcran>
    );
  if (profil === null)
    return (
      <CanevasEcran
        style={{
          flex: 1,
          paddingTop: insets.top + theme.espace[6],
          paddingHorizontal: theme.espace.gouttiere,
          backgroundColor: theme.couleur.fond.canevas,
        }}
      >
        <EtatVide titre="Profil introuvable" explication="Ce profil n’existe plus." />
      </CanevasEcran>
    );

  const nom = `${profil.prenom} ${profil.nom}`;
  const actionAbonnement = (
    <Bouton
      libelle={
        offres[0] ? `S’abonner · ${(offres[0].prixCentimes / 100).toFixed(0)} €/mois` : 'S’abonner'
      }
      variante="primaire"
      onPress={() =>
        router.push(
          (session ? `/(client)/souscription/${profil.id}` : '/(public)/connexion') as Href,
        )
      }
      desactive={offres.length === 0 || sessionEnChargement}
    />
  );
  return (
    <CanevasEcran ample style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <DefilementEcran
        ample
        contentContainerStyle={{
          paddingTop: insets.top + theme.espace[4],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[8],
          gap: theme.espace[6],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[2] }}>
          <BoutonIcone
            nom="retour"
            accessibilityLabel="Retour aux résultats"
            onPress={() =>
              router.canGoBack?.() ? router.back() : router.push('/(client)/(tabs)/explorer')
            }
          />
          <Text style={{ ...theme.texte.petit, color: theme.couleur.marque.primaire }}>
            Retour aux résultats
          </Text>
        </View>
        <View
          style={{
            flexDirection: large ? 'row' : 'column',
            alignItems: large ? 'center' : 'stretch',
            gap: theme.espace[6],
          }}
        >
          <View style={large ? { width: theme.taille.formulaire / 2 } : undefined}>
            <EmplacementImage
              nom={nom}
              ratio={large ? 'portrait3x4' : 'paysage4x3'}
              source={profil.photoUrl ?? undefined}
            />
          </View>
          <View style={{ flex: large ? 1 : undefined, gap: theme.espace[3] }}>
            <Text style={{ ...theme.texte.label, color: theme.couleur.marque.primaire }}>
              {profil.discipline}
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                ...(large ? theme.texte.editorial : theme.texte.titre1),
                color: theme.couleur.texte.principal,
              }}
            >
              {nom}
            </Text>
            {profil.titreCourt ? (
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
                {profil.titreCourt}
              </Text>
            ) : null}
            {profil.verifiee ? <Badge statut="succes" libelle="Vérifié" /> : null}
            {profil.verifiee && profil.verifieeDepuisLe ? (
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                Vérifié depuis le {new Date(profil.verifieeDepuisLe).toLocaleDateString('fr-FR')}
              </Text>
            ) : null}
          </View>
        </View>
        <View
          style={{
            flexDirection: large ? 'row' : 'column',
            alignItems: 'flex-start',
            gap: theme.espace[12],
          }}
        >
          <View
            style={{
              flex: large ? 1 : undefined,
              width: large ? undefined : '100%',
              gap: theme.espace[6],
            }}
          >
            {profil.bio ? (
              <View style={{ gap: theme.espace[3] }}>
                <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
                  Mon approche
                </Text>
                <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                  {profil.bio}
                </Text>
              </View>
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
            {onglet === 'avis' ? (
              <OngletAvis
                coachId={profil.id}
                prenom={profil.prenom}
                onDonnerAvis={() =>
                  router.push(`/(client)/avis/${encodeURIComponent(profil.id)}` as Href)
                }
              />
            ) : null}
            {onglet === 'parcours' ? <OngletParcours profil={profil} /> : null}
          </View>
          {large ? (
            <View style={{ width: theme.taille.formulaire / 2 }}>
              <Carte>
                <View style={{ padding: theme.espace[6], gap: theme.espace[6] }}>
                  <Text style={{ ...theme.texte.label, color: theme.couleur.marque.primaire }}>
                    Ton prochain pas
                  </Text>
                  <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
                    Un accompagnement humain.
                  </Text>
                  {actionAbonnement}
                </View>
              </Carte>
            </View>
          ) : null}
        </View>
      </DefilementEcran>
      {!large ? (
        <View
          style={{
            paddingHorizontal: theme.espace.gouttiere,
            paddingTop: theme.espace[3],
            paddingBottom: insets.bottom + theme.espace[3],
            borderTopWidth: theme.taille.bordureFine,
            borderColor: theme.couleur.bordure.marquee,
            backgroundColor: theme.couleur.fond.canevas,
          }}
        >
          {actionAbonnement}
        </View>
      ) : null}
    </CanevasEcran>
  );
}

export default function ProfilCoachPublicEcran() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CorpsProfilCoachPublic id={id} />;
}

function OngletOffres({ offres }: { offres: Offre[] }) {
  const theme = useTheme();
  if (offres.length === 0)
    return (
      <EtatVide
        titre="Aucune offre publiée"
        explication="Ce coach n’a rien publié pour l’instant."
      />
    );
  return (
    <View style={{ gap: theme.espace[6] }}>
      {offres.map((o) => (
        <Carte key={o.id}>
          <View style={{ padding: theme.espace[6], gap: theme.espace[4] }}>
            {o.estMiseEnAvant ? <Badge statut="accent" libelle="LE PLUS CHOISI" /> : null}
            <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
              {o.titre}
            </Text>
            <Text style={{ ...theme.texte.display, color: theme.couleur.marque.primaire }}>
              {(o.prixCentimes / 100).toFixed(0)} €
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {' '}
                / mois
              </Text>
            </Text>
            {o.benefices.map((b) => (
              <View
                key={b}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.espace[3] }}
              >
                <Icone nom="valide" couleur={theme.couleur.marque.primaire} />
                <Text
                  style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire, flex: 1 }}
                >
                  {b}
                </Text>
              </View>
            ))}
          </View>
        </Carte>
      ))}
    </View>
  );
}

function OngletParcours({ profil }: { profil: ProfilCoachPublic }) {
  const theme = useTheme();
  if (!profil.parcoursTexte)
    return (
      <EtatVide
        titre="Rien pour l’instant"
        explication="Ce coach n’a pas encore rédigé son parcours."
      />
    );
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
