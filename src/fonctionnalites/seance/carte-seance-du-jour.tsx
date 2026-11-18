import { type ReactNode, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { Carte } from '@/composants/carte';
import { Icone } from '@/composants/icones';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { SeanceDuJour } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { ecouterSeanceModifiee } from './seance-modifiee';

// docs/ecrans/L6-05-seance-du-jour.md, « Le bloc de l'accueil ». Une carte par séance du jour,
// rendue par le serveur ; aucune : aucune carte (l'absence est l'état honnête), une lecture en
// échec non plus. Présentation : la « Carte séance » de la galerie (maquettes, System 01).
export function CarteSeanceDuJour({
  onOuvrir,
  siAucune = null,
}: {
  onOuvrir: (id: string) => void;
  // Rendu une fois la lecture faite, s'il n'y a aucune séance aujourd'hui (onglet Séance).
  siAucune?: ReactNode;
}) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [seances, setSeances] = useState<SeanceDuJour[] | null>(null);

  const [cleTentative, setCleTentative] = useState(0);
  // Retour d'une séance commencée ou terminée : la carte, restée dessous, relit.
  useEffect(() => ecouterSeanceModifiee(() => setCleTentative((c) => c + 1)), []);

  useEffect(() => {
    let monte = true;
    port
      .lireSeancesDuJour()
      .then((lues) => {
        if (monte) setSeances(lues);
      })
      .catch(() => {});
    return () => {
      monte = false;
    };
  }, [port, cleTentative]);

  if (seances === null) return null;
  if (seances.length === 0) return <>{siAucune}</>;
  return (
    <View style={{ gap: theme.espace[2] }}>
      <Text
        accessibilityRole="header"
        style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}
      >
        Ta séance du jour
      </Text>
      {seances.map((s) => (
        <Carte key={s.id}>
          <View style={{ padding: theme.espace[4], gap: theme.espace[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}>
              <View
                style={{
                  width: theme.taille.avatarLg,
                  height: theme.taille.avatarLg,
                  borderRadius: theme.rayon.saisie,
                  backgroundColor: theme.couleur.marque.primaireTeinte,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icone nom="seance" couleur={theme.couleur.marque.primaire} />
              </View>
              <View style={{ flex: 1, gap: theme.espace[1] }}>
                <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                  {s.titre || 'Séance'}
                </Text>
                <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                  {`${s.nombreExercices} ${s.nombreExercices > 1 ? 'exercices' : 'exercice'} · ${s.dureeMinutes} min · avec ${s.coachPrenom} ${s.coachNom}`}
                </Text>
              </View>
            </View>
            {s.statut === 'faite' ? (
              <Text style={{ ...theme.texte.label, color: theme.couleur.marque.primaire }}>
                Faite
              </Text>
            ) : (
              <Bouton
                libelle={s.statut === 'en_cours' ? 'Reprendre' : 'Commencer'}
                variante="primaire"
                accessibilityLabel={`${s.statut === 'en_cours' ? 'Reprendre' : 'Commencer'} ${s.titre || 'la séance'}`}
                onPress={() => onOuvrir(s.id)}
              />
            )}
          </View>
        </Carte>
      ))}
    </View>
  );
}
