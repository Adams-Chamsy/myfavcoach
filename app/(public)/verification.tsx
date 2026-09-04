import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { Icone } from '@/composants/icones';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { ErreurAuth } from '@/services/auth/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-03-verification-email.md : "Renvoyer l'e-mail | secondaire | Actif après
// 60 secondes".
const SECONDES_AVANT_RENVOI = 60;

// Diamètre de la pastille qui entoure l'icône "document" (docs/ecrans/L1-03-verification-
// email.md : "Icône `document` 62 dans une pastille `marque.secondaire`"). Aucun token ne
// vaut 62 (le plus proche, taille.avatarXl, vaut 76 — un usage différent, l'avatar d'un
// profil) : constante locale documentée, même motif que TAILLE_LOGO dans app/index.tsx. Voir
// docs/dette.md.
const TAILLE_PASTILLE = 62;

type EtatEcran =
  | { type: 'attente' }
  | { type: 'renvoye' }
  | { type: 'lien_expire' }
  // docs/ecrans/L1-03, "Règles" : "Un renvoi refusé par le service affiche « Attends une
  // minute avant de réessayer », jamais un code technique" — message dédié, distinct du
  // bandeau EtatErreur générique utilisé pour "erreur".
  | { type: 'limite_renvoi' }
  | { type: 'erreur'; erreur: ErreurAuth };

function formaterDecompte(secondes: number): string {
  return `Renvoyer l'e-mail dans ${secondes} seconde${secondes > 1 ? 's' : ''}`;
}

export default function Verification() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const { port, session } = useSession();

  const [etat, setEtat] = useState<EtatEcran>({ type: 'attente' });
  const [secondesRestantes, setSecondesRestantes] = useState(SECONDES_AVANT_RENVOI);
  const [chargementRenvoi, setChargementRenvoi] = useState(false);
  const [nombreEchecs, setNombreEchecs] = useState(0);

  // Annonce le titre à l'arrivée (critère 6) — même mécanisme que EtatErreur
  // (src/composants/etats/etat-erreur.tsx) : announceForAccessibility, pas un déplacement de
  // focus.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Regarde tes e-mails.');
  }, []);

  // Décompte de renvoi (critère 1) : un intervalle réel, une seconde à la fois, jamais un
  // minuteur unique de 60 s — un test à minuteurs simulés doit pouvoir observer chaque palier.
  useEffect(() => {
    if (secondesRestantes <= 0) return;
    const identifiant = setInterval(() => {
      setSecondesRestantes((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(identifiant);
  }, [secondesRestantes]);

  // Transition automatique dès que la session (déjà réactive via FournisseurSession) devient
  // vérifiée — que ce soit ce lien profond qui vient de l'établir (ci-dessous) ou
  // app/_layout.tsx au démarrage à froid. Jamais determinerDestination(session) directement
  // ici (depuis P1.10) : la vraie destination dépend aussi des profils serveur, qu'un seul
  // endroit sait attendre correctement — "/" (app/index.tsx). Un seul endroit CALCULE la
  // destination (garde.ts), un seul endroit l'ATTEND (app/index.tsx) ; cet écran ne fait ni
  // l'un ni l'autre.
  useEffect(() => {
    if (session && session.emailVerifie) {
      router.replace('/');
    }
    // router stable ; seule une session nouvellement vérifiée doit redéclencher l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function traiterEchec(erreur: ErreurAuth) {
    if (erreur.code === 'lien_expire') {
      setEtat({ type: 'lien_expire' });
      return;
    }
    setNombreEchecs((n) => n + 1);
    setEtat({ type: 'erreur', erreur });
  }

  // Lien reçu PENDANT que cet écran est monté (application déjà ouverte). Le démarrage à
  // froid est traité séparément par app/_layout.tsx, une seule fois, jamais ici — le même
  // lien ne doit jamais être échangé deux fois (voir le commentaire de
  // traiterLienDemarrageAFroid dans _layout.tsx).
  useEffect(() => {
    const abonnement = Linking.addEventListener('url', ({ url }) => {
      port.etablirSessionDepuisLien(url).then((resultat) => {
        if (!resultat.succes) traiterEchec(resultat.erreur);
        // Succès : l'effet [session] ci-dessus gère la redirection dès que
        // FournisseurSession propage la nouvelle session (surChangementDeSession).
      });
    });
    return () => abonnement.remove();
  }, [port]);

  // Retour au premier plan (règle de la fiche : "Il attend le lien profond, ou un retour au
  // premier plan : à ce moment-là, une seule vérification d'état") — jamais une boucle
  // (critère 5) : un seul appel par VRAIE transition fond -> premier plan, jamais au montage
  // (l'écran est déjà au premier plan en arrivant ici) ni à chaque événement 'change' (qui
  // couvre aussi les transitions vers l'arrière-plan).
  const etatAppPrecedent = useRef(AppState.currentState);
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etatApp) => {
      const redevientActif = etatApp === 'active' && etatAppPrecedent.current !== 'active';
      etatAppPrecedent.current = etatApp;
      if (!redevientActif) return;

      port.sessionCourante().then((sessionTrouvee) => {
        if (sessionTrouvee && sessionTrouvee.emailVerifie) {
          router.replace('/');
        }
      });
    });
    return () => abonnement.remove();
  }, [port, router]);

  async function surRenvoyer() {
    setChargementRenvoi(true);
    const resultat = await port.renvoyerVerification(email);
    setChargementRenvoi(false);

    if (!resultat.succes) {
      if (resultat.erreur.code === 'limite_debit') {
        setEtat({ type: 'limite_renvoi' });
        setSecondesRestantes(SECONDES_AVANT_RENVOI);
        return;
      }
      traiterEchec(resultat.erreur);
      return;
    }

    setEtat({ type: 'renvoye' });
    setSecondesRestantes(SECONDES_AVANT_RENVOI);
    AccessibilityInfo.announceForAccessibility("C'est reparti.");
  }

  function surAdresseIncorrecte() {
    // Retour à L1-02 : la même instance d'écran reste montée sous la pile de navigation
    // (expo-router, pile native) — l'adresse ET le mot de passe déjà saisis y sont donc
    // encore présents, sans qu'aucun état n'ait besoin de transiter par cet écran-ci ni par
    // l'URL (docs/ecrans/L1-02-creation-compte.md, "le mot de passe... jamais placé dans un
    // état global").
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: theme.espace.gouttiere,
          gap: theme.espace[6],
        }}
      >
        {etat.type === 'erreur' ? (
          <EtatErreurRenvoi
            erreur={etat.erreur}
            nombreEchecs={nombreEchecs}
            onReessayer={surRenvoyer}
          />
        ) : null}

        <View style={{ alignItems: 'center', gap: theme.espace[4] }}>
          <View
            style={{
              width: TAILLE_PASTILLE,
              height: TAILLE_PASTILLE,
              borderRadius: theme.rayon.pilule,
              backgroundColor: theme.couleur.marque.secondaire,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icone nom="document" couleur={theme.couleur.marque.secondaireEncre} />
          </View>

          <Text
            style={{
              ...theme.texte.titre1,
              color: theme.couleur.texte.principal,
              textAlign: 'center',
            }}
          >
            Regarde tes e-mails.
          </Text>

          <Text
            style={{
              ...theme.texte.corps,
              color: theme.couleur.texte.secondaire,
              textAlign: 'center',
            }}
          >
            On a envoyé un lien à{' '}
            <Text style={{ fontWeight: '700', color: theme.couleur.texte.principal }}>{email}</Text>
            . Clique dessus et on continue.
          </Text>
        </View>

        {etat.type === 'lien_expire' ? (
          <View
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
            <Bouton variante="primaire" libelle="M’en renvoyer un" onPress={surRenvoyer} />
          </View>
        ) : null}

        <View style={{ gap: theme.espace[3] }}>
          <Bouton
            variante="secondaire"
            libelle={
              secondesRestantes > 0 ? formaterDecompte(secondesRestantes) : "Renvoyer l'e-mail"
            }
            onPress={surRenvoyer}
            desactive={secondesRestantes > 0 || chargementRenvoi}
          />

          {etat.type === 'renvoye' ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                ...theme.texte.petit,
                color: theme.couleur.marque.primaire,
                textAlign: 'center',
              }}
            >
              C’est reparti
            </Text>
          ) : null}

          {etat.type === 'limite_renvoi' ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                ...theme.texte.petit,
                color: theme.couleur.texte.secondaire,
                textAlign: 'center',
              }}
            >
              Attends une minute avant de réessayer.
            </Text>
          ) : null}

          <Bouton
            variante="discret"
            libelle="Ce n’est pas la bonne adresse"
            onPress={surAdresseIncorrecte}
          />
        </View>

        <View
          style={{
            padding: theme.espace[4],
            borderRadius: theme.rayon.feuille,
            backgroundColor: theme.couleur.marque.secondaire,
          }}
        >
          <Text style={{ ...theme.texte.petit, color: theme.couleur.marque.secondaireEncre }}>
            Rien dans ta boîte ? Regarde dans les indésirables. L’expéditeur est
            bonjour@myfavcoach.fr.
          </Text>
        </View>
      </View>
    </View>
  );
}

// Bespoke plutôt que src/composants/etats/etat-erreur.tsx directement : EtatErreur impose ses
// propres libellés de bouton ("Réessayer" / "Nous écrire"), corrects pour l'usage générique
// mais pas pour ce renvoi précis — ici "onReessayer" DOIT relancer exactement la même action
// que le bouton "Renvoyer l'e-mail" du bas, pas une action distincte. Réutilise son
// vocabulaire visuel (mêmes tokens de couleur), pas son composant.
function EtatErreurRenvoi({
  erreur,
  nombreEchecs,
  onReessayer,
}: {
  erreur: ErreurAuth;
  nombreEchecs: number;
  onReessayer: () => void;
}) {
  const theme = useTheme();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(messageErreur(erreur));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- annonce seulement à l'apparition.
  }, []);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        gap: theme.espace[3],
        padding: theme.espace[4],
        borderRadius: theme.rayon.feuille,
        backgroundColor: theme.couleur.etat.erreurTeinte,
        borderWidth: 1,
        borderColor: theme.couleur.etat.erreurBordure,
        alignItems: 'flex-start',
      }}
    >
      <Icone nom="alerte" taille={theme.taille.icone} couleur={theme.couleur.etat.erreur} />
      <View style={{ flex: 1, gap: theme.espace[3] }}>
        <Text style={{ ...theme.texte.corps, color: theme.couleur.etat.erreurEncre }}>
          {messageErreur(erreur)}
        </Text>
        <Bouton
          variante="primaire"
          libelle={nombreEchecs >= 3 ? 'Nous écrire' : 'Réessayer'}
          onPress={onReessayer}
        />
      </View>
    </View>
  );
}

// Deux causes seulement peuvent atteindre ce bandeau (traiterEchec exclut déjà lien_expire et
// limite_debit, chacun avec son propre affichage dédié) : reseau et serveur — voir le tableau
// de docs/ecrans/L1-02-creation-compte.md, réutilisé ici pour la cohérence des libellés entre
// les deux écrans du même parcours.
function messageErreur(erreur: ErreurAuth): string {
  if (erreur.code === 'reseau') return 'Pas de connexion. Réessaie.';
  return 'On a un souci de notre côté. Ce n’est pas toi.';
}
