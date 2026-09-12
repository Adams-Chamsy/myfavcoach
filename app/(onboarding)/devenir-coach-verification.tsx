import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Icone } from '@/composants/icones';
import { EnteteOnboarding } from '@/fonctionnalites/identite/entete-onboarding';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { PieceDeposee, TypePiece } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// L2-06 : formats et taille max, non trouvés dans le dossier (fiche, "Ce qui a été inventé") —
// images (le cas courant, une photo prise sur le vif) et PDF (un diplôme/une attestation
// numérisée), plafond 10 Mo choisi ici, à confirmer.
const TYPES_MIME_ACCEPTES = ['image/*', 'application/pdf'];
const TAILLE_MAX_OCTETS = 10 * 1024 * 1024;

// L2-06 — étape 3/4, fusionnée avec le dépôt des pièces (docs/prompts/L2.md P2.8, point 2).
//
// GARDE DE SORTIE (P2.8, point 3) : PAS POSÉE ICI, décision explicite, pas un oubli.
// useGardeSortie (src/fonctionnalites/navigation/garde-sortie.tsx) exige un Stack de
// `expo-router/js-stack` (son propre avertissement : `beforeRemove` « not fully supported in
// native-stack »). Le groupe `(onboarding)` n'a AUCUN `_layout.tsx` aujourd'hui — il tourne sur
// le native-stack par défaut, partagé par 1-identite/2-objectifs/3-poids/4-cest-parti et
// devenir-coach, tous déjà testés dans cette configuration. Y introduire un `_layout.tsx`
// js-stack maintenant changerait la navigation de TOUT le groupe, pas seulement cet écran — un
// changement d'infrastructure plus large que ce que ce lot peut valider en une passe. C'est ce
// que ce dépôt appelle une dette : cet écran est pourtant, de tout le parcours, celui où
// l'abandon coûte le plus cher (une pièce d'identité à moitié envoyée, un dossier incomplet).
// Voir le rapport de P2.8 : la dette n'est PAS réglée à ce lot, contrairement à l'intention
// initiale de ce commentaire — reste inscrite dans docs/dette.md.
const LIBELLES_PIECE: Record<TypePiece, string> = {
  identite: 'Pièce d’identité',
  diplome_ou_certification: 'Diplôme ou certification',
  assurance_rc_pro: 'Attestation d’assurance RC pro',
};
const ORDRE_PIECES: TypePiece[] = ['identite', 'diplome_ou_certification', 'assurance_rc_pro'];

function libelleManquant(deposees: Set<TypePiece>): string {
  const manquantes = ORDRE_PIECES.filter((t) => !deposees.has(t));
  if (manquantes.length === 0) return '';
  if (manquantes.length === ORDRE_PIECES.length) return 'Dépose tes trois documents.';
  return `Il manque ${manquantes.map((t) => LIBELLES_PIECE[t].toLowerCase()).join(' et ')}.`;
}

export default function DevenirCoachVerification() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lirePiecesDeposees, deposerPieceVerification } = useDonnees().port;

  const [pieces, setPieces] = useState<PieceDeposee[]>([]);
  const [enCours, setEnCours] = useState<TypePiece | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let monte = true;
    void lirePiecesDeposees().then((p) => {
      if (monte) {
        setPieces(p);
        setChargement(false);
      }
    });
    return () => {
      monte = false;
    };
  }, [lirePiecesDeposees]);

  const deposees = new Set(pieces.map((p) => p.type));
  const toutesDeposees = ORDRE_PIECES.every((t) => deposees.has(t));

  async function surChoisirFichier(type: TypePiece) {
    setErreur(null);
    const resultat = await DocumentPicker.getDocumentAsync({
      type: TYPES_MIME_ACCEPTES,
      copyToCacheDirectory: true,
    });
    if (resultat.canceled) return;
    const fichier = resultat.assets[0];
    if (!fichier) return;

    if (fichier.size !== undefined && fichier.size !== null && fichier.size > TAILLE_MAX_OCTETS) {
      setErreur('Ce fichier dépasse 10 Mo. Choisis-en un plus léger.');
      return;
    }

    setEnCours(type);
    const resultatDepot = await deposerPieceVerification(type, {
      uri: fichier.uri,
      nom: fichier.name,
      typeMime: fichier.mimeType ?? 'application/octet-stream',
    });
    setEnCours(null);
    if (!resultatDepot.succes) {
      setErreur(resultatDepot.erreur);
      return;
    }
    const misesAJour = await lirePiecesDeposees();
    setPieces(misesAJour);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <EnteteOnboarding etape={3} desactive={enCours !== null} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[2],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          Trois documents.
        </Text>
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
          Une personne les examine sous 48 h ouvrées. Ils servent à ça et à rien d’autre.
        </Text>

        {!chargement
          ? ORDRE_PIECES.map((type) => {
              const piece = pieces.find((p) => p.type === type);
              return (
                <View
                  key={type}
                  style={{
                    borderWidth: piece ? 1 : 1,
                    borderStyle: piece ? 'solid' : 'dashed',
                    borderColor: theme.couleur.bordure.discrete,
                    borderRadius: theme.rayon.carte,
                    padding: theme.espace[4],
                    gap: theme.espace[2],
                  }}
                >
                  <Text style={{ ...theme.texte.label, color: theme.couleur.texte.principal }}>
                    {LIBELLES_PIECE[type]}
                  </Text>
                  {piece ? (
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[2] }}
                    >
                      <Icone nom="valide" couleur={theme.couleur.etat.succesEncre} />
                      <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                        Déposée le {new Date(piece.deposeLe).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                  ) : (
                    <Bouton
                      libelle={enCours === type ? 'Envoi en cours…' : 'Choisir un fichier'}
                      variante="secondaire"
                      onPress={() => void surChoisirFichier(type)}
                      desactive={enCours !== null}
                    />
                  )}
                </View>
              );
            })
          : null}

        <View
          style={{
            backgroundColor: theme.couleur.fond.creux,
            borderRadius: theme.rayon.carte,
            padding: theme.espace[3],
          }}
        >
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            Une fois envoyé, un document n’est plus consultable ici — ni par toi, ni par personne
            d’autre que l’examinateur. Tu peux le remplacer, pas le rouvrir.
          </Text>
        </View>

        {erreur ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
            {erreur}
          </Text>
        ) : null}
      </ScrollView>

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
        <Bouton
          libelle="Continuer"
          variante="primaire"
          onPress={() => router.push('/(onboarding)/devenir-coach-recapitulatif')}
          desactive={!toutesDeposees}
        />
        {!toutesDeposees ? (
          <Text
            style={{
              ...theme.texte.petit,
              color: theme.couleur.texte.attenue,
              textAlign: 'center',
            }}
          >
            {libelleManquant(deposees)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
