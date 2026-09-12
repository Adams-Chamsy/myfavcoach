import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, type StatutBadge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import type { DossierVerification } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';
import { echeanceQuaranteHuitHeuresOuvrees } from './echeance-verification';

// L2-09 : écran indépendant (pas un bandeau ajouté à L2-11), affiché tant que le dossier n'est
// pas `verifiee`. Un seul statut par dossier (docs/domaine.md §4.2) : les trois documents
// s'affichent en étiquettes neutres, jamais avec un état individuel.
const CONTENU_PAR_STATUT: Record<
  Exclude<DossierVerification['statut'], 'verifiee'>,
  { badge: string; statutBadge: StatutBadge; titre: string }
> = {
  // Aucune pièce jamais déposée (dossier quitté avant L2-06) : même mise en page, invite à
  // reprendre le dépôt plutôt qu'à attendre un examen qui n'a pas commencé.
  absente: {
    badge: 'VÉRIFICATION À FAIRE',
    statutBadge: 'neutre',
    titre: 'Il te reste à te faire vérifier',
  },
  en_examen: { badge: 'DOSSIER EN EXAMEN', statutBadge: 'accent', titre: 'On regarde ton dossier' },
  complement_demande: {
    badge: 'COMPLÉMENT DEMANDÉ',
    statutBadge: 'alerte',
    titre: 'On a besoin d’une chose',
  },
  refusee: { badge: 'DEMANDE REFUSÉE', statutBadge: 'erreur', titre: 'Ta demande a été refusée' },
  revoquee: {
    badge: 'VÉRIFICATION RÉVOQUÉE',
    statutBadge: 'erreur',
    titre: 'Ton badge a été retiré',
  },
};

export function AttenteVerification({ dossier }: { dossier: DossierVerification }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (dossier.statut === 'verifiee') return null;
  const contenu = CONTENU_PAR_STATUT[dossier.statut];
  const echeance = dossier.deposeLe ? echeanceQuaranteHuitHeuresOuvrees(dossier.deposeLe) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      {/* Île fixe, toujours sombre quel que soit le thème ambiant (CLAUDE.md §5) : themes.sombre
          lu explicitement, jamais theme.couleur.* — même pattern que barre-navigation.tsx. */}
      <View
        style={{
          backgroundColor: themes.sombre.fond.canevas,
          paddingTop: insets.top + theme.espace[3],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.titre3, color: themes.sombre.texte.surSombre }}>
          Espace coach
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[4],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Badge statut={contenu.statutBadge} libelle={contenu.badge} />
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          {contenu.titre}
        </Text>
        {dossier.statut === 'en_examen' && echeance ? (
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
            Déposé le {new Date(dossier.deposeLe as string).toLocaleDateString('fr-FR')}. Réponse
            sous 48 h ouvrées, soit d’ici le {echeance.toLocaleDateString('fr-FR')}.
          </Text>
        ) : null}

        {dossier.statut === 'complement_demande' && dossier.motif ? (
          <View
            style={{
              backgroundColor: theme.couleur.etat.erreurTeinte,
              borderRadius: theme.rayon.carte,
              padding: theme.espace[4],
              gap: theme.espace[2],
            }}
          >
            <Text style={{ ...theme.texte.label, color: theme.couleur.etat.erreurEncre }}>
              Il manque quelque chose
            </Text>
            <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
              {dossier.motif}
            </Text>
            <Bouton
              libelle="Renvoyer le document"
              variante="secondaire"
              onPress={() => router.push('/(onboarding)/devenir-coach-verification')}
            />
          </View>
        ) : null}

        {(dossier.statut === 'refusee' || dossier.statut === 'revoquee') && (
          <View
            style={{
              backgroundColor: theme.couleur.etat.erreurTeinte,
              borderRadius: theme.rayon.carte,
              padding: theme.espace[4],
              gap: theme.espace[2],
            }}
          >
            {dossier.motif ? (
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                {dossier.motif}
              </Text>
            ) : null}
            <Bouton
              libelle="Déposer un nouveau dossier"
              variante="secondaire"
              onPress={() => router.push('/(onboarding)/devenir-coach-verification')}
            />
          </View>
        )}

        <View style={{ gap: theme.espace[2] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Ton dossier
          </Text>
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
            Pièce d’identité · Diplôme · Assurance RC pro
          </Text>
        </View>

        <View style={{ gap: theme.espace[2] }}>
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
            Rédige ton profil — Ton profil est déjà consultable par lien direct, sans badge.
          </Text>
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
            Publier une offre — Seule la publication attend la vérification.
          </Text>
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[3],
          paddingBottom: insets.bottom + theme.espace[3],
        }}
      >
        <Bouton
          libelle="Rédiger mon profil"
          variante="primaire"
          onPress={() => router.push('/(onboarding)/devenir-coach-profil')}
        />
      </View>
    </View>
  );
}
