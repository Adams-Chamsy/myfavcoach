import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Squelette } from '@/composants/squelette';
import {
  TITRES_DOCUMENTS,
  VERSIONS_DOCUMENTS,
  VERSION_CGU_ACCEPTEE,
  formaterVersionDocument,
  type TypeDocumentLegal,
} from '@/fonctionnalites/identite/documents-legaux';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';

type LigneDocument = {
  type: TypeDocumentLegal;
  // true : "Version X · acceptée le {date}" (comparé à la version courante pour le bandeau).
  // false : "mise à jour le {date}", simple information, aucune comparaison de version.
  acceptee: boolean;
};

const DOCUMENTS_TOUJOURS: LigneDocument[] = [
  { type: 'cgu', acceptee: true },
  { type: 'cgv', acceptee: true },
  { type: 'confidentialite', acceptee: false },
];

function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

// L2-03 (C-06), surface authentifiée : liste des documents avec la version ACCEPTÉE PAR CE
// COMPTE (contrairement à la surface publique, qui ne parle jamais d'acceptation). Le chevron
// de chaque ligne réutilise le lecteur public pour l'affichage (fiche, "Deux surfaces, pas
// une") — jamais un second lecteur dupliqué ici.
export default function Documents() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port, profils } = useDonnees();

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [dates, setDates] = useState<{ cguVersionAcceptee: string; creeLe: string } | null>(null);

  useEffect(() => {
    let monte = true;
    port
      .lireDatesDocuments()
      .then((d) => {
        if (monte) {
          setDates(d);
          setChargement(false);
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
  }, [port]);

  const coachExiste = profils?.coachExiste ?? false;
  const lignes: LigneDocument[] = coachExiste
    ? [...DOCUMENTS_TOUJOURS, { type: 'contrat-coach', acceptee: false }]
    : DOCUMENTS_TOUJOURS;

  // Bandeau : comparaison comptes.cgu_version_acceptee (ce que ce compte a accepté) contre la
  // version courante (fiche, "Le bandeau de mise à jour est un cas que le schéma sait déjà
  // détecter"). CGU et CGV partagent la même colonne d'acceptation (docs/dette.md), d'où un
  // bandeau unique nommant les deux plutôt qu'un par document.
  const versionAChange = dates != null && dates.cguVersionAcceptee !== VERSION_CGU_ACCEPTEE;

  function ouvrirDocument(type: TypeDocumentLegal) {
    router.push(`/(public)/documents/${type}` as Href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.espace[3],
          paddingTop: insets.top + theme.espace[2],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[3],
        }}
      >
        <BoutonIcone nom="retour" accessibilityLabel="Retour" onPress={() => router.back()} />
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          Documents.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: insets.bottom + theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
          Tout ce que tu as accepté, avec la version exacte en vigueur au moment où tu l’as fait.
        </Text>

        {chargement ? (
          <Squelette forme="liste" />
        ) : erreur ? (
          <EtatErreur
            titre={textesRepliErreur.serveur.titre}
            explication={textesRepliErreur.serveur.explication}
            nombreEchecs={0}
            onReessayer={() => {}}
            onNousEcrire={() => {}}
          />
        ) : (
          <>
            {versionAChange ? (
              <View
                style={{
                  gap: theme.espace[3],
                  padding: theme.espace[4],
                  borderRadius: theme.rayon.carte,
                  backgroundColor: theme.couleur.etat.alerteTeinte,
                  borderWidth: 1,
                  borderColor: theme.couleur.bordure.discrete,
                }}
              >
                <Text
                  style={{ ...theme.texte.actionAccent, color: theme.couleur.etat.alerteEncre }}
                >
                  Les CGU et les CGV ont été mises à jour. Lis ce qui change avant de continuer.
                </Text>
                <Bouton
                  libelle="Voir ce qui change"
                  variante="secondaire"
                  onPress={() => ouvrirDocument('cgu')}
                />
              </View>
            ) : null}

            <View
              style={{
                borderRadius: theme.rayon.carte,
                borderWidth: 1,
                borderColor: theme.couleur.bordure.discrete,
              }}
            >
              {lignes.map((ligne, index) => (
                <View key={ligne.type}>
                  {index > 0 ? (
                    <View style={{ height: 1, backgroundColor: theme.couleur.bordure.discrete }} />
                  ) : null}
                  <Pressable
                    onPress={() => ouvrirDocument(ligne.type)}
                    accessibilityRole="button"
                    accessibilityLabel={TITRES_DOCUMENTS[ligne.type]}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.espace[3],
                      paddingHorizontal: theme.espace[4],
                      paddingVertical: theme.espace[4],
                      minHeight: theme.taille.tapMin,
                    }}
                  >
                    <Icone nom="document" couleur={theme.couleur.texte.secondaire} />
                    <View style={{ flex: 1, gap: theme.espace[1] }}>
                      <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                        {TITRES_DOCUMENTS[ligne.type]}
                      </Text>
                      <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                        {ligne.acceptee && dates
                          ? `Version ${formaterVersionDocument(dates.cguVersionAcceptee)} · acceptée le ${formaterDate(dates.creeLe)}`
                          : `Mise à jour le ${formaterVersionDocument(VERSIONS_DOCUMENTS[ligne.type])}`}
                      </Text>
                    </View>
                    <Icone nom="suivant" couleur={theme.couleur.texte.attenue} />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
