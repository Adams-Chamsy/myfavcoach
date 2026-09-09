import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { Avatar } from '@/composants/avatar';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { FeuilleBasse } from '@/composants/feuille-basse';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { ProfilActif } from '@/services/donnees/port';
import { useTheme, type ThemeResolu } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

export type ProprietesFeuilleBascule = {
  ouverte: boolean;
  onFermer: () => void;
  // Contenu d'écran normal, derrière la feuille — transmis tel quel à FeuilleBasse (même rôle,
  // voir src/composants/feuille-basse.tsx).
  children: ReactNode;
};

// docs/ecrans/L1-06-bascule-espace.md : "la deuxième ligne mène à L1-08" — route posée par sa
// propre fiche (docs/ecrans/L1-08-activation-espace-coach.md), pas inventée ici.
const ROUTE_DEVENIR_COACH = '/(onboarding)/devenir-coach' as Href;

function nomComplet(prenom: string, nom: string | null) {
  return [prenom, nom].filter(Boolean).join(' ');
}

export function FeuilleBascule({ ouverte, onFermer, children }: ProprietesFeuilleBascule) {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const { profils, port, rafraichir } = useDonnees();

  const [enCours, setEnCours] = useState<ProfilActif | null>(null);
  const [derniereTentative, setDerniereTentative] = useState<ProfilActif | null>(null);
  const [enErreur, setEnErreur] = useState(false);
  const [nombreEchecs, setNombreEchecs] = useState(0);

  // Chaque ouverture repart d'un état propre : une erreur de la fois précédente ne doit pas
  // rester affichée derrière une feuille qu'on rouvre pour une autre raison. Ajustement pendant
  // le rendu (comme FeuilleBasse le fait pour "estMonte") plutôt qu'un effet : évite un rendu en
  // cascade pour une simple remise à zéro déclenchée par le changement de "ouverte".
  const [ouvertePrecedente, setOuvertePrecedente] = useState(ouverte);
  if (ouverte !== ouvertePrecedente) {
    setOuvertePrecedente(ouverte);
    if (ouverte) {
      setEnErreur(false);
      setNombreEchecs(0);
    }
  }

  if (!profils) {
    // N'arrive pas en usage normal : les deux seuls points d'entrée (docs/ecrans/
    // L1-06-bascule-espace.md, "Ouverture") vivent dans des écrans déjà protégés par
    // determinerDestination, qui n'accorde jamais un espace sans profils déjà résolus. Filet
    // minimal plutôt qu'un écran qui plante si jamais rendu avant.
    return (
      <FeuilleBasse ouverte={ouverte} onFermer={onFermer} enfants={null}>
        {children}
      </FeuilleBasse>
    );
  }

  async function basculerVers(profil: ProfilActif) {
    if (enCours || profils!.profilActif === profil) return;
    setEnErreur(false);
    setDerniereTentative(profil);
    setEnCours(profil);
    const resultat = await port.basculerProfil(profil);
    setEnCours(null);

    if (!resultat.succes) {
      setEnErreur(true);
      setNombreEchecs((n) => n + 1);
      return;
    }

    // basculer_profil a changé comptes.profil_actif CÔTÉ SERVEUR : sans ce rafraîchissement,
    // `profils.profilActif` en mémoire reste sur l'ancien espace, et la prochaine ouverture de
    // la feuille affiche la coche sur la mauvaise ligne — l'utilisateur ne peut alors plus
    // revenir (la ligne « déjà active » est inerte, `basculerVers` s'arrête sur le garde en
    // tête). Même défaut de fraîcheur que celui traité pour creer_profil_coach à P1.14.
    await rafraichir();

    onFermer();
    AccessibilityInfo.announceForAccessibility(
      profil === 'coach' ? 'Espace coach' : 'Espace client',
    );
    router.replace((profil === 'coach' ? '/(coach)/pilotage' : '/(client)/accueil') as Href);
  }

  function reessayer() {
    if (derniereTentative) basculerVers(derniereTentative);
  }

  function allerDevenirCoach() {
    if (enCours) return;
    onFermer();
    router.push(ROUTE_DEVENIR_COACH);
  }

  function allerReglagesCompte() {
    if (enCours) return;
    onFermer();
    // Asymétrie assumée (docs/prompts/L1.md, P1.12) : app/(coach)/moi.tsx n'existe pas encore,
    // seul P1.13 (docs/ecrans/L1-07-compte-reglages.md) construit les deux écrans "moi" pour de
    // bon. Depuis l'espace coach, ce lien mène à une route qui n'existe pas encore — même
    // asymétrie que la deuxième entrée de cette feuille (voir app/(client)/moi.tsx).
    router.push((profils!.profilActif === 'coach' ? '/(coach)/moi' : '/(client)/moi') as Href);
  }

  const actifClient = profils.profilActif === 'client';
  const actifCoach = profils.profilActif === 'coach';
  const pastilleAttentes =
    profils.coachExiste && !actifCoach && profils.attentesCoach > 0 ? profils.attentesCoach : null;

  return (
    <FeuilleBasse
      ouverte={ouverte}
      // Pendant une bascule en cours, rien d'autre n'est tactile (docs/ecrans/
      // L1-06-bascule-espace.md, États) — y compris le voile et le glissement de fermeture,
      // qui appellent tous les deux onFermer via FeuilleBasse : neutralisé le temps de l'appel.
      onFermer={enCours ? () => {} : onFermer}
      testID="feuille-bascule"
      enfants={
        <View style={{ gap: theme.espace[4] }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: theme.rayon.pilule,
              backgroundColor: theme.couleur.bordure.marquee,
              alignSelf: 'center',
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}>
            <Avatar
              nom={nomComplet(profils.identiteActive.prenom, profils.identiteActive.nom)}
              taille="lg"
            />
            <View style={{ flex: 1, gap: theme.espace[1] }}>
              <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
                {nomComplet(profils.identiteActive.prenom, profils.identiteActive.nom)}
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                {session?.email ?? ''}
              </Text>
            </View>
          </View>

          {enErreur ? (
            <EtatErreur
              titre={textesRepliErreur.serveur.titre}
              explication={textesRepliErreur.serveur.explication}
              nombreEchecs={nombreEchecs}
              onReessayer={reessayer}
              onNousEcrire={reessayer}
            />
          ) : null}

          <LigneEspaceClient
            theme={theme}
            actif={actifClient}
            enCours={enCours}
            desactive={Boolean(enCours)}
            onPress={() => basculerVers('client')}
          />

          {profils.coachExiste ? (
            <LigneEspaceCoach
              theme={theme}
              actif={actifCoach}
              enCours={enCours}
              desactive={Boolean(enCours)}
              pastille={pastilleAttentes}
              onPress={() => basculerVers('coach')}
            />
          ) : (
            <LigneDevenirCoach
              theme={theme}
              desactive={Boolean(enCours)}
              onPress={allerDevenirCoach}
            />
          )}

          <View style={{ height: 1, backgroundColor: theme.couleur.bordure.discrete }} />

          <Pressable
            onPress={allerReglagesCompte}
            disabled={Boolean(enCours)}
            accessibilityRole="button"
            accessibilityLabel="Réglages du compte"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.espace[3],
              minHeight: theme.taille.tapMin,
            }}
          >
            <Icone nom="reglages" couleur={theme.couleur.texte.secondaire} />
            <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
              Réglages du compte
            </Text>
          </Pressable>
        </View>
      }
    >
      {children}
    </FeuilleBasse>
  );
}

type ProprietesLigne = {
  theme: ThemeResolu;
  desactive: boolean;
  onPress: () => void;
};

// Espace client : suit le thème ambiant de bout en bout (comme la barre de navigation client,
// src/composants/barre-navigation.tsx) — jamais une île, contrairement à l'espace coach
// ci-dessous.
function LigneEspaceClient({
  theme,
  actif,
  enCours,
  desactive,
  onPress,
}: ProprietesLigne & { actif: boolean; enCours: ProfilActif | null }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityLabel={`Espace client${actif ? ', espace actif' : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.espace[3],
        padding: theme.espace[3],
        borderRadius: theme.rayon.saisie,
        minHeight: theme.taille.tapMin,
        backgroundColor: actif ? theme.couleur.marque.primaireTeinte : theme.couleur.fond.surface,
        borderWidth: actif ? 1.5 : 1,
        borderColor: actif ? theme.couleur.marque.primaire : theme.couleur.bordure.discrete,
        opacity: enCours === 'client' ? 0.6 : 1,
      }}
    >
      <Icone nom="profil" couleur={theme.couleur.texte.principal} />
      <View style={{ flex: 1, gap: theme.espace[1] }}>
        <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
          Espace client
        </Text>
        <Text
          style={{
            ...theme.texte.petit,
            // texte.secondaire sur marque.primaireTeinte (thème sombre) : 4,50:1, sous le seuil
            // de 4,5:1 exigé — marque.primaireSurvol est la paire vérifiée pour du texte sur ce
            // fond précis (src/composants/chip.tsx, seul autre consommateur de primaireTeinte).
            color: actif ? theme.couleur.marque.primaireSurvol : theme.couleur.texte.secondaire,
          }}
        >
          Tes coachs et tes séances
        </Text>
      </View>
      {actif ? <Icone nom="valide" couleur={theme.couleur.marque.primaire} /> : null}
    </Pressable>
  );
}

// Espace coach : île sombre FIXE, comme la barre de navigation coach (src/composants/
// barre-navigation.tsx) — fond ET contenu viennent toujours de themes.sombre, jamais du thème
// ambiant via useTheme(). CLAUDE.md §5 : ce même bug (un token "inversible" lu par contexte,
// donc retourné sous un thème ambiant différent) a déjà été trouvé deux fois au jalon 1.
function LigneEspaceCoach({
  theme,
  actif,
  enCours,
  desactive,
  pastille,
  onPress,
}: ProprietesLigne & { actif: boolean; enCours: ProfilActif | null; pastille: number | null }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityLabel={[
        'Espace coach',
        actif ? 'espace actif' : null,
        pastille ? `${pastille} en attente` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.espace[3],
        padding: theme.espace[3],
        borderRadius: theme.rayon.saisie,
        minHeight: theme.taille.tapMin,
        backgroundColor: themes.sombre.fond.canevas,
        opacity: enCours === 'coach' ? 0.6 : 1,
      }}
    >
      <Icone nom="pilotage" couleur={themes.sombre.texte.surSombre} />
      <View style={{ flex: 1, gap: theme.espace[1] }}>
        <Text style={{ ...theme.texte.titre3, color: themes.sombre.texte.surSombre }}>
          Espace coach
        </Text>
        <Text style={{ ...theme.texte.petit, color: themes.sombre.texte.secondaire }}>
          Tes clients et tes revenus
        </Text>
      </View>
      {actif ? <Icone nom="valide" couleur={themes.sombre.marque.primaire} /> : null}
      {pastille ? (
        <View
          testID="pastille-attentes-coach"
          style={{
            minWidth: theme.espace[6],
            height: theme.espace[6],
            paddingHorizontal: theme.espace[2],
            borderRadius: theme.rayon.pilule,
            backgroundColor: themes.sombre.marque.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...theme.texte.legende, color: themes.sombre.marque.accentEncre }}>
            {pastille}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// Sans profil coach : docs/ecrans/L1-06-bascule-espace.md, "Si le profil coach n'existe pas".
// Jamais grisée — desactive ne vaut jamais true ici pour "profil coach absent", seulement
// pendant une bascule EN COURS (l'autre ligne), comme toute autre action de la feuille.
function LigneDevenirCoach({
  theme,
  desactive,
  onPress,
}: {
  theme: ThemeResolu;
  desactive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityLabel="Devenir coach"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.espace[3],
        padding: theme.espace[3],
        borderRadius: theme.rayon.saisie,
        minHeight: theme.taille.tapMin,
        backgroundColor: themes.sombre.fond.canevas,
      }}
    >
      <Icone nom="pilotage" couleur={themes.sombre.texte.surSombre} />
      <View style={{ flex: 1, gap: theme.espace[1] }}>
        <Text style={{ ...theme.texte.titre3, color: themes.sombre.texte.surSombre }}>
          Devenir coach
        </Text>
        <Text style={{ ...theme.texte.petit, color: themes.sombre.texte.secondaire }}>
          Publier tes offres et être payé
        </Text>
      </View>
      <Icone nom="suivant" couleur={themes.sombre.texte.secondaire} />
    </Pressable>
  );
}
