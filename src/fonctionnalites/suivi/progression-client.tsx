import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { Carte } from '@/composants/carte';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { FeuilleBasse } from '@/composants/feuille-basse';
import { Squelette } from '@/composants/squelette';
import { nouvelleCleIdempotence } from '@/fonctionnalites/abonnement/cle-idempotence';
import { dateLongue } from '@/fonctionnalites/factures/format';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { ecouterSeanceModifiee } from '@/fonctionnalites/seance/seance-modifiee';
import type { MesMesures, MonSuivi, TypeMesure } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { SemainesSuivi } from './semaines-suivi';

const MESURES = [
  { type: 'poids', libelle: 'Poids', unite: 'kg', cle: 'poids' },
  { type: 'tour_de_taille', libelle: 'Tour de taille', unite: 'cm', cle: 'tourDeTaille' },
] as const;

function nombre(valeur: number) {
  return valeur.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

export function ProgressionClient() {
  const { port } = useDonnees();
  const router = useRouter();
  const theme = useTheme();
  const [suivi, setSuivi] = useState<MonSuivi | null>(null);
  const [mesures, setMesures] = useState<MesMesures | null>(null);
  const [accord, setAccord] = useState<boolean | null>(null);
  const [erreurSuivi, setErreurSuivi] = useState(false);
  const [erreurMesures, setErreurMesures] = useState(false);
  const [ouverte, setOuverte] = useState(false);
  const [revision, setRevision] = useState(0);
  const [actif, setActif] = useState(AppState.currentState !== 'background');
  const [actifSuivi, setActifSuivi] = useState(0);

  useEffect(() => {
    const quitter = ecouterSeanceModifiee(() => setActifSuivi((n) => n + 1));
    const ecoute = AppState.addEventListener('change', (etat) => {
      setActif(etat === 'active');
      if (etat !== 'active') {
        setMesures(null);
        setAccord(null);
        setOuverte(false);
      }
    });
    return () => {
      quitter();
      ecoute.remove();
    };
  }, []);
  useEffect(() => {
    let monte = true;
    void port.lireMonSuivi().then(
      (resultat) => {
        if (monte) {
          setSuivi(resultat);
          setErreurSuivi(false);
        }
      },
      () => {
        if (monte) setErreurSuivi(true);
      },
    );
    return () => {
      monte = false;
    };
  }, [port, actifSuivi]);
  useEffect(() => {
    if (!actif) return;
    let monte = true;
    void (async () => {
      try {
        const consentement = await port.lireConsentementSante();
        if (!monte) return;
        if (!consentement.accorde) {
          setMesures(null);
          setAccord(false);
          setOuverte(false);
          setErreurMesures(false);
          return;
        }
        const resultat = await port.lireMesMesures();
        if (monte) {
          setAccord(true);
          setMesures(resultat);
          setErreurMesures(false);
        }
      } catch (err) {
        if (!monte) return;
        setMesures(null);
        if (
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          err.message === 'consentement_sante_absent'
        ) {
          setAccord(false);
          setOuverte(false);
          setErreurMesures(false);
        } else setErreurMesures(true);
      }
    })();
    return () => {
      monte = false;
    };
  }, [actif, port, revision]);

  const titre = { ...theme.texte.titre3, color: theme.couleur.texte.principal };
  const detail = { ...theme.texte.corps, color: theme.couleur.texte.secondaire };
  const relire = () => setRevision((n) => n + 1);
  return (
    <FeuilleBasse
      ouverte={ouverte && mesures !== null}
      onFermer={() => setOuverte(false)}
      enfants={
        ouverte && mesures ? (
          <AjoutMesure
            seuils={mesures.seuils}
            onTermine={() => {
              setOuverte(false);
              relire();
            }}
            onConsentementRetire={() => {
              setOuverte(false);
              setAccord(false);
              setMesures(null);
            }}
          />
        ) : null
      }
    >
      <View style={{ gap: theme.espace[3] }}>
        <Text accessibilityRole="header" style={titre}>
          Ta progression
        </Text>
        {erreurSuivi ? (
          <EtatErreur
            titre="Impossible de charger ta progression"
            explication="Réessaie dans un instant."
            nombreEchecs={0}
            onReessayer={() => setActifSuivi((n) => n + 1)}
          />
        ) : suivi === null ? (
          <Squelette forme="carte" />
        ) : suivi.depuis === null ? (
          <Text style={detail}>Ta progression apparaîtra après ta première séance.</Text>
        ) : (
          <>
            <Carte>
              <View style={{ gap: theme.espace[2], padding: theme.espace[3] }}>
                <Text style={titre}>{suivi.seancesFaites} séances</Text>
                <Text style={detail}>Depuis le {dateLongue(suivi.depuis)}</Text>
                <Text style={detail}>
                  Assiduité ·{' '}
                  {suivi.assiduite === null
                    ? 'Pas encore assez de séances'
                    : `${suivi.assiduite} % sur 28 jours`}
                </Text>
                <Text style={detail}>
                  Série · {suivi.serie} {suivi.serie === 1 ? 'semaine' : 'semaines'}
                </Text>
              </View>
            </Carte>
            <SemainesSuivi semaines={suivi.semaines} />
          </>
        )}
        {erreurMesures ? (
          <EtatErreur
            titre="Impossible de charger tes mesures"
            explication="Réessaie dans un instant."
            nombreEchecs={0}
            onReessayer={relire}
          />
        ) : accord === false ? (
          <>
            <Text style={detail}>
              Pour suivre ton poids et ton tour de taille, autorise l’enregistrement de tes données
              de santé.
            </Text>
            <Bouton
              libelle="Mes réglages de confidentialité"
              variante="secondaire"
              onPress={() => router.push('/(compte)/confidentialite')}
            />
          </>
        ) : mesures ? (
          <>
            {MESURES.map(({ cle, libelle, unite }) => {
              const mesure = mesures[cle];
              return (
                <Carte key={cle}>
                  <View style={{ gap: theme.espace[1], padding: theme.espace[3] }}>
                    <Text style={titre}>{libelle}</Text>
                    {mesure ? (
                      <>
                        <Text style={detail}>
                          {nombre(mesure.derniere.valeur)} {unite} · Mesuré le{' '}
                          {dateLongue(mesure.derniere.le)}
                        </Text>
                        <Text style={detail}>
                          {mesure.ecart > 0 ? '+' : ''}
                          {nombre(mesure.ecart)} {unite} depuis le {dateLongue(mesure.premiere.le)}
                        </Text>
                      </>
                    ) : (
                      <Text style={detail}>Aucune mesure pour l’instant.</Text>
                    )}
                  </View>
                </Carte>
              );
            })}
            <Bouton
              libelle="Ajouter une mesure"
              variante="secondaire"
              onPress={() => setOuverte(true)}
            />
          </>
        ) : actif ? (
          <Squelette forme="ligne" />
        ) : null}
      </View>
    </FeuilleBasse>
  );
}

function AjoutMesure({
  seuils,
  onTermine,
  onConsentementRetire,
}: {
  seuils: MesMesures['seuils'];
  onTermine: () => void;
  onConsentementRetire: () => void;
}) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [type, setType] = useState<TypeMesure | null>(null);
  const [saisie, setSaisie] = useState('');
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const tentative = useRef<{ type: TypeMesure; valeur: number; cle: string } | null>(null);
  const enCours = useRef(false);
  const choix = MESURES.find((m) => m.type === type);
  const valeur = /^\d+(?:[,.]\d)?$/.test(saisie.trim())
    ? Number(saisie.trim().replace(',', '.'))
    : NaN;

  async function enregistrer() {
    if (!type || enCours.current) return;
    if (!Number.isFinite(valeur) || valeur <= 0 || valeur > 1000) {
      setErreur('Vérifie la valeur saisie. Utilise une décimale au maximum.');
      return;
    }
    if (!confirmer && (valeur < seuils[type].min || valeur > seuils[type].max)) {
      setConfirmer(true);
      return;
    }
    if (tentative.current?.type !== type || tentative.current.valeur !== valeur)
      tentative.current = { type, valeur, cle: nouvelleCleIdempotence() };
    enCours.current = true;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await port.enregistrerMesure(type, valeur, tentative.current.cle);
      if (r.issue === 'ok') onTermine();
      else if (r.issue === 'refusee' && r.code === 'consentement_sante_absent')
        onConsentementRetire();
      else setErreur('Impossible d’enregistrer la mesure. Vérifie la valeur ou réessaie.');
    } catch {
      setErreur('Impossible d’enregistrer la mesure. Réessaie.');
    } finally {
      enCours.current = false;
      setEnvoi(false);
    }
  }
  return (
    <View style={{ gap: theme.espace[3] }}>
      <Text
        accessibilityRole="header"
        style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}
      >
        Ajouter une mesure
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
        {MESURES.map((m) => (
          <Chip
            key={m.type}
            libelle={m.libelle}
            variante="selection"
            selectionne={type === m.type}
            onPress={() => {
              if (envoi || type === m.type) return;
              setType(m.type);
              setSaisie('');
              setConfirmer(false);
              setErreur(null);
            }}
          />
        ))}
      </View>
      {choix ? (
        <Champ
          libelle={`${choix.libelle} (${choix.unite})`}
          valeur={saisie}
          onChangeTexte={(texte) => {
            setSaisie(texte);
            setConfirmer(false);
            setErreur(null);
          }}
          type="decimal"
          desactive={envoi}
          messageErreur={erreur ?? undefined}
        />
      ) : null}
      {confirmer ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.couleur.texte.principal }}>
          Cette valeur sort de la plage habituelle. Vérifie la valeur et l’unité avant de confirmer.
        </Text>
      ) : null}
      <Bouton
        libelle={confirmer ? 'Confirmer la mesure' : 'Enregistrer'}
        variante="primaire"
        desactive={!type || !saisie.trim() || envoi}
        onPress={() => void enregistrer()}
      />
    </View>
  );
}
