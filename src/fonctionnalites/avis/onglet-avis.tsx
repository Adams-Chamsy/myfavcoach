import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { Chip } from '@/composants/chip';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { EtatVide } from '@/composants/etats/etat-vide';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { AvisDuCoach, AvisPublic, EtatMonAvis, EtiquetteAvis } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L2-13-avis.md (l'onglet Avis du profil coach, maquette 27) et l'état 27b de
// docs/ecrans/L4-27a-depot-avis.md (maquette 27b). Tout vient du serveur (P4.9a) : la durée de
// suivi (jamais une date), la moyenne (rendue à partir de 5 avis seulement), l'éligibilité et le
// nombre de jours restants. Les avis `signale` et `masque` ne sortent jamais de avis_du_coach.
//
// 27a (le dépôt) n'est pas encore construit : il attend la durée de suivi du client, que l'étape
// serveur à venir rendra (docs/decisions-en-attente.md). D'ici là, « Donner mon avis » n'existe
// que dans son état INACTIF (27b) — jamais actif vers un écran absent.

type Lecture = { avis: AvisDuCoach; etiquettes: EtiquetteAvis[]; monAvis: EtatMonAvis };

function auteur(a: AvisPublic): string {
  return a.initialeNom ? `${a.prenom} ${a.initialeNom}.` : a.prenom;
}

export function OngletAvis({ coachId }: { coachId: string; prenom: string }) {
  const theme = useTheme();
  const { port } = useDonnees();
  const { session } = useSession();
  const connecte = Boolean(session?.emailVerifie);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [erreur, setErreur] = useState(false);
  const [filtre, setFiltre] = useState<string | null>(null);

  useEffect(() => {
    let monte = true;
    // L'état du lecteur (27b) ne se lit qu'avec une session : anon n'a ni encart ni bouton.
    const monAvis: Promise<EtatMonAvis> = connecte
      ? port.lireMonAvis(coachId).catch(() => ({ etat: 'aucun' }))
      : Promise.resolve({ etat: 'aucun' });
    void Promise.all([port.lireAvisDuCoach(coachId), port.lireEtiquettesAvis(), monAvis])
      .then(([avis, etiquettes, mien]) => {
        if (monte) setLecture({ avis, etiquettes, monAvis: mien });
      })
      .catch(() => {
        if (monte) setErreur(true);
      });
    return () => {
      monte = false;
    };
  }, [coachId, connecte, port]);

  if (erreur) {
    return (
      <EtatErreur
        titre={textesRepliErreur.serveur.titre}
        explication={textesRepliErreur.serveur.explication}
        nombreEchecs={0}
        onReessayer={() => setErreur(false)}
      />
    );
  }
  if (!lecture) return <Squelette forme="carte" />;

  const { avis, etiquettes, monAvis } = lecture;
  const libelle = (cle: string) => etiquettes.find((e) => e.cle === cle)?.libelle ?? cle;
  const encart =
    monAvis.etat === 'pas_encore' || monAvis.etat === 'suivi_interrompu' ? monAvis : null;
  const visibles = filtre ? avis.avis.filter((a) => a.etiquettes.includes(filtre)) : avis.avis;

  return (
    <View style={{ gap: theme.espace[4] }}>
      {encart ? (
        <View
          style={{
            padding: theme.espace[4],
            borderRadius: theme.rayon.carte,
            backgroundColor: theme.couleur.fond.creux,
            gap: theme.espace[1],
          }}
        >
          {encart.etat === 'pas_encore' ? (
            <>
              <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                {`Encore ${encart.joursRestants} jours`}
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                Tu pourras donner ton avis après 30 jours de suivi. Le temps de savoir ce que tu en
                penses vraiment.
              </Text>
            </>
          ) : (
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Tu pourras donner ton avis quand ton suivi aura repris.
            </Text>
          )}
        </View>
      ) : null}

      {avis.avis.length === 0 ? (
        <EtatVide
          titre="Aucun avis pour l’instant"
          explication="Ce coach n’a pas encore reçu d’avis."
        />
      ) : (
        <>
          {encart ? (
            <Text style={{ ...theme.texte.label, color: theme.couleur.texte.secondaire }}>
              Ce que disent les autres
            </Text>
          ) : null}

          {avis.synthese.moyenne !== null ? <Synthese avis={avis} /> : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
            <Chip
              variante="filtre"
              libelle="Tous"
              selectionne={filtre === null}
              onPress={() => setFiltre(null)}
            />
            {avis.synthese.etiquettesPortees.map((cle) => (
              <Chip
                key={cle}
                variante="filtre"
                libelle={libelle(cle)}
                selectionne={filtre === cle}
                onPress={() => setFiltre(cle)}
              />
            ))}
          </View>

          {visibles.map((a) => (
            <View
              key={a.id}
              style={{
                gap: theme.espace[2],
                paddingVertical: theme.espace[3],
                borderTopWidth: 1,
                borderTopColor: theme.couleur.bordure.discrete,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.espace[2] }}>
                <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                  {auteur(a)}
                </Text>
                <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
                  {`${a.dureeSuiviMois} mois de suivi`}
                </Text>
              </View>
              <Etoiles note={a.note} />
              {a.etiquettes.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
                  {a.etiquettes.map((cle) => (
                    <Text
                      key={cle}
                      style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}
                    >
                      {libelle(cle)}
                    </Text>
                  ))}
                </View>
              ) : null}
              {a.texte ? (
                <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                  {a.texte}
                </Text>
              ) : null}
            </View>
          ))}
        </>
      )}

      {encart ? (
        <Bouton
          libelle="Donner mon avis"
          accessibilityLabel={
            encart.etat === 'pas_encore'
              ? `Donner mon avis, possible dans ${encart.joursRestants} jours`
              : 'Donner mon avis, possible quand ton suivi aura repris'
          }
          variante="primaire"
          onPress={() => {}}
          desactive
        />
      ) : null}
    </View>
  );
}

// La note d'un avis : cinq étoiles, ET le texte « {n} sur 5 » — jamais la seule couleur
// (CLAUDE.md §5) ; même forme que le libellé des étoiles de 27a.
function Etoiles({ note }: { note: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[1] }}>
      <View
        style={{ flexDirection: 'row' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Icone
            key={n}
            nom="note"
            couleur={n <= note ? theme.couleur.marque.accent : theme.couleur.bordure.discrete}
          />
        ))}
      </View>
      <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}>
        {`${note} sur 5`}
      </Text>
    </View>
  );
}

// Bloc note (maquette 27) : la moyenne du serveur au dixième, le nombre d'avis, la distribution
// en barres de 5 à 1. Rendu seulement quand le serveur rend une moyenne (5 avis publiés ou plus).
function Synthese({ avis }: { avis: AvisDuCoach }) {
  const theme = useTheme();
  const { moyenne, nombre, distribution } = avis.synthese;
  const plusGrand = Math.max(1, ...distribution);
  return (
    <View style={{ flexDirection: 'row', gap: theme.espace[4], alignItems: 'center' }}>
      <View style={{ alignItems: 'center', gap: theme.espace[1] }}>
        <Text style={{ ...theme.texte.display, color: theme.couleur.texte.principal }}>
          {(moyenne ?? 0).toLocaleString('fr-FR', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
        </Text>
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
          {`${nombre} avis`}
        </Text>
      </View>
      <View style={{ flex: 1, gap: theme.espace[1] }}>
        {[5, 4, 3, 2, 1].map((etoiles) => (
          <View
            key={etoiles}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[2] }}
          >
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}>
              {etoiles}
            </Text>
            <View
              style={{
                flex: 1,
                height: theme.espace[1],
                borderRadius: theme.rayon.pilule,
                backgroundColor: theme.couleur.bordure.discrete,
              }}
            >
              <View
                style={{
                  width: `${((distribution[etoiles - 1] ?? 0) / plusGrand) * 100}%`,
                  height: '100%',
                  borderRadius: theme.rayon.pilule,
                  backgroundColor: theme.couleur.marque.accent,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
