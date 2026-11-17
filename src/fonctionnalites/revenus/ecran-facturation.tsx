import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { IdentiteFiscale, RefusServeur } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { signalerFacturationEnregistree } from './facturation-enregistree';

// docs/ecrans/L5-13-revenus.md, « Formulaire — informations de facturation ». L'identité fiscale
// du coach : ce qui figure sur les factures émises en son nom (docs/domaine.md §3.2, §3.5). La
// forme est vérifiée par le serveur (clé du SIREN, code postal, régime et taux, 0070), qui
// refuse avec un texte ; l'écran ne valide rien lui-même.

export type ProprietesEcranFacturation = {
  onRetour: () => void;
  // Enregistré : retour à Revenus, qui relit.
  onEnregistre: () => void;
};

type Regime = IdentiteFiscale['regimeTva'];

// « 20 » pour 20 % ; le serveur reçoit des pour mille (200). Une virgule est acceptée.
function versPourMille(texte: string): number | null {
  const nombre = Number(texte.trim().replace(',', '.'));
  return texte.trim() === '' || !Number.isFinite(nombre) ? null : Math.round(nombre * 10);
}

export function EcranFacturation({ onRetour, onEnregistre }: ProprietesEcranFacturation) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();
  const [lecture, setLecture] = useState<'lecture' | 'erreur' | 'pret'>('lecture');
  const [cleTentative, setCleTentative] = useState(0);
  const [siren, setSiren] = useState('');
  const [adresse, setAdresse] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [commune, setCommune] = useState('');
  const [regime, setRegime] = useState<Regime | null>(null);
  const [taux, setTaux] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<RefusServeur | 'sans_reponse' | null>(null);
  const verrou = useRef(false);

  useEffect(() => {
    let monte = true;
    void port
      .lireMonIdentiteFiscale()
      .then((identite) => {
        if (!monte) return;
        if (identite) {
          setSiren(identite.siren);
          setAdresse(identite.adresseLigne);
          setCodePostal(identite.codePostal);
          setCommune(identite.commune);
          setRegime(identite.regimeTva);
          setTaux(
            identite.tauxTvaPourMille === null
              ? ''
              : (identite.tauxTvaPourMille / 10).toLocaleString('fr-FR'),
          );
        }
        setLecture('pret');
      })
      .catch(() => {
        if (monte) setLecture('erreur');
      });
    return () => {
      monte = false;
    };
  }, [port, cleTentative]);

  async function enregistrer() {
    if (regime === null || verrou.current) return;
    verrou.current = true;
    setEnvoi(true);
    setRefus(null);
    try {
      const resultat = await port.enregistrerIdentiteFiscale({
        siren: siren.replace(/\s/g, ''),
        adresseLigne: adresse,
        codePostal: codePostal.trim(),
        commune,
        regimeTva: regime,
        tauxTvaPourMille: regime === 'assujetti' ? versPourMille(taux) : null,
      });
      if (resultat.issue === 'ok') {
        signalerFacturationEnregistree();
        onEnregistre();
        return;
      }
      setRefus(resultat.issue === 'refusee' ? resultat.refus : 'sans_reponse');
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
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
          Informations de facturation
        </Text>
      </View>

      <DefilementEcran
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        {lecture === 'lecture' ? <Squelette forme="detail" /> : null}
        {lecture === 'erreur' ? (
          <EtatErreur
            titre={textesRepliErreur.serveur.titre}
            explication={textesRepliErreur.serveur.explication}
            nombreEchecs={0}
            onReessayer={() => {
              setLecture('lecture');
              setCleTentative((c) => c + 1);
            }}
          />
        ) : null}
        {lecture === 'pret' ? (
          <>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Elles figurent sur les factures émises en ton nom.
            </Text>
            <Champ libelle="SIREN" valeur={siren} onChangeTexte={setSiren} type="telephone" />
            <Champ libelle="Adresse" valeur={adresse} onChangeTexte={setAdresse} />
            <Champ
              libelle="Code postal"
              valeur={codePostal}
              onChangeTexte={setCodePostal}
              type="telephone"
            />
            <Champ libelle="Commune" valeur={commune} onChangeTexte={setCommune} />
            <View style={{ gap: theme.espace[2] }}>
              <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
                Régime de TVA
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
                <Chip
                  variante="selection"
                  libelle="Franchise en base de TVA"
                  selectionne={regime === 'franchise_en_base'}
                  onPress={() => setRegime('franchise_en_base')}
                />
                <Chip
                  variante="selection"
                  libelle="Assujetti à la TVA"
                  selectionne={regime === 'assujetti'}
                  onPress={() => setRegime('assujetti')}
                />
              </View>
            </View>
            {regime === 'assujetti' ? (
              <Champ
                libelle="Taux de TVA (%)"
                valeur={taux}
                onChangeTexte={setTaux}
                placeholder="20"
                type="decimal"
              />
            ) : null}
            {refus === 'sans_reponse' ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ ...theme.texte.corps, color: theme.couleur.etat.erreurEncre }}
              >
                Pas de connexion. Réessaie.
              </Text>
            ) : refus ? (
              <View accessibilityLiveRegion="polite" style={{ gap: theme.espace[1] }}>
                <Text style={{ ...theme.texte.label, color: theme.couleur.etat.erreurEncre }}>
                  {refus.title}
                </Text>
                <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
                  {refus.detail}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </DefilementEcran>

      {lecture === 'pret' ? (
        <View
          style={{
            paddingHorizontal: theme.espace.gouttiere,
            paddingTop: theme.espace[3],
            paddingBottom: insets.bottom + theme.espace[3],
            borderTopWidth: theme.taille.bordureFine,
            borderTopColor: theme.couleur.bordure.discrete,
          }}
        >
          <Bouton
            libelle={envoi ? 'Envoi en cours…' : 'Enregistrer'}
            variante="primaire"
            desactive={regime === null || envoi}
            onPress={() => void enregistrer()}
          />
        </View>
      ) : null}
    </CanevasEcran>
  );
}
