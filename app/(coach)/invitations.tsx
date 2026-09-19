import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Path, Rect, Svg } from 'react-native-svg';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Modale } from '@/composants/modale';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type { Invitation } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

// Pictogramme "copier" : hors des 36 icônes fermées du système (docs/design-system.md §5,
// src/composants/icones/) — SVG one-off, jamais ajouté à ce catalogue, même motif que
// IconeApple/IconeEnveloppe (app/(public)/index.tsx).
function IconeCopier({ couleur }: { couleur: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={2}>
      <Rect x="8" y="8" width="13" height="13" rx="2" />
      <Path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </Svg>
  );
}

// docs/ecrans/L3bis-I01-inviter-mes-clients.md. Écran FRÈRE du groupe (tabs), jamais dedans
// (CLAUDE.md §8, même motif que coach/[id]/creer/[type]).
//
// Domaine provisoire (docs/dette.md, Universal Links/App Links) : la vraie valeur dépend d'un
// hébergement qui n'existe pas encore — affichée telle quelle plutôt qu'inventée sous une autre
// forme.
const DOMAINE_INVITATION = 'myfavcoach.fr';

// La carte "Ton lien d'invitation" fixe son propre fond sombre, quel que soit le thème ambiant
// (maquette) : fond.inverse SUIT le thème ambiant et s'inverserait sous un thème sombre
// (CLAUDE.md §5 — trouvé deux fois déjà, barre-navigation.tsx et app/(public)/index.tsx,
// n'y ajoute pas une troisième fois). themes.clair.fond.inverse est la valeur sombre fixe
// (#17211E) qui correspond à ce que la maquette montre, choisie explicitement, jamais via
// useTheme().
const clair = themes.clair;

function libelleStatut(invitation: Invitation): string {
  if (invitation.statut === 'abonnee') {
    // abonneeLe est réel dès que le statut l'est (docs/domaine.md §3.15) — jamais atteint dans
    // ce lot (voir Règles), mais le code ne suppose pas cette absence : si abonneeLe manquait
    // malgré un statut 'abonnee', un texte vide serait pire qu'une valeur non formatée.
    const date = invitation.abonneeLe ? formaterDateCourte(invitation.abonneeLe) : '';
    return date ? `Abonnée depuis le ${date}` : 'Abonnée';
  }
  return 'Compte créé, pas encore abonnée';
}

function formaterDateCourte(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  return annee && mois && jour ? `${jour}/${mois}/${annee}` : iso;
}

export default function Invitations() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port } = useDonnees();

  const [chargement, setChargement] = useState(true);
  const [erreurLecture, setErreurLecture] = useState(false);
  const [jeton, setJeton] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [nombreEnAttente, setNombreEnAttente] = useState(0);
  const [copie, setCopie] = useState(false);
  // Le minuteur qui ramène l'icône "copié" à son état normal doit être annulé au démontage
  // (retour arrière juste après un tap) : sans quoi setCopie s'exécute sur un composant démonté.
  const minuteurCopieRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modaleRegenerationOuverte, setModaleRegenerationOuverte] = useState(false);
  const [regenerationEnCours, setRegenerationEnCours] = useState(false);
  const [erreurEcriture, setErreurEcriture] = useState<string | null>(null);

  const [modaleAjoutOuverte, setModaleAjoutOuverte] = useState(false);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  // Incrémenté par "Réessayer" pour redéclencher l'effet ci-dessous, plutôt que d'appeler une
  // fonction qui écrit l'état directement depuis le corps de l'effet (même style que
  // informations.tsx : la promesse est enchaînée dans l'effet lui-même, jamais une fonction
  // nommée invoquée comme une instruction).
  const [tentative, setTentative] = useState(0);

  useEffect(() => {
    let monte = true;
    Promise.all([
      port.lireMonJetonInvitation(),
      port.lireMesInvitations(),
      port.lireNombreInvitationsEnAttente(),
    ])
      .then(([jetonLu, invitationsLues, nombreLu]) => {
        if (!monte) return;
        setJeton(jetonLu);
        setInvitations(invitationsLues);
        setNombreEnAttente(nombreLu);
        setErreurLecture(false);
      })
      .catch(() => {
        if (monte) setErreurLecture(true);
      })
      .finally(() => {
        if (monte) setChargement(false);
      });
    return () => {
      monte = false;
    };
  }, [port, tentative]);

  useEffect(() => {
    return () => {
      if (minuteurCopieRef.current) clearTimeout(minuteurCopieRef.current);
    };
  }, []);

  const lien = `https://${DOMAINE_INVITATION}/y/${jeton}`;
  // "ont commencé" : X ne compte que les invitations avec une identité réelle à montrer, jamais
  // une promesse de "inscrits" que le JOIN de mes_invitations() ne peut pas garantir tant que
  // ProfilClient n'existe pas (docs/domaine.md §3.15). Y garde le dénominateur, qui reste la
  // seule comptabilité du coach (invitations envoyées), jamais un total vérifié côté serveur.
  const totalCommences = invitations.length;
  const totalEnvoyees = totalCommences + nombreEnAttente;

  async function copierLien() {
    await Clipboard.setStringAsync(lien);
    setCopie(true);
    AccessibilityInfo.announceForAccessibility('Lien copié.');
    if (minuteurCopieRef.current) clearTimeout(minuteurCopieRef.current);
    minuteurCopieRef.current = setTimeout(() => setCopie(false), 2000);
  }

  async function partager(texteIntroduction?: string) {
    try {
      await Share.share({
        message: texteIntroduction ? `${texteIntroduction} ${lien}` : lien,
      });
      // Que l'action résolue soit 'sharedAction' ou 'dismissedAction' (la personne ferme la
      // feuille sans partager), c'est un succès du point de vue de cet écran : Share.share
      // (react-native, Share.js) ne REJETTE JAMAIS pour une annulation — iOS résout avec
      // dismissedAction, Android résout toujours avec sharedAction. Un rejet ici est donc
      // TOUJOURS un vrai échec (module natif indisponible, contenu invalide…), jamais un choix
      // de la personne — voir le catch ci-dessous.
    } catch {
      setErreurEcriture('On a un souci de notre côté.');
    }
  }

  async function confirmerRegeneration() {
    setErreurEcriture(null);
    setRegenerationEnCours(true);
    try {
      const nouveauJeton = await port.regenererJetonInvitation();
      setJeton(nouveauJeton);
      setModaleRegenerationOuverte(false);
    } catch {
      setErreurEcriture('On a un souci de notre côté.');
    } finally {
      setRegenerationEnCours(false);
    }
  }

  async function confirmerAjout() {
    setAjoutEnCours(true);
    const resultat = await port.ajouterInvitationEnAttente();
    setAjoutEnCours(false);
    setModaleAjoutOuverte(false);
    if (resultat.succes) {
      setNombreEnAttente((n) => n + 1);
    } else {
      setErreurEcriture(resultat.erreur);
    }
  }

  const afficherQuiARepondu = totalCommences > 0 || nombreEnAttente > 0;

  return (
    <Modale
      ouverte={modaleRegenerationOuverte}
      onFermer={() => setModaleRegenerationOuverte(false)}
      titre="Régénérer ton lien ?"
      corps="Le lien actuel ne fonctionnera plus, même pour les personnes à qui tu l'as déjà envoyé mais qui n'ont pas encore créé de compte. Les invitations déjà abouties restent inchangées."
      libelleAction="Annuler"
      onAction={() => setModaleRegenerationOuverte(false)}
      libelleDestructeur="Régénérer"
      onDestructeur={confirmerRegeneration}
      destructeurOccupe={regenerationEnCours}
    >
      <Modale
        ouverte={modaleAjoutOuverte}
        onFermer={() => setModaleAjoutOuverte(false)}
        titre="Tu as prévenu quelqu'un d'autre ?"
        corps="On ajoute juste un compte à la liste de tes invitations envoyées — aucun nom n'est demandé ni enregistré."
        libelleAction="Annuler"
        onAction={() => setModaleAjoutOuverte(false)}
        libelleDestructeur="Confirmer l'ajout"
        onDestructeur={confirmerAjout}
        destructeurOccupe={ajoutEnCours}
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
              Mes invitations
            </Text>
          </View>

          {chargement ? (
            <View style={{ paddingHorizontal: theme.espace.gouttiere, gap: theme.espace[4] }}>
              <Squelette forme="carte" />
              <Squelette forme="ligne" />
              <Squelette forme="ligne" />
            </View>
          ) : erreurLecture ? (
            <View style={{ paddingHorizontal: theme.espace.gouttiere }}>
              <EtatErreur
                titre={textesRepliErreur.serveur.titre}
                explication={textesRepliErreur.serveur.explication}
                nombreEchecs={0}
                onReessayer={() => {
                  setChargement(true);
                  setTentative((n) => n + 1);
                }}
                onNousEcrire={() => {}}
              />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: theme.espace.gouttiere,
                paddingBottom: insets.bottom + theme.espace[6],
                gap: theme.espace[6],
              }}
            >
              <View style={{ gap: theme.espace[2] }}>
                <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
                  Tes clients actuels
                </Text>
                <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
                  Ceux que tu suis déjà ailleurs. Ils retrouvent leur programme ici, et tu arrêtes
                  de jongler entre trois outils.
                </Text>
              </View>

              <View
                style={{
                  borderRadius: theme.rayon.carte,
                  backgroundColor: clair.fond.inverse,
                  padding: theme.espace[4],
                  gap: theme.espace[4],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <Text style={{ ...theme.texte.label, color: clair.texte.surMarque }}>
                    Ton lien d&apos;invitation
                  </Text>
                  <Text style={{ ...theme.texte.legende, color: clair.texte.surMarque }}>
                    {totalCommences} ont commencé sur {totalEnvoyees}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.espace[2],
                    borderRadius: theme.rayon.saisie,
                    backgroundColor: theme.couleur.fond.canevas,
                    paddingVertical: theme.espace[2],
                    paddingHorizontal: theme.espace[3],
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      ...theme.texte.petit,
                      color: theme.couleur.texte.secondaire,
                    }}
                  >
                    {lien}
                  </Text>
                  <Pressable
                    onPress={copierLien}
                    accessibilityRole="button"
                    accessibilityLabel={copie ? 'Lien copié' : 'Copier le lien'}
                    style={{
                      minWidth: theme.taille.tapMin,
                      minHeight: theme.taille.tapMin,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {copie ? (
                      <Icone nom="valide" taille={17} couleur={theme.couleur.marque.primaire} />
                    ) : (
                      <IconeCopier couleur={theme.couleur.marque.primaire} />
                    )}
                  </Pressable>
                </View>

                <Bouton libelle="Partager" variante="primaire" onPress={() => partager()} />

                <Text style={{ ...theme.texte.legende, color: clair.texte.surMarque }}>
                  Un seul lien pour tout le monde. Envoie-le par message, par mail, comme tu veux.
                </Text>

                {/* Action rare, jamais mise en avant (docs/prompts/L3bis.md point 1) : un lien
                    texte discret, pas un second bouton au même poids que Partager. */}
                <Text
                  onPress={() => setModaleRegenerationOuverte(true)}
                  accessibilityRole="button"
                  style={{
                    ...theme.texte.petit,
                    color: clair.texte.surMarque,
                    textDecorationLine: 'underline',
                    minHeight: theme.taille.tapMin,
                  }}
                >
                  Régénérer mon lien
                </Text>
              </View>

              {erreurEcriture ? (
                <View accessibilityLiveRegion="polite">
                  <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
                    {erreurEcriture}
                  </Text>
                </View>
              ) : null}

              {afficherQuiARepondu ? (
                <View style={{ gap: theme.espace[3] }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
                      Qui a répondu
                    </Text>
                    <Text
                      onPress={() => setModaleAjoutOuverte(true)}
                      accessibilityRole="button"
                      style={{
                        ...theme.texte.corps,
                        fontWeight: '700',
                        color: theme.couleur.marque.primaire,
                        minHeight: theme.taille.tapMin,
                      }}
                    >
                      Ajouter
                    </Text>
                  </View>

                  {invitations.map((invitation) => (
                    <View
                      key={invitation.id}
                      style={{ flexDirection: 'row', gap: theme.espace[3], alignItems: 'center' }}
                    >
                      <View
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.couleur.fond.creux,
                        }}
                      >
                        <Icone
                          nom={invitation.statut === 'abonnee' ? 'valide' : 'duree'}
                          taille={16}
                          couleur={theme.couleur.marque.primaire}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text
                          style={{
                            ...theme.texte.corps,
                            fontWeight: '700',
                            color: theme.couleur.texte.principal,
                          }}
                        >
                          {invitation.prenom} {invitation.initialeNom}.
                        </Text>
                        <Text
                          style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}
                        >
                          {libelleStatut(invitation)}
                        </Text>
                      </View>
                      {invitation.statut === 'compte_cree' ? (
                        <Text
                          onPress={() => partager(`Salut ${invitation.prenom} !`)}
                          accessibilityRole="button"
                          style={{
                            ...theme.texte.legende,
                            fontWeight: '700',
                            color: theme.couleur.marque.primaire,
                            minHeight: theme.taille.tapMin,
                          }}
                        >
                          Relancer
                        </Text>
                      ) : null}
                    </View>
                  ))}

                  {nombreEnAttente > 0 ? (
                    // Écart à la maquette (opacité 60 %) : réduire l'opacité de tout le bloc
                    // pousse texte.attenue, déjà au ras du seuil, sous 4,5:1 — trouvé par
                    // npm run test:a11y. La désaturation reste portée par les couleurs
                    // (texte.attenue, fond.creux), jamais par une opacité qui les combine.
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: theme.espace[3],
                        alignItems: 'center',
                      }}
                    >
                      <View
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.couleur.fond.creux,
                        }}
                      >
                        <Icone nom="message" taille={15} couleur={theme.couleur.texte.attenue} />
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text
                          style={{
                            ...theme.texte.corps,
                            fontWeight: '700',
                            color: theme.couleur.texte.principal,
                          }}
                        >
                          {nombreEnAttente} invitation{nombreEnAttente > 1 ? 's' : ''} envoyée
                          {nombreEnAttente > 1 ? 's' : ''}
                        </Text>
                        <Text
                          style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}
                        >
                          Sans réponse pour l&apos;instant
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Rappel de commission : absent tant qu'aucun abonnement réel n'existe (voir
                  Règles de la fiche) — l'absence de cette carte EST l'état honnête à ce lot,
                  pas une carte construite puis masquée. */}
            </ScrollView>
          )}
        </View>
      </Modale>
    </Modale>
  );
}
