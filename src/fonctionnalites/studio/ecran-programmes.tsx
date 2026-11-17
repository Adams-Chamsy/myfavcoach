import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { ProgrammeResume } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { BandeauRefus } from './bandeau-refus';
import { ecouterStudioModifie } from './studio-modifie';
import { LIBELLES_STATUT_PROGRAMME, SANS_REPONSE, texteRefus, type TexteRefus } from './textes';

// docs/ecrans/L6-11-studio.md, « Mes programmes ».
export type ProprietesEcranProgrammes = {
  onRetour: () => void;
  onOuvrirProgramme: (programmeId: string) => void;
  onOuvrirBibliotheque: () => void;
  // Entrée « Nouvelle séance » de la feuille Créer : une séance s'ajoute dans un programme.
  choixPourSeance?: boolean;
  // Entrée « Nouveau programme » : le brouillon se crée à l'arrivée, puis s'ouvre.
  creerAuMontage?: boolean;
};

export function EcranProgrammes({
  onRetour,
  onOuvrirProgramme,
  onOuvrirBibliotheque,
  choixPourSeance = false,
  creerAuMontage = false,
}: ProprietesEcranProgrammes) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();
  const [programmes, setProgrammes] = useState<ProgrammeResume[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [cleTentative, setCleTentative] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<TexteRefus | null>(null);

  useEffect(() => {
    let monte = true;
    port
      .lireMesProgrammes()
      .then((lus) => {
        if (!monte) return;
        setProgrammes(lus);
        setErreur(false);
      })
      .catch(() => {
        if (monte) setErreur(true);
      });
    return () => {
      monte = false;
    };
  }, [port, cleTentative]);

  // Retour d'un programme modifié : la liste, restée dessous, relit.
  useEffect(() => ecouterStudioModifie(() => setCleTentative((c) => c + 1)), []);

  const creationFaite = useRef(false);
  useEffect(() => {
    if (!creerAuMontage || creationFaite.current) return;
    creationFaite.current = true;
    void nouveauProgramme();
    // Une seule fois, à l'arrivée.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nouveauProgramme change à chaque rendu ; seule l'arrivée compte
  }, [creerAuMontage]);

  async function nouveauProgramme() {
    if (envoi) return;
    setEnvoi(true);
    setRefus(null);
    const resultat = await port.creerProgramme();
    setEnvoi(false);
    if (resultat.issue === 'ok') onOuvrirProgramme(resultat.valeur);
    else setRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
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
          style={{ ...theme.texte.titre2, flex: 1, color: theme.couleur.texte.principal }}
        >
          Studio
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onOuvrirBibliotheque}
          style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
        >
          <Text style={{ ...theme.texte.label, color: theme.couleur.marque.primaire }}>
            Bibliothèque
          </Text>
        </Pressable>
      </View>
      <DefilementEcran
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: insets.bottom + theme.espace[6],
          gap: theme.espace[3],
        }}
      >
        {choixPourSeance ? (
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
            Une séance s’ajoute dans un programme. Choisis-le.
          </Text>
        ) : null}
        {programmes === null && !erreur ? <Squelette forme="carte" /> : null}
        {erreur ? (
          <EtatErreur
            titre={textesRepliErreur.serveur.titre}
            explication={textesRepliErreur.serveur.explication}
            nombreEchecs={0}
            onReessayer={() => {
              setErreur(false);
              setProgrammes(null);
              setCleTentative((c) => c + 1);
            }}
          />
        ) : null}
        {programmes?.length === 0 ? (
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
            Aucun programme pour l’instant.
          </Text>
        ) : null}
        {programmes?.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.titre || 'Sans titre'}, ${LIBELLES_STATUT_PROGRAMME[p.statut]}`}
            onPress={() => onOuvrirProgramme(p.id)}
            style={{
              minHeight: theme.taille.tapMin,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.espace[3],
              paddingVertical: theme.espace[3],
              borderBottomWidth: theme.taille.bordureFine,
              borderBottomColor: theme.couleur.bordure.discrete,
            }}
          >
            <View style={{ flex: 1, gap: theme.espace[1] }}>
              <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                {p.titre || 'Sans titre'}
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {`${p.dureeSemaines} ${p.dureeSemaines > 1 ? 'semaines' : 'semaine'} · ${p.nombreSeances} ${p.nombreSeances > 1 ? 'séances' : 'séance'} · ${LIBELLES_STATUT_PROGRAMME[p.statut]}`}
              </Text>
            </View>
            <Icone nom="suivant" couleur={theme.couleur.texte.secondaire} />
          </Pressable>
        ))}
        {refus ? <BandeauRefus refus={refus} /> : null}
        {programmes !== null ? (
          <Bouton
            libelle={envoi ? 'Envoi en cours…' : 'Nouveau programme'}
            variante="primaire"
            icone="ajouter"
            desactive={envoi}
            onPress={() => void nouveauProgramme()}
          />
        ) : null}
      </DefilementEcran>
    </CanevasEcran>
  );
}
