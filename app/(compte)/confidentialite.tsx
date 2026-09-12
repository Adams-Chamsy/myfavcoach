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
  TEXTE_CONSENTEMENT_COMMUNICATIONS,
  VERSION_CONSENTEMENT_COMMUNICATIONS,
} from '@/fonctionnalites/identite/consentement-communications';
import {
  TEXTE_CONSENTEMENT_SANTE,
  VERSION_CONSENTEMENT_SANTE,
} from '@/fonctionnalites/identite/consentement-sante';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-09-mes-informations.md + docs/ecrans/L2-02-consentement-communications.md
// (C-04). Renommé « Mes autorisations » (L2-02) : deux réglages désormais — santé (L1) et
// communications commerciales (L2), le seul des trois consentements cités par
// docs/perimetre.md (C-04) qui ne dépend d'aucune fonctionnalité pas encore construite (les
// notifications restent au lot L10, absentes ici, pas même désactivées).
//
// Chaque consentement est un JOURNAL d'ajout : accorder comme retirer insère une nouvelle ligne,
// jamais une mise à jour. Le bloc santé garde sa Modale de retrait à deux conséquences (inchangé
// depuis L1) ; le bloc communications retire IMMÉDIATEMENT, sans modale — une seule conséquence
// (plus de courriel), déjà dite par l'intitulé (L2-02, Règles).

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
  const [accordeCommunications, setAccordeCommunications] = useState(false);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [historique, setHistorique] = useState<
    { type: string; accorde: boolean; version: string; horodatage: string }[] | null
  >(null);

  const [confirmationRetrait, setConfirmationRetrait] = useState(false);
  const [etapeEffacement, setEtapeEffacement] = useState<EtapeEffacement>(null);
  const [mesuresEffacees, setMesuresEffacees] = useState(false);
  const [ecritureEnCours, setEcritureEnCours] = useState(false);

  useEffect(() => {
    let monte = true;
    Promise.all([port.lireConsentementSante(), port.lireConsentementCommunications()])
      .then(([sante, communications]) => {
        if (!monte) return;
        setAccorde(sante.accorde);
        setVersionEnregistree(sante.version);
        setAccordeCommunications(communications.accorde);
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

  async function surBasculeCommunications(nouvelAccord: boolean) {
    setEcritureEnCours(true);
    const resultat = await port.enregistrerConsentementCommunications(
      nouvelAccord,
      VERSION_CONSENTEMENT_COMMUNICATIONS,
    );
    setEcritureEnCours(false);
    if (resultat.succes) setAccordeCommunications(nouvelAccord);
  }

  async function ouvrirHistorique() {
    setHistoriqueOuvert(true);
    const lignes = await port.lireHistoriqueConsentements();
    setHistorique(lignes);
  }

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
                Mes autorisations
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
                    Nouveautés et conseils
                  </Text>
                  <Switch
                    value={accordeCommunications}
                    onValueChange={(v) => void surBasculeCommunications(v)}
                    disabled={ecritureEnCours}
                    accessibilityLabel="Nouveautés et conseils"
                    trackColor={{
                      false: theme.couleur.gris[300],
                      true: theme.couleur.marque.primaireTeinte2,
                    }}
                    thumbColor={theme.couleur.fond.surface}
                  />
                </View>
                <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                  {TEXTE_CONSENTEMENT_COMMUNICATIONS}
                </Text>
                <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
                  Les messages liés à ton abonnement et à tes paiements arrivent quoi qu’il arrive :
                  ils ne relèvent pas d’une autorisation.
                </Text>

                <Pressable
                  onPress={() =>
                    historiqueOuvert ? setHistoriqueOuvert(false) : void ouvrirHistorique()
                  }
                  accessibilityRole="button"
                  style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
                >
                  <Text
                    style={{
                      ...theme.texte.corps,
                      color: theme.couleur.marque.primaire,
                    }}
                  >
                    Historique de mes décisions
                  </Text>
                </Pressable>

                {historiqueOuvert ? (
                  <View style={{ gap: theme.espace[2] }}>
                    {historique === null ? (
                      <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
                        Chargement…
                      </Text>
                    ) : historique.length === 0 ? (
                      <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
                        Aucune décision enregistrée.
                      </Text>
                    ) : (
                      historique.map((l, index) => (
                        <Text
                          key={`${l.type}-${l.horodatage}-${index}`}
                          style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}
                        >
                          {new Date(l.horodatage).toLocaleDateString('fr-FR')} · {l.type} ·{' '}
                          {l.accorde ? 'accordé' : 'retiré'} (v{l.version})
                        </Text>
                      ))
                    )}
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
