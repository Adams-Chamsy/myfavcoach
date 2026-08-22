import { useEffect } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { Icone } from '@/composants/icones';
import { useTheme } from '@/theme/fournisseur';

export type ProprietesEtatErreur = {
  titre: string;
  explication: string;
  // Ce qui marche encore, la partie que tout le monde oublie.
  resteAccessible?: string;
  onReessayer: () => void;
  // Adresse de support, pas de formulaire au jalon 1. Toujours fourni : l'action y bascule
  // au troisieme echec sans que l'ecran appelant ait a le savoir a l'avance.
  onNousEcrire: () => void;
  // Echecs consecutifs de la meme action. Sans logique metier dans ce composant : c'est
  // l'ecran appelant qui compte, EtatErreur se contente de decider quelle action montrer.
  nombreEchecs: number;
  // Selectionnable pour le support. Jamais de code technique brut (docs/ecrans/L0-03…).
  code?: string;
  testID?: string;
};

// A partir du troisieme echec consecutif, l'action devient "Nous ecrire"
// (docs/ecrans/L0-03-etats-systeme.md).
const SEUIL_NOUS_ECRIRE = 3;

export function EtatErreur({
  titre,
  explication,
  resteAccessible,
  onReessayer,
  onNousEcrire,
  nombreEchecs,
  code,
}: ProprietesEtatErreur) {
  const theme = useTheme();
  const proposeNousEcrire = nombreEchecs >= SEUIL_NOUS_ECRIRE;

  // Annonce l'erreur au lecteur d'ecran des son apparition, sans deplacer le focus dessus
  // (docs/ecrans/L0-03-etats-systeme.md, critere 6). accessibilityLiveRegion couvre Android,
  // announceForAccessibility couvre les deux plateformes.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${titre}. ${explication}`);
    // Annonce uniquement a l'apparition du composant, pas a chaque changement de texte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <View style={{ gap: theme.espace[1] }}>
          <Text style={{ ...theme.texte.actionAccent, color: theme.couleur.etat.erreurEncre }}>
            {titre}
          </Text>
          <Text style={{ ...theme.texte.corps, color: theme.couleur.etat.erreurEncre }}>
            {explication}
          </Text>
          {resteAccessible ? (
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              {resteAccessible}
            </Text>
          ) : null}
          {code ? (
            <Text selectable style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              {code}
            </Text>
          ) : null}
        </View>

        {proposeNousEcrire ? (
          <Bouton variante="primaire" libelle="Nous écrire" onPress={onNousEcrire} />
        ) : (
          <Bouton variante="primaire" libelle="Réessayer" onPress={onReessayer} />
        )}
      </View>
    </View>
  );
}
