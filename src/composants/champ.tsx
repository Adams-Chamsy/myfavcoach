import { forwardRef, useState } from 'react';
import { Pressable, Text, TextInput, type TextInputInstance, View } from 'react-native';

import { BoutonIcone } from '@/composants/bouton-icone';
import { useTheme } from '@/theme/fournisseur';
import { usePresentationV2 } from './presentation-v2';
import { presentationV2 as mesure } from '@/theme/tokens';

// "texte" : par defaut, aucun comportement particulier. "email" : clavier e-mail, sans
// majuscule automatique ni correction (docs/ecrans/L1-02-creation-compte.md, "Adresse e-mail").
// "motDePasse" : masque par defaut, bouton oeil dans une cible de 44 pour reveler
// (docs/ecrans/L1-02-creation-compte.md, "Mot de passe | Champ masque, bouton oeil").
// "decimal" : clavier numerique avec separateur decimal (docs/ecrans/L1-05-onboarding-client.md,
// etape 3/4 : "poids... en kilogrammes avec une decimale") — Champ ne filtre ni ne parse la
// saisie, juste le clavier ; c'est a l'ecran appelant de valider le format.
// "telephone" : clavier telephone (docs/ecrans/L1-08-activation-espace-coach.md, "Telephone |
// Format francais, indicatif fixe") — un clavier alphabetique pour un numero est un defaut
// d'ergonomie. Comme "decimal", Champ ne valide rien : l'ecran verifie le format.
export type TypeChamp = 'texte' | 'email' | 'motDePasse' | 'decimal' | 'telephone';

export type ProprietesChamp = {
  libelle: string;
  valeur: string;
  onChangeTexte: (texte: string) => void;
  // Sortie du champ (docs/ecrans/L1-02-creation-compte.md : "Format vérifié à la sortie du
  // champ, jamais pendant la frappe") — un écran y déclenche sa propre validation, Champ ne
  // valide rien lui-même.
  onBlur?: () => void;
  messageErreur?: string;
  placeholder?: string;
  desactive?: boolean;
  type?: TypeChamp;
  // Saisie sur plusieurs lignes (docs/ecrans/L4-27a-depot-avis.md, « Raconte, si tu veux ») :
  // le champ grandit avec le texte, à partir de deux hauteurs de contrôle.
  multiligne?: boolean;
  // Longueur maximale, posée sur le champ lui-même : la frappe s'arrête, rien n'est tronqué
  // après coup. Le serveur garde la règle (docs/domaine.md §3.11 pour l'avis).
  longueurMax?: number;
};

// Ref transmise (React.forwardRef) : docs/ecrans/L1-04-connexion.md, États, "Échec
// d'identifiants... le focus va au mot de passe" — un écran a besoin d'un moyen impératif de
// rendre le focus clavier à un champ précis après une erreur globale (pas liée à UN champ,
// donc portée par l'écran, jamais par Champ lui-même). Distinct de l'annonce lecteur d'écran
// (critère 6, "sans voler le focus") : ce ref ne déplace QUE le focus clavier/visuel, jamais le
// curseur d'accessibilité — c'est announceForAccessibility qui porte l'annonce, ailleurs.
// SDK 58 (react-native 0.88) : `TextInput` est le type du COMPOSANT ; l'objet reçu par la ref
// (focus, blur...) est `TextInputInstance`.
export const Champ = forwardRef<TextInputInstance, ProprietesChamp>(function Champ(
  {
    libelle,
    valeur,
    onChangeTexte,
    onBlur,
    messageErreur,
    placeholder,
    desactive = false,
    type = 'texte',
    multiligne = false,
    longueurMax,
  },
  ref,
) {
  const theme = useTheme();
  const presentationV2 = usePresentationV2();
  const [estFocus, setEstFocus] = useState(false);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const enErreur = Boolean(messageErreur);
  const estMotDePasse = type === 'motDePasse';

  // gris[500] (#7C766E) sur fond.canevas mesure 4,49:1 — sous le seuil de 4,5:1 (npm run
  // test:a11y, calcul WCAG reel). C'est la meme couleur que la correction §1.2 de
  // docs/design-system.md ("text.muted #7C766E... reel 4,24:1"), deja resolue ailleurs par
  // texte.attenue (#6F695F, 5,14:1) : Champ ne l'utilisait pas encore pour son libelle au repos.
  const couleurLabel = desactive
    ? theme.couleur.texte.desactive
    : enErreur
      ? theme.couleur.etat.erreurEncre
      : estFocus
        ? theme.couleur.marque.primaire
        : theme.couleur.texte.attenue;

  const couleurBordure = desactive
    ? theme.couleur.bordure.discrete
    : enErreur
      ? theme.couleur.etat.erreur
      : estFocus
        ? theme.couleur.bordure.focus
        : theme.couleur.bordure.marquee;

  // Composition explicite plutot que accessibilityLabelledBy : ce dernier REMPLACE
  // accessibilityLabel des qu'il resout un texte (verifie via le calcul de nom accessible de
  // React Native Testing Library, identique a VoiceOver/TalkBack) — un champ en erreur
  // s'annoncerait alors par son message et perdrait son identification. Ici le libelle reste
  // toujours present, le message d'erreur s'y ajoute.
  const nomAccessible = enErreur ? `${libelle}, erreur : ${messageErreur}` : libelle;

  // Pas de accessibilityState.invalid : ce champ n'existe pas en React Native
  // (AccessibilityState ne definit que disabled, selected, checked, busy, expanded — aucun
  // equivalent a aria-invalid du web). Le nom accessible compose ci-dessus est le seul
  // vecteur disponible pour porter l'information d'erreur au lecteur d'ecran.
  return (
    <View style={{ gap: theme.espace[2] }}>
      <Text
        style={{
          ...(presentationV2 ? theme.texte.v2LabelChamp : theme.texte.label),
          color:
            presentationV2 && !enErreur && !desactive
              ? theme.couleur.texte.principal
              : couleurLabel,
        }}
      >
        {libelle}
      </Text>

      <View
        style={
          estFocus && {
            borderRadius: theme.rayon.saisie + theme.taille.focusHalo,
            padding: theme.taille.focusHalo,
            backgroundColor: theme.couleur.bordure.focusHalo,
          }
        }
      >
        <TextInput
          ref={ref}
          value={valeur}
          onChangeText={onChangeTexte}
          onFocus={() => setEstFocus(true)}
          onBlur={() => {
            setEstFocus(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.couleur.gris[400]}
          editable={!desactive}
          accessibilityLabel={nomAccessible}
          accessibilityState={{ disabled: desactive }}
          keyboardType={
            type === 'email'
              ? 'email-address'
              : type === 'decimal'
                ? 'decimal-pad'
                : type === 'telephone'
                  ? 'phone-pad'
                  : 'default'
          }
          autoCapitalize={
            type === 'email' || type === 'telephone' || estMotDePasse ? 'none' : 'sentences'
          }
          autoCorrect={type === 'email' ? false : true}
          secureTextEntry={estMotDePasse && !motDePasseVisible}
          multiline={multiligne}
          maxLength={longueurMax}
          style={{
            minHeight: multiligne
              ? theme.taille.controle * 2
              : presentationV2
                ? mesure.champHauteur
                : theme.taille.controle,
            textAlignVertical: multiligne ? 'top' : 'center',
            paddingVertical: presentationV2 ? mesure.champVertical : theme.espace[3],
            borderRadius: presentationV2 ? mesure.rayonChamp : theme.rayon.saisie,
            borderWidth: presentationV2 ? mesure.bordure : theme.taille.focusContour,
            borderColor:
              presentationV2 && !enErreur && !estFocus && !desactive
                ? theme.couleur.bordure.v2Champ
                : couleurBordure,
            backgroundColor: desactive ? theme.couleur.fond.creux : theme.couleur.fond.surface,
            paddingHorizontal: presentationV2 ? mesure.champHorizontal : theme.espace[4],
            paddingRight: estMotDePasse ? theme.taille.tapMin : theme.espace[4],
            ...(presentationV2 ? theme.texte.v2Champ : theme.texte.corps),
            color: desactive ? theme.couleur.texte.desactive : theme.couleur.texte.principal,
          }}
        />
        {estMotDePasse ? (
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            }}
          >
            {presentationV2 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                }
                disabled={desactive}
                onPress={() => setMotDePasseVisible((v) => !v)}
                style={{
                  minHeight: theme.taille.tapMin,
                  minWidth: theme.taille.tapMin,
                  paddingHorizontal: mesure.champHorizontal,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...theme.texte.v2LabelChamp, color: theme.couleur.marque.primaire }}>
                  {motDePasseVisible ? 'Masquer' : 'Voir'}
                </Text>
              </Pressable>
            ) : (
              <BoutonIcone
                nom={motDePasseVisible ? 'oeil-barre' : 'oeil'}
                accessibilityLabel={
                  motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                }
                onPress={() => setMotDePasseVisible((v) => !v)}
                desactive={desactive}
              />
            )}
          </View>
        ) : null}
      </View>

      {/* Message d'erreur sous le champ, jamais en surimpression : espace reserve dans le
          flux normal, pas une bulle positionnee par-dessus le contenu suivant. Affiche tel
          quel visuellement ; c'est nomAccessible ci-dessus qui porte l'info au lecteur
          d'ecran, pas ce Text (qui n'est pas lie au champ par un accessibilityLabelledBy). */}
      {enErreur ? (
        <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
          {messageErreur}
        </Text>
      ) : null}
    </View>
  );
});
