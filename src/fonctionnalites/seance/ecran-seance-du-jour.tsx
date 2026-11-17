import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { FeuilleBasse } from '@/composants/feuille-basse';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { BandeauRefus } from '@/fonctionnalites/studio/bandeau-refus';
import { resumeExercice } from '@/fonctionnalites/studio/ecran-seance';
import { SANS_REPONSE, texteRefus, type TexteRefus } from '@/fonctionnalites/studio/textes';
import { signalerSeanceModifiee } from './seance-modifiee';
import type {
  ExerciceDeSeance,
  SeanceProgrammeeDetail,
  SerieSaisie,
} from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L6-05-seance-du-jour.md. Le client fait sa séance exercice par exercice ; tout
// s'écrit par le serveur (démarrage, séries, fin). Le ressenti d'effort est une donnée de santé
// (docs/domaine.md §3.12) : demandé seulement avec le consentement, gardé dans l'état de cet
// écran le temps de l'envoyer, jamais ailleurs.
export type ProprietesEcranSeanceDuJour = {
  seanceProgrammeeId: string;
  onRetour: () => void;
  onTerminee: () => void;
  // Ouvre la démo d'un exercice (URL signée) : navigateur intégré, ou onglet sur le web.
  ouvrirPage: (url: string) => Promise<void>;
};

type Donnees = {
  seance: SeanceProgrammeeDetail;
  exercices: ExerciceDeSeance[];
  series: SerieSaisie[];
  consentementSante: boolean;
};

type Lecture =
  | { type: 'lecture' }
  | { type: 'erreur' }
  | { type: 'introuvable' }
  | { type: 'sans_acces' }
  | { type: 'pret'; donnees: Donnees };

function minutesSecondes(depuis: string, maintenant: number): string {
  const secondes = Math.max(0, Math.floor((maintenant - new Date(depuis).getTime()) / 1000));
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;
}

export function EcranSeanceDuJour({
  seanceProgrammeeId,
  onRetour,
  onTerminee,
  ouvrirPage,
}: ProprietesEcranSeanceDuJour) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();
  const [lecture, setLecture] = useState<Lecture>({ type: 'lecture' });
  const [cleTentative, setCleTentative] = useState(0);
  const [courant, setCourant] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<TexteRefus | null>(null);
  const [fin, setFin] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const relire = useCallback(() => setCleTentative((c) => c + 1), []);

  useEffect(() => {
    let monte = true;
    Promise.all([
      port.lireSeanceProgrammee(seanceProgrammeeId),
      port.lireExercicesDeMaSeance(seanceProgrammeeId),
      port.lireSeriesDeMaSeance(seanceProgrammeeId),
      port.lireConsentementSante(),
    ])
      .then(([seance, exercices, series, consentement]) => {
        if (monte) {
          setLecture({
            type: 'pret',
            donnees: { seance, exercices, series, consentementSante: consentement.accorde },
          });
        }
      })
      .catch((e: unknown) => {
        if (!monte) return;
        const message = e instanceof Error ? e.message : '';
        if (message === 'seance_introuvable') setLecture({ type: 'introuvable' });
        else if (message === 'abonnement_sans_acces') setLecture({ type: 'sans_acces' });
        else setLecture({ type: 'erreur' });
      });
    return () => {
      monte = false;
    };
  }, [port, seanceProgrammeeId, cleTentative]);

  const enCours = lecture.type === 'pret' && lecture.donnees.seance.statut === 'en_cours';
  // Le chronomètre de l'en-tête, seulement pendant la séance.
  useEffect(() => {
    if (!enCours) return;
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, [enCours]);

  async function ecrire(action: () => ReturnType<typeof port.demarrerSeance>, apres?: () => void) {
    if (envoi) return;
    setEnvoi(true);
    setRefus(null);
    const resultat = await action();
    setEnvoi(false);
    if (resultat.issue === 'ok') {
      signalerSeanceModifiee();
      apres?.();
      relire();
    } else {
      setRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
    }
  }

  const donnees = lecture.type === 'pret' ? lecture.donnees : null;
  const seance = donnees?.seance;
  const exercices = donnees?.exercices ?? [];
  const restant =
    seance?.demarreeLe && exercices.length > 0
      ? Math.max(
          0,
          Math.round((seance.dureeMinutes * (exercices.length - courant)) / exercices.length),
        )
      : (seance?.dureeMinutes ?? 0);

  return (
    <FeuilleBasse
      ouverte={fin}
      onFermer={() => setFin(false)}
      enfants={
        donnees ? (
          <FeuilleFin
            seanceProgrammeeId={seanceProgrammeeId}
            prenomCoach={donnees.seance.coachPrenom}
            consentementSante={donnees.consentementSante}
            onEnregistree={() => {
              setFin(false);
              onTerminee();
            }}
          />
        ) : null
      }
    >
      <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <View
          style={{
            paddingTop: insets.top + theme.espace[2],
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace[3],
            gap: theme.espace[2],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}>
            <BoutonIcone nom="retour" accessibilityLabel="Retour" onPress={onRetour} />
            {seance?.demarreeLe && enCours ? (
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {`${minutesSecondes(seance.demarreeLe, maintenant)} écoulées`}
              </Text>
            ) : null}
          </View>
          {seance ? (
            <>
              <Text
                accessibilityRole="header"
                style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}
              >
                {seance.titre || 'Séance'}
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {enCours && exercices.length > 0
                  ? `Exercice ${courant + 1} sur ${exercices.length} · il te reste ~${restant} min`
                  : `${exercices.length} ${exercices.length > 1 ? 'exercices' : 'exercice'} · ${seance.dureeMinutes} min · avec ${seance.coachPrenom} ${seance.coachNom}`}
              </Text>
            </>
          ) : null}
        </View>
        <DefilementEcran
          contentContainerStyle={{
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: insets.bottom + theme.espace[6],
            gap: theme.espace[3],
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
                relire();
              }}
            />
          ) : null}
          {lecture.type === 'introuvable' ? (
            <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
              Cette séance est introuvable.
            </Text>
          ) : null}
          {lecture.type === 'sans_acces' ? (
            <View style={{ gap: theme.espace[1] }}>
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                Ta séance n’est pas accessible pour l’instant.
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {texteRefus('abonnement_sans_acces').detail}
              </Text>
            </View>
          ) : null}
          {seance && donnees ? (
            <>
              {seance.statut === 'faite' ? (
                <Text style={{ ...theme.texte.corps, color: theme.couleur.marque.primaire }}>
                  {seance.rattrapee ? 'Séance faite (rattrapée).' : 'Séance faite.'}
                </Text>
              ) : null}
              {exercices.map((e, i) =>
                enCours && i === courant ? (
                  <ExerciceEnCours
                    key={e.id}
                    exercice={e}
                    seanceProgrammeeId={seanceProgrammeeId}
                    series={donnees.series.filter((s) => s.exerciceId === e.id)}
                    ouvrirPage={ouvrirPage}
                    onSerieValidee={relire}
                  />
                ) : (
                  <View
                    key={e.id}
                    style={{
                      paddingVertical: theme.espace[2],
                      borderBottomWidth: theme.taille.bordureFine,
                      borderBottomColor: theme.couleur.bordure.discrete,
                    }}
                  >
                    <Text
                      style={{
                        ...theme.texte.corps,
                        color:
                          enCours && i < courant
                            ? theme.couleur.texte.secondaire
                            : theme.couleur.texte.principal,
                      }}
                    >
                      {resumeExercice(e) ? `${e.nom} · ${resumeExercice(e)}` : e.nom}
                    </Text>
                  </View>
                ),
              )}
              {refus ? <BandeauRefus refus={refus} /> : null}
              {seance.statut === 'a_faire' ||
              seance.statut === 'manquee' ||
              seance.statut === 'partielle' ? (
                <Bouton
                  libelle={envoi ? 'Envoi en cours…' : 'Commencer la séance'}
                  variante="primaire"
                  desactive={envoi}
                  onPress={() => void ecrire(() => port.demarrerSeance(seanceProgrammeeId))}
                />
              ) : null}
              {enCours ? (
                courant < exercices.length - 1 ? (
                  <Bouton
                    libelle="Exercice suivant"
                    variante="primaire"
                    onPress={() => setCourant((c) => c + 1)}
                  />
                ) : (
                  <Bouton
                    libelle="Terminer la séance"
                    variante="primaire"
                    onPress={() => setFin(true)}
                  />
                )
              ) : null}
            </>
          ) : null}
        </DefilementEcran>
      </CanevasEcran>
    </FeuilleBasse>
  );
}

// L'exercice en cours : sa démo, sa consigne, une ligne par série, pré-remplie d'après le
// programme (ou ce qui a déjà été saisi), « Valider » l'enregistre.
function ExerciceEnCours({
  exercice: e,
  seanceProgrammeeId,
  series,
  ouvrirPage,
  onSerieValidee,
}: {
  exercice: ExerciceDeSeance;
  seanceProgrammeeId: string;
  series: SerieSaisie[];
  ouvrirPage: (url: string) => Promise<void>;
  onSerieValidee: () => void;
}) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [refus, setRefus] = useState<TexteRefus | null>(null);
  const nombre = e.series ?? 1;

  async function demo() {
    if (!e.mediaChemin) return;
    const url = await port.urlMedia(e.mediaChemin);
    if (url) await ouvrirPage(url);
    else setRefus(texteRefus('media_introuvable'));
  }

  return (
    <View
      style={{
        gap: theme.espace[3],
        padding: theme.espace[4],
        borderRadius: theme.rayon.carte,
        backgroundColor: theme.couleur.fond.surface,
      }}
    >
      <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>{e.nom}</Text>
      {e.mediaChemin ? (
        <Bouton
          libelle="Démo"
          variante="secondaire"
          icone="lecture"
          accessibilityLabel={`Voir la démo de ${e.nom}`}
          onPress={() => void demo()}
        />
      ) : null}
      {e.consigne ? (
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
          {e.consigne}
        </Text>
      ) : null}
      {Array.from({ length: nombre }, (_, i) => i + 1).map((numero) => (
        <LigneSerie
          key={numero}
          exercice={e}
          numero={numero}
          saisie={series.find((s) => s.numero === numero) ?? null}
          seanceProgrammeeId={seanceProgrammeeId}
          onValidee={onSerieValidee}
          onRefus={setRefus}
        />
      ))}
      {refus ? <BandeauRefus refus={refus} /> : null}
    </View>
  );
}

function LigneSerie({
  exercice: e,
  numero,
  saisie,
  seanceProgrammeeId,
  onValidee,
  onRefus,
}: {
  exercice: ExerciceDeSeance;
  numero: number;
  saisie: SerieSaisie | null;
  seanceProgrammeeId: string;
  onValidee: () => void;
  onRefus: (refus: TexteRefus | null) => void;
}) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [repetitions, setRepetitions] = useState(
    String(saisie?.repetitions ?? e.repetitions ?? ''),
  );
  const [charge, setCharge] = useState(() => {
    const grammes = saisie?.chargeGrammes ?? e.chargeGrammes;
    return grammes === null ? '' : (grammes / 1000).toLocaleString('fr-FR');
  });
  const [envoi, setEnvoi] = useState(false);

  async function valider() {
    if (envoi) return;
    setEnvoi(true);
    onRefus(null);
    const reps = Number(repetitions.trim());
    const kilos = Number(charge.trim().replace(',', '.'));
    const resultat = await port.enregistrerSerie(seanceProgrammeeId, {
      exerciceId: e.id,
      numero,
      repetitions: repetitions.trim() === '' || !Number.isFinite(reps) ? null : Math.round(reps),
      chargeGrammes:
        charge.trim() === '' || !Number.isFinite(kilos) ? null : Math.round(kilos * 1000),
    });
    setEnvoi(false);
    if (resultat.issue === 'ok') {
      signalerSeanceModifiee();
      onValidee();
    } else onRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
  }

  return (
    <View style={{ gap: theme.espace[2] }}>
      <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
        {saisie ? `Série ${numero} · validée` : `Série ${numero}`}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.espace[2] }}>
        <View style={{ flex: 1 }}>
          <Champ
            libelle={`Répétitions, série ${numero}`}
            valeur={repetitions}
            onChangeTexte={setRepetitions}
            type="telephone"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Champ
            libelle={`Charge (kg), série ${numero}`}
            valeur={charge}
            onChangeTexte={setCharge}
            type="decimal"
          />
        </View>
      </View>
      <Bouton
        libelle={envoi ? 'Envoi en cours…' : 'Valider'}
        variante="secondaire"
        accessibilityLabel={`Valider la série ${numero}`}
        desactive={envoi}
        onPress={() => void valider()}
      />
    </View>
  );
}

// Fin de séance : le ressenti (avec le consentement santé seulement), un mot au coach.
function FeuilleFin({
  seanceProgrammeeId,
  prenomCoach,
  consentementSante,
  onEnregistree,
}: {
  seanceProgrammeeId: string;
  prenomCoach: string;
  consentementSante: boolean;
  onEnregistree: () => void;
}) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [ressenti, setRessenti] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<TexteRefus | null>(null);

  async function enregistrer() {
    if (envoi) return;
    setEnvoi(true);
    setRefus(null);
    const resultat = await port.terminerSeance(
      seanceProgrammeeId,
      consentementSante ? ressenti : null,
      commentaire.trim() === '' ? null : commentaire,
    );
    setEnvoi(false);
    if (resultat.issue === 'ok') {
      signalerSeanceModifiee();
      onEnregistree();
    } else setRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
  }

  return (
    <View style={{ gap: theme.espace[4], padding: theme.espace.gouttiere }}>
      <Text
        accessibilityRole="header"
        style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}
      >
        Comment s’est passée ta séance ?
      </Text>
      {consentementSante ? (
        <View style={{ gap: theme.espace[2] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Ton ressenti d’effort
          </Text>
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            1 · très facile, 10 · maximal
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Chip
                key={n}
                variante="selection"
                libelle={String(n)}
                selectionne={ressenti === n}
                onPress={() => setRessenti(n)}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Champ
        libelle={`Un mot pour ${prenomCoach} ?`}
        valeur={commentaire}
        onChangeTexte={setCommentaire}
        multiligne
        longueurMax={500}
      />
      {refus ? <BandeauRefus refus={refus} /> : null}
      <Bouton
        libelle={envoi ? 'Envoi en cours…' : 'Enregistrer'}
        variante="primaire"
        desactive={envoi}
        onPress={() => void enregistrer()}
      />
    </View>
  );
}
