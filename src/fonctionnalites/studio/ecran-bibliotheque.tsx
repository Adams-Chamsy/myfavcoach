import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { MediaBibliotheque } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { BandeauRefus } from './bandeau-refus';
import { signalerStudioModifie } from './studio-modifie';
import { libelleTypeMedia } from './ecran-seance';
import { SANS_REPONSE, texteRefus, type TexteRefus } from './textes';

// docs/ecrans/L6-11-studio.md, « Bibliothèque ». Le type et le poids sont vérifiés ici pour un
// message immédiat, puis de nouveau par le dossier et par le serveur (0082, 0083), qui décident.
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf'];
const POIDS_MAX = 50 * 1024 * 1024;

export type ChoisirFichier = () => Promise<{
  uri: string;
  nom: string;
  typeMime: string;
  poidsOctets: number;
} | null>;

// Le sélecteur de fichiers du téléphone (expo-document-picker, déjà dans le projet).
export const choisirFichierParDefaut: ChoisirFichier = async () => {
  const resultat = await DocumentPicker.getDocumentAsync({
    type: TYPES_ACCEPTES,
    copyToCacheDirectory: true,
  });
  if (resultat.canceled) return null;
  const fichier = resultat.assets[0];
  if (!fichier) return null;
  return {
    uri: fichier.uri,
    nom: fichier.name,
    typeMime: fichier.mimeType ?? 'application/octet-stream',
    poidsOctets: fichier.size ?? 0,
  };
};

export function poidsLisible(octets: number): string {
  return octets >= 1024 * 1024
    ? `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
    : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

export type ProprietesEcranBibliotheque = {
  onRetour: () => void;
  choisirFichier?: ChoisirFichier;
};

export function EcranBibliotheque({
  onRetour,
  choisirFichier = choisirFichierParDefaut,
}: ProprietesEcranBibliotheque) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();
  const [medias, setMedias] = useState<MediaBibliotheque[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [cleTentative, setCleTentative] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<TexteRefus | null>(null);
  const relire = useCallback(() => setCleTentative((c) => c + 1), []);

  useEffect(() => {
    let monte = true;
    port
      .lireMesMedias()
      .then((lus) => {
        if (!monte) return;
        setMedias(lus);
        setErreur(false);
      })
      .catch(() => {
        if (monte) setErreur(true);
      });
    return () => {
      monte = false;
    };
  }, [port, cleTentative]);

  async function ajouter() {
    if (envoi) return;
    setRefus(null);
    const fichier = await choisirFichier();
    if (!fichier) return;
    if (!TYPES_ACCEPTES.includes(fichier.typeMime)) {
      setRefus({
        titre: 'Ce type de fichier n’est pas accepté.',
        detail: 'Images JPEG ou PNG, vidéos MP4 ou PDF.',
      });
      return;
    }
    if (fichier.poidsOctets > POIDS_MAX) {
      setRefus({
        titre: 'Ce fichier est trop lourd (50 Mo au plus).',
        detail: 'Choisis-en un plus léger.',
      });
      return;
    }
    setEnvoi(true);
    const resultat = await port.deposerMedia(fichier);
    setEnvoi(false);
    if (resultat.issue === 'ok') {
      signalerStudioModifie();
      relire();
    } else setRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
  }

  async function supprimer(id: string) {
    if (envoi) return;
    setEnvoi(true);
    setRefus(null);
    const resultat = await port.supprimerMedia(id);
    setEnvoi(false);
    if (resultat.issue === 'ok') {
      signalerStudioModifie();
      relire();
    } else setRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
  }

  return (
    <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <View
        style={{
          paddingTop: insets.top + theme.espace[2],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.espace[3],
        }}
      >
        <BoutonIcone nom="retour" accessibilityLabel="Retour" onPress={onRetour} />
        <Text
          accessibilityRole="header"
          style={{ ...theme.texte.titre3, flex: 1, color: theme.couleur.texte.principal }}
        >
          Bibliothèque
        </Text>
      </View>
      <DefilementEcran
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: insets.bottom + theme.espace[6],
          gap: theme.espace[3],
        }}
      >
        {medias === null && !erreur ? <Squelette forme="liste" /> : null}
        {erreur ? (
          <EtatErreur
            titre={textesRepliErreur.serveur.titre}
            explication={textesRepliErreur.serveur.explication}
            nombreEchecs={0}
            onReessayer={() => {
              setErreur(false);
              relire();
            }}
          />
        ) : null}
        {medias?.length === 0 ? (
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
            Aucun média pour l’instant.
          </Text>
        ) : null}
        {medias?.map((m) => (
          <View
            key={m.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.espace[3],
              paddingVertical: theme.espace[2],
              borderBottomWidth: theme.taille.bordureFine,
              borderBottomColor: theme.couleur.bordure.discrete,
            }}
          >
            <View style={{ flex: 1, gap: theme.espace[1] }}>
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                {m.nomFichier}
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {`${libelleTypeMedia(m.typeMime)} · ${poidsLisible(m.poidsOctets)}`}
              </Text>
            </View>
            <Bouton
              libelle="Supprimer"
              variante="discret"
              accessibilityLabel={`Supprimer ${m.nomFichier}`}
              desactive={envoi}
              onPress={() => void supprimer(m.id)}
            />
          </View>
        ))}
        {refus ? <BandeauRefus refus={refus} /> : null}
        {medias !== null ? (
          <Bouton
            libelle={envoi ? 'Envoi en cours…' : 'Ajouter un média'}
            variante="primaire"
            icone="ajouter"
            desactive={envoi}
            onPress={() => void ajouter()}
          />
        ) : null}
      </DefilementEcran>
    </CanevasEcran>
  );
}
