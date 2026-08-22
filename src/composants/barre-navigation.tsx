import { Pressable, Text, View } from 'react-native';

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
  const estCoach = variante === 'coach';

  // "La barre encre est une île sombre dans un thème clair, elle utilise les tokens sombre pour
  // son contenu. C'est le seul endroit du jalon 1 où les tokens sombres servent."
  // (docs/ecrans/L0-02-coquille-coach.md). Lecture directe de themes.sombre, jamais via
  // useTheme() : le fond, lui, reste ambiant (theme.couleur.fond.inverse), voir plus bas.
  const couleurInactif = estCoach ? themes.sombre.texte.surSombre : theme.couleur.texte.secondaire;
  const couleurActif = estCoach ? themes.sombre.marque.primaire : theme.couleur.marque.primaire;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: estCoach ? theme.couleur.fond.inverse : theme.couleur.fond.canevas,
        borderTopWidth: estCoach ? 0 : 1,
        borderTopColor: theme.couleur.bordure.discrete,
        paddingHorizontal: theme.espace[2],
        paddingTop: theme.espace[3],
        paddingBottom: theme.espace[4] + paddingBas,
      }}
    >
      {elements.map((element, index) => {
        const couleur = element.actif ? couleurActif : couleurInactif;
        // Opacite 70 % de l'inactif coach (docs/ecrans/L0-02-coquille-coach.md), recalculee a
        // la main plutot que reprise de la maquette (docs/design-system.md §1 : les ratios
        // annoncés sont optimistes de 0,3 à 0,8 point) : texte.surSombre à 70 % sur fond.inverse
        // mesure 7,74:1, l'actif plein 7,58:1 — largement au-dessus du seuil de 4,5:1 exigé.
        const opacite = estCoach && !element.actif && !element.misEnAvant ? 0.7 : 1;

        if (element.misEnAvant) {
          return (
            <Pressable
              // element central sans identifiant propre, ordre stable
              key={index}
              onPress={element.onPress}
              accessibilityRole="button"
              accessibilityLabel={libelleOnglet(element, index, elements.length)}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: theme.espace[1],
                minHeight: theme.taille.tapMin,
                // Remonte le rond au-dessus du reste de la barre.
                marginTop: -theme.espace[6],
              }}
            >
              <View
                style={{
                  width: theme.taille.avatarMd,
                  height: theme.taille.avatarMd,
                  borderRadius: theme.rayon.pilule,
                  backgroundColor: theme.couleur.marque.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icone nom={element.icone} couleur={theme.couleur.marque.accentEncre} />
              </View>
              <Text style={{ ...theme.texte.legende, fontFamily: font.uiSemibold, color: couleur }}>
                {element.libelle}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={index}
            onPress={element.onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: Boolean(element.actif) }}
            accessibilityLabel={libelleOnglet(element, index, elements.length)}
            style={{
              flex: 1,
              minHeight: theme.taille.tapMin,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.espace[1],
              opacity: opacite,
            }}
          >
            <View>
              <Icone nom={element.icone} couleur={couleur} actif={element.actif} />
              {element.pastilleNonLus ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -theme.espace[1],
                    right: -theme.espace[1],
                    width: theme.espace[2],
                    height: theme.espace[2],
                    borderRadius: theme.rayon.pilule,
                    backgroundColor: theme.couleur.marque.accent,
                  }}
                />
              ) : null}
            </View>
            <Text
              style={{
                ...theme.texte.legende,
                fontFamily: element.actif ? font.uiBold : font.uiSemibold,
                color: couleur,
              }}
            >
              {element.libelle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
