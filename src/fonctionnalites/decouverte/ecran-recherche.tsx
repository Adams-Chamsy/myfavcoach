import { CanevasEcran, DefilementEcran, useDispositionEcran } from '@/composants/canevas-ecran';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState, type ReactElement } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { Choix } from '@/composants/choix';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EmplacementImage } from '@/composants/emplacement-image';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { EntetePublicV2, FournisseurPresentationV2 } from '@/composants/presentation-v2';
import { EtatVide } from '@/composants/etats/etat-vide';
import { FeuilleBasse } from '@/composants/feuille-basse';
import { Icone } from '@/composants/icones';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { CommuneReference, Discipline, ResultatCoachRecherche } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { font, presentationV2 as mesure } from '@/theme/tokens';

// Écran 02 (docs/ecrans/L3-02-recherche-filtres.md). Consomme rechercher_coachs()
// (0023_creer_recherche_coachs.sql, validée par douze cycles casser/restaurer, P3.3).
//
// PAS de note, PAS d'avis, PAS de tri par note, PAS de badge de certification nommé, PAS de tag
// de capacité, PAS de filtre « Asynchrone » — cinq corrections à la maquette (fiche, Règles),
// aucune reproduite ici : rechercher_coachs() ne rend d'ailleurs aucune de ces données, il n'y a
// rien à retirer côté écran, seulement à ne pas réinventer.
//
// « Tout effacer » (validé le 13 septembre) et le bouton « Ouvrir aux coachs en visio » de
// l'état vide (L3-03, construit ici en ligne — Règles de L3-03 : « pas une route séparée ») sont
// tous deux implémentés plus bas.

const PLAFOND_PAGE = 20; // le vrai plafond dur (30) vit dans la fonction, jamais deviné ici.

type Filtres = {
  discipline: string | null;
  communeInsee: string | null;
  format: 'visio' | 'presentiel' | null;
  prixMinCentimes: number | null;
  prixMaxCentimes: number | null;
};

const FILTRES_VIDES: Filtres = {
  discipline: null,
  communeInsee: null,
  format: null,
  prixMinCentimes: null,
  prixMaxCentimes: null,
};

// Composant top-level, jamais déclaré dans le corps d'Explorer (react-hooks/static-components) :
// une carte de résultat, réutilisée pour la liste principale ET pour « Proches de ta recherche »
// (L3-03).
function CarteResultat({
  coach,
  visiteur = false,
}: {
  coach: ResultatCoachRecherche;
  visiteur?: boolean;
}): ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { large } = useDispositionEcran();
  const nomCoach = `${coach.prenom} ${coach.nom}`;

  return (
    <Pressable
      onPress={() =>
        router.push(
          (visiteur
            ? `/(public)/profil/${coach.coachId}`
            : `/(client)/coach/${coach.coachId}`) as Href,
        )
      }
      accessibilityRole="button"
      accessibilityLabel={`Voir le profil de ${nomCoach}`}
      style={{
        flexDirection: 'row',
        gap: large ? mesure.rechercheCarteLargeEspace : mesure.rechercheCarteEspace,
        paddingVertical: large ? mesure.rechercheCarteLargeVertical : mesure.rechercheCarteVertical,
        borderBottomWidth: theme.taille.bordureFine,
        borderColor: theme.couleur.bordure.marquee,
      }}
    >
      <View
        style={{
          width: large ? mesure.recherchePhotoLargeLargeur : mesure.recherchePhotoLargeur,
          height: large ? mesure.recherchePhotoLargeHauteur : mesure.recherchePhotoHauteur,
          overflow: 'hidden',
          borderRadius: theme.rayon.media,
        }}
      >
        <EmplacementImage nom={nomCoach} ratio="portrait3x4" source={coach.photoUrl ?? undefined} />
      </View>
      <View style={{ flex: 1, gap: theme.espace[1] }}>
        <Text style={{ ...theme.texte.v2NomResultat, color: theme.couleur.texte.principal }}>
          {nomCoach}
        </Text>
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
          {[coach.discipline, coach.titreCourt].filter(Boolean).join(' · ')}
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.espace[1], flexWrap: 'wrap' }}>
          <Badge statut="succes" libelle="Vérifié" />
          {coach.formats.map((f) => (
            <Badge key={f} statut="neutre" libelle={f === 'visio' ? 'Visio' : 'Présentiel'} />
          ))}
        </View>
        <Text
          style={{
            ...theme.texte.petit,
            fontFamily: font.uiBold,
            color: theme.couleur.texte.principal,
          }}
        >
          {(coach.prixCentimes / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €/mois
        </Text>
      </View>
    </Pressable>
  );
}

function ListeResultats({
  liste,
  visiteur = false,
}: {
  liste: ResultatCoachRecherche[];
  visiteur?: boolean;
}): ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.espace[3] }}>
      {liste.map((coach) => (
        <CarteResultat key={coach.offreId} coach={coach} visiteur={visiteur} />
      ))}
    </View>
  );
}

// Séparé de la lecture du paramètre de route, même motif que CorpsProfilCoachPublic
// (app/(client)/coach/[id].tsx) : useLocalSearchParams ne se résout qu'à travers un vrai match
// de route, jamais depuis app/_galerie.tsx ni depuis un test qui rend l'écran hors navigation
// réelle. Exporté pour que la galerie et les tests d'écran exercent ce corps directement.
export function CorpsExplorer({
  disciplinePreselectionnee,
  visiteur = false,
}: {
  disciplinePreselectionnee?: string;
  visiteur?: boolean;
}): ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port } = useDonnees();
  const { large } = useDispositionEcran();

  const [erreur, setErreur] = useState(false);
  const [tentative, setTentative] = useState(0);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [communes, setCommunes] = useState<CommuneReference[]>([]);
  const [texte, setTexte] = useState('');
  const [texteApplique, setTexteApplique] = useState('');
  const [filtres, setFiltres] = useState<Filtres>({
    ...FILTRES_VIDES,
    discipline: disciplinePreselectionnee ?? null,
  });
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [brouillon, setBrouillon] = useState<Filtres>({
    ...FILTRES_VIDES,
    discipline: disciplinePreselectionnee ?? null,
  });
  const [prixMinTexte, setPrixMinTexte] = useState('');
  const [prixMaxTexte, setPrixMaxTexte] = useState('');

  const [resultats, setResultats] = useState<ResultatCoachRecherche[]>([]);
  const [totalResultats, setTotalResultats] = useState(0);
  const [decalage, setDecalage] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [erreurBudget, setErreurBudget] = useState<string | undefined>();

  // L3-03 (état vide) : second appel réel, format relâché — voir plus bas, déclenché seulement
  // quand la recherche principale est vide ET que le format actif est 'presentiel' (le seul
  // relâchement construit à ce lot, fiche L3-03).
  const [resultatsRelaches, setResultatsRelaches] = useState<ResultatCoachRecherche[]>([]);
  const [totalRelaches, setTotalRelaches] = useState<number | null>(null);

  useEffect(() => {
    let monte = true;
    void Promise.all([port.lireDisciplines(), port.lireCommunesReference()])
      .then(([d, c]) => {
        if (!monte) return;
        setDisciplines(d);
        setCommunes(c);
      })
      .catch(() => {
        if (monte) {
          setErreur(true);
          setChargement(false);
        }
      });
    return () => {
      monte = false;
    };
  }, [port, tentative]);

  // Nouvelle recherche (jamais un défilement) : discipline, commune, format ou budget a changé,
  // ou le texte a été soumis. Réinitialise le décalage à 0. Ne pose PAS chargement=true ici
  // (react-hooks/set-state-in-effect) : chaque déclencheur (retirerFiltre, appliquerFiltres,
  // « Tout effacer », soumission du texte) le pose lui-même avant de changer filtres/texteApplique
  // — seul le montage initial s'appuie sur la valeur par défaut de useState(true) ci-dessus.
  useEffect(() => {
    let monte = true;
    void port
      .rechercherCoachs({
        discipline: filtres.discipline,
        texte: filtres.discipline ? null : texteApplique.trim() || null,
        communeInsee: filtres.communeInsee,
        format: filtres.format,
        prixMinCentimes: filtres.prixMinCentimes,
        prixMaxCentimes: filtres.prixMaxCentimes,
        limite: PLAFOND_PAGE,
        decalage: 0,
      })
      .then((r) => {
        if (!monte) return;
        setResultats(r.resultats);
        setTotalResultats(r.totalResultats);
        setDecalage(r.resultats.length);
        setChargement(false);
      })
      .catch(() => {
        if (monte) {
          setErreur(true);
          setChargement(false);
        }
      });
    return () => {
      monte = false;
    };
  }, [port, filtres, texteApplique, tentative]);

  // L3-03 : second appel réel avec le format relâché, seulement quand utile (Règles de
  // L3-03) — jamais un nombre inventé ou mis en cache au-delà de cet écran. Aucun setState dans
  // la branche « rien à faire » (react-hooks/set-state-in-effect) : le JSX plus bas ne rend
  // resultatsRelaches/totalRelaches que sous la MÊME condition (filtres.format === 'presentiel'
  // et resultats vide), donc une valeur obsolète d'un filtre précédent ne peut jamais s'afficher.
  useEffect(() => {
    let monte = true;
    if (chargement || resultats.length > 0 || filtres.format !== 'presentiel') {
      return;
    }
    void port
      .rechercherCoachs({
        discipline: filtres.discipline,
        texte: filtres.discipline ? null : texteApplique.trim() || null,
        communeInsee: filtres.communeInsee,
        format: null,
        prixMinCentimes: filtres.prixMinCentimes,
        prixMaxCentimes: filtres.prixMaxCentimes,
        limite: 3,
      })
      .then((r) => {
        if (!monte) return;
        setResultatsRelaches(r.resultats);
        setTotalRelaches(r.totalResultats);
      })
      .catch(() => {
        if (monte) setErreur(true);
      });
    return () => {
      monte = false;
    };
  }, [port, chargement, resultats.length, filtres, texteApplique, tentative]);

  async function chargerPlus() {
    setChargementPlus(true);
    try {
      const r = await port.rechercherCoachs({
        discipline: filtres.discipline,
        texte: filtres.discipline ? null : texteApplique.trim() || null,
        communeInsee: filtres.communeInsee,
        format: filtres.format,
        prixMinCentimes: filtres.prixMinCentimes,
        prixMaxCentimes: filtres.prixMaxCentimes,
        limite: PLAFOND_PAGE,
        decalage,
      });
      setResultats((precedents) => [...precedents, ...r.resultats]);
      setDecalage((d) => d + r.resultats.length);
    } catch {
      setErreur(true);
    } finally {
      setChargementPlus(false);
    }
  }

  function ouvrirFeuilleFiltres() {
    setBrouillon(filtres);
    setPrixMinTexte(filtres.prixMinCentimes != null ? String(filtres.prixMinCentimes / 100) : '');
    setPrixMaxTexte(filtres.prixMaxCentimes != null ? String(filtres.prixMaxCentimes / 100) : '');
    setFeuilleOuverte(true);
  }

  function appliquerFiltres() {
    setErreur(false);
    const min = Number.parseFloat(prixMinTexte.replace(',', '.'));
    const max = Number.parseFloat(prixMaxTexte.replace(',', '.'));
    if ((Number.isFinite(min) && min < 0) || (Number.isFinite(max) && max < 0)) {
      setErreurBudget('Le budget doit être positif.');
      return;
    }
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      setErreurBudget('Le prix maximum doit être supérieur au prix minimum.');
      return;
    }
    setErreurBudget(undefined);
    setChargement(true);
    setFiltres({
      ...brouillon,
      prixMinCentimes: Number.isFinite(min) ? Math.round(min * 100) : null,
      prixMaxCentimes: Number.isFinite(max) ? Math.round(max * 100) : null,
    });
    setFeuilleOuverte(false);
  }

  function retirerFiltre(cle: keyof Filtres) {
    setErreur(false);
    setChargement(true);
    setFiltres((precedents) => ({ ...precedents, [cle]: null }));
    setBrouillon((precedents) => ({ ...precedents, [cle]: null }));
    if (cle === 'prixMinCentimes') setPrixMinTexte('');
    if (cle === 'prixMaxCentimes') setPrixMaxTexte('');
  }

  function toutEffacer() {
    setErreur(false);
    setChargement(true);
    setFiltres(FILTRES_VIDES);
    setBrouillon(FILTRES_VIDES);
    setPrixMinTexte('');
    setPrixMaxTexte('');
  }

  function soumettreRecherche() {
    setTentative((t) => t + 1);
    setErreur(false);
    setChargement(true);
    setTexteApplique(texte);
  }

  const nombreFiltresActifs =
    (filtres.discipline ? 1 : 0) +
    (filtres.communeInsee ? 1 : 0) +
    (filtres.format ? 1 : 0) +
    (filtres.prixMinCentimes != null || filtres.prixMaxCentimes != null ? 1 : 0);

  const libelleDiscipline = disciplines.find((d) => d.cle === filtres.discipline)?.libelle;
  const nomCommune = communes.find((c) => c.codeInsee === filtres.communeInsee)?.nom;

  const contenuFiltres = (
    <View style={{ gap: theme.espace[4] }}>
      <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>Filtres</Text>

      <Choix
        libelle="Discipline"
        valeur={brouillon.discipline ?? ''}
        options={[
          { valeur: '', libelle: 'Toutes les disciplines' },
          ...disciplines.map((d) => ({ valeur: d.cle, libelle: d.libelle })),
        ]}
        onChanger={(valeur) => setBrouillon((b) => ({ ...b, discipline: valeur || null }))}
      />
      <Choix
        libelle="Commune"
        valeur={brouillon.communeInsee ?? ''}
        options={[
          { valeur: '', libelle: 'Toutes les communes' },
          ...communes.map((c) => ({ valeur: c.codeInsee, libelle: c.nom })),
        ]}
        onChanger={(valeur) => setBrouillon((b) => ({ ...b, communeInsee: valeur || null }))}
      />
      <View style={{ gap: theme.espace[2] }}>
        <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>Format</Text>
        <View style={{ flexDirection: 'row', gap: theme.espace[2] }}>
          {(['visio', 'presentiel'] as const).map((f) => (
            <Chip
              key={f}
              variante="filtre"
              libelle={f === 'visio' ? 'En visio' : 'En présentiel'}
              selectionne={brouillon.format === f}
              onPress={() => setBrouillon((b) => ({ ...b, format: b.format === f ? null : f }))}
            />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.espace[3] }}>
        <View style={{ flex: 1 }}>
          <Champ
            libelle="Prix min (€)"
            valeur={prixMinTexte}
            onChangeTexte={setPrixMinTexte}
            type="decimal"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Champ
            libelle="Prix max (€)"
            messageErreur={erreurBudget}
            valeur={prixMaxTexte}
            onChangeTexte={setPrixMaxTexte}
            type="decimal"
          />
        </View>
      </View>

      <Bouton libelle="Appliquer" variante="primaire" onPress={appliquerFiltres} />
    </View>
  );

  return (
    <FournisseurPresentationV2>
      <FeuilleBasse
        ouverte={feuilleOuverte}
        onFermer={() => setFeuilleOuverte(false)}
        enfants={!large ? contenuFiltres : null}
      >
        <CanevasEcran
          ample
          largeurMax={mesure.largeurContenu}
          style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}
        >
          {visiteur || !large ? (
            <EntetePublicV2
              accessoire={
                visiteur ? (
                  <Bouton
                    libelle="Se connecter"
                    variante="discret"
                    onPress={() => router.push('/(public)/connexion' as Href)}
                  />
                ) : undefined
              }
            />
          ) : null}
          <View
            style={{
              paddingTop: !visiteur && large ? insets.top + theme.espace[6] : theme.espace[6],
              paddingHorizontal: large ? '5%' : mesure.enteteHorizontal,
              paddingBottom: theme.espace[2],
              gap: theme.espace[3],
            }}
          >
            <View
              style={{ gap: mesure.rechercheTitreAvant, marginBottom: mesure.rechercheTitreApres }}
            >
              <Text style={{ ...theme.texte.v2Surtitre, color: theme.couleur.marque.primaire }}>
                EXPLORER LES COACHS
              </Text>
              <Text
                accessibilityRole="header"
                style={{
                  ...(large ? theme.texte.v2TitreAuthLarge : theme.texte.v2TitreAuth),
                  color: theme.couleur.texte.principal,
                }}
              >
                {'La bonne personne.\nPour ton prochain pas.'}
              </Text>
              <Text style={{ ...theme.texte.v2Corps, color: theme.couleur.texte.secondaire }}>
                Une discipline, un format, un budget : trouve ton point de départ.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[2] }}>
              <BoutonIcone
                nom="retour"
                accessibilityLabel="Retour"
                onPress={() =>
                  router.canGoBack?.() ? router.back() : router.replace('/(public)' as Href)
                }
              />
              <View
                // Le libellé porte sur le groupe, pas sur cette View seule (jamais "accessible",
                // donc jamais fusionnée pour de vrai) : c'est la loupe, purement décorative, qui a
                // besoin d'un ancêtre étiqueté (docs/design-system.md §6) — le TextInput plus bas
                // garde son propre accessibilityLabel, seul élément réellement focusable ici.
                accessibilityLabel="Rechercher un coach"
                style={{
                  flex: 1,
                  minHeight: mesure.rechercheChampHauteur,
                  borderRadius: theme.rayon.saisie,
                  borderWidth: 1,
                  borderColor: theme.couleur.bordure.discrete,
                  backgroundColor: theme.couleur.fond.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.espace[2],
                  paddingHorizontal: theme.espace[3],
                }}
              >
                <Icone nom="recherche" couleur={theme.couleur.texte.attenue} />
                <TextInput
                  value={texte}
                  onChangeText={setTexte}
                  onSubmitEditing={soumettreRecherche}
                  placeholder="Un coach, une discipline…"
                  placeholderTextColor={theme.couleur.gris[400]}
                  accessibilityLabel="Rechercher un coach"
                  style={{ flex: 1, ...theme.texte.corps, color: theme.couleur.texte.principal }}
                  returnKeyType="search"
                />
              </View>
              <View style={{ display: large ? 'none' : 'flex' }}>
                <BoutonIcone
                  nom="filtres"
                  accessibilityLabel="Filtres"
                  onPress={ouvrirFeuilleFiltres}
                />
                {nombreFiltresActifs > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: theme.couleur.marque.accentAction,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 3,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: font.uiBold,
                        color: theme.couleur.texte.surMarque,
                      }}
                    >
                      {nombreFiltresActifs}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {nombreFiltresActifs > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
                {filtres.discipline ? (
                  <Chip
                    variante="filtreRetirable"
                    libelle={libelleDiscipline ?? filtres.discipline}
                    selectionne
                    onPress={() => {}}
                    onRetirer={() => retirerFiltre('discipline')}
                    accessibilityLabelRetirer="Retirer le filtre de discipline"
                  />
                ) : null}
                {filtres.communeInsee ? (
                  <Chip
                    variante="filtreRetirable"
                    libelle={nomCommune ?? filtres.communeInsee}
                    selectionne
                    onPress={() => {}}
                    onRetirer={() => retirerFiltre('communeInsee')}
                    accessibilityLabelRetirer="Retirer le filtre de commune"
                  />
                ) : null}
                {filtres.format ? (
                  <Chip
                    variante="filtreRetirable"
                    libelle={filtres.format === 'visio' ? 'En visio' : 'En présentiel'}
                    selectionne
                    onPress={() => {}}
                    onRetirer={() => retirerFiltre('format')}
                    accessibilityLabelRetirer="Retirer le filtre de format"
                  />
                ) : null}
                {filtres.prixMinCentimes != null || filtres.prixMaxCentimes != null ? (
                  <Chip
                    variante="filtreRetirable"
                    libelle={
                      filtres.prixMaxCentimes != null
                        ? `Jusqu’à ${(filtres.prixMaxCentimes / 100).toFixed(0)} €`
                        : `À partir de ${((filtres.prixMinCentimes ?? 0) / 100).toFixed(0)} €`
                    }
                    selectionne
                    onPress={() => {}}
                    onRetirer={() => {
                      retirerFiltre('prixMinCentimes');
                      retirerFiltre('prixMaxCentimes');
                    }}
                    accessibilityLabelRetirer="Retirer le filtre de budget"
                  />
                ) : null}
                <Pressable
                  onPress={toutEffacer}
                  accessibilityRole="button"
                  accessibilityLabel="Tout effacer"
                  style={{ justifyContent: 'center', paddingHorizontal: theme.espace[2] }}
                >
                  <Text
                    style={{
                      ...theme.texte.petit,
                      fontFamily: font.uiBold,
                      color: theme.couleur.marque.primaire,
                    }}
                  >
                    Tout effacer
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {!chargement ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                  {totalResultats} coach{totalResultats > 1 ? 's' : ''}
                  {nomCommune ? ` · ${nomCommune}` : filtres.format === 'visio' ? ' · Visio' : ''}
                </Text>
                <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.principal }}>
                  Pertinence
                </Text>
              </View>
            ) : null}
          </View>

          <DefilementEcran
            largeurMax={mesure.largeurContenu}
            ample
            contentContainerStyle={{
              paddingHorizontal: large ? '5%' : mesure.enteteHorizontal,
              paddingBottom: theme.espace[8],
              gap: theme.espace[4],
            }}
          >
            <View
              style={{
                flexDirection: large ? 'row' : 'column',
                gap: large ? mesure.rechercheColonnesEspace : 0,
              }}
            >
              {large ? (
                <View style={{ width: mesure.rechercheFiltresLargeur }}>{contenuFiltres}</View>
              ) : null}
              <View style={{ flex: 1, minWidth: 0, gap: theme.espace[4] }}>
                {erreur ? (
                  <EtatErreur
                    titre={textesRepliErreur.serveur.titre}
                    explication={textesRepliErreur.serveur.explication}
                    nombreEchecs={tentative + 1}
                    onReessayer={() => {
                      setErreur(false);
                      setChargement(true);
                      setTentative((t) => t + 1);
                    }}
                  />
                ) : chargement ? (
                  <Text
                    accessibilityRole="alert"
                    style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}
                  >
                    Recherche des coachs…
                  </Text>
                ) : resultats.length > 0 ? (
                  <>
                    <ListeResultats liste={resultats} visiteur={visiteur} />
                    {resultats.length < totalResultats ? (
                      <Bouton
                        libelle={chargementPlus ? 'Chargement…' : 'Voir plus'}
                        variante="secondaire"
                        onPress={chargerPlus}
                        desactive={chargementPlus}
                      />
                    ) : null}
                  </>
                ) : (
                  <EtatVide
                    titre={`Personne en ${libelleDiscipline ?? (texteApplique || 'ce moment')}${
                      nomCommune ? ` près de ${nomCommune}` : ''
                    }`}
                    explication="Tes filtres sont peut-être un peu serrés."
                    actionPrincipale={
                      filtres.format === 'presentiel' && totalRelaches != null && totalRelaches > 0
                        ? {
                            libelle: `Ouvrir aux coachs en visio · ${totalRelaches} résultat${totalRelaches > 1 ? 's' : ''}`,
                            onPress: () => retirerFiltre('format'),
                          }
                        : undefined
                    }
                    contenuSecondaire={
                      filtres.format === 'presentiel' && resultatsRelaches.length > 0 ? (
                        <View style={{ gap: theme.espace[3] }}>
                          <Text
                            style={{
                              ...theme.texte.legende,
                              fontFamily: font.uiBold,
                              letterSpacing: 1,
                              textTransform: 'uppercase',
                              color: theme.couleur.texte.attenue,
                            }}
                          >
                            Proches de ta recherche
                          </Text>
                          <ListeResultats liste={resultatsRelaches} visiteur={visiteur} />
                        </View>
                      ) : undefined
                    }
                  />
                )}
              </View>
            </View>
          </DefilementEcran>
        </CanevasEcran>
      </FeuilleBasse>
    </FournisseurPresentationV2>
  );
}
