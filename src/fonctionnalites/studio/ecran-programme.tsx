import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
import type {
  AbonneAffectable,
  ProgrammeResume,
  ResultatStudio,
  SeanceResume,
} from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { BandeauRefus } from './bandeau-refus';
import { ApercuProgramme } from './apercu-programme';
import { ecouterStudioModifie, signalerStudioModifie } from './studio-modifie';
import {
  JOURS_COURTS,
  LIBELLES_STATUT_PROGRAMME,
  SANS_REPONSE,
  semaineEtJour,
  texteRefus,
  type TexteRefus,
} from './textes';

// docs/ecrans/L6-11-studio.md, « Un programme » et « Affecter à un abonné ».
export type ProprietesEcranProgramme = {
  programmeId: string;
  onRetour: () => void;
  onOuvrirSeance: (seanceId: string) => void;
};

type Donnees = { programme: ProgrammeResume; seances: SeanceResume[] };

const DUREES = Array.from({ length: 12 }, (_, i) => i + 1);

// AAAA-MM-JJ du jour de Paris, décalé de `jours`.
function jourParis(jours: number): string {
  const date = new Date(Date.now() + jours * 86_400_000);
  return date.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

export function EcranProgramme({
  programmeId,
  onRetour,
  onOuvrirSeance,
}: ProprietesEcranProgramme) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [cleTentative, setCleTentative] = useState(0);
  const [titre, setTitre] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<TexteRefus | null>(null);
  const [feuille, setFeuille] = useState<'affectation' | 'apercu' | null>(null);

  const relire = useCallback(() => setCleTentative((c) => c + 1), []);

  useEffect(() => {
    let monte = true;
    Promise.all([port.lireMesProgrammes(), port.lireSeancesDuProgramme(programmeId)])
      .then(([programmes, seances]) => {
        if (!monte) return;
        const programme = programmes.find((p) => p.id === programmeId);
        if (!programme) {
          setIntrouvable(true);
          return;
        }
        setDonnees({ programme, seances });
        setTitre(programme.titre);
        setErreur(false);
      })
      .catch(() => {
        if (monte) setErreur(true);
      });
    return () => {
      monte = false;
    };
  }, [port, programmeId, cleTentative]);

  // Une écriture, son refus, puis la relecture.
  // Retour d'une séance modifiée : l'écran, resté dessous, relit.
  useEffect(() => ecouterStudioModifie(relire), [relire]);

  // `verrou` : les actions (publier, ajouter…) ne se doublent pas. Le titre et la durée, eux,
  // s'enregistrent sans attendre, à la file : taper un titre puis toucher une durée enchaîne deux
  // écritures, et la seconde ne doit pas être perdue (trouvé dans le navigateur le 17 novembre
  // 2026).
  const fileEcritures = useRef<Promise<unknown>>(Promise.resolve());
  async function ecrire<T>(
    action: () => Promise<ResultatStudio<T>>,
    apres?: (valeur: T) => void,
    verrou = true,
  ): Promise<void> {
    if (verrou && envoi) return;
    if (verrou) setEnvoi(true);
    setRefus(null);
    // Sans verrou, les écritures passent l'une après l'autre, dans l'ordre des gestes : la
    // dernière durée touchée est celle qui reste, même si le réseau répond dans le désordre.
    let resultat: ResultatStudio<T>;
    if (verrou) {
      resultat = await action();
    } else {
      const suivante = fileEcritures.current.then(action, action);
      fileEcritures.current = suivante;
      resultat = await suivante;
    }
    if (verrou) setEnvoi(false);
    if (resultat.issue === 'ok') {
      signalerStudioModifie();
      apres?.(resultat.valeur);
      relire();
    } else {
      setRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
    }
  }

  const programme = donnees?.programme;
  const brouillon = programme?.statut === 'brouillon';

  return (
    <FeuilleBasse
      ouverte={feuille !== null}
      onFermer={() => setFeuille(null)}
      enfants={
        feuille === 'apercu' && programme && donnees ? (
          <ApercuProgramme
            titre={titre}
            semaines={programme.dureeSemaines}
            seances={donnees.seances}
            onFermer={() => setFeuille(null)}
          />
        ) : programme && feuille === 'affectation' ? (
          <FeuilleAffectation
            programmeId={programme.id}
            onAffecte={() => {
              relire();
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
            Programme
          </Text>
          {programme ? (
            <Text
              style={{
                ...theme.texte.label,
                color: brouillon ? theme.couleur.texte.secondaire : theme.couleur.marque.primaire,
              }}
            >
              {LIBELLES_STATUT_PROGRAMME[programme.statut].toLocaleUpperCase('fr-FR')}
            </Text>
          ) : null}
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
              Ce programme est introuvable.
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
          {programme && donnees ? (
            <>
              {brouillon ? (
                <>
                  <Champ
                    libelle="Titre"
                    valeur={titre}
                    onChangeTexte={setTitre}
                    longueurMax={80}
                    onBlur={() => {
                      if (titre.trim() !== programme.titre) {
                        void ecrire(
                          () =>
                            port.modifierProgramme(programme.id, titre, programme.dureeSemaines),
                          undefined,
                          false,
                        );
                      }
                    }}
                  />
                  <View style={{ gap: theme.espace[2] }}>
                    <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
                      Durée (semaines)
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
                      {DUREES.map((d) => (
                        <Chip
                          key={d}
                          variante="selection"
                          libelle={String(d)}
                          selectionne={programme.dureeSemaines === d}
                          onPress={() =>
                            void ecrire(
                              () => port.modifierProgramme(programme.id, titre, d),
                              undefined,
                              false,
                            )
                          }
                        />
                      ))}
                    </View>
                  </View>
                </>
              ) : (
                <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
                  {`${programme.titre || 'Sans titre'} · ${programme.dureeSemaines} ${programme.dureeSemaines > 1 ? 'semaines' : 'semaine'}`}
                </Text>
              )}
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
                {`${programme.nombreSeances} ${programme.nombreSeances > 1 ? 'séances' : 'séance'} · ${programme.abonnesEnCours} ${programme.abonnesEnCours > 1 ? 'abonnés en cours' : 'abonné en cours'}`}
              </Text>

              {Array.from({ length: programme.dureeSemaines }, (_, i) => i + 1).map((semaine) => {
                const seances = donnees.seances.filter(
                  (s) => semaineEtJour(s.jourRelatif).semaine === semaine,
                );
                return (
                  <View key={semaine} style={{ gap: theme.espace[2] }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text
                        accessibilityRole="header"
                        style={{
                          ...theme.texte.titre3,
                          flex: 1,
                          color: theme.couleur.texte.principal,
                        }}
                      >
                        {`Semaine ${semaine}`}
                      </Text>
                      {brouillon && seances.length > 0 && semaine < programme.dureeSemaines ? (
                        <Bouton
                          libelle="Dupliquer"
                          variante="discret"
                          accessibilityLabel={`Dupliquer la semaine ${semaine} dans la suivante`}
                          onPress={() =>
                            void ecrire(() => port.dupliquerSemaine(programme.id, semaine))
                          }
                        />
                      ) : null}
                    </View>
                    {seances.map((s) => (
                      <Pressable
                        key={s.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${JOURS_COURTS[semaineEtJour(s.jourRelatif).jour]}, ${s.titre || 'Séance sans titre'}, ${s.nombreExercices} exercices`}
                        onPress={() => onOuvrirSeance(s.id)}
                        style={{
                          minHeight: theme.taille.tapMin,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: theme.espace[3],
                          padding: theme.espace[3],
                          borderRadius: theme.rayon.carte,
                          backgroundColor: theme.couleur.fond.surface,
                        }}
                      >
                        <Text
                          style={{ ...theme.texte.label, color: theme.couleur.texte.secondaire }}
                        >
                          {JOURS_COURTS[semaineEtJour(s.jourRelatif).jour]}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}
                          >
                            {s.titre || 'Séance sans titre'}
                          </Text>
                          <Text
                            style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}
                          >
                            {`${s.nombreExercices} ${s.nombreExercices > 1 ? 'exercices' : 'exercice'}`}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                    {brouillon ? (
                      <Bouton
                        libelle="Ajouter une séance"
                        variante="secondaire"
                        icone="ajouter"
                        accessibilityLabel={`Ajouter une séance en semaine ${semaine}`}
                        desactive={envoi}
                        onPress={() =>
                          void ecrire(
                            () => port.ajouterSeance(programme.id, (semaine - 1) * 7 + 1),
                            onOuvrirSeance,
                          )
                        }
                      />
                    ) : null}
                  </View>
                );
              })}

              {refus ? <BandeauRefus refus={refus} /> : null}
              <Bouton
                libelle="Aperçu client"
                variante="secondaire"
                desactive={envoi}
                onPress={() => setFeuille('apercu')}
              />
              {programme.statut === 'brouillon' ? (
                <Bouton
                  libelle={envoi ? 'Envoi en cours…' : 'Publier'}
                  variante="primaire"
                  desactive={envoi}
                  onPress={() => void ecrire(() => port.publierProgramme(programme.id))}
                />
              ) : null}
              {programme.statut === 'publie' ? (
                <View style={{ gap: theme.espace[2] }}>
                  <Bouton
                    libelle="Affecter à un abonné"
                    variante="primaire"
                    onPress={() => setFeuille('affectation')}
                  />
                  <Bouton
                    libelle="Revenir en édition"
                    variante="secondaire"
                    desactive={envoi}
                    onPress={() => void ecrire(() => port.revenirEnEdition(programme.id))}
                  />
                  <Bouton
                    libelle="Archiver"
                    variante="discret"
                    desactive={envoi}
                    onPress={() => void ecrire(() => port.archiverProgramme(programme.id))}
                  />
                </View>
              ) : null}
            </>
          ) : null}
        </DefilementEcran>
      </CanevasEcran>
    </FeuilleBasse>
  );
}

// « Affecter à un abonné » : qui, à partir de quand.
function FeuilleAffectation({
  programmeId,
  onAffecte,
}: {
  programmeId: string;
  onAffecte: () => void;
}) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [abonnes, setAbonnes] = useState<AbonneAffectable[] | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [debut, setDebut] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<TexteRefus | null>(null);
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    let monte = true;
    port
      .lireAbonnesAffectables()
      .then((lus) => {
        if (monte) setAbonnes(lus);
      })
      .catch(() => {
        if (monte) setAbonnes([]);
      });
    return () => {
      monte = false;
    };
  }, [port]);

  async function affecter() {
    if (!choisi || envoi) return;
    setEnvoi(true);
    setRefus(null);
    const resultat = await port.affecterProgramme(programmeId, choisi, jourParis(debut));
    setEnvoi(false);
    if (resultat.issue === 'ok') {
      setSucces(true);
      signalerStudioModifie();
      onAffecte();
    } else {
      setRefus(resultat.issue === 'refusee' ? texteRefus(resultat.code) : SANS_REPONSE);
    }
  }

  return (
    <View style={{ gap: theme.espace[4], padding: theme.espace.gouttiere }}>
      <Text
        accessibilityRole="header"
        style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}
      >
        Affecter à un abonné
      </Text>
      {abonnes === null ? <Squelette forme="ligne" /> : null}
      {abonnes?.length === 0 ? (
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
          Aucun abonné ne peut recevoir ce programme pour l’instant.
        </Text>
      ) : null}
      {abonnes && abonnes.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
            {abonnes.map((a) => (
              <Chip
                key={a.profilClientId}
                variante="selection"
                libelle={`${a.prenom} ${a.initialeNom}.`}
                selectionne={choisi === a.profilClientId}
                onPress={() => setChoisi(a.profilClientId)}
              />
            ))}
          </View>
          <View style={{ gap: theme.espace[2] }}>
            <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
              À partir de
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
              <Chip
                variante="selection"
                libelle="Aujourd’hui"
                selectionne={debut === 0}
                onPress={() => setDebut(0)}
              />
              <Chip
                variante="selection"
                libelle="Demain"
                selectionne={debut === 1}
                onPress={() => setDebut(1)}
              />
            </View>
          </View>
          {succes ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}
            >
              Programme affecté. Ses séances apparaissent dans son application.
            </Text>
          ) : null}
          {refus ? <BandeauRefus refus={refus} /> : null}
          <Bouton
            libelle={envoi ? 'Envoi en cours…' : 'Affecter'}
            variante="primaire"
            desactive={!choisi || envoi}
            onPress={() => void affecter()}
          />
        </>
      ) : null}
    </View>
  );
}
