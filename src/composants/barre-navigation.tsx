import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Marque } from '@/composants/marque';
import { useDispositionEcran } from '@/composants/canevas-ecran';
import { Icone, type NomIcone } from '@/composants/icones';
import { SvgXml } from 'react-native-svg';
import { useTheme } from '@/theme/fournisseur';
import { font, themes, presentationV2 as mesure } from '@/theme/tokens';

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
  dansEntete?: boolean;
  accessoire?: ReactNode;
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

const tracesNavigationV2: Partial<Record<NomIcone, string>> = {
  accueil: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',
  recherche: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  seance: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4m8-4v4M8 11h8m-8 5h5"/>',
  message: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z"/>',
  profil: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  pilotage: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',
  clients:
    '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6m3 4a5 5 0 0 1 3 5v2"/>',
  ajouter: '<path d="M12 4v16M4 12h16"/>',
  agenda: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4m8-4v4M8 11h8m-8 5h5"/>',
  virement: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>',
};

export function BarreNavigation({
  variante,
  elements,
  paddingBas = 0,
  dansEntete = false,
  accessoire,
}: ProprietesBarreNavigation) {
  const theme = useTheme();
  const { large } = useDispositionEcran();
  const couleurs = variante === 'coach' ? themes.clair : theme.couleur;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: dansEntete ? 1 : undefined,
        width: dansEntete ? undefined : '100%',
        alignSelf: dansEntete ? undefined : 'center',
        maxWidth: undefined,
        minHeight: large && !dansEntete ? mesure.enteteLarge : undefined,
        backgroundColor: couleurs.fond.canevas,
        borderTopWidth: large ? 0 : theme.taille.bordureFine,
        borderBottomWidth: large && !dansEntete ? theme.taille.bordureFine : 0,
        borderColor: couleurs.bordure.marquee,
        paddingHorizontal: dansEntete ? 0 : large ? theme.espace[8] : mesure.navigationHorizontal,
        paddingTop: dansEntete ? 0 : large ? theme.espace[3] : mesure.navigationHaut,
        paddingBottom: dansEntete
          ? 0
          : large
            ? theme.espace[3]
            : Math.max(mesure.navigationBas, paddingBas),
        gap: large ? theme.espace[2] : 0,
      }}
    >
      {large && !dansEntete ? <Marque surFondClair={variante === 'coach'} /> : null}
      {elements.map((element, index) => {
        const couleur = element.actif ? couleurs.marque.primaire : couleurs.texte.secondaire;
        const trace = tracesNavigationV2[element.icone];
        const halo = element.misEnAvant ? mesure.navigationHaloCreation : mesure.navigationHalo;
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
              flex: large ? 1 : undefined,
              opacity: 1,
              minWidth: mesure.navigationLargeur,
              minHeight: mesure.navigationCible,
              alignItems: 'center',
              justifyContent: 'center',
              gap: mesure.navigationEspace,
              paddingHorizontal: large ? theme.espace[3] : 0,
              paddingVertical: large ? theme.espace[2] : 0,
            }}
          >
            {!large || element.misEnAvant ? (
              <View
                style={{
                  width: mesure.navigationIcone,
                  height: mesure.navigationIcone,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: element.misEnAvant ? theme.espace[1] : 0,
                }}
              >
                {element.actif || element.misEnAvant ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: -halo,
                      top: -halo,
                      width: mesure.navigationIcone + halo * 2,
                      height: mesure.navigationIcone + halo * 2,
                      borderRadius: element.misEnAvant ? theme.rayon.pilule : theme.rayon.badge,
                      backgroundColor: element.misEnAvant
                        ? couleurs.marque.primaire
                        : couleurs.marque.primaireTeinte,
                    }}
                  />
                ) : null}
                {trace ? (
                  <SvgXml
                    width={mesure.navigationIcone}
                    height={mesure.navigationIcone}
                    xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${element.misEnAvant ? couleurs.texte.surMarque : couleur}" stroke-width="${mesure.iconeTrait}" stroke-linecap="round" stroke-linejoin="round">${trace}</svg>`}
                  />
                ) : (
                  <Icone
                    nom={element.icone}
                    taille={mesure.navigationIcone}
                    couleur={element.misEnAvant ? couleurs.texte.surMarque : couleur}
                  />
                )}
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
                fontFamily: element.actif || element.misEnAvant ? font.uiBold : font.uiRegular,
                fontSize: large ? mesure.navigationLabelLarge : mesure.navigationLabel,
                lineHeight:
                  (large ? mesure.navigationLabelLarge : mesure.navigationLabel) *
                  mesure.navigationLabelInterligne,
                color: element.misEnAvant ? couleurs.marque.primaire : couleur,
              }}
            >
              {element.libelle}
            </Text>
            {large && element.actif ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: theme.espace[3],
                  right: theme.espace[3],
                  height: theme.taille.bordureFine,
                  backgroundColor: couleurs.marque.primaire,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
      {accessoire}
    </View>
  );
}
