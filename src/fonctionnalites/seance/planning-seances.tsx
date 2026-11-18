import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { Carte } from '@/composants/carte';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { Squelette } from '@/composants/squelette';
import { dateLongue } from '@/fonctionnalites/factures/format';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { SeancePlanning } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { ecouterSeanceModifiee } from './seance-modifiee';

export function PlanningSeances({ onOuvrir }: { onOuvrir: (id: string) => void }) {
  const { port } = useDonnees();
  const theme = useTheme();
  const [seances, setSeances] = useState<SeancePlanning[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [tentative, setTentative] = useState(0);

  useEffect(() => {
    const relire = () => setTentative((n) => n + 1);
    const retirer = ecouterSeanceModifiee(relire);
    const abonnement = AppState.addEventListener('change', (statut) => {
      if (statut === 'active') relire();
    });
    return () => {
      retirer();
      abonnement.remove();
    };
  }, []);

  useEffect(() => {
    let actif = true;
    void port.lireMonPlanningSeances().then(
      (lus) => {
        if (!actif) return;
        setSeances(lus);
        setErreur(false);
      },
      () => {
        if (actif) setErreur(true);
      },
    );
    return () => {
      actif = false;
    };
  }, [port, tentative]);

  const titres = { ...theme.texte.titre3, color: theme.couleur.texte.principal };
  const detail = { ...theme.texte.petit, color: theme.couleur.texte.secondaire };
  const groupes = [
    {
      titre: 'À rattraper',
      seances: seances?.filter((s) => s.aRattraperAvant),
      vide: 'Aucune séance à rattraper.',
    },
    {
      titre: 'À venir',
      seances: seances?.filter((s) => !s.aRattraperAvant),
      vide: 'Aucune séance dans les 14 prochains jours.',
    },
  ];

  if (erreur) {
    return (
      <EtatErreur
        titre="Impossible de charger ton planning"
        explication="Réessaie dans un instant."
        nombreEchecs={0}
        onReessayer={() => setTentative((n) => n + 1)}
      />
    );
  }

  return (
    <View style={{ gap: theme.espace[4] }}>
      {groupes.map((groupe) => (
        <View key={groupe.titre} style={{ gap: theme.espace[2] }}>
          <Text accessibilityRole="header" style={titres}>
            {groupe.titre}
          </Text>
          {!groupe.seances ? (
            <Squelette forme="ligne" />
          ) : groupe.seances.length === 0 ? (
            <Text style={detail}>{groupe.vide}</Text>
          ) : (
            groupe.seances.map((seance) => (
              <Carte key={seance.id}>
                <View style={{ gap: theme.espace[1], padding: theme.espace[3] }}>
                  <Text style={titres}>{seance.titre || 'Séance'}</Text>
                  <Text style={detail}>
                    {`${dateLongue(seance.datePrevue)} · ${seance.dureeMinutes} min · avec ${seance.coachPrenom} ${seance.coachNom}`}
                  </Text>
                  {seance.aRattraperAvant ? (
                    <>
                      <Text style={detail}>
                        {`Rattrapable jusqu’au ${dateLongue(seance.aRattraperAvant)}`}
                      </Text>
                      <Bouton
                        libelle="Rattraper"
                        accessibilityLabel={`Rattraper ${seance.titre || 'la séance'}`}
                        variante="secondaire"
                        onPress={() => onOuvrir(seance.id)}
                      />
                    </>
                  ) : null}
                </View>
              </Carte>
            ))
          )}
        </View>
      ))}
    </View>
  );
}
