import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EmplacementImage } from '@/composants/emplacement-image';
import { EtatVide } from '@/composants/etats/etat-vide';
import { FeuilleBasse } from '@/composants/feuille-basse';
import { Icone } from '@/composants/icones';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { CommuneReference, Discipline, ResultatCoachRecherche } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { font } from '@/theme/tokens';

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
function CarteResultat({ coach }: { coach: ResultatCoachRecherche }) {
  const theme = useTheme();
  const router = useRouter();
  const nomCoach = `${coach.prenom} ${coach.nom}`;

  return (
    <Pressable
      onPress={() => router.push(`/(client)/coach/${coach.coachId}`)}
      accessibilityRole="button"
      accessibilityLabel={`Voir le profil de ${nomCoach}`}
      style={{
        flexDirection: 'row',
        gap: theme.espace[3],
        padding: theme.espace[3],
        borderRadius: theme.rayon.carte,
        borderWidth: 1,
        borderColor: theme.couleur.bordure.discrete,
      }}
    >
      <View style={{ width: 88 }}>
        <EmplacementImage nom={nomCoach} ratio="portrait3x4" source={coach.photoUrl ?? undefined} />
      </View>
      <View style={{ flex: 1, gap: theme.espace[1] }}>
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.principal }}>
          {nomCoach}
        </Text>
        <Text
          style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}
          numberOfLines={1}
        >
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
          {(coach.prixCentimes / 100).toFixed(0)} €/mois
        </Text>
      </View>
    </Pressable>
  );
}

function ListeResultats({ liste }: { liste: ResultatCoachRecherche[] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.espace[3] }}>
      {liste.map((coach) => (
        <CarteResultat key={coach.offreId} coach={coach} />
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
}: {
  disciplinePreselectionnee?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port } = useDonnees();

  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [communes, setCommunes] = useState<CommuneReference[]>([]);
  const [texte, setTexte] = useState('');
  const [texteApplique, setTexteApplique] = useState('');
  const [filtres, setFiltres] = useState<Filtres>({
    ...FILTRES_VIDES,
    discipline: disciplinePreselectionnee ?? null,
  });
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [brouillon, setBrouillon] = useState<Filtres>(FILTRES_VIDES);
  const [prixMinTexte, setPrixMinTexte] = useState('');
  const [prixMaxTexte, setPrixMaxTexte] = useState('');

  const [resultats, setResultats] = useState<ResultatCoachRecherche[]>([]);
  const [totalResultats, setTotalResultats] = useState(0);
  const [decalage, setDecalage] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [chargementPlus, setChargementPlus] = useState(false);

  // L3-03 (état vide) : second appel réel, format relâché — voir plus bas, déclenché seulement
  // quand la recherche principale est vide ET que le format actif est 'presentiel' (le seul
  // relâchement construit à ce lot, fiche L3-03).
  const [resultatsRelaches, setResultatsRelaches] = useState<ResultatCoachRecherche[]>([]);
  const [totalRelaches, setTotalRelaches] = useState<number | null>(null);

  useEffect(() => {
    let monte = true;
    void Promise.all([port.lireDisciplines(), port.lireCommunesReference()]).then(([d, c]) => {
      if (!monte) return;
      setDisciplines(d);
      setCommunes(c);
    });
    return () => {
      monte = false;
    };
  }, [port]);

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
      });
    return () => {
      monte = false;
    };
  }, [port, filtres, texteApplique]);

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
      });
    return () => {
      monte = false;
    };
  }, [port, chargement, resultats.length, filtres, texteApplique]);

  async function chargerPlus() {
    setChargementPlus(true);
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
    setChargementPlus(false);
  }

  function ouvrirFeuilleFiltres() {
    setBrouillon(filtres);
    setPrixMinTexte(filtres.prixMinCentimes != null ? String(filtres.prixMinCentimes / 100) : '');
    setPrixMaxTexte(filtres.prixMaxCentimes != null ? String(filtres.prixMaxCentimes / 100) : '');
    setFeuilleOuverte(true);
  }

  function appliquerFiltres() {
    const min = Number.parseFloat(prixMinTexte.replace(',', '.'));
    const max = Number.parseFloat(prixMaxTexte.replace(',', '.'));
    setChargement(true);
    setFiltres({
      ...brouillon,
      prixMinCentimes: Number.isFinite(min) ? Math.round(min * 100) : null,
      prixMaxCentimes: Number.isFinite(max) ? Math.round(max * 100) : null,
    });
    setFeuilleOuverte(false);
  }

  function retirerFiltre(cle: keyof Filtres) {
    setChargement(true);
    setFiltres((precedents) => ({ ...precedents, [cle]: null }));
  }

  function toutEffacer() {
    setChargement(true);
    setFiltres(FILTRES_VIDES);
  }

  function soumettreRecherche() {
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

  return (
    <FeuilleBasse
      ouverte={feuilleOuverte}
      onFermer={() => setFeuilleOuverte(false)}
      enfants={
        <View style={{ gap: theme.espace[4] }}>
          <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
            Filtres
          </Text>

          <View style={{ gap: theme.espace[2] }}>
            <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
              Commune
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
              {communes.map((commune) => (
                <Chip
                  key={commune.codeInsee}
                  variante="filtre"
                  libelle={commune.nom}
                  selectionne={brouillon.communeInsee === commune.codeInsee}
                  onPress={() =>
                    setBrouillon((b) => ({
                      ...b,
                      communeInsee: b.communeInsee === commune.codeInsee ? null : commune.codeInsee,
                    }))
                  }
                />
              ))}
            </View>
          </View>

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
                valeur={prixMaxTexte}
                onChangeTexte={setPrixMaxTexte}
                type="decimal"
              />
            </View>
          </View>

          <Bouton libelle="Appliquer" variante="primaire" onPress={appliquerFiltres} />
        </View>
      }
    >
      <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <View
          style={{
            paddingTop: insets.top + theme.espace[2],
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace[2],
            gap: theme.espace[3],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[2] }}>
            <BoutonIcone nom="retour" accessibilityLabel="Retour" onPress={() => router.back()} />
            <View
              // Le libellé porte sur le groupe, pas sur cette View seule (jamais "accessible",
              // donc jamais fusionnée pour de vrai) : c'est la loupe, purement décorative, qui a
              // besoin d'un ancêtre étiqueté (docs/design-system.md §6) — le TextInput plus bas
              // garde son propre accessibilityLabel, seul élément réellement focusable ici.
              accessibilityLabel="Rechercher un coach"
              style={{
                flex: 1,
                minHeight: theme.taille.controle,
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
            <View>
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
                  libelle={`Jusqu'à ${((filtres.prixMaxCentimes ?? 0) / 100).toFixed(0)} €`}
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

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace[8],
            gap: theme.espace[4],
          }}
        >
          {chargement ? null : resultats.length > 0 ? (
            <>
              <ListeResultats liste={resultats} />
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
                    <ListeResultats liste={resultatsRelaches} />
                  </View>
                ) : undefined
              }
            />
          )}
        </ScrollView>
      </View>
    </FeuilleBasse>
  );
}

export default function Explorer() {
  const params = useLocalSearchParams<{ discipline?: string }>();
  return <CorpsExplorer disciplinePreselectionnee={params.discipline} />;
}
