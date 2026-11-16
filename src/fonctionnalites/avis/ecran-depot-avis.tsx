import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/composants/avatar';
import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { CadreFormulaireV2 } from '@/composants/presentation-v2';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type {
  EtiquetteAvis,
  MonAvis,
  ProfilCoachPublic,
  RefusServeur,
} from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { signalerAvisEnregistre } from './avis-enregistre';

// docs/ecrans/L4-27a-depot-avis.md (P4.9b) : déposer un avis, ou le modifier pendant 14 jours.
// Un seul champ obligatoire, la note. L'éligibilité est tranchée par le serveur (mon_avis_possible,
// 0049/0061) : cet écran ne s'ouvre en saisie que pour les états `possible` et `modifiable`, et
// le refus d'un dépôt s'affiche tel quel (docs/api.md §1). La durée de suivi vient du serveur.

// Tranché le 28 septembre 2026 (fiche, Contenu).
export const MOTS_NOTE = ['Décevant', 'Mitigé', 'Correct', 'Très bien', 'Excellent'] as const;
export const ETIQUETTES_MAX = 3;
export const TEXTE_MAX = 600;

export type ProprietesEcranDepotAvis = {
  coachId: string;
  onRetour: () => void;
  // Succès : retour à l'onglet Avis, qui relit (fiche, États).
  onEnregistre: () => void;
  // Ni dépôt ni modification possibles pour ce lecteur (pas encore éligible, avis figé, aucun
  // suivi) : rien à saisir ici, la route ramène au profil du coach.
  onRienADeposer: () => void;
};

// Les deux seuls états où l'on saisit : `dureeSuiviMois` est toujours là, l'avis seulement en
// modification.
type EtatSaisie =
  | { etat: 'possible'; dureeSuiviMois: number }
  | { etat: 'modifiable'; dureeSuiviMois: number; avis: MonAvis };

type Lecture =
  | { type: 'lecture' }
  | { type: 'erreur'; echecs: number }
  | { type: 'pret'; profil: ProfilCoachPublic; etiquettes: EtiquetteAvis[]; monAvis: EtatSaisie };

type Envoi =
  | { type: 'repos' }
  | { type: 'envoi' }
  | { type: 'refus'; refus: RefusServeur }
  | { type: 'sans_reponse' };

export function EcranDepotAvis({
  coachId,
  onRetour,
  onEnregistre,
  onRienADeposer,
}: ProprietesEcranDepotAvis) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [lecture, setLecture] = useState<Lecture>({ type: 'lecture' });
  const [cleTentative, setCleTentative] = useState(0);
  const [note, setNote] = useState<number | null>(null);
  const [choisies, setChoisies] = useState<string[]>([]);
  const [texte, setTexte] = useState('');
  const [quatriemeRefusee, setQuatriemeRefusee] = useState(false);
  const [envoi, setEnvoi] = useState<Envoi>({ type: 'repos' });
  // Garde synchrone : « non pressable deux fois » (fiche, États).
  const verrou = useRef(false);

  useEffect(() => {
    let monte = true;
    void Promise.all([
      port.lireProfilCoachPublic(coachId),
      port.lireEtiquettesAvis(),
      port.lireMonAvis(coachId),
    ])
      .then(([profil, etiquettes, monAvis]) => {
        if (!monte) return;
        if (!profil || (monAvis.etat !== 'possible' && monAvis.etat !== 'modifiable')) {
          onRienADeposer();
          return;
        }
        // Modification : champs pré-remplis depuis l'avis existant, relu du serveur.
        if (monAvis.etat === 'modifiable') {
          setNote(monAvis.avis.note);
          setChoisies(monAvis.avis.etiquettes);
          setTexte(monAvis.avis.texte ?? '');
          setLecture({
            type: 'pret',
            profil,
            etiquettes,
            monAvis: {
              etat: 'modifiable',
              dureeSuiviMois: monAvis.dureeSuiviMois,
              avis: monAvis.avis,
            },
          });
          return;
        }
        setLecture({
          type: 'pret',
          profil,
          etiquettes,
          monAvis: { etat: 'possible', dureeSuiviMois: monAvis.dureeSuiviMois },
        });
      })
      .catch(() => {
        if (monte)
          setLecture((l) => ({ type: 'erreur', echecs: l.type === 'erreur' ? l.echecs + 1 : 1 }));
      });
    return () => {
      monte = false;
    };
  }, [coachId, port, cleTentative, onRienADeposer]);

  function basculerEtiquette(cle: string) {
    if (choisies.includes(cle)) {
      setChoisies(choisies.filter((c) => c !== cle));
      setQuatriemeRefusee(false);
      return;
    }
    // La quatrième sélection est refusée avec un message, pas ignorée en silence (fiche).
    if (choisies.length >= ETIQUETTES_MAX) {
      setQuatriemeRefusee(true);
      return;
    }
    setChoisies([...choisies, cle]);
  }

  async function envoyer(modification: boolean) {
    if (note === null || verrou.current) return;
    verrou.current = true;
    setEnvoi({ type: 'envoi' });
    try {
      const propre = texte.trim();
      const saisie = { note, etiquettes: choisies, texte: propre === '' ? null : propre };
      const resultat = modification
        ? await port.modifierAvis(coachId, saisie)
        : await port.deposerAvis(coachId, saisie);
      if (resultat.issue === 'enregistre') {
        // L'onglet Avis du profil, resté monté derrière, relit (avis-enregistre.ts).
        signalerAvisEnregistre(coachId);
        onEnregistre();
        return;
      }
      // Refus ou absence de réponse : aucun champ perdu (fiche, États).
      setEnvoi(
        resultat.issue === 'refusee'
          ? { type: 'refus', refus: resultat.refus }
          : { type: 'sans_reponse' },
      );
    } finally {
      verrou.current = false;
    }
  }

  const pret = lecture.type === 'pret' ? lecture : null;
  const modification = pret?.monAvis.etat === 'modifiable';

  return (
    <CadreFormulaireV2
      surtitre="TON EXPÉRIENCE"
      titre="Comment ça se passe ?"
      entete={<BoutonIcone nom="retour" accessibilityLabel="Retour" onPress={onRetour} />}
      actions={
        pret ? (
          <View>
            <Bouton
              libelle={
                envoi.type === 'envoi'
                  ? 'Envoi en cours…'
                  : modification
                    ? 'Enregistrer les modifications'
                    : 'Publier mon avis'
              }
              variante="primaire"
              onPress={() => void envoyer(modification)}
              desactive={note === null || envoi.type === 'envoi'}
            />
          </View>
        ) : null
      }
    >
      {lecture.type === 'lecture' ? <Squelette forme="detail" /> : null}
      {lecture.type === 'erreur' ? (
        <EtatErreur
          titre={textesRepliErreur.serveur.titre}
          explication={textesRepliErreur.serveur.explication}
          nombreEchecs={lecture.echecs}
          onReessayer={() => setCleTentative((c) => c + 1)}
        />
      ) : null}

      {pret ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}>
            <Avatar nom={`${pret.profil.prenom} ${pret.profil.nom}`} taille="lg" />
            <View style={{ flex: 1, gap: theme.espace[1] }}>
              <Text style={{ ...theme.texte.v2NomResultat, color: theme.couleur.texte.principal }}>
                {`${pret.profil.prenom} ${pret.profil.nom}`}
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {`Suivi depuis ${pret.monAvis.dureeSuiviMois} mois`}
              </Text>
            </View>
          </View>

          <View style={{ gap: theme.espace[3] }}>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row' }}>
              {MOTS_NOTE.map((mot, i) => {
                const n = i + 1;
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="radio"
                    accessibilityLabel={`${n} sur 5, ${mot}`}
                    accessibilityState={{ checked: note === n }}
                    onPress={() => setNote(n)}
                    style={{
                      minWidth: theme.taille.tapMin,
                      minHeight: theme.taille.tapMin,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icone
                      nom="note"
                      couleur={
                        note !== null && n <= note
                          ? theme.couleur.marque.accent
                          : theme.couleur.bordure.marquee
                      }
                    />
                  </Pressable>
                );
              })}
            </View>
            {/* Le mot de la note choisie : la note n'est jamais portée par la seule couleur. */}
            {note !== null ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.principal }}
              >
                {MOTS_NOTE[note - 1]}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: theme.espace[3] }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: theme.espace[2],
              }}
            >
              <Text
                style={{
                  ...theme.texte.v2NomResultat,
                  flex: 1,
                  color: theme.couleur.texte.principal,
                }}
              >
                {`Ce qui caractérise ${pret.profil.prenom}`}
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {`${choisies.length} sur ${ETIQUETTES_MAX}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
              {pret.etiquettes.map((e) => (
                <Chip
                  key={e.cle}
                  variante="selection"
                  libelle={e.libelle}
                  selectionne={choisies.includes(e.cle)}
                  onPress={() => basculerEtiquette(e.cle)}
                />
              ))}
            </View>
            {quatriemeRefusee ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}
              >
                Trois étiquettes au plus. Retires-en une pour en choisir une autre.
              </Text>
            ) : null}
          </View>

          <View style={{ gap: theme.espace[2] }}>
            <Champ
              libelle="Raconte, si tu veux"
              valeur={texte}
              onChangeTexte={setTexte}
              multiligne
              longueurMax={TEXTE_MAX}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
                Facultatif
              </Text>
              <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
                {`${texte.length} / ${TEXTE_MAX}`}
              </Text>
            </View>
          </View>

          {/* L'encart annonce TOUT ce qui sera public, avant le geste (fiche, correction 2). */}
          <View
            style={{
              flexDirection: 'row',
              gap: theme.espace[3],
              padding: theme.espace[4],
              borderRadius: theme.rayon.carte,
              backgroundColor: theme.couleur.fond.creux,
            }}
          >
            <Icone nom="information" couleur={theme.couleur.texte.secondaire} />
            <Text style={{ ...theme.texte.petit, flex: 1, color: theme.couleur.texte.secondaire }}>
              {`Ton avis sera public sur le profil de ${pret.profil.prenom}, signé de ton prénom, de l’initiale de ton nom et de la durée de ton suivi. Tu peux le modifier pendant 14 jours, puis il se fige.`}
            </Text>
          </View>

          {envoi.type === 'refus' ? (
            <View accessibilityLiveRegion="polite" style={{ gap: theme.espace[1] }}>
              <Text style={{ ...theme.texte.v2NomResultat, color: theme.couleur.etat.erreurEncre }}>
                {envoi.refus.title}
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
                {envoi.refus.detail}
              </Text>
            </View>
          ) : null}
          {envoi.type === 'sans_reponse' ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{ ...theme.texte.v2Corps, color: theme.couleur.etat.erreurEncre }}
            >
              Pas de connexion. Réessaie.
            </Text>
          ) : null}
        </>
      ) : null}
    </CadreFormulaireV2>
  );
}
