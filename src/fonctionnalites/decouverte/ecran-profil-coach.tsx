import { useRouter, type Href } from 'expo-router';
import { useEffect, useState, type ReactElement } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran, useDispositionEcran } from '@/composants/canevas-ecran';
import { Carte } from '@/composants/carte';
import { EmplacementImage } from '@/composants/emplacement-image';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { useParcoursVisiteur } from '@/fonctionnalites/accueil/fournisseur-parcours-visiteur';
import { EtatVide } from '@/composants/etats/etat-vide';
import { Onglets } from '@/composants/onglets';
import { Squelette } from '@/composants/squelette';
import {
  CarteOffrePublique,
  montantOffreEnEuros,
} from '@/fonctionnalites/offres/carte-offre-publique';
import { OngletAvis } from '@/fonctionnalites/avis/onglet-avis';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { Offre, ProfilCoachPublic } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

type Onglet = 'offres' | 'avis' | 'parcours';

export function CorpsProfilCoachPublic({ id }: { id: string | undefined }): ReactElement {
  const theme = useTheme();
  const { large } = useDispositionEcran();
  const insets = useSafeAreaInsets();
  const { port, profils, chargement: donneesEnChargement } = useDonnees();
  const { retenirCoach } = useParcoursVisiteur();
  const [erreur, setErreur] = useState(false);
  const [tentative, setTentative] = useState(0);
  const { session, chargement: sessionEnChargement } = useSession();
  const router = useRouter();
  const [profil, setProfil] = useState<ProfilCoachPublic | null | undefined>(undefined);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [onglet, setOnglet] = useState<Onglet>('offres');
  useEffect(() => {
    if (!id) return;
    let monte = true;
    void Promise.all([port.lireProfilCoachPublic(id), port.lireOffresPublieesDeCoach(id)])
      .then(([p, o]) => {
        if (monte) {
          setProfil(p);
          setOffres(o);
        }
      })
      .catch(() => {
        if (monte) setErreur(true);
      });
    return () => {
      monte = false;
    };
  }, [id, port, tentative, session?.compteId, session?.emailVerifie]);

  if (erreur)
    return (
      <CanevasEcran
        style={{
          flex: 1,
          paddingTop: insets.top + theme.espace[6],
          paddingHorizontal: theme.espace.gouttiere,
          backgroundColor: theme.couleur.fond.canevas,
        }}
      >
        <EtatErreur
          titre={textesRepliErreur.serveur.titre}
          explication={textesRepliErreur.serveur.explication}
          nombreEchecs={tentative + 1}
          onReessayer={() => {
            setErreur(false);
            setTentative((t) => t + 1);
          }}
        />
      </CanevasEcran>
    );
  if (profil === undefined && id)
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
  if (profil == null || !id)
    return (
      <CanevasEcran
        style={{
          flex: 1,
          paddingTop: insets.top + theme.espace[6],
          paddingHorizontal: theme.espace.gouttiere,
          backgroundColor: theme.couleur.fond.canevas,
        }}
      >
        <EtatVide
          titre="Profil introuvable"
          explication="Ce profil n’existe plus."
          actionPrincipale={{
            libelle: 'Découvrir les coachs',
            onPress: () => router.replace('/(public)/decouvrir' as Href),
          }}
        />
      </CanevasEcran>
    );

  const nom = `${profil.prenom} ${profil.nom}`;
  const espaceCoach = Boolean(session?.emailVerifie && profils?.profilActif === 'coach');
  const clientPret = Boolean(
    session?.emailVerifie &&
    profils?.profilActif === 'client' &&
    profils.clientExiste &&
    (profils.clientOnboardingEtape ?? 0) > 4,
  );
  const actionAbonnement = (
    <Bouton
      libelle={
        espaceCoach
          ? 'Ouvrir mon espace'
          : offres[0]
            ? `S’abonner · ${montantOffreEnEuros(offres[0].prixCentimes)} €/mois`
            : 'S’abonner'
      }
      variante="primaire"
      onPress={() => {
        if (espaceCoach) {
          router.push('/' as Href);
          return;
        }
        if (!clientPret) retenirCoach(profil.id);
        router.push(
          (!session?.emailVerifie
            ? '/(public)/connexion'
            : !clientPret
              ? '/'
              : `/(client)/souscription/${profil.id}`) as Href,
        );
      }}
      desactive={
        offres.length === 0 ||
        sessionEnChargement ||
        Boolean(session?.emailVerifie && donneesEnChargement)
      }
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
              router.canGoBack?.() ? router.back() : router.replace('/(public)/decouvrir' as Href)
            }
          />
          <Text style={{ ...theme.texte.petit, color: theme.couleur.marque.primaire }}>
            Retour aux résultats
          </Text>
        </View>
        {espaceCoach ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            Pour t’abonner, ouvre ton espace et passe au profil client.
          </Text>
        ) : null}
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
      {offres.map((offre) => (
        <CarteOffrePublique key={offre.id} {...offre} />
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
