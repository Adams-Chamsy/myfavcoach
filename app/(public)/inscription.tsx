import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { Champ } from '@/composants/champ';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { estMajeur, formatDateISO } from '@/fonctionnalites/identite/age';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { ErreurAuth } from '@/services/auth/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-02-creation-compte.md, tableau "Règles de saisie" : 10 caractères minimum,
// 72 maximum. 72 est une limite dure de bcrypt côté service, jamais un choix d'ergonomie
// (voir le commentaire de surCreerCompte plus bas).
const LONGUEUR_MOT_DE_PASSE_MIN = 10;
const LONGUEUR_MOT_DE_PASSE_MAX = 72;

// Volontairement simple : une arobase suivie d'un point, sans caractères d'espacement. Ce
// n'est PAS une validation exhaustive de la RFC (aucune ne l'est complètement côté client) —
// juste de quoi attraper une faute de frappe évidente avant l'appel réseau. Le service reste
// la validation qui compte réellement.
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Défaut ouvert sur l'année en cours moins 25 ans" (docs/ecrans/L1-02-creation-compte.md).
function dateNaissanceParDefaut(): Date {
  const aujourdHui = new Date();
  return new Date(aujourdHui.getFullYear() - 25, aujourdHui.getMonth(), aujourdHui.getDate());
}

function formaterDateAffichage(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

// Seuls "reseau" a un message dédié sur cet écran (docs/ecrans/L1-02, tableau des messages) :
// "age_insuffisant" est toujours intercepté avant cet appel (voir surCreerCompte), et aucun
// autre code n'est autorisé à apparaître ici — la fiche l'interdit explicitement ("Aucun
// autre. Si une situation nouvelle apparaît, elle s'ajoute à ce tableau avant d'apparaître à
// l'écran"). Tout code non prévu retombe donc sur le message générique, jamais un code brut.
function messageErreurGlobale(erreur: ErreurAuth): string {
  if (erreur.code === 'reseau') return 'Pas de connexion. Ta saisie est gardée, réessaie.';
  return 'On a un souci de notre côté. Ce n’est pas toi.';
}

type ProprietesDeclencheurDate = {
  dateNaissance: Date | null;
  enErreur: boolean;
  desactive: boolean;
  onPress: () => void;
};

// Partagé entre la variante Android (ouvre un dialogue) et iOS (déplie un sélecteur en ligne) :
// même apparence, seul le geste d'ouverture diffère. N'affiche JAMAIS une date tant que
// dateNaissance est null — voir le commentaire de dateNaissance dans Inscription ci-dessous.
function DeclencheurDate({
  dateNaissance,
  enErreur,
  desactive,
  onPress,
}: ProprietesDeclencheurDate) {
  const theme = useTheme();
  const texte = dateNaissance
    ? formaterDateAffichage(dateNaissance)
    : 'Choisir ta date de naissance';

  return (
    <Pressable
      testID="ouvrir-selecteur-date-naissance"
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityLabel={
        dateNaissance ? `Date de naissance, ${texte}` : `Date de naissance, ${texte.toLowerCase()}`
      }
      style={{
        minHeight: theme.taille.controle,
        justifyContent: 'center',
        borderRadius: theme.rayon.saisie,
        borderWidth: theme.taille.focusContour,
        borderColor: enErreur ? theme.couleur.etat.erreur : theme.couleur.bordure.marquee,
        paddingHorizontal: theme.espace[4],
        backgroundColor: theme.couleur.fond.canevas,
      }}
    >
      <Text
        style={{
          ...theme.texte.corps,
          // texte.attenue, jamais gris[400] (le ton du placeholder natif de Champ) : ce
          // texte est un VRAI nœud <Text>, contrairement à un placeholder de TextInput —
          // npm run test:a11y l'a mesuré à 2,38:1, sous le seuil (docs/design-system.md §1,
          // même famille de correction que #2).
          color: dateNaissance ? theme.couleur.texte.principal : theme.couleur.texte.attenue,
        }}
      >
        {texte}
      </Text>
    </Pressable>
  );
}

export default function Inscription() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { port } = useSession();

  const [email, setEmail] = useState(params.email ?? '');
  const [motDePasse, setMotDePasse] = useState('');
  // null : aucune date CHOISIE — jamais pré-rempli avec la date d'ouverture du sélecteur.
  // Trouvé en usage réel (pas en test) : une valeur plausible déjà là se laisse valider sans
  // qu'on l'ait jamais regardée, alors que c'est justement le champ qui porte la règle des 18
  // ans. Voir docs/ecrans/L1-02-creation-compte.md, tableau des champs, corrigé au même lot.
  const [dateNaissance, setDateNaissance] = useState<Date | null>(null);
  // Position d'ouverture du sélecteur seulement (année en cours moins 25 ans) — jamais une
  // valeur choisie. Figée une seule fois (pas de setter utilisé) : "aujourd'hui" ne doit pas
  // glisser d'un jour si la saisie traverse minuit.
  const [datePointOuverture] = useState(dateNaissanceParDefaut);
  const [afficherPickerAndroid, setAfficherPickerAndroid] = useState(false);
  const [afficherPickerIOS, setAfficherPickerIOS] = useState(false);
  const [valeurIOSEnCours, setValeurIOSEnCours] = useState(datePointOuverture);

  const [erreurEmail, setErreurEmail] = useState<string | undefined>();
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | undefined>();
  const [erreurDate, setErreurDate] = useState<string | undefined>();
  const [erreurGlobale, setErreurGlobale] = useState<ErreurAuth | undefined>();
  const [nombreEchecs, setNombreEchecs] = useState(0);
  const [chargement, setChargement] = useState(false);

  // "Bouton actif dès que les trois champs sont remplis, jamais avant" (États) : remplis, pas
  // nécessairement valides — un champ rempli mais invalide affiche son erreur à l'appui, voir
  // surCreerCompte. Pour la date, "rempli" veut dire CHOISIE par un geste explicite
  // (dateNaissance !== null) — jamais seulement "une valeur par défaut existe quelque part".
  const formulaireRempli = email.trim() !== '' && motDePasse !== '' && dateNaissance !== null;

  function validerEmail(valeur: string): boolean {
    if (!FORMAT_EMAIL.test(valeur.trim())) {
      setErreurEmail('Cette adresse ne ressemble pas à une adresse e-mail.');
      return false;
    }
    setErreurEmail(undefined);
    return true;
  }

  function validerMotDePasse(valeur: string): boolean {
    if (valeur.length < LONGUEUR_MOT_DE_PASSE_MIN) {
      setErreurMotDePasse('Il faut au moins 10 caractères.');
      return false;
    }
    // Jamais tronqué en silence (critère 3) : un mot de passe trop long est refusé avec ce
    // message, jamais coupé à 72 caractères puis envoyé.
    if (valeur.length > LONGUEUR_MOT_DE_PASSE_MAX) {
      setErreurMotDePasse('72 caractères au maximum.');
      return false;
    }
    setErreurMotDePasse(undefined);
    return true;
  }

  function validerDate(date: Date): boolean {
    if (!estMajeur(date)) {
      setErreurDate('My fav Coach est réservé aux majeurs.');
      return false;
    }
    setErreurDate(undefined);
    return true;
  }

  // Android : le dialogue natif a ses propres boutons OK/Annuler — onValueChange ne se
  // déclenche QUE sur OK, c'est déjà un geste de confirmation explicite.
  function surOuvrirSelecteurAndroid() {
    setAfficherPickerAndroid(true);
  }

  function surChoixAndroid(_evenement: DateTimePickerChangeEvent, date: Date) {
    setAfficherPickerAndroid(false);
    setDateNaissance(date);
    validerDate(date);
  }

  function surFermetureSansChoixAndroid() {
    setAfficherPickerAndroid(false);
  }

  // iOS : le style "spinner" n'a AUCUN geste de confirmation propre (contrairement au
  // dialogue Android) — il faut donc un état intermédiaire (valeurIOSEnCours) qui ne devient
  // dateNaissance qu'au bouton "Valider la date", jamais au premier défilement.
  function surOuvrirSelecteurIOS() {
    setValeurIOSEnCours(dateNaissance ?? datePointOuverture);
    setAfficherPickerIOS(true);
  }

  function surDeplacementIOS(_evenement: DateTimePickerChangeEvent, date: Date) {
    setValeurIOSEnCours(date);
  }

  function surValiderIOS() {
    setDateNaissance(valeurIOSEnCours);
    validerDate(valeurIOSEnCours);
    setAfficherPickerIOS(false);
  }

  async function surCreerCompte() {
    // Contrôle applicatif des trois champs, une politesse : la vraie règle des 18 ans est le
    // déclencheur SQL de 0001_creer_identite.sql, prouvé par src/test/rls.banc.ts. Le mot de
    // passe n'est jamais journalisé, jamais placé dans un état global au-delà de cet écran, et
    // n'est conservé après l'appel que le temps de revenir corriger l'adresse depuis L1-03
    // (docs/ecrans/L1-03-verification-email.md, "Ce n'est pas la bonne adresse" — la même
    // instance d'écran reste montée sous la pile de navigation, voir surAdresseIncorrecte de
    // app/(public)/verification.tsx).
    const emailValide = validerEmail(email);
    const motDePasseValide = validerMotDePasse(motDePasse);
    // Inatteignable par un appui réel (formulaireRempli désactive le bouton tant que
    // dateNaissance est null) : garde de défense en profondeur, pas un message utilisateur —
    // le tableau des messages de la fiche n'en prévoit aucun pour ce cas.
    if (dateNaissance === null) return;
    const dateValide = validerDate(dateNaissance);
    if (!emailValide || !motDePasseValide || !dateValide) return;

    setErreurGlobale(undefined);
    setChargement(true);
    const resultat = await port.inscrire(email.trim(), motDePasse, formatDateISO(dateNaissance));
    setChargement(false);

    if (!resultat.succes) {
      // Fenêtre de désaccord documentée (docs/dette.md) : le serveur, en UTC, peut refuser une
      // personne que ce contrôle local, en heure de l'appareil, vient d'accepter — jamais
      // l'inverse. Rejoué ici comme une erreur de champ, pas une erreur globale.
      if (resultat.erreur.code === 'age_insuffisant') {
        setErreurDate(resultat.erreur.message);
        return;
      }
      setNombreEchecs((n) => n + 1);
      setErreurGlobale(resultat.erreur);
      return;
    }

    // Aucune énumération de comptes (règle de la fiche) : ce chemin est identique, adresse
    // nouvelle ou déjà inscrite — c'est le port lui-même qui garantit ce comportement
    // (src/services/auth/faux.ts, src/services/auth/supabase.ts), jamais "amélioré" ici.
    // app/(public)/verification.tsx n'existe pas encore au moment où ce fichier est écrit
    // (P1.8, même prompt) : cast Href, même motif que app/(public)/index.tsx pour
    // "/(public)/inscription" avant que ce fichier-ci existe.
    router.push(`/(public)/verification?email=${encodeURIComponent(email.trim())}` as Href);
  }

  const compteurMotDePasse = `${LONGUEUR_MOT_DE_PASSE_MIN} caractères minimum · ${Math.min(
    motDePasse.length,
    LONGUEUR_MOT_DE_PASSE_MIN,
  )} sur ${LONGUEUR_MOT_DE_PASSE_MIN}`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + theme.espace[3],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <BoutonIcone
          nom="retour"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          desactive={chargement}
        />

        {erreurGlobale ? (
          <EtatErreur
            titre="On a un souci de notre côté"
            explication={messageErreurGlobale(erreurGlobale)}
            nombreEchecs={nombreEchecs}
            onReessayer={surCreerCompte}
            onNousEcrire={() => {}}
            code={erreurGlobale.code}
          />
        ) : null}

        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          On commence par ton compte.
        </Text>

        <Champ
          libelle="Adresse e-mail"
          type="email"
          valeur={email}
          onChangeTexte={(valeur) => {
            setEmail(valeur);
            if (erreurEmail) setErreurEmail(undefined);
          }}
          onBlur={() => {
            if (email.trim() !== '') validerEmail(email);
          }}
          messageErreur={erreurEmail}
          desactive={chargement}
        />

        <View style={{ gap: theme.espace[2] }}>
          <Champ
            libelle="Mot de passe"
            type="motDePasse"
            valeur={motDePasse}
            onChangeTexte={(valeur) => {
              setMotDePasse(valeur);
              if (erreurMotDePasse) setErreurMotDePasse(undefined);
            }}
            onBlur={() => {
              if (motDePasse !== '') validerMotDePasse(motDePasse);
            }}
            messageErreur={erreurMotDePasse}
            desactive={chargement}
          />
          {!erreurMotDePasse ? (
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              {compteurMotDePasse}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: theme.espace[2] }}>
          <Text
            style={{
              ...theme.texte.label,
              color: erreurDate ? theme.couleur.etat.erreurEncre : theme.couleur.texte.attenue,
            }}
          >
            Date de naissance
          </Text>

          {Platform.OS === 'web' ? (
            // @react-native-community/datetimepicker n'a aucune implémentation web
            // (node_modules/.../src/datetimepicker.js, le repli sans suffixe de plateforme
            // que Metro utilise faute de .web.js, rend null et se contente d'un
            // console.warn) — même trou que expo-secure-store, voir docs/backend.md pour
            // l'angle mort structurel que ça révèle sur nos vérifications. Un repli
            // SILENCIEUX serait pire qu'un champ manquant : la règle des 18 ans ne pourrait
            // jamais être confirmée sans que rien ne le dise. Le web n'étant de toute façon
            // jamais une cible du produit (CLAUDE.md §1), ce message dit honnêtement que
            // l'inscription ne peut pas aboutir ici plutôt que de laisser un bouton qui ne
            // s'active jamais sans explication.
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Le sélecteur de date n’est pas disponible depuis un navigateur. Utilise l’application
              mobile pour créer ton compte.
            </Text>
          ) : Platform.OS === 'android' ? (
            <>
              <DeclencheurDate
                dateNaissance={dateNaissance}
                enErreur={Boolean(erreurDate)}
                desactive={chargement}
                onPress={surOuvrirSelecteurAndroid}
              />
              {afficherPickerAndroid ? (
                <DateTimePicker
                  testID="selecteur-date-naissance"
                  value={dateNaissance ?? datePointOuverture}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onValueChange={surChoixAndroid}
                  onDismiss={surFermetureSansChoixAndroid}
                />
              ) : null}
            </>
          ) : (
            <>
              <DeclencheurDate
                dateNaissance={dateNaissance}
                enErreur={Boolean(erreurDate)}
                desactive={chargement}
                onPress={surOuvrirSelecteurIOS}
              />
              {afficherPickerIOS ? (
                <View style={{ gap: theme.espace[2] }}>
                  <DateTimePicker
                    testID="selecteur-date-naissance"
                    value={valeurIOSEnCours}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    onValueChange={surDeplacementIOS}
                    accessibilityLabel="Date de naissance"
                  />
                  <Bouton variante="secondaire" libelle="Valider la date" onPress={surValiderIOS} />
                </View>
              ) : null}
            </>
          )}

          {erreurDate ? (
            <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
              {erreurDate}
            </Text>
          ) : null}
        </View>

        <Text
          style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}
          accessibilityLabel="En créant ton compte, tu acceptes les CGU et la politique de confidentialité."
        >
          En créant ton compte, tu acceptes les{' '}
          <Text
            // L2-03 (C-06) : ouvre la surface publique du lecteur de document, sans session.
            // L'enregistrement du consentement CGU AVEC SA VERSION reste un mécanisme distinct
            // (VERSION_CGU_ACCEPTEE, src/services/auth/supabase.ts, déjà écrit à l'inscription
            // depuis L1) — cette page ne fait que permettre de LIRE le texte, jamais l'accepter.
            onPress={() => router.push('/(public)/documents/cgu' as Href)}
            style={{ textDecorationLine: 'underline' }}
          >
            CGU
          </Text>{' '}
          et la{' '}
          <Text
            onPress={() => router.push('/(public)/documents/confidentialite' as Href)}
            style={{ textDecorationLine: 'underline' }}
          >
            politique de confidentialité
          </Text>
          .
        </Text>
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
          libelle="Créer mon compte"
          variante="primaire"
          onPress={surCreerCompte}
          desactive={!formulaireRempli || chargement}
        />
      </View>
    </View>
  );
}
