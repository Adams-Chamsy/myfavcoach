import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { Champ } from '@/composants/champ';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Modale } from '@/composants/modale';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useGardeSortie } from '@/fonctionnalites/navigation/garde-sortie';
import type { InformationsCompte, ModificationsInformations } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-09-mes-informations.md, « Mes informations ». Modifie le PROFIL ACTIF : le
// formulaire n'est pas le même des deux côtés. Enregistrement EXPLICITE par le bouton en pied,
// jamais à la frappe (une sauvegarde automatique sur un champ de nom produit des états
// intermédiaires absurdes côté serveur).
//
// Absents de cet écran, décision explicite (voir docs/dette.md) :
// - Photo : aucun bucket Supabase Storage n'existe encore.
// - Commune : aucun référentiel INSEE n'existe encore.
// Un champ qui ne peut rien enregistrer est pire qu'un champ absent.
//
// Date de naissance (les deux profils) et discipline (coach) : LECTURE SEULE, rendues comme du
// texte, jamais un champ. La date porte la règle des 18 ans (colonne hors GRANT UPDATE,
// 0001_creer_identite.sql). La discipline attend la liste figée, décision produit de P1.14
// (activation de l'espace coach) qui gouverne la recherche du lot L3 — pas une décision
// d'implémentation à prendre ici.

function formaterDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-');
  return annee && mois && jour ? `${jour}/${mois}/${annee}` : iso;
}

// Ce que le formulaire peut réécrire, sérialisé pour comparer « saisie actuelle » à « valeurs
// d'origine » — remettre un champ à sa valeur initiale repasse `modifie` à false (critère 2).
function empreinte(
  profil: 'client' | 'coach',
  v: { prenom: string; nom: string; titreCourt: string; bio: string },
) {
  return profil === 'coach'
    ? JSON.stringify([v.prenom.trim(), v.nom.trim(), v.titreCourt.trim(), v.bio.trim()])
    : JSON.stringify([v.prenom.trim(), v.nom.trim()]);
}

export default function Informations() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port } = useDonnees();

  const [lecture, setLecture] = useState<InformationsCompte | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreurLecture, setErreurLecture] = useState(false);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [titreCourt, setTitreCourt] = useState('');
  const [bio, setBio] = useState('');
  const [empreinteInitiale, setEmpreinteInitiale] = useState('');

  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurEcriture, setErreurEcriture] = useState<string | null>(null);

  useEffect(() => {
    let monte = true;
    port
      .lireInformations()
      .then((info) => {
        if (!monte) return;
        setLecture(info);
        setPrenom(info.prenom);
        setNom(info.nom ?? '');
        const tc = info.profil === 'coach' ? (info.titreCourt ?? '') : '';
        const bo = info.profil === 'coach' ? (info.bio ?? '') : '';
        setTitreCourt(tc);
        setBio(bo);
        setEmpreinteInitiale(
          empreinte(info.profil, {
            prenom: info.prenom,
            nom: info.nom ?? '',
            titreCourt: tc,
            bio: bo,
          }),
        );
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

  const profil = lecture?.profil ?? 'client';
  const modifie =
    lecture != null && empreinte(profil, { prenom, nom, titreCourt, bio }) !== empreinteInitiale;

  const { sortieEnAttente, annulerSortie } = useGardeSortie(modifie);

  async function enregistrer() {
    if (!lecture) return;
    setErreurEcriture(null);
    setEnregistrement(true);

    const modifs: ModificationsInformations =
      lecture.profil === 'coach'
        ? {
            profil: 'coach',
            prenom: prenom.trim(),
            nom: nom.trim(),
            titreCourt: titreCourt.trim() === '' ? null : titreCourt.trim(),
            bio: bio.trim() === '' ? null : bio.trim(),
          }
        : {
            profil: 'client',
            prenom: prenom.trim(),
            nom: nom.trim() === '' ? null : nom.trim(),
          };

    const resultat = await port.enregistrerInformations(modifs);
    setEnregistrement(false);
    if (!resultat.succes) {
      setErreurEcriture(resultat.erreur);
      return;
    }
    // Succès : les valeurs saisies deviennent les nouvelles « valeurs d'origine » — le bouton
    // redevient inactif, la garde de sortie se relâche, l'utilisateur reste sur l'écran.
    setEmpreinteInitiale(empreinte(lecture.profil, { prenom, nom, titreCourt, bio }));
  }

  return (
    <Modale
      ouverte={sortieEnAttente !== null}
      onFermer={annulerSortie}
      titre="Modifications non enregistrées"
      corps="Tu as des modifications non enregistrées."
      libelleAction="Rester"
      onAction={annulerSortie}
      libelleDestructeur="Quitter"
      onDestructeur={() => sortieEnAttente?.reprendre()}
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
            Mes informations
          </Text>
        </View>

        {chargement ? (
          <View style={{ paddingHorizontal: theme.espace.gouttiere, gap: theme.espace[4] }}>
            <Squelette forme="ligne" />
            <Squelette forme="ligne" />
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
          <>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: theme.espace.gouttiere,
                paddingTop: theme.espace[2],
                paddingBottom: theme.espace[6],
                gap: theme.espace[4],
              }}
            >
              {erreurEcriture ? (
                <View accessibilityLiveRegion="polite">
                  <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
                    {erreurEcriture}
                  </Text>
                </View>
              ) : null}

              <Champ
                libelle="Prénom"
                valeur={prenom}
                onChangeTexte={setPrenom}
                desactive={enregistrement}
              />
              <Champ
                libelle="Nom"
                valeur={nom}
                onChangeTexte={setNom}
                desactive={enregistrement}
                placeholder={profil === 'client' ? 'Facultatif' : undefined}
              />

              {profil === 'coach' ? (
                <>
                  <Champ
                    libelle="Titre court"
                    valeur={titreCourt}
                    onChangeTexte={setTitreCourt}
                    desactive={enregistrement}
                  />
                  <Champ
                    libelle="Bio"
                    valeur={bio}
                    onChangeTexte={setBio}
                    desactive={enregistrement}
                  />
                  {/* Discipline : lecture seule à ce lot. La liste figée est fixée à P1.14
                      (activation de l'espace coach). */}
                  <ChampLectureSeule
                    libelle="Discipline"
                    valeur={lecture?.profil === 'coach' ? lecture.discipline : ''}
                    mention="Pour la modifier, écris-nous."
                  />
                </>
              ) : null}

              <ChampLectureSeule
                libelle="Date de naissance"
                valeur={lecture ? formaterDate(lecture.dateNaissance) : ''}
                mention="Pour la modifier, écris-nous."
              />
            </ScrollView>

            <View
              style={{
                paddingHorizontal: theme.espace.gouttiere,
                paddingTop: theme.espace[3],
                paddingBottom: insets.bottom + theme.espace[3],
                borderTopWidth: 1,
                borderTopColor: theme.couleur.bordure.discrete,
                backgroundColor: theme.couleur.fond.canevas,
              }}
            >
              <Bouton
                libelle="Enregistrer"
                variante="primaire"
                onPress={enregistrer}
                desactive={!modifie || enregistrement}
              />
            </View>
          </>
        )}
      </View>
    </Modale>
  );
}

// Un libellé, une valeur en texte, une mention en dessous — jamais un TextInput : la valeur
// n'est pas modifiable depuis l'application (critère 3 : « aucun champ éditable dans l'arbre
// rendu » pour la date de naissance).
function ChampLectureSeule({
  libelle,
  valeur,
  mention,
}: {
  libelle: string;
  valeur: string;
  mention: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.espace[2] }}>
      <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>{libelle}</Text>
      <View
        style={{
          minHeight: theme.taille.controle,
          justifyContent: 'center',
          borderRadius: theme.rayon.saisie,
          borderWidth: theme.taille.focusContour,
          borderColor: theme.couleur.bordure.discrete,
          backgroundColor: theme.couleur.fond.creux,
          paddingHorizontal: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
          {valeur}
        </Text>
      </View>
      <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>{mention}</Text>
    </View>
  );
}
