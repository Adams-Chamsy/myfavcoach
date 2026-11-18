import { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { DefilementEcran } from '@/composants/canevas-ecran';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { ExerciceProgramme, SeanceResume } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { semaineEtJour } from './textes';

export function ApercuProgramme({
  titre,
  semaines,
  seances,
  onFermer,
}: {
  titre: string;
  semaines: number;
  seances: SeanceResume[];
  onFermer: () => void;
}) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const [selection, setSelection] = useState<string | null>(null);
  const seance = seances.find((s) => s.id === selection);
  const corps = { ...theme.texte.corps, color: theme.couleur.texte.principal };
  const petit = { ...theme.texte.petit, color: theme.couleur.texte.secondaire };

  return (
    <View style={{ gap: theme.espace[3], maxHeight: height * 0.7 }}>
      <Text accessibilityRole="header" style={{ ...corps, ...theme.texte.titre3 }}>
        Aperçu client
      </Text>
      <Text style={corps}>{titre.trim() || 'Programme sans titre'}</Text>
      <Text style={petit}>{semaines === 1 ? '1 semaine' : `${semaines} semaines`}</Text>
      <DefilementEcran contentContainerStyle={{ gap: theme.espace[3] }}>
        {seance ? (
          <DetailApercuSeance key={seance.id} seance={seance} />
        ) : seances.length ? (
          [...seances]
            .sort((a, b) => a.jourRelatif - b.jourRelatif)
            .map((s) => (
              <Bouton
                key={s.id}
                variante="secondaire"
                libelle={`Semaine ${semaineEtJour(s.jourRelatif).semaine}, jour ${semaineEtJour(s.jourRelatif).jour + 1} · ${s.titre || 'Séance sans titre'}`}
                onPress={() => setSelection(s.id)}
              />
            ))
        ) : (
          <Text style={petit}>Aucune séance dans ce programme.</Text>
        )}
      </DefilementEcran>
      <Bouton
        libelle={seance ? 'Toutes les séances' : 'Revenir au programme'}
        variante="secondaire"
        onPress={seance ? () => setSelection(null) : onFermer}
      />
    </View>
  );
}

function DetailApercuSeance({ seance }: { seance: SeanceResume }) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [exercices, setExercices] = useState<ExerciceProgramme[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [tentative, setTentative] = useState(0);

  useEffect(() => {
    let actif = true;
    void port.lireExercices(seance.id).then(
      (lus) => {
        if (actif) setExercices(lus);
      },
      () => {
        if (actif) setErreur(true);
      },
    );
    return () => {
      actif = false;
    };
  }, [port, seance.id, tentative]);

  const titre = { ...theme.texte.label, color: theme.couleur.texte.principal };
  const detail = { ...theme.texte.petit, color: theme.couleur.texte.secondaire };

  return (
    <View style={{ gap: theme.espace[3] }}>
      <Text accessibilityRole="header" style={titre}>
        {seance.titre || 'Séance sans titre'}
      </Text>
      <Text style={detail}>{`${seance.dureeMinutes} min`}</Text>
      {erreur ? (
        <EtatErreur
          titre="Impossible de charger les exercices"
          explication="Réessaie dans un instant."
          nombreEchecs={0}
          onReessayer={() => {
            setErreur(false);
            setTentative((n) => n + 1);
          }}
        />
      ) : exercices === null ? (
        <Squelette forme="ligne" />
      ) : exercices.length === 0 ? (
        <Text style={detail}>Aucun exercice dans cette séance.</Text>
      ) : (
        exercices.map((e) => {
          const indications = [
            e.series === null ? null : `${e.series} ${e.series === 1 ? 'série' : 'séries'}`,
            e.repetitions === null ? null : `${e.repetitions} rép.`,
            e.chargeGrammes === null
              ? null
              : `${(e.chargeGrammes / 1000).toLocaleString('fr-FR')} kg`,
          ].filter(Boolean);
          return (
            <View key={e.id} style={{ gap: theme.espace[1] }}>
              <Text style={titre}>{e.nom}</Text>
              {indications.length ? <Text style={detail}>{indications.join(' · ')}</Text> : null}
              {e.consigne ? <Text style={detail}>{e.consigne}</Text> : null}
              {e.media ? <Text style={detail}>Démonstration jointe</Text> : null}
            </View>
          );
        })
      )}
    </View>
  );
}
