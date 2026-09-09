import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import type { TextInput } from 'react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { Champ } from './champ';

function rendreChamp(proprietes: Partial<React.ComponentProps<typeof Champ>> = {}) {
  return render(
    <FournisseurTheme>
      <Champ libelle="Objectif" valeur="" onChangeTexte={() => {}} {...proprietes} />
    </FournisseurTheme>,
  );
}

describe('Champ', () => {
  it('rend son libelle et sa valeur', async () => {
    await rendreChamp({ valeur: 'Perdre 4 kg avant juin' });

    expect(screen.getByText('Objectif')).toBeTruthy();
    expect(screen.getByDisplayValue('Perdre 4 kg avant juin')).toBeTruthy();
  });

  it("n'affiche aucun message d'erreur par defaut", async () => {
    await rendreChamp();

    expect(screen.queryByText('Il manque un @ dans ton adresse.')).toBeNull();
  });

  it("compose le nom accessible avec le libelle ET le message en etat d'erreur", async () => {
    await rendreChamp({ messageErreur: 'Il manque un @ dans ton adresse.' });

    // Le champ doit rester identifiable ("Objectif") ET porter l'erreur — jamais l'un a la
    // place de l'autre.
    const champ = screen.getByLabelText('Objectif, erreur : Il manque un @ dans ton adresse.');
    expect(champ).toBeTruthy();
  });

  it("garde « Objectif » seul comme nom accessible en l'absence d'erreur", async () => {
    await rendreChamp();

    expect(screen.getByLabelText('Objectif')).toBeTruthy();
    // Sans erreur, le nom accessible ne doit surtout pas contenir "erreur :".
    expect(screen.queryByLabelText(/erreur :/)).toBeNull();
  });

  // docs/ecrans/L1-05-onboarding-client.md, critère 3 : « leur inertie est perceptible
  // autrement que par la couleur ». `desactive` doit donc rendre le champ inerte À LA SAISIE
  // (editable=false) ET l'annoncer au lecteur d'écran (accessibilityState.disabled), pas
  // seulement le griser.
  it('desactive : le champ est inerte à la saisie et annoncé désactivé, pas seulement grisé', async () => {
    await rendreChamp({ desactive: true });

    const champ = screen.getByLabelText('Objectif');
    expect(champ.props.editable).toBe(false);
    expect(champ.props.accessibilityState.disabled).toBe(true);
  });

  // docs/ecrans/L1-02-creation-compte.md : "Adresse e-mail | clavier e-mail, sans majuscule
  // automatique, sans correction".
  it('type email : clavier dédié, sans majuscule automatique ni correction', async () => {
    await rendreChamp({ type: 'email', libelle: 'Adresse e-mail' });

    const champ = screen.getByLabelText('Adresse e-mail');
    expect(champ.props.keyboardType).toBe('email-address');
    expect(champ.props.autoCapitalize).toBe('none');
    expect(champ.props.autoCorrect).toBe(false);
  });

  // docs/ecrans/L1-05-onboarding-client.md, étape 3/4 : "poids... en kilogrammes avec une
  // décimale".
  it('type decimal : clavier numérique avec séparateur décimal', async () => {
    await rendreChamp({ type: 'decimal', libelle: 'Poids actuel' });

    expect(screen.getByLabelText('Poids actuel').props.keyboardType).toBe('decimal-pad');
  });

  // docs/ecrans/L1-02-creation-compte.md : "Mot de passe | Champ masqué, bouton œil dans une
  // cible de 44".
  describe('type motDePasse', () => {
    it('masque la saisie par défaut, et la révèle au bouton œil', async () => {
      await rendreChamp({ type: 'motDePasse', libelle: 'Mot de passe' });

      expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(true);

      await fireEvent.press(screen.getByLabelText('Afficher le mot de passe'));

      expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(false);
      expect(screen.getByLabelText('Masquer le mot de passe')).toBeTruthy();
    });

    it('le bouton œil a une cible ≥ 44 pt', async () => {
      await rendreChamp({ type: 'motDePasse', libelle: 'Mot de passe' });

      const bouton = screen.getByLabelText('Afficher le mot de passe');
      expect(bouton.props.style.minHeight ?? bouton.props.style.height).toBeGreaterThanOrEqual(44);
    });
  });

  it('type texte (défaut) : aucun bouton œil, aucun clavier spécial', async () => {
    await rendreChamp();

    expect(screen.queryByLabelText('Afficher le mot de passe')).toBeNull();
    expect(screen.getByLabelText('Objectif').props.secureTextEntry).toBeFalsy();
  });

  // docs/ecrans/L1-04-connexion.md, États : "le focus va au mot de passe" — un écran doit
  // pouvoir rendre le focus clavier à ce champ précis après une erreur globale.
  it('transmet une ref jusqu’au TextInput sous-jacent, utilisable pour rendre le focus', async () => {
    const ref = createRef<TextInput>();
    await render(
      <FournisseurTheme>
        <Champ ref={ref} libelle="Mot de passe" valeur="" onChangeTexte={() => {}} />
      </FournisseurTheme>,
    );

    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.focus).toBe('function');
  });
});
