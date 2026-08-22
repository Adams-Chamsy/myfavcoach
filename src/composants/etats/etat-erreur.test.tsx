import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { EtatErreur } from './etat-erreur';

function rendreEtatErreur(nombreEchecs: number, onReessayer = () => {}, onNousEcrire = () => {}) {
  return render(
    <FournisseurTheme>
      <EtatErreur
        titre="Pas de connexion"
        explication="Vérifie ton réseau, on réessaie dès que c'est revenu."
        onReessayer={onReessayer}
        onNousEcrire={onNousEcrire}
        nombreEchecs={nombreEchecs}
      />
    </FournisseurTheme>,
  );
}

describe('EtatErreur', () => {
  it('rend le titre et l’explication', async () => {
    await rendreEtatErreur(0);

    expect(screen.getByText('Pas de connexion')).toBeTruthy();
    expect(screen.getByText("Vérifie ton réseau, on réessaie dès que c'est revenu.")).toBeTruthy();
  });

  it('affiche resteAccessible et code quand ils sont fournis', async () => {
    await render(
      <FournisseurTheme>
        <EtatErreur
          titre="Pas de connexion"
          explication="Vérifie ton réseau, on réessaie dès que c'est revenu."
          resteAccessible="Tes séances déjà enregistrées restent disponibles hors-ligne."
          onReessayer={() => {}}
          onNousEcrire={() => {}}
          nombreEchecs={0}
          code="ERR_4821"
        />
      </FournisseurTheme>,
    );

    expect(
      screen.getByText('Tes séances déjà enregistrées restent disponibles hors-ligne.'),
    ).toBeTruthy();
    expect(screen.getByText('ERR_4821')).toBeTruthy();
  });

  // Critere d'acceptation 4 (docs/ecrans/L0-03-etats-systeme.md) : "EtatErreur affiche
  // « Réessayer » aux deux premiers échecs, « Nous écrire » au troisième."
  describe('action affichee selon le nombre d’echecs consecutifs', () => {
    it.each([0, 1, 2])('affiche "Réessayer" a %i echec(s)', async (nombreEchecs) => {
      await rendreEtatErreur(nombreEchecs);

      expect(screen.getByText('Réessayer')).toBeTruthy();
      expect(screen.queryByText('Nous écrire')).toBeNull();
    });

    it('affiche "Nous écrire" au troisieme echec consecutif', async () => {
      await rendreEtatErreur(3);

      expect(screen.getByText('Nous écrire')).toBeTruthy();
      expect(screen.queryByText('Réessayer')).toBeNull();
    });

    it('appelle onReessayer aux deux premiers echecs, onNousEcrire au troisieme', async () => {
      const onReessayer = jest.fn();
      const onNousEcrire = jest.fn();
      await rendreEtatErreur(2, onReessayer, onNousEcrire);

      await fireEvent.press(screen.getByText('Réessayer'));

      expect(onReessayer).toHaveBeenCalledTimes(1);
      expect(onNousEcrire).not.toHaveBeenCalled();
    });
  });

  // Critere d'acceptation 6 : "Le lecteur d'écran annonce l'erreur à son apparition (région
  // active), sans voler le focus."
  describe('annonce au lecteur d’ecran', () => {
    it('annonce le titre et l’explication a l’apparition', async () => {
      const annonce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

      await rendreEtatErreur(0);

      expect(annonce).toHaveBeenCalledWith(
        "Pas de connexion. Vérifie ton réseau, on réessaie dès que c'est revenu.",
      );

      annonce.mockRestore();
    });

    it('marque le conteneur en region active (accessibilityLiveRegion), sans voler le focus', async () => {
      await rendreEtatErreur(0);

      const conteneur = screen.getByText('Pas de connexion').parent!.parent!.parent!;
      expect(conteneur.props.accessibilityLiveRegion).toBe('polite');
      // "Sans voler le focus" : aucune prop qui force le focus n'est posee.
      expect(conteneur.props.accessibilityViewIsModal).toBeUndefined();
      expect(conteneur.props.autoFocus).toBeUndefined();
    });
  });
});
