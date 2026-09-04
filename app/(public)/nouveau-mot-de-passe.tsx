import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Champ } from '@/composants/champ';
import { determinerDestination } from '@/fonctionnalites/identite/garde';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { ErreurAuth } from '@/services/auth/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-04-connexion.md, "Nouveau mot de passe" : "Un champ (10 caractères minimum)".
// Même borne haute que docs/ecrans/L1-02-creation-compte.md et pour la même raison — limite
// dure de bcrypt côté service (docs/domaine.md §3.1), pas un choix d'ergonomie propre à cet
// écran.
const LONGUEUR_MOT_DE_PASSE_MIN = 10;
const LONGUEUR_MOT_DE_PASSE_MAX = 72;

type EtatEcran =
  | { type: 'attente' } // établissement de la session de récupération, lien pas encore reçu
  | { type: 'pret' }
  | { type: 'lien_expire' }
  | { type: 'erreur'; erreur: ErreurAuth };

function messageErreur(erreur: ErreurAuth): string {
  if (erreur.code === 'reseau') return 'Pas de connexion. Réessaie.';
  return 'On a un souci de notre côté. Ce n’est pas toi.';
}

export default function NouveauMotDePasse() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port, session } = useSession();

  const [etat, setEtat] = useState<EtatEcran>({ type: 'attente' });
  const [motDePasse, setMotDePasse] = useState('');
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | undefined>();
  const [chargement, setChargement] = useState(false);

  function traiterEchecLien(erreur: ErreurAuth) {
    if (erreur.code === 'lien_expire') {
      setEtat({ type: 'lien_expire' });
      return;
    }
    setEtat({ type: 'erreur', erreur });
  }

  function traiterLien(url: string) {
    port.etablirSessionDepuisLien(url).then((resultat) => {
      if (resultat.succes) {
        setEtat({ type: 'pret' });
      } else {
        traiterEchecLien(resultat.erreur);
      }
    });
  }

  // Démarrage à froid : app/_layout.tsx a délibérément NAVIGUÉ ici sans échanger le code (voir
  // son commentaire) — cet écran doit donc lire l'URL de lancement lui-même, une seule fois.
  // Démarrage à chaud (l'écran est déjà monté quand le lien arrive) : addEventListener, jamais
  // les deux pour le MÊME lancement (getInitialURL ne se déclenche qu'au vrai démarrage à
  // froid ; un remontage sans redémarrage réel relirait la même URL et échouerait proprement
  // en "lien expiré" — un cas rare, sans conséquence de sécurité, jamais gardé explicitement).
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) traiterLien(url);
    });
    const abonnement = Linking.addEventListener('url', ({ url }) => traiterLien(url));
    return () => abonnement.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port]);

  function validerMotDePasse(valeur: string): boolean {
    if (valeur.length < LONGUEUR_MOT_DE_PASSE_MIN) {
      setErreurMotDePasse('Il faut au moins 10 caractères.');
      return false;
    }
    if (valeur.length > LONGUEUR_MOT_DE_PASSE_MAX) {
      setErreurMotDePasse('72 caractères au maximum.');
      return false;
    }
    setErreurMotDePasse(undefined);
    return true;
  }

  async function surValider() {
    if (!validerMotDePasse(motDePasse)) return;

    setChargement(true);
    const resultat = await port.changerMotDePasse(motDePasse);
    setChargement(false);

    if (!resultat.succes) {
      setEtat({ type: 'erreur', erreur: resultat.erreur });
      return;
    }

    // La session établie par le lien (à l'arrivée sur cet écran) reste la même : changer le
    // mot de passe ne change ni le compte ni son état de vérification. garde.ts décide de la
    // destination, jamais cet écran (docs/ecrans/L1-04, "l'utilisateur arrive dans son espace,
    // connecté").
    if (session) router.replace(determinerDestination(session));
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + theme.espace[6],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          Choisis un nouveau mot de passe.
        </Text>

        {etat.type === 'attente' ? (
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
            On prépare ton lien…
          </Text>
        ) : null}

        {etat.type === 'lien_expire' ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              gap: theme.espace[3],
              padding: theme.espace[4],
              borderRadius: theme.rayon.feuille,
              backgroundColor: theme.couleur.etat.erreurTeinte,
              borderWidth: 1,
              borderColor: theme.couleur.etat.erreurBordure,
            }}
          >
            <Text style={{ ...theme.texte.actionAccent, color: theme.couleur.etat.erreurEncre }}>
              Ce lien a expiré
            </Text>
            <Bouton
              variante="primaire"
              libelle="M’en renvoyer un"
              onPress={() => router.replace('/(public)/mot-de-passe-oublie')}
            />
          </View>
        ) : null}

        {etat.type === 'erreur' ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              gap: theme.espace[2],
              padding: theme.espace[4],
              borderRadius: theme.rayon.feuille,
              backgroundColor: theme.couleur.etat.erreurTeinte,
              borderWidth: 1,
              borderColor: theme.couleur.etat.erreurBordure,
            }}
          >
            <Text style={{ ...theme.texte.corps, color: theme.couleur.etat.erreurEncre }}>
              {messageErreur(etat.erreur)}
            </Text>
          </View>
        ) : null}

        {etat.type === 'pret' ? (
          <Champ
            libelle="Nouveau mot de passe"
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
        ) : null}
      </ScrollView>

      {etat.type === 'pret' ? (
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
            libelle="Valider"
            variante="primaire"
            onPress={surValider}
            desactive={motDePasse === '' || chargement}
          />
        </View>
      ) : null}
    </View>
  );
}
