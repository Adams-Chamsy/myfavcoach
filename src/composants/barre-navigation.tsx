import { Pressable, Text, View } from 'react-native';

import { Marque } from '@/composants/marque';
import { useDispositionEcran } from '@/composants/canevas-ecran';
import { Icone, type NomIcone } from '@/composants/icones';
import { useTheme } from '@/theme/fournisseur';
import { font, themes } from '@/theme/tokens';

export type ElementNavigation = {
  icone: NomIcone;
  libelle: string;
  actif?: boolean;
  // Element central en relief, reserve a l'action "Créer" de la barre coach
  // (docs/design-system.md §6 : "coach (encre, 5 entrées, Créer central)"). Un seul par barre.
  // Jamais annonce comme selectionne : role "bouton", pas "onglet"
  // (docs/ecrans/L0-02-coquille-coach.md, critere 2).
  misEnAvant?: boolean;
  // Absent en galerie (docs/ecrans/L0-00-galerie-systeme.md §9 : barres "non fonctionnelles").
  // Fourni par l'ecran reel, qui porte seul la logique de navigation.
  onPress?: () => void;
  // Point de non-lus (docs/ecrans/L0-01-coquille-client.md), fusionne dans le libelle
  // accessible plutot que porte par la seule couleur.
  pastilleNonLus?: number;
};

export type ProprietesBarreNavigation = {
  variante: 'client' | 'coach';
  elements: ElementNavigation[];
  // Marge basse issue des zones sures du systeme (useSafeAreaInsets), jamais codee en dur ici
  // (docs/ecrans/L0-01-coquille-client.md : "lues depuis les zones sûres du système, jamais
  // codées en dur par plateforme"). Calculee par l'appelant : cette primitive ne connait pas
  // react-native-safe-area-context, elle reste sans logique d'environnement.
  paddingBas?: number;
};

// "Accueil, onglet, sélectionné, 1 sur 5" — ordre et mots repris tels quels de
// docs/ecrans/L0-01-coquille-client.md, critere d'acceptation 4.
function libelleOnglet(element: ElementNavigation, index: number, total: number) {
  if (element.misEnAvant) return element.libelle;

  const segments = [element.libelle];
  if (element.pastilleNonLus) segments.push(`${element.pastilleNonLus} non lus`);
  segments.push('onglet');
  if (element.actif) segments.push('sélectionné');
  segments.push(`${index + 1} sur ${total}`);
  return segments.join(', ');
}

export function BarreNavigation({ variante, elements, paddingBas = 0 }: ProprietesBarreNavigation) {
  const theme = useTheme();
  const { large } = useDispositionEcran();
  // La navigation coach V2 est une surface claire fixe, fond et contenu toujours pairés.
  const couleurs = variante === 'coach' ? themes.clair : theme.couleur;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        alignSelf: 'center',
        maxWidth: large ? theme.taille.contenu : undefined,
        backgroundColor: couleurs.fond.canevas,
        borderTopWidth: large ? 0 : theme.taille.bordureFine,
        borderBottomWidth: large ? theme.taille.bordureFine : 0,
        borderColor: couleurs.bordure.discrete,
        paddingHorizontal: large ? theme.espace[8] : theme.espace[2],
        paddingTop: theme.espace[3],
        paddingBottom: large ? theme.espace[3] : theme.espace[4] + paddingBas,
        gap: large ? theme.espace[6] : 0,
      }}
    >
      {large ? <Marque surFondClair={variante === 'coach'} /> : null}
      {elements.map((element, index) => {
        const couleur = element.actif ? couleurs.marque.primaire : couleurs.texte.secondaire;
        return (
          <Pressable
            key={index}
            onPress={element.onPress}
            accessibilityRole={element.misEnAvant ? 'button' : 'tab'}
            accessibilityState={
              element.misEnAvant ? undefined : { selected: Boolean(element.actif) }
            }
            accessibilityLabel={libelleOnglet(element, index, elements.length)}
            style={{
              flex: 1,
              minHeight: theme.taille.tapMin,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.espace[1],
              opacity: 1,
            }}
          >
            {!large || element.misEnAvant ? (
              <View
                style={
                  element.misEnAvant
                    ? {
                        width: theme.taille.tapMin,
                        height: theme.taille.tapMin,
                        borderRadius: theme.rayon.pilule,
                        backgroundColor: couleurs.marque.primaire,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }
                    : {
                        paddingHorizontal: theme.espace[2],
                        paddingVertical: theme.espace[1],
                        borderRadius: theme.rayon.champ,
                        backgroundColor: element.actif ? couleurs.marque.primaireTeinte : undefined,
                      }
                }
              >
                <Icone
                  nom={element.icone}
                  couleur={element.misEnAvant ? couleurs.texte.surMarque : couleur}
                  actif={element.actif}
                />
                {element.pastilleNonLus ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -theme.espace[1],
                      right: -theme.espace[1],
                      width: theme.espace[2],
                      height: theme.espace[2],
                      borderRadius: theme.rayon.pilule,
                      backgroundColor: couleurs.marque.accent,
                    }}
                  />
                ) : null}
              </View>
            ) : null}
            <Text
              style={{
                ...theme.texte.legende,
                fontFamily: element.actif ? font.uiBold : font.uiSemibold,
                color: element.misEnAvant ? couleurs.marque.primaire : couleur,
              }}
            >
              {element.libelle}
            </Text>
            {large && element.actif ? (
              <View
                style={{
                  height: theme.taille.bordureFine,
                  alignSelf: 'stretch',
                  backgroundColor: couleurs.marque.primaire,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
