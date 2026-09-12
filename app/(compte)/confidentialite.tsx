import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoutonIcone } from '@/composants/bouton-icone';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Modale } from '@/composants/modale';
import { Squelette } from '@/composants/squelette';
import {
  TEXTE_CONSENTEMENT_SANTE,
  VERSION_CONSENTEMENT_SANTE,
} from '@/fonctionnalites/identite/consentement-sante';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-09-mes-informations.md, section « Confidentialité ». Un seul réglage au lot L1 :
// le consentement aux données de santé (docs/domaine.md §3.12). Le consentement aux
// notifications arrive avec le lot L10, celui aux communications commerciales avec le lot
// L2 (C-04) — ils ne figurent pas ici, pas même désactivés.
//
// Le consentement est un JOURNAL d'ajout : accorder comme retirer insère une nouvelle ligne
// (port.enregistrerConsentementSante), jamais une mise à jour. L'accord est immédiat ; le
// retrait passe par une Modale qui énonce ses deux conséquences. Après un retrait, une ligne
// « Effacer mes mesures enregistrées » apparaît, à double confirmation — l'effacement est
// irréversible.

function formaterVersion(version: string): string {
  const [annee, mois, jour] = version.split('-');
  return annee && mois && jour ? `${jour}/${mois}/${annee}` : version;
}

type EtapeEffacement = null | 'confirmer1' | 'confirmer2';

export default function Confidentialite() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port } = useDonnees();

  const [chargement, setChargement] = useState(true);
  const [erreurLecture, setErreurLecture] = useState(false);
  const [accorde, setAccorde] = useState(false);
  const [versionEnregistree, setVersionEnregistree] = useState<string | null>(null);

  const [confirmationRetrait, setConfirmationRetrait] = useState(false);
  const [etapeEffacement, setEtapeEffacement] = useState<EtapeEffacement>(null);
  const [mesuresEffacees, setMesuresEffacees] = useState(false);
  const [ecritureEnCours, setEcritureEnCours] = useState(false);

  useEffect(() => {
    let monte = true;
    port
      .lireConsentementSante()
      .then((etat) => {
        if (!monte) return;
        setAccorde(etat.accorde);
        setVersionEnregistree(etat.version);
        setChargement(false);
      })
      .catch(() => {
        if (!monte) return;
        setErreurLecture(true);
        setChargement(false);
      });
    return () => {
      monte = false;
    };
  }, [port]);

  async function definirConsentement(nouvelAccord: boolean) {
    setEcritureEnCours(true);
    const resultat = await port.enregistrerConsentementSante(
      nouvelAccord,
      VERSION_CONSENTEMENT_SANTE,
    );
    setEcritureEnCours(false);
    if (resultat.succes) {
      setAccorde(nouvelAccord);
      setVersionEnregistree(VERSION_CONSENTEMENT_SANTE);
    }
  }

  function surBasculeConsentement(valeur: boolean) {
    if (valeur) {
      void definirConsentement(true);
    } else {
      setConfirmationRetrait(true);
    }
  }

  async function confirmerRetrait() {
    setConfirmationRetrait(false);
    await definirConsentement(false);
  }

  async function effacerMesures() {
    setEtapeEffacement(null);
    setEcritureEnCours(true);
    const resultat = await port.effacerMesuresCorporelles();
    setEcritureEnCours(false);
    if (resultat.succes) setMesuresEffacees(true);
  }

  return (
    <Modale
      ouverte={confirmationRetrait}
      onFermer={() => setConfirmationRetrait(false)}
      titre="Retirer ton consentement ?"
      corps="Tes mesures ne seront plus enregistrées. Celles déjà enregistrées restent, sauf si tu demandes leur effacement."
      libelleAction="Annuler"
      onAction={() => setConfirmationRetrait(false)}
      libelleDestructeur="Retirer"
      onDestructeur={confirmerRetrait}
    >
      <Modale
        ouverte={etapeEffacement === 'confirmer1'}
        onFermer={() => setEtapeEffacement(null)}
        titre="Effacer tes mesures enregistrées ?"
        corps="Cette action est irréversible."
        libelleAction="Annuler"
        onAction={() => setEtapeEffacement(null)}
        libelleDestructeur="Continuer"
        onDestructeur={() => setEtapeEffacement('confirmer2')}
      >
        <Modale
          ouverte={etapeEffacement === 'confirmer2'}
          onFermer={() => setEtapeEffacement(null)}
          titre="Confirmer l’effacement"
          corps="Tes mesures enregistrées seront définitivement supprimées."
          libelleAction="Annuler"
          onAction={() => setEtapeEffacement(null)}
          libelleDestructeur="Effacer"
          onDestructeur={effacerMesures}
        >
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
                Confidentialité
              </Text>
            </View>

            {chargement ? (
              <View style={{ paddingHorizontal: theme.espace.gouttiere }}>
                <Squelette forme="ligne" />
              </View>
            ) : erreurLecture ? (
              <View style={{ paddingHorizontal: theme.espace.gouttiere }}>
                <EtatErreur
                  titre={textesRepliErreur.serveur.titre}
                  explication={textesRepliErreur.serveur.explication}
                  nombreEchecs={0}
                  onReessayer={() => {}}
                  onNousEcrire={() => {}}
                />
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: theme.espace.gouttiere,
                  paddingTop: theme.espace[2],
                  paddingBottom: insets.bottom + theme.espace[6],
                  gap: theme.espace[4],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.espace[3],
                    minHeight: theme.taille.tapMin,
                  }}
                >
                  <Text
                    style={{
                      ...theme.texte.corps,
                      flex: 1,
                      color: theme.couleur.texte.principal,
                    }}
                  >
                    Enregistrer mes données de santé
                  </Text>
                  <Switch
                    value={accorde}
                    onValueChange={surBasculeConsentement}
                    disabled={ecritureEnCours}
                    accessibilityLabel="Enregistrer mes données de santé"
                    trackColor={{
                      false: theme.couleur.gris[300],
                      true: theme.couleur.marque.primaireTeinte2,
                    }}
                    thumbColor={theme.couleur.fond.surface}
                  />
                </View>

                <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                  {TEXTE_CONSENTEMENT_SANTE}
                </Text>
                <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
                  Version du {formaterVersion(versionEnregistree ?? VERSION_CONSENTEMENT_SANTE)}
                </Text>

                {!accorde && !mesuresEffacees ? (
                  <Pressable
                    onPress={() => setEtapeEffacement('confirmer1')}
                    accessibilityRole="button"
                    accessibilityLabel="Effacer mes mesures enregistrées"
                    disabled={ecritureEnCours}
                    style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
                  >
                    <Text style={{ ...theme.texte.corps, color: theme.couleur.etat.erreur }}>
                      Effacer mes mesures enregistrées
                    </Text>
                  </Pressable>
                ) : null}

                {mesuresEffacees ? (
                  <View accessibilityLiveRegion="polite">
                    <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.succesEncre }}>
                      Tes mesures enregistrées ont été effacées.
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>
        </Modale>
      </Modale>
    </Modale>
  );
}
