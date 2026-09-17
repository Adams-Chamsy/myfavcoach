import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Modale } from '@/composants/modale';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useGardeSortie } from '@/fonctionnalites/navigation/garde-sortie';
import type {
  CommuneReference,
  InformationsCompte,
  Langue,
  ModificationsInformations,
} from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-09-mes-informations.md, « Mes informations ». Modifie le PROFIL ACTIF : le
// formulaire n'est pas le même des deux côtés. Enregistrement EXPLICITE par le bouton en pied,
// jamais à la frappe (une sauvegarde automatique sur un champ de nom produit des états
// intermédiaires absurdes côté serveur).
//
// Absent de cet écran, décision explicite (voir docs/dette.md) :
// - Photo : aucun bucket Supabase Storage n'existe encore. Un champ qui ne peut rien
//   enregistrer est pire qu'un champ absent.
//
// Commune, Formats, Parcours, Langues (révision du 13 septembre 2026, docs/dette.md) : quatre
// colonnes réelles (0001, 0016, 0022) jamais écrites par aucun écran jusqu'ici — sans ce
// formulaire, rechercher_coachs() (L3) trie sur une proximité et filtre sur un format que
// personne ne peut renseigner. Commune (les deux profils) et commune de base (coach) partagent
// le même référentiel fermé (`lireCommunesReference`, L3-02). Langues suit exactement le même
// principe que Discipline (P1.14) : liste fermée en table de référence
// (0025_creer_langues_reference_et_communes_fkey.sql), jamais un texte libre — deux « Nadia » ne
// doivent pas pouvoir écrire « fr » et « Français » pour la même langue.
//
// Date de naissance (les deux profils) et discipline (coach) : LECTURE SEULE, rendues comme du
// texte, jamais un champ. La date porte la règle des 18 ans (colonne hors GRANT UPDATE,
// 0001_creer_identite.sql). La discipline attend la liste figée, décision produit de P1.14
// (activation de l'espace coach) qui gouverne la recherche du lot L3 — pas une décision
// d'implémentation à prendre ici.

const FORMATS_POSSIBLES = ['visio', 'presentiel'] as const;

function libelleFormat(format: string): string {
  return format === 'visio' ? 'En visio' : 'En présentiel';
}

function formaterDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-');
  return annee && mois && jour ? `${jour}/${mois}/${annee}` : iso;
}

// Ce que le formulaire peut réécrire, sérialisé pour comparer « saisie actuelle » à « valeurs
// d'origine » — remettre un champ à sa valeur initiale repasse `modifie` à false (critère 2).
// `formats`/`langues` sont triés avant sérialisation : ce sont des ENSEMBLES, pas des listes
// ordonnées — décocher puis recocher la même langue ne doit jamais compter comme un changement
// réel simplement parce que l'ordre d'insertion a bougé.
function empreinte(
  profil: 'client' | 'coach',
  v: {
    prenom: string;
    nom: string;
    titreCourt: string;
    bio: string;
    communeInsee: string | null;
    communeBaseInsee: string | null;
    formats: string[];
    parcoursTexte: string;
    langues: string[];
  },
) {
  return profil === 'coach'
    ? JSON.stringify([
        v.prenom.trim(),
        v.nom.trim(),
        v.titreCourt.trim(),
        v.bio.trim(),
        v.communeBaseInsee,
        [...v.formats].sort(),
        v.parcoursTexte.trim(),
        [...v.langues].sort(),
      ])
    : JSON.stringify([v.prenom.trim(), v.nom.trim(), v.communeInsee]);
}

export default function Informations() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port, enregistrerInformations } = useDonnees();

  const [lecture, setLecture] = useState<InformationsCompte | null>(null);
  const [communes, setCommunes] = useState<CommuneReference[]>([]);
  const [languesDisponibles, setLanguesDisponibles] = useState<Langue[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurLecture, setErreurLecture] = useState(false);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [titreCourt, setTitreCourt] = useState('');
  const [bio, setBio] = useState('');
  const [communeInsee, setCommuneInsee] = useState<string | null>(null);
  const [communeBaseInsee, setCommuneBaseInsee] = useState<string | null>(null);
  const [formats, setFormats] = useState<string[]>([]);
  const [parcoursTexte, setParcoursTexte] = useState('');
  const [langues, setLangues] = useState<string[]>([]);
  const [empreinteInitiale, setEmpreinteInitiale] = useState('');

  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurEcriture, setErreurEcriture] = useState<string | null>(null);

  useEffect(() => {
    let monte = true;
    Promise.all([port.lireInformations(), port.lireCommunesReference(), port.lireLangues()])
      .then(([info, communesRef, languesRef]) => {
        if (!monte) return;
        setLecture(info);
        setCommunes(communesRef);
        setLanguesDisponibles(languesRef);
        setPrenom(info.prenom);
        setNom(info.nom ?? '');
        const tc = info.profil === 'coach' ? (info.titreCourt ?? '') : '';
        const bo = info.profil === 'coach' ? (info.bio ?? '') : '';
        const ci = info.profil === 'client' ? info.communeInsee : null;
        const cbi = info.profil === 'coach' ? info.communeBaseInsee : null;
        const fo = info.profil === 'coach' ? info.formats : [];
        const pt = info.profil === 'coach' ? (info.parcoursTexte ?? '') : '';
        const la = info.profil === 'coach' ? info.langues : [];
        setTitreCourt(tc);
        setBio(bo);
        setCommuneInsee(ci);
        setCommuneBaseInsee(cbi);
        setFormats(fo);
        setParcoursTexte(pt);
        setLangues(la);
        setEmpreinteInitiale(
          empreinte(info.profil, {
            prenom: info.prenom,
            nom: info.nom ?? '',
            titreCourt: tc,
            bio: bo,
            communeInsee: ci,
            communeBaseInsee: cbi,
            formats: fo,
            parcoursTexte: pt,
            langues: la,
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
    lecture != null &&
    empreinte(profil, {
      prenom,
      nom,
      titreCourt,
      bio,
      communeInsee,
      communeBaseInsee,
      formats,
      parcoursTexte,
      langues,
    }) !== empreinteInitiale;

  const { sortieEnAttente, annulerSortie } = useGardeSortie(modifie);

  function basculerFormat(format: string) {
    setFormats((f) => (f.includes(format) ? f.filter((x) => x !== format) : [...f, format]));
  }

  function basculerLangue(cle: string) {
    setLangues((l) => (l.includes(cle) ? l.filter((x) => x !== cle) : [...l, cle]));
  }

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
            communeBaseInsee,
            formats,
            parcoursTexte: parcoursTexte.trim() === '' ? null : parcoursTexte.trim(),
            langues,
          }
        : {
            profil: 'client',
            prenom: prenom.trim(),
            nom: nom.trim() === '' ? null : nom.trim(),
            communeInsee,
          };

    const resultat = await enregistrerInformations(modifs);
    setEnregistrement(false);
    if (!resultat.succes) {
      setErreurEcriture(resultat.erreur);
      return;
    }
    // Succès : les valeurs saisies deviennent les nouvelles « valeurs d'origine » — le bouton
    // redevient inactif, la garde de sortie se relâche, l'utilisateur reste sur l'écran. Le
    // prénom/nom du profil actif est aussi EtatProfils.identiteActive (lu par l'écran compte,
    // la feuille de bascule) : le fournisseur l'a rafraîchi, cet écran n'a rien à faire de plus.
    setEmpreinteInitiale(
      empreinte(lecture.profil, {
        prenom,
        nom,
        titreCourt,
        bio,
        communeInsee,
        communeBaseInsee,
        formats,
        parcoursTexte,
        langues,
      }),
    );
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

              <View style={{ gap: theme.espace[2] }}>
                <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
                  {profil === 'coach' ? 'Commune de base' : 'Commune'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
                  {communes.map((commune) => {
                    const valeurActuelle = profil === 'coach' ? communeBaseInsee : communeInsee;
                    const definir = profil === 'coach' ? setCommuneBaseInsee : setCommuneInsee;
                    return (
                      <Chip
                        key={commune.codeInsee}
                        variante="filtre"
                        libelle={commune.nom}
                        selectionne={valeurActuelle === commune.codeInsee}
                        onPress={() =>
                          definir(valeurActuelle === commune.codeInsee ? null : commune.codeInsee)
                        }
                      />
                    );
                  })}
                </View>
              </View>

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
                  <Champ
                    libelle="Parcours"
                    valeur={parcoursTexte}
                    onChangeTexte={setParcoursTexte}
                    desactive={enregistrement}
                  />

                  <View style={{ gap: theme.espace[2] }}>
                    <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
                      Formats
                    </Text>
                    <View style={{ flexDirection: 'row', gap: theme.espace[2] }}>
                      {FORMATS_POSSIBLES.map((f) => (
                        <Chip
                          key={f}
                          variante="selection"
                          libelle={libelleFormat(f)}
                          selectionne={formats.includes(f)}
                          onPress={() => basculerFormat(f)}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={{ gap: theme.espace[2] }}>
                    <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
                      Langues
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
                      {languesDisponibles.map((langue) => (
                        <Chip
                          key={langue.cle}
                          variante="selection"
                          libelle={langue.libelle}
                          selectionne={langues.includes(langue.cle)}
                          onPress={() => basculerLangue(langue.cle)}
                        />
                      ))}
                    </View>
                  </View>

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
