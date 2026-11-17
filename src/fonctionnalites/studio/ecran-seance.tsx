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
import { Modale } from '@/composants/modale';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type {
  ExerciceProgramme,
  MediaBibliotheque,
  ResultatStudio,
  SeanceResume,
} from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { BandeauRefus } from './bandeau-refus';
import { signalerStudioModifie } from './studio-modifie';
import { JOURS_COURTS, SANS_REPONSE, semaineEtJour, texteRefus, type TexteRefus } from './textes';

// docs/ecrans/L6-11-studio.md, « Une séance ».
export type ProprietesEcranSeance = {
  programmeId: string;
  seanceId: string;
  onRetour: () => void;
};

type Donnees = { seance: SeanceResume; brouillon: boolean; exercices: ExerciceProgramme[] };

export function libelleTypeMedia(typeMime: string): string {
  if (typeMime.startsWith('video/')) return 'Vidéo';
  if (typeMime.startsWith('image/')) return 'Image';
  return 'PDF';
}

// « 3 × 12 · 12 kg » d'après ce que porte l'exercice.
export function resumeExercice(e: {
  series: number | null;
  repetitions: number | null;
  chargeGrammes: number | null;
}): string {
  const morceaux: string[] = [];
  if (e.series && e.repetitions) morceaux.push(`${e.series} × ${e.repetitions}`);
  else if (e.series) morceaux.push(`${e.series} ${e.series > 1 ? 'séries' : 'série'}`);
  else if (e.repetitions) morceaux.push(`${e.repetitions} répétitions`);
  if (e.chargeGrammes) morceaux.push(`${(e.chargeGrammes / 1000).toLocaleString('fr-FR')} kg`);
  return morceaux.join(' · ');
}

const entier = (texte: string): number | null => {
  const n = Number(texte.trim().replace(',', '.'));
  return texte.trim() === '' || !Number.isFinite(n) ? null : Math.round(n);
};

export function EcranSeance({ programmeId, seanceId, onRetour }: ProprietesEcranSeance) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [cleTentative, setCleTentative] = useState(0);
  const [titre, setTitre] = useState('');
  const [duree, setDuree] = useState('');
  const [jour, setJour] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<TexteRefus | null>(null);
  const [formulaire, setFormulaire] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const relire = useCallback(() => setCleTentative((c) => c + 1), []);

  useEffect(() => {
    let monte = true;
    Promise.all([
      port.lireMesProgrammes(),
      port.lireSeancesDuProgramme(programmeId),
      port.lireExercices(seanceId),
    ])
      .then(([programmes, seances, exercices]) => {
        if (!monte) return;
        const seance = seances.find((s) => s.id === seanceId);
        const programme = programmes.find((p) => p.id === programmeId);
        if (!seance || !programme) {
          setIntrouvable(true);
          return;
        }
        setDonnees({ seance, brouillon: programme.statut === 'brouillon', exercices });
        setTitre(seance.titre);
        setDuree(String(seance.dureeMinutes));
        setJour(semaineEtJour(seance.jourRelatif).jour);
        setErreur(false);
      })
      .catch(() => {
        if (monte) setErreur(true);
      });
    return () => {
      monte = false;
    };
  }, [port, programmeId, seanceId, cleTentative]);

  async function ecrire<T>(action: () => Promise<ResultatStudio<T>>, apres?: () => void) {
    if (envoi) return;
    setEnvoi(true);
    setRefus(null);
    const resultat = await action();
    setEnvoi(false);
    if (resultat.issue === 'ok') {
      signalerStudioModifie();
      apres?.();
      relire();
    } else {
      setRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
    }
  }

  const seance = donnees?.seance;
  const semaine = seance ? semaineEtJour(seance.jourRelatif).semaine : 1;

  return (
    <Modale
      ouverte={confirmation}
      onFermer={() => setConfirmation(false)}
      titre="Supprimer cette séance ?"
      corps="Ses exercices sont supprimés avec elle."
      libelleAction="Annuler"
      onAction={() => setConfirmation(false)}
      libelleDestructeur="Supprimer"
      onDestructeur={() => {
        setConfirmation(false);
        void ecrire(() => port.supprimerSeance(seanceId), onRetour);
      }}
    >
      <FeuilleBasse
        ouverte={formulaire}
        onFermer={() => setFormulaire(false)}
        enfants={
          <FormulaireExercice
            seanceId={seanceId}
            onAjoute={() => {
              setFormulaire(false);
              relire();
            }}
          />
        }
      >
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
              {seance ? `Semaine ${semaine} · ${JOURS_COURTS[jour]}` : 'Séance'}
            </Text>
          </View>
          <DefilementEcran
            contentContainerStyle={{
              paddingHorizontal: theme.espace.gouttiere,
              paddingBottom: insets.bottom + theme.espace[6],
              gap: theme.espace[4],
            }}
          >
            {!donnees && !erreur && !introuvable ? <Squelette forme="detail" /> : null}
            {introuvable ? (
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                Cette séance est introuvable.
              </Text>
            ) : null}
            {erreur ? (
              <EtatErreur
                titre={textesRepliErreur.serveur.titre}
                explication={textesRepliErreur.serveur.explication}
                nombreEchecs={0}
                onReessayer={() => {
                  setErreur(false);
                  relire();
                }}
              />
            ) : null}
            {seance && donnees ? (
              <>
                {donnees.brouillon ? (
                  <>
                    <Champ
                      libelle="Titre"
                      valeur={titre}
                      onChangeTexte={setTitre}
                      longueurMax={80}
                    />
                    <Champ
                      libelle="Durée (minutes)"
                      valeur={duree}
                      onChangeTexte={setDuree}
                      type="telephone"
                    />
                    <View style={{ gap: theme.espace[2] }}>
                      <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
                        Jour
                      </Text>
                      <View
                        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}
                      >
                        {JOURS_COURTS.map((libelle, i) => (
                          <Chip
                            key={libelle}
                            variante="selection"
                            libelle={libelle}
                            selectionne={jour === i}
                            onPress={() => setJour(i)}
                          />
                        ))}
                      </View>
                    </View>
                    <Bouton
                      libelle={envoi ? 'Envoi en cours…' : 'Enregistrer la séance'}
                      variante="secondaire"
                      desactive={envoi}
                      onPress={() =>
                        void ecrire(() =>
                          port.modifierSeance(seanceId, {
                            titre,
                            dureeMinutes: entier(duree) ?? 0,
                            jourRelatif: (semaine - 1) * 7 + jour + 1,
                          }),
                        )
                      }
                    />
                  </>
                ) : (
                  <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
                    {`${seance.titre || 'Séance sans titre'} · ${seance.dureeMinutes} min`}
                  </Text>
                )}

                <Text
                  accessibilityRole="header"
                  style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}
                >
                  Exercices
                </Text>
                {donnees.exercices.length === 0 ? (
                  <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
                    Aucun exercice pour l’instant.
                  </Text>
                ) : null}
                {donnees.exercices.map((e, i) => (
                  <View
                    key={e.id}
                    style={{
                      gap: theme.espace[2],
                      padding: theme.espace[3],
                      borderRadius: theme.rayon.carte,
                      backgroundColor: theme.couleur.fond.surface,
                    }}
                  >
                    <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                      {e.nom}
                    </Text>
                    {resumeExercice(e) ? (
                      <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                        {resumeExercice(e)}
                      </Text>
                    ) : null}
                    {e.consigne ? (
                      <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                        {e.consigne}
                      </Text>
                    ) : null}
                    {e.media ? (
                      <Text style={{ ...theme.texte.petit, color: theme.couleur.marque.primaire }}>
                        {`${libelleTypeMedia(e.media.typeMime)} · ${e.media.nomFichier}`}
                      </Text>
                    ) : null}
                    {donnees.brouillon ? (
                      <View
                        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}
                      >
                        {i > 0 ? (
                          <Bouton
                            libelle="Monter"
                            variante="discret"
                            accessibilityLabel={`Monter ${e.nom}`}
                            onPress={() => void ecrire(() => port.deplacerExercice(e.id, 'haut'))}
                          />
                        ) : null}
                        {i < donnees.exercices.length - 1 ? (
                          <Bouton
                            libelle="Descendre"
                            variante="discret"
                            accessibilityLabel={`Descendre ${e.nom}`}
                            onPress={() => void ecrire(() => port.deplacerExercice(e.id, 'bas'))}
                          />
                        ) : null}
                        <Bouton
                          libelle="Supprimer"
                          variante="discret"
                          accessibilityLabel={`Supprimer ${e.nom}`}
                          onPress={() => void ecrire(() => port.supprimerExercice(e.id))}
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
                {refus ? <BandeauRefus refus={refus} /> : null}
                {donnees.brouillon ? (
                  <>
                    <Bouton
                      libelle="Ajouter un exercice"
                      variante="primaire"
                      icone="ajouter"
                      onPress={() => setFormulaire(true)}
                    />
                    <Bouton
                      libelle="Supprimer la séance"
                      variante="destructeur"
                      onPress={() => setConfirmation(true)}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </DefilementEcran>
        </CanevasEcran>
      </FeuilleBasse>
    </Modale>
  );
}

// « Ajouter un exercice » : le formulaire, puis le média joint s'il y en a un.
function FormulaireExercice({ seanceId, onAjoute }: { seanceId: string; onAjoute: () => void }) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [nom, setNom] = useState('');
  const [series, setSeries] = useState('');
  const [repetitions, setRepetitions] = useState('');
  const [charge, setCharge] = useState('');
  const [consigne, setConsigne] = useState('');
  const [medias, setMedias] = useState<MediaBibliotheque[]>([]);
  const [media, setMedia] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<TexteRefus | null>(null);

  useEffect(() => {
    let monte = true;
    port
      .lireMesMedias()
      .then((lus) => {
        if (monte) setMedias(lus);
      })
      .catch(() => {});
    return () => {
      monte = false;
    };
  }, [port]);

  async function ajouter() {
    if (envoi) return;
    setEnvoi(true);
    setRefus(null);
    const kilos = Number(charge.trim().replace(',', '.'));
    const resultat = await port.ajouterExercice(seanceId, {
      nom,
      series: entier(series),
      repetitions: entier(repetitions),
      chargeGrammes:
        charge.trim() === '' || !Number.isFinite(kilos) ? null : Math.round(kilos * 1000),
      consigne,
    });
    if (resultat.issue === 'ok' && media) {
      const jointure = await port.joindreMedia(resultat.valeur, media);
      if (jointure.issue !== 'ok') {
        setEnvoi(false);
        setRefus(jointure.issue === 'refusee' ? texteRefus(jointure.code) : SANS_REPONSE);
        return;
      }
    }
    setEnvoi(false);
    if (resultat.issue === 'ok') {
      signalerStudioModifie();
      onAjoute();
    } else setRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
  }

  return (
    <View style={{ gap: theme.espace[3], padding: theme.espace.gouttiere }}>
      <Text
        accessibilityRole="header"
        style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}
      >
        Ajouter un exercice
      </Text>
      <Champ libelle="Nom" valeur={nom} onChangeTexte={setNom} longueurMax={80} />
      <View style={{ flexDirection: 'row', gap: theme.espace[2] }}>
        <View style={{ flex: 1 }}>
          <Champ libelle="Séries" valeur={series} onChangeTexte={setSeries} type="telephone" />
        </View>
        <View style={{ flex: 1 }}>
          <Champ
            libelle="Répétitions"
            valeur={repetitions}
            onChangeTexte={setRepetitions}
            type="telephone"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Champ libelle="Charge (kg)" valeur={charge} onChangeTexte={setCharge} type="decimal" />
        </View>
      </View>
      <Champ
        libelle="Consigne"
        valeur={consigne}
        onChangeTexte={setConsigne}
        multiligne
        longueurMax={500}
      />
      <View style={{ gap: theme.espace[2] }}>
        <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>Média</Text>
        {medias.length === 0 ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            Ta bibliothèque est vide. Ajoute un média depuis le studio.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
            <Chip
              variante="selection"
              libelle="Aucun"
              selectionne={media === null}
              onPress={() => setMedia(null)}
            />
            {medias.map((m) => (
              <Chip
                key={m.id}
                variante="selection"
                libelle={m.nomFichier}
                selectionne={media === m.id}
                onPress={() => setMedia(m.id)}
              />
            ))}
          </View>
        )}
      </View>
      {refus ? <BandeauRefus refus={refus} /> : null}
      <Bouton
        libelle={envoi ? 'Envoi en cours…' : 'Ajouter'}
        variante="primaire"
        desactive={envoi || nom.trim() === ''}
        onPress={() => void ajouter()}
      />
    </View>
  );
}
