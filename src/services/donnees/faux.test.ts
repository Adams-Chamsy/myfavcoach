import { creerFauxPortDonnees } from './faux';

describe('creerFauxPortDonnees', () => {
  // docs/services/donnees/port.ts : comptes.profil_actif est NOT NULL, défaut 'client' —
  // reflété ici, jamais 'coach' ni une valeur neutre inventée.
  it('rend un état par défaut réaliste : profilActif client, aucun profil réel', async () => {
    const port = creerFauxPortDonnees();

    expect(await port.lireEtatProfils()).toEqual({
      profilActif: 'client',
      clientExiste: false,
      coachExiste: false,
    });
  });

  it('definirEtatProfilsPourTest change ce que lireEtatProfils rend ensuite', async () => {
    const port = creerFauxPortDonnees();

    port.definirEtatProfilsPourTest({
      profilActif: 'coach',
      clientExiste: true,
      coachExiste: true,
    });

    expect(await port.lireEtatProfils()).toEqual({
      profilActif: 'coach',
      clientExiste: true,
      coachExiste: true,
    });
  });
});
