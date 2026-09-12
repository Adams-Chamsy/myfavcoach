import { useState } from 'react';
import { ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { Offre } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { centimesDepuisSaisieEuros, saisieEurosDepuisCentimes } from './prix';

// L2-15 : réconciliation entre docs/domaine.md §3.3 (trois catégories) et la maquette (quatre
// jetons au libellé différent) — non tranchée par la fiche elle-même ("à réconcilier en une
// seule liste avant de coder", "Ce qui a été inventé"). docs/domaine.md l'emporte
// (CLAUDE.md §3, sources de vérité) : les trois catégories du domaine, texte inchangé.
const ENGAGEMENTS_POSSIBLES = [
  'ajustement hebdomadaire',
  'visio mensuelle',
  'messagerie avec délai de réponse annoncé',
];

const NOMBRE_BENEFICES_MIN = 3;
const NOMBRE_BENEFICES_MAX = 5;

const TEXTES_REFUS: Record<string, string> = {
  coach_non_verifie: 'Ton identité doit être vérifiée avant de publier une offre.',
  engagement_humain_requis: 'Choisis au moins un engagement humain.',
  inconnu: 'On a un souci de notre côté. Réessaie dans un instant.',
};

export function EcranCreationOffre({ offreExistante }: { offreExistante?: Offre }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { port } = useDonnees();

  const [id, setId] = useState<string | undefined>(offreExistante?.id);
  const [titre, setTitre] = useState(offreExistante?.titre ?? '');
  const [description, setDescription] = useState(offreExistante?.description ?? '');
  const [saisiePrix, setSaisiePrix] = useState(
    offreExistante ? saisieEurosDepuisCentimes(offreExistante.prixCentimes) : '',
  );
  const [benefices, setBenefices] = useState<string[]>(offreExistante?.benefices ?? []);
  const [nouveauBenefice, setNouveauBenefice] = useState('');
  const [engagements, setEngagements] = useState<string[]>(offreExistante?.engagementHumain ?? []);
  const [miseEnAvant, setMiseEnAvant] = useState(offreExistante?.estMiseEnAvant ?? false);
  const [publieeLe, setPublieeLe] = useState<string | null>(offreExistante?.publieeLe ?? null);
  const [retireeLe, setRetireeLe] = useState<string | null>(offreExistante?.retireeLe ?? null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const prixCentimes = centimesDepuisSaisieEuros(saisiePrix);
  const prixValide = prixCentimes !== null && prixCentimes >= 1000 && prixCentimes <= 50000;
  const brouillonComplet =
    titre.trim() !== '' && prixValide && benefices.length >= NOMBRE_BENEFICES_MIN;
  // engagements.length > 0 n'est PAS revérifié ici : le serveur le fait déjà
  // (engagement_humain_requis, publier_offre) et son texte de refus doit rester atteignable
  // depuis l'écran (docs/ecrans/L2-15, Règles) — un bouton désactivé ne l'afficherait jamais.
  const publicable = brouillonComplet;

  function modifications() {
    return {
      titre: titre.trim(),
      description: description.trim() === '' ? null : description.trim(),
      prixCentimes: prixCentimes ?? 0,
      benefices,
      engagementHumain: engagements,
      estMiseEnAvant: miseEnAvant,
    };
  }

  async function surEnregistrer() {
    setErreur(null);
    setChargement(true);
    if (id) {
      const resultat = await port.modifierOffre(id, modifications());
      setChargement(false);
      if (!resultat.succes) setErreur(resultat.erreur);
      return;
    }
    const resultat = await port.creerOffreBrouillon(modifications());
    setChargement(false);
    if (!resultat.succes) {
      setErreur(resultat.erreur);
      return;
    }
    setId(resultat.id);
  }

  async function surPublier() {
    setErreur(null);
    setChargement(true);
    if (!id) {
      const cree = await port.creerOffreBrouillon(modifications());
      if (!cree.succes) {
        setChargement(false);
        setErreur(cree.erreur);
        return;
      }
      setId(cree.id);
      const resultat = await port.publierOffre(cree.id);
      setChargement(false);
      if (!resultat.succes) {
        setErreur(TEXTES_REFUS[resultat.code] ?? TEXTES_REFUS.inconnu);
        return;
      }
      setPublieeLe(new Date().toISOString());
      return;
    }
    const resultat = await port.publierOffre(id);
    setChargement(false);
    if (!resultat.succes) {
      setErreur(TEXTES_REFUS[resultat.code] ?? TEXTES_REFUS.inconnu);
      return;
    }
    setPublieeLe(new Date().toISOString());
    setRetireeLe(null);
  }

  async function surRetirer() {
    if (!id) return;
    setChargement(true);
    const resultat = await port.retirerOffre(id);
    setChargement(false);
    if (resultat.succes) setRetireeLe(new Date().toISOString());
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <View
        style={{
          paddingTop: insets.top + theme.espace[3],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[2],
          flexDirection: 'row',
          justifyContent: 'flex-end',
        }}
      >
        <Bouton
          libelle="Enregistrer"
          variante="discret"
          onPress={() => void surEnregistrer()}
          desactive={chargement}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        {retireeLe ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
            Cette offre n’est plus en vente. Tes abonnés en cours gardent l’accès.
          </Text>
        ) : null}

        <Champ libelle="Titre" valeur={titre} onChangeTexte={setTitre} desactive={chargement} />
        <Champ
          libelle="Description"
          valeur={description}
          onChangeTexte={setDescription}
          desactive={chargement}
        />

        <View style={{ gap: theme.espace[1] }}>
          <Champ
            libelle="Prix mensuel (€)"
            valeur={saisiePrix}
            onChangeTexte={setSaisiePrix}
            desactive={chargement}
          />
          {publieeLe ? (
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
              Le prix est figé pour les abonnés déjà souscrits : un changement ici ne s’applique
              qu’aux nouveaux.
            </Text>
          ) : null}
        </View>

        <View style={{ gap: theme.espace[2] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Ce que le client reçoit — {benefices.length} sur {NOMBRE_BENEFICES_MAX}
          </Text>
          {benefices.map((b, index) => (
            <Chip
              key={`${b}-${index}`}
              variante="filtreRetirable"
              libelle={b}
              selectionne
              onPress={() => {}}
              onRetirer={() => setBenefices(benefices.filter((_, i) => i !== index))}
              accessibilityLabelRetirer={`Retirer « ${b} »`}
            />
          ))}
          {benefices.length < NOMBRE_BENEFICES_MAX ? (
            <View style={{ flexDirection: 'row', gap: theme.espace[2] }}>
              <TextInput
                value={nouveauBenefice}
                onChangeText={setNouveauBenefice}
                placeholder="Ajouter une ligne"
                style={{
                  flex: 1,
                  ...theme.texte.corps,
                  color: theme.couleur.texte.principal,
                  borderWidth: 1,
                  borderColor: theme.couleur.bordure.discrete,
                  borderRadius: theme.rayon.saisie,
                  paddingHorizontal: theme.espace[3],
                  paddingVertical: theme.espace[2],
                }}
              />
              <Bouton
                libelle="Ajouter"
                variante="secondaire"
                desactive={nouveauBenefice.trim() === ''}
                onPress={() => {
                  setBenefices([...benefices, nouveauBenefice.trim()]);
                  setNouveauBenefice('');
                }}
              />
            </View>
          ) : null}
        </View>

        <View style={{ gap: theme.espace[2] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Ce que tu fais toi-même
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
            {ENGAGEMENTS_POSSIBLES.map((e) => (
              <Chip
                key={e}
                variante="selection"
                libelle={e}
                selectionne={engagements.includes(e)}
                onPress={() =>
                  setEngagements(
                    engagements.includes(e)
                      ? engagements.filter((x) => x !== e)
                      : [...engagements, e],
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}>
          <Switch value={miseEnAvant} onValueChange={setMiseEnAvant} disabled={chargement} />
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
            Mise en avant (« LE PLUS CHOISI »)
          </Text>
        </View>

        {erreur ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
            {erreur}
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[3],
          paddingBottom: insets.bottom + theme.espace[3],
          borderTopWidth: 1,
          borderTopColor: theme.couleur.bordure.discrete,
        }}
      >
        {publieeLe && !retireeLe ? (
          <Bouton
            libelle="Retirer"
            variante="secondaire"
            onPress={() => void surRetirer()}
            desactive={chargement}
          />
        ) : (
          <Bouton
            libelle="Publier"
            variante="primaire"
            onPress={() => void surPublier()}
            desactive={!publicable || chargement}
          />
        )}
      </View>
    </View>
  );
}
