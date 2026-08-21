import { render, screen } from '@testing-library/react-native';

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
});
