import { InterrupteurV2 } from '@/composants/interrupteur-v2';
import { CadreFormulaireV2 } from '@/composants/presentation-v2';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { Champ } from '@/composants/champ';
import { textesRepliErreur } from '@/composants/etats/textes';
import {
  TEXTE_CONSENTEMENT_SANTE,
  VERSION_CONSENTEMENT_SANTE,
} from '@/fonctionnalites/identite/consentement-sante';
import { EnteteOnboarding } from '@/fonctionnalites/identite/entete-onboarding';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';

// Texte et version du consentement santé : source unique, partagée avec l'écran Confidentialité
// (P1.13d). Voir src/fonctionnalites/identite/consentement-sante.ts.
const TEXTE_CONSENTEMENT = TEXTE_CONSENTEMENT_SANTE;

// "en kilogrammes avec une décimale" (fiche) : virgule ET point acceptés en saisie (clavier
// français), convertis en grammes entiers (profils_client.poids_*_grammes, entier — voir
// 0001_creer_identite.sql) pour le port. Une saisie vide ou invalide ne bloque rien (poids
// facultatif) : rend undefined plutôt qu'une valeur inventée.
function versGrammes(texte: string): number | undefined {
  const nombre = Number.parseFloat(texte.trim().replace(',', '.'));
  if (!Number.isFinite(nombre) || nombre <= 0) return undefined;
  return Math.round(nombre * 1000);
}

// Sens inverse de versGrammes, pour le pré-remplissage au retour depuis l'étape 4.
function versSaisie(grammes: number): string {
  return (grammes / 1000).toFixed(1).replace('.', ',');
}

// docs/ecrans/L1-05-onboarding-client.md, étape 3/4. CLAUDE.md §10 : donnée de santé
// (catégorie 9 RGPD) — jamais journalisée, jamais dans une URL (aucun de ces deux champs ne
// quitte cet écran autrement que par le corps de la requête du port), jamais mise en cache au-
// delà de la session (aucun stockage local ici, seulement du useState perdu à la navigation).
export default function OnboardingPoids() {
  const theme = useTheme();
  const router = useRouter();
  const { port } = useDonnees();

  const [consentementAccorde, setConsentementAccorde] = useState(false);
  const [poidsActuel, setPoidsActuel] = useState('');
  const [poidsVise, setPoidsVise] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Reprise via le bouton retour depuis l'étape 4 (P1.11) : relit un poids déjà enregistré
  // plutôt que de reproposer des champs vides et un interrupteur décoché. La présence d'un
  // poids implique le consentement (le déclencheur de 0004_proteger_donnees_sante.sql
  // l'exigeait déjà à l'écriture) — pas de champ dédié à relire pour ça.
  useEffect(() => {
    let monte = true;
    port.lireProfilOnboarding().then((profil) => {
      if (!monte) return;
      if (profil.poidsDepartGrammes != null || profil.poidsCibleGrammes != null) {
        setConsentementAccorde(true);
      }
      if (profil.poidsDepartGrammes != null) setPoidsActuel(versSaisie(profil.poidsDepartGrammes));
      if (profil.poidsCibleGrammes != null) setPoidsVise(versSaisie(profil.poidsCibleGrammes));
    });
    return () => {
      monte = false;
    };
  }, [port]);

  async function enregistrerEtAvancer(
    donnees: Parameters<typeof port.enregistrerPointDeDepart>[0],
  ) {
    setErreur(null);
    setChargement(true);
    const resultat = await port.enregistrerPointDeDepart(donnees);
    setChargement(false);

    if (!resultat.succes) {
      setErreur(resultat.erreur);
      return;
    }
    router.push('/(onboarding)/4-cest-parti');
  }

  function surContinuer() {
    return enregistrerEtAvancer({
      consentementAccorde,
      versionConsentement: VERSION_CONSENTEMENT_SANTE,
      poidsDepartGrammes: consentementAccorde ? versGrammes(poidsActuel) : undefined,
      poidsCibleGrammes: consentementAccorde ? versGrammes(poidsVise) : undefined,
    });
  }

  // « Passer » : un vrai saut, jamais influencé par ce que le formulaire contient déjà (un
  // interrupteur touché par erreur puis "Passer" pressé ne doit rien enregistrer) — distinct de
  // "Continuer" avec l'interrupteur décoché, qui produit le même résultat mais en LISANT l'état
  // du formulaire plutôt qu'en l'ignorant.
  function surPasser() {
    return enregistrerEtAvancer({
      consentementAccorde: false,
      versionConsentement: VERSION_CONSENTEMENT_SANTE,
    });
  }

  return (
    <CadreFormulaireV2
      reference="point-depart"
      surtitre="UNE ÉTAPE FACULTATIVE"
      titre="Ton point de départ."
      description="Tu peux passer cette étape."
      entete={
        <>
          <EnteteOnboarding etape={3} desactive={chargement} onPasser={surPasser} />
        </>
      }
      alerte={
        erreur ? (
          <View
            accessibilityLiveRegion="polite"
            style={{ paddingHorizontal: theme.espace.gouttiere, paddingTop: theme.espace[2] }}
          >
            <Text style={{ ...theme.texte.label, color: theme.couleur.etat.erreurEncre }}>
              {textesRepliErreur.serveur.titre}
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
              {textesRepliErreur.serveur.explication}
            </Text>
          </View>
        ) : null
      }
      actions={
        <>
          {/* Hors de la zone de défilement : un message d'erreur doit être dans le champ de vision
          (2 novembre 2026, docs/prompts/defauts-L2-iphone.md, partie B). Le repli serveur, titre et
          détail, jamais le texte du port. */}

          <>
            <Bouton
              libelle="Continuer"
              variante="primaire"
              onPress={surContinuer}
              desactive={chargement}
            />
          </>
        </>
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.espace[3],
          paddingVertical: theme.espace[6],
          borderBottomWidth: theme.taille.bordureFine,
          borderBottomColor: theme.couleur.bordure.discrete,
        }}
      >
        <View style={{ flex: 1, gap: theme.espace[3] }}>
          <Text style={{ ...theme.texte.actionAccent, color: theme.couleur.texte.principal }}>
            Données de santé
          </Text>
          <Text
            style={{ ...theme.texte.v2Engagement, color: theme.couleur.texte.secondaire }}
            accessibilityLabel={TEXTE_CONSENTEMENT}
          >
            {TEXTE_CONSENTEMENT}
          </Text>
        </View>
        <InterrupteurV2
          value={consentementAccorde}
          onValueChange={setConsentementAccorde}
          disabled={chargement}
          accessibilityRole="switch"
          accessibilityLabel="J'accepte l'enregistrement de mes données de santé"
          trackColor={{ false: theme.couleur.gris[300], true: theme.couleur.marque.primaire }}
          thumbColor={theme.couleur.fond.surface}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.espace[3] }}>
        <View style={{ flex: 1 }}>
          <Champ
            libelle="Poids actuel (kg)"
            type="decimal"
            valeur={poidsActuel}
            onChangeTexte={setPoidsActuel}
            desactive={!consentementAccorde || chargement}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Champ
            libelle="Objectif de poids (kg)"
            type="decimal"
            valeur={poidsVise}
            onChangeTexte={setPoidsVise}
            desactive={!consentementAccorde || chargement}
          />
        </View>
      </View>
      <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.secondaire }}>
        Tu peux retirer cet accord à tout moment dans ton compte.
      </Text>
    </CadreFormulaireV2>
  );
}
