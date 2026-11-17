import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { Carte } from '@/composants/carte';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { FactureDetail } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { dateCourte, dateLongue, euros } from './format';

// docs/ecrans/L5-C05-factures-recus.md, une facture, avec toutes ses mentions. Le serveur rend
// HT et TVA ; l'écran ne calcule rien. La commission n'arrive que pour le coach (ma_facture,
// 0075). Mentions à faire valider par le juriste (docs/perimetre.md §6).

export type ProprietesEcranFacture = {
  factureId: string;
  onRetour: () => void;
};

type Lecture =
  | { type: 'lecture' }
  | { type: 'erreur' }
  | { type: 'introuvable' }
  | { type: 'pret'; facture: FactureDetail };

export function EcranFacture({ factureId, onRetour }: ProprietesEcranFacture) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();
  const [lecture, setLecture] = useState<Lecture>({ type: 'lecture' });
  const [cleTentative, setCleTentative] = useState(0);

  useEffect(() => {
    let monte = true;
    void port
      .lireFacture(factureId)
      .then((facture) => {
        if (monte) setLecture(facture ? { type: 'pret', facture } : { type: 'introuvable' });
      })
      .catch(() => {
        if (monte) setLecture({ type: 'erreur' });
      });
    return () => {
      monte = false;
    };
  }, [port, factureId, cleTentative]);

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
          {lecture.type === 'pret' ? `Facture n° ${lecture.facture.numero}` : 'Facture'}
        </Text>
      </View>
      <DefilementEcran
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: insets.bottom + theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        {lecture.type === 'lecture' ? <Squelette forme="detail" /> : null}
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
        {lecture.type === 'introuvable' ? (
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
            Cette facture est introuvable.
          </Text>
        ) : null}
        {lecture.type === 'pret' ? <Mentions facture={lecture.facture} /> : null}
      </DefilementEcran>
    </CanevasEcran>
  );
}

function Mentions({ facture: f }: { facture: FactureDetail }) {
  const theme = useTheme();
  const t = (contenu: string, style: keyof typeof theme.texte = 'corps', secondaire = false) => (
    <Text
      style={{
        ...theme.texte[style],
        color: secondaire ? theme.couleur.texte.secondaire : theme.couleur.texte.principal,
      }}
    >
      {contenu}
    </Text>
  );
  const vendeur = `${f.vendeurPrenom} ${f.vendeurNom}`;
  const client = [f.clientPrenom, f.clientNom].filter(Boolean).join(' ');
  const franchise = f.vendeurRegimeTva === 'franchise_en_base';
  const assujetti =
    f.vendeurRegimeTva === 'assujetti' && f.montantHtCentimes !== null && f.tvaCentimes !== null;

  return (
    <View style={{ gap: theme.espace[4] }}>
      {t(`Émise le ${dateLongue(f.emiseLe)} · payée le ${dateLongue(f.payeeLe)}`, 'petit', true)}

      <Carte>
        <View style={{ padding: theme.espace[4], gap: theme.espace[1] }}>
          {t('Vendeur', 'label', true)}
          {t(vendeur, 'titre3')}
          {f.vendeurSiren ? t(`SIREN ${f.vendeurSiren}`) : null}
          {f.vendeurAdresse ? t(f.vendeurAdresse) : null}
          {!f.vendeurSiren
            ? t('Mentions fiscales du vendeur absentes (facture de test).', 'petit', true)
            : null}
        </View>
      </Carte>

      <Carte>
        <View style={{ padding: theme.espace[4], gap: theme.espace[1] }}>
          {t('Client', 'label', true)}
          {t(client, 'titre3')}
        </View>
      </Carte>

      {t(`Facture émise par My Fav Coach au nom et pour le compte de ${vendeur}.`, 'petit', true)}

      <Carte>
        <View style={{ padding: theme.espace[4], gap: theme.espace[3] }}>
          {t('Objet', 'label', true)}
          {t(f.libelle, 'titre3')}
          {t(`Du ${dateCourte(f.periodeDu)} au ${dateLongue(f.periodeAu)}`, 'petit', true)}
          <View
            style={{
              height: theme.taille.bordureFine,
              backgroundColor: theme.couleur.bordure.discrete,
            }}
          />
          {assujetti ? (
            <>
              <Ligne libelle="Total HT" valeur={euros(f.montantHtCentimes as number)} />
              <Ligne
                libelle={`TVA (${((f.vendeurTauxTvaPourMille ?? 0) / 10).toLocaleString('fr-FR')} %)`}
                valeur={euros(f.tvaCentimes as number)}
              />
              <Ligne libelle="Total TTC" valeur={euros(f.montantTtcCentimes)} fort />
            </>
          ) : franchise ? (
            <>
              <Ligne libelle="Total" valeur={euros(f.montantTtcCentimes)} fort />
              {t('TVA non applicable, art. 293 B du CGI', 'petit', true)}
            </>
          ) : (
            <Ligne libelle="Total TTC" valeur={euros(f.montantTtcCentimes)} fort />
          )}
        </View>
      </Carte>

      {f.commissionCentimes !== null ? (
        <Carte>
          <View style={{ padding: theme.espace[4] }}>
            <Ligne libelle="Commission de la plateforme" valeur={euros(f.commissionCentimes)} />
          </View>
        </Carte>
      ) : null}
    </View>
  );
}

function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  const theme = useTheme();
  const style = fort ? theme.texte.titre3 : theme.texte.corps;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.espace[2] }}>
      <Text style={{ ...style, flex: 1, color: theme.couleur.texte.principal }}>{libelle}</Text>
      <Text style={{ ...style, color: theme.couleur.texte.principal }}>{valeur}</Text>
    </View>
  );
}
