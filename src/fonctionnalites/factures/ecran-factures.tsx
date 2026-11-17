import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Onglets } from '@/composants/onglets';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { FactureCommission, FactureResume } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { dateCourte, dateLongue, euros, majuscule } from './format';

// docs/ecrans/L5-C05-factures-recus.md, la liste. Selon l'espace actif : le client lit ses
// achats ; le coach ses ventes (avec la commission) et, dans un second onglet, les factures de
// commission de la plateforme. Tout vient du serveur.

export type ProprietesEcranFactures = {
  onRetour: () => void;
  onOuvrirFacture: (factureId: string) => void;
};

type Lecture =
  | { type: 'lecture' }
  | { type: 'erreur' }
  | { type: 'pret'; factures: FactureResume[]; commission: FactureCommission[] };

export function EcranFactures({ onRetour, onOuvrirFacture }: ProprietesEcranFactures) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port, profils } = useDonnees();
  const coach = profils?.profilActif === 'coach';
  const [lecture, setLecture] = useState<Lecture>({ type: 'lecture' });
  const [cleTentative, setCleTentative] = useState(0);
  const [onglet, setOnglet] = useState<'ventes' | 'commission'>('ventes');

  useEffect(() => {
    let monte = true;
    void Promise.all([
      port.lireFactures(),
      coach ? port.lireFacturesCommission() : Promise.resolve([]),
    ])
      .then(([factures, commission]) => {
        if (monte) setLecture({ type: 'pret', factures, commission });
      })
      .catch(() => {
        if (monte) setLecture({ type: 'erreur' });
      });
    return () => {
      monte = false;
    };
  }, [port, coach, cleTentative]);

  const vide = (
    <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
      Aucune facture pour l’instant.
    </Text>
  );
  const ligneStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.espace[3],
    paddingVertical: theme.espace[3],
    borderBottomWidth: theme.taille.bordureFine,
    borderBottomColor: theme.couleur.bordure.discrete,
  };

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
          Mes factures
        </Text>
      </View>
      <DefilementEcran
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: insets.bottom + theme.espace[6],
          gap: theme.espace[3],
        }}
      >
        {coach ? (
          <Onglets
            options={[
              { valeur: 'ventes', libelle: 'Mes ventes' },
              { valeur: 'commission', libelle: 'Commission' },
            ]}
            valeurActive={onglet}
            onChangement={setOnglet}
          />
        ) : null}
        {lecture.type === 'lecture' ? <Squelette forme="carte" /> : null}
        {lecture.type === 'erreur' ? (
          <EtatErreur
            titre={textesRepliErreur.serveur.titre}
            explication={textesRepliErreur.serveur.explication}
            nombreEchecs={0}
            onReessayer={() => {
              setLecture({ type: 'lecture' });
              setCleTentative((c) => c + 1);
            }}
          />
        ) : null}
        {lecture.type === 'pret' && (!coach || onglet === 'ventes')
          ? lecture.factures.length === 0
            ? vide
            : lecture.factures.map((f) => (
                <Pressable
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Facture ${f.numero}, ${f.libelle}, ${euros(f.montantTtcCentimes)}`}
                  onPress={() => onOuvrirFacture(f.id)}
                  style={{ ...ligneStyle, minHeight: theme.taille.tapMin }}
                >
                  <View style={{ flex: 1, gap: theme.espace[1] }}>
                    <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                      {f.libelle}
                    </Text>
                    <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                      {`${f.autrePartie} · du ${dateCourte(f.periodeDu)} au ${dateCourte(f.periodeAu)}`}
                    </Text>
                    <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                      {f.commissionCentimes === null
                        ? `Payée le ${dateLongue(f.payeeLe)}`
                        : `Payée le ${dateLongue(f.payeeLe)} · commission ${euros(f.commissionCentimes)}`}
                    </Text>
                  </View>
                  <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                    {euros(f.montantTtcCentimes)}
                  </Text>
                  <Icone nom="suivant" couleur={theme.couleur.texte.secondaire} />
                </Pressable>
              ))
          : null}
        {lecture.type === 'pret' && coach && onglet === 'commission'
          ? lecture.commission.length === 0
            ? vide
            : lecture.commission.map((c) => (
                <View key={c.id} style={ligneStyle}>
                  <View style={{ flex: 1, gap: theme.espace[1] }}>
                    <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                      {majuscule(
                        new Date(`${c.mois}T12:00:00Z`).toLocaleDateString('fr-FR', {
                          timeZone: 'Europe/Paris',
                          month: 'long',
                          year: 'numeric',
                        }),
                      )}
                    </Text>
                    <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                      {`Facture n° ${c.numero} · ${c.nombreLignes} ${c.nombreLignes > 1 ? 'paiements' : 'paiement'}`}
                    </Text>
                  </View>
                  <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                    {euros(c.montantTtcCentimes)}
                  </Text>
                </View>
              ))
          : null}
      </DefilementEcran>
    </CanevasEcran>
  );
}
