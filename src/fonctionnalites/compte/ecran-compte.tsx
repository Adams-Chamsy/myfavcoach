import { DefilementEcran, useDispositionEcran } from '@/composants/canevas-ecran';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/composants/avatar';
import { EntetePublicV2, FournisseurPresentationV2, FlecheV2 } from '@/composants/presentation-v2';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { BlocMesAbonnements } from '@/fonctionnalites/abonnement/bloc-mes-abonnements';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone, type NomIcone } from '@/composants/icones';
import { Modale } from '@/composants/modale';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useTheme, type ThemeResolu } from '@/theme/fournisseur';
import { themes, presentationV2 as mesure } from '@/theme/tokens';

// Écran 24 « Mon compte et réglages » (docs/ecrans/L1-07-compte-reglages.md). Le MÊME écran
// dans les deux espaces, même route relative « moi » : app/(client)/moi.tsx et
// app/(coach)/moi.tsx ne font que le réexporter. Seul l'en-tête change de profil (identité
// active + bloc encre), la liste de réglages est identique des deux côtés.
//
// Lignes qui ouvrent réellement leur destination (docs/prompts/L1.md, P1.13 : « une ligne qui
// n'ouvre rien ne s'affiche pas »). Ni abonnements (L4), ni notifications (L10) — deux lots
// réellement loin. Un test le vérifie : src/fonctionnalites/compte/ecran-compte.test.tsx,
// critère 9.
//
// P2.12 (L2, C-03/C-06/C-07) ajoute « Documents contractuels » et « Exporter mes données » à
// cette liste, et « Supprimer mon compte » en dessous de « Se déconnecter » (styles distincts :
// une déconnexion se répare en une reconnexion, une suppression non).

type LigneReglage = {
  cle: string;
  libelle: string;
  description: string;
  icone: NomIcone;
  route: Href;
};

const LIGNES_REGLAGES: LigneReglage[] = [
  {
    cle: 'informations',
    libelle: 'Mes informations',
    description: 'Identité et profil',
    icone: 'profil',
    route: '/(compte)/informations' as Href,
  },
  {
    cle: 'identifiants',
    libelle: 'Adresse e-mail et mot de passe',
    description: 'Sécurité du compte',
    icone: 'securite',
    route: '/(compte)/identifiants' as Href,
  },
  {
    cle: 'confidentialite',
    libelle: 'Mes autorisations',
    description: 'Santé et communications',
    icone: 'information',
    route: '/(compte)/confidentialite' as Href,
  },
  {
    cle: 'documents',
    libelle: 'Documents contractuels',
    description: 'Conditions et confidentialité',
    icone: 'document',
    route: '/(compte)/documents' as Href,
  },
  {
    cle: 'export',
    libelle: 'Exporter mes données',
    description: 'Récupérer une copie',
    icone: 'document',
    route: '/(compte)/export' as Href,
  },
];

function nomComplet(prenom: string, nom: string | null) {
  return [prenom, nom].filter(Boolean).join(' ');
}

// Version + numéro de build affichés en pied (« ce que le support demandera un jour »). Le
// build est absent en développement (Expo Go, `expo start`) : on n'affiche alors que la
// version, jamais un « (build null) » trompeur.
function ligneVersion() {
  const version = Constants.expoConfig?.version ?? '—';
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    (Constants.expoConfig?.android?.versionCode != null
      ? String(Constants.expoConfig.android.versionCode)
      : null);
  return build ? `Version ${version} (build ${build})` : `Version ${version}`;
}

export function EcranCompte() {
  const theme = useTheme();
  const { large } = useDispositionEcran();
  // Onglet / route sous une navigation « headerShown: false » : rien au-dessus ne réserve la
  // barre d'état. Comme accueil.tsx et pilotage.tsx, l'écran pousse lui-même son premier
  // contenu sous l'encoche (src/test/accessibilite.test.tsx, ECRANS_CHROME_HAUT).
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, port: portAuth } = useSession();
  const { chargement, profils } = useDonnees();

  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [confirmationDeconnexion, setConfirmationDeconnexion] = useState(false);

  const nom = profils ? nomComplet(profils.identiteActive.prenom, profils.identiteActive.nom) : '';
  const coachExiste = profils?.coachExiste ?? false;

  async function confirmerDeconnexion() {
    setConfirmationDeconnexion(false);
    // Réussit même hors ligne : le port passe `{ scope: 'local' }` et n'échoue jamais faute de
    // réseau (docs/ecrans/L1-07-compte-reglages.md, règle « déconnexion »). Rien de plus à
    // faire ici que de l'appeler puis de renvoyer sur l'écran de bienvenue (L1-01).
    await portAuth.deconnecter();
    router.replace('/(public)' as Href);
  }

  return (
    <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
      <Modale
        ouverte={confirmationDeconnexion}
        onFermer={() => setConfirmationDeconnexion(false)}
        titre="Se déconnecter ?"
        corps="Il faudra te reconnecter avec ton mot de passe."
        libelleAction="Annuler"
        onAction={() => setConfirmationDeconnexion(false)}
        libelleDestructeur="Se déconnecter"
        onDestructeur={confirmerDeconnexion}
      >
        <FournisseurPresentationV2>
          <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
            {!large ? (
              <EntetePublicV2
                accessoire={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mon compte, changer d’espace"
                    onPress={() => setFeuilleOuverte(true)}
                    style={{
                      minHeight: theme.taille.tapMin,
                      minWidth: theme.taille.tapMin,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Avatar nom={nom} taille="sm" />
                  </Pressable>
                }
              />
            ) : null}
            <DefilementEcran
              ample
              contentContainerStyle={{
                paddingHorizontal: large ? theme.espace[12] : mesure.enteteHorizontal,
                paddingTop: large ? mesure.contenuLargePadding : theme.espace[6],
                paddingBottom: insets.bottom + mesure.contenuBas,
              }}
            >
              <View style={{ marginBottom: mesure.enteteBas }}>
                <Text
                  style={{
                    ...theme.texte.v2Surtitre,
                    color: theme.couleur.marque.primaire,
                    marginBottom: mesure.titreHaut,
                  }}
                >
                  {profils?.profilActif === 'coach' ? 'TON ESPACE COACH' : 'TON ESPACE CLIENT'}
                </Text>
                <Text
                  accessibilityRole="header"
                  style={{
                    ...(large ? theme.texte.v2TitreAuthLarge : theme.texte.v2TitreAuth),
                    color: theme.couleur.texte.principal,
                  }}
                >
                  {profils?.profilActif === 'coach'
                    ? 'Un compte.\nDeux façons d’avancer.'
                    : 'À toi de choisir.'}
                </Text>
                {profils?.profilActif !== 'coach' ? (
                  <Text
                    style={{
                      ...theme.texte.v2Corps,
                      color: theme.couleur.texte.secondaire,
                      marginTop: mesure.descriptionHaut,
                    }}
                  >
                    Tes accompagnements et tes réglages, au même endroit.
                  </Text>
                ) : null}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: mesure.profilEspace,
                  marginBottom: mesure.profilBas,
                }}
              >
                <Pressable
                  onPress={() => setFeuilleOuverte(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`${nom || 'Mon compte'}, changer d'espace`}
                  style={{
                    minWidth: theme.taille.tapMin,
                    minHeight: theme.taille.tapMin,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Avatar nom={nom} taille="lg" />
                </Pressable>
                <View style={{ flex: 1, gap: theme.espace[1] }}>
                  <Text
                    style={{ ...theme.texte.v2NomProfil, color: theme.couleur.texte.principal }}
                  >
                    {nom}
                  </Text>
                  <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.texte.secondaire }}>
                    {session?.email ?? ''}
                  </Text>
                </View>
              </View>
              <View style={{ gap: theme.espace[4] }}>
                {chargement ? (
                  <>
                    <Squelette forme="liste" />
                    <Squelette forme="carte" />
                  </>
                ) : (
                  <>
                    {!profils ? (
                      <EtatErreur
                        titre={textesRepliErreur.serveur.titre}
                        explication={textesRepliErreur.serveur.explication}
                        nombreEchecs={0}
                        onReessayer={() => {}}
                      />
                    ) : null}

                    {/* L4-24b : entre l'en-tête et la liste de réglages, espace client seulement (les
                    abonnés d'un coach sont une autre lecture, L7). */}
                    {profils?.profilActif === 'client' ? (
                      <BlocMesAbonnements
                        onRegler={(abonnementId) =>
                          router.push(
                            `/(client)/abonnement/${encodeURIComponent(abonnementId)}/refus` as Href,
                          )
                        }
                      />
                    ) : null}

                    <View>
                      {LIGNES_REGLAGES.map((ligne, index) => (
                        <View key={ligne.cle}>
                          {index > 0 ? (
                            <View
                              style={{ height: 1, backgroundColor: theme.couleur.bordure.marquee }}
                            />
                          ) : null}
                          <Pressable
                            onPress={() => router.push(ligne.route)}
                            accessibilityRole="button"
                            accessibilityLabel={ligne.libelle}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: theme.espace[3],
                              paddingHorizontal: 0,
                              paddingVertical: mesure.reglageVertical,
                              minHeight: mesure.reglageHauteur,
                            }}
                          >
                            <Icone
                              nom={ligne.icone}
                              taille={mesure.icone}
                              couleur={theme.couleur.texte.secondaire}
                            />
                            <View style={{ flex: 1, gap: theme.espace[1] }}>
                              <Text
                                style={{
                                  ...theme.texte.v2LabelChamp,
                                  fontSize: mesure.reglageTexte,
                                  lineHeight: mesure.reglageInterligne,
                                  color: theme.couleur.texte.principal,
                                }}
                              >
                                {ligne.libelle}
                              </Text>
                              <Text
                                style={{
                                  ...theme.texte.v2Petit,
                                  color: theme.couleur.texte.secondaire,
                                }}
                              >
                                {ligne.description}
                              </Text>
                            </View>
                            <FlecheV2 couleur={theme.couleur.texte.secondaire} />
                          </Pressable>
                        </View>
                      ))}
                    </View>

                    <BlocEncre
                      theme={theme}
                      coachExiste={coachExiste}
                      onPress={() => setFeuilleOuverte(true)}
                    />

                    <Pressable
                      onPress={() => setConfirmationDeconnexion(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Se déconnecter"
                      accessibilityHint="Ferme ta session. Il faudra te reconnecter avec ton mot de passe."
                      style={{
                        minHeight: mesure.reglageHauteur,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ ...theme.texte.titre3, color: theme.couleur.etat.erreur }}>
                        Se déconnecter
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => router.push('/(compte)/suppression' as Href)}
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer mon compte"
                      style={{
                        minHeight: mesure.reglageHauteur,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ ...theme.texte.v2Petit, color: theme.couleur.etat.erreur }}>
                        Supprimer mon compte
                      </Text>
                    </Pressable>

                    <Text
                      style={{
                        ...theme.texte.legende,
                        color: theme.couleur.texte.attenue,
                        textAlign: 'center',
                      }}
                    >
                      {ligneVersion()}
                    </Text>
                  </>
                )}
              </View>
            </DefilementEcran>
          </View>
        </FournisseurPresentationV2>
      </Modale>
    </FeuilleBascule>
  );
}

// Bloc encre : île sombre FIXE (CLAUDE.md §5) — fond ET texte viennent toujours de
// themes.sombre, jamais de useTheme(). fond.inverse lu par le contexte s'inverserait sous un
// thème ambiant sombre (galerie themeForce, test:a11y) et rendrait ce texte invisible sur son
// propre fond — bug déjà trouvé trois fois au jalon 1 (barre-navigation, (public)/index,
// (client)/moi). Presser le bloc OUVRE la feuille de bascule, au même titre que l'avatar,
// jamais une bascule directe ni un aiguillage vers L1-08 : titre et sous-titre ne sont qu'un
// aperçu du contenu de la feuille (docs/ecrans/L1-07-compte-reglages.md, §Contenu).
function BlocEncre({
  theme,
  coachExiste,
  onPress,
}: {
  theme: ThemeResolu;
  coachExiste: boolean;
  onPress: () => void;
}) {
  const titre = coachExiste ? 'Passer en espace coach' : 'Devenir coach';
  const sousTitre = coachExiste ? 'Tes clients et tes revenus' : 'Publie tes offres, fixe tes prix';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titre}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.espace[3],
        padding: theme.espace[4],
        borderRadius: theme.rayon.carte,
        backgroundColor: themes.clair.marque.primaireProfond,
        minHeight: theme.taille.tapMin,
      }}
    >
      <Icone nom="pilotage" couleur={themes.sombre.texte.surSombre} />
      <View style={{ flex: 1, gap: theme.espace[1] }}>
        <Text style={{ ...theme.texte.titre3, color: themes.sombre.texte.surSombre }}>{titre}</Text>
        <Text style={{ ...theme.texte.petit, color: themes.sombre.texte.secondaire }}>
          {sousTitre}
        </Text>
      </View>
      <Icone nom="suivant" couleur={themes.sombre.texte.secondaire} />
    </Pressable>
  );
}
