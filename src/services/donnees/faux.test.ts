import { creerFauxPortDonnees } from './faux';

describe('creerFauxPortDonnees', () => {
  // src/services/donnees/port.ts : comptes.profil_actif est NOT NULL, défaut 'client' —
  // reflété ici, jamais 'coach' ni une valeur neutre inventée.
  it('rend un état par défaut réaliste : profilActif client, aucun profil réel', async () => {
    const port = creerFauxPortDonnees();

    expect(await port.lireEtatProfils()).toEqual({
      profilActif: 'client',
      clientExiste: false,
      clientOnboardingEtape: null,
      coachExiste: false,
    });
  });

  it('definirEtatProfilsPourTest change ce que lireEtatProfils rend ensuite', async () => {
    const port = creerFauxPortDonnees();

    port.definirEtatProfilsPourTest({
      profilActif: 'coach',
      clientExiste: true,
      clientOnboardingEtape: 3,
      coachExiste: true,
    });

    expect(await port.lireEtatProfils()).toEqual({
      profilActif: 'coach',
      clientExiste: true,
      clientOnboardingEtape: 3,
      coachExiste: true,
    });
  });

  it('lireProfilOnboarding rend des valeurs par défaut avant toute écriture', async () => {
    const port = creerFauxPortDonnees();

    expect(await port.lireProfilOnboarding()).toEqual({
      prenom: '',
      nom: null,
      objectifs: [],
      rythme: null,
      poidsDepartGrammes: null,
      poidsCibleGrammes: null,
    });
  });

  describe("écritures d'onboarding", () => {
    it('creerProfilClient fait passer clientExiste à true, onboarding_etape à 2, et se relit', async () => {
      const port = creerFauxPortDonnees();

      const resultat = await port.creerProfilClient('Camille', 'Dupont');

      expect(resultat).toEqual({ succes: true });
      expect(await port.lireEtatProfils()).toMatchObject({
        clientExiste: true,
        clientOnboardingEtape: 2,
      });
      expect(await port.lireProfilOnboarding()).toMatchObject({
        prenom: 'Camille',
        nom: 'Dupont',
      });
    });

    it('creerProfilClient traduit un nom vide en null (comme le vrai adaptateur)', async () => {
      const port = creerFauxPortDonnees();

      await port.creerProfilClient('Camille', '');

      expect((await port.lireProfilOnboarding()).nom).toBeNull();
    });

    it('enregistrerObjectifsEtRythme fait passer onboarding_etape à 3, et se relit', async () => {
      const port = creerFauxPortDonnees();
      await port.creerProfilClient('Camille', '');

      const resultat = await port.enregistrerObjectifsEtRythme(['perdre-du-poids'], '3-4-fois');

      expect(resultat).toEqual({ succes: true });
      expect((await port.lireEtatProfils()).clientOnboardingEtape).toBe(3);
      expect(await port.lireProfilOnboarding()).toMatchObject({
        objectifs: ['perdre-du-poids'],
        rythme: '3-4-fois',
      });
    });

    it('enregistrerPointDeDepart fait passer onboarding_etape à 4, et enregistre le poids', async () => {
      const port = creerFauxPortDonnees();
      await port.creerProfilClient('Camille', '');

      const resultat = await port.enregistrerPointDeDepart({
        consentementAccorde: true,
        versionConsentement: '2026-09-04',
        poidsDepartGrammes: 70000,
        poidsCibleGrammes: 65000,
      });

      expect(resultat).toEqual({ succes: true });
      expect((await port.lireEtatProfils()).clientOnboardingEtape).toBe(4);
      expect(await port.lireProfilOnboarding()).toMatchObject({
        poidsDepartGrammes: 70000,
        poidsCibleGrammes: 65000,
      });
    });

    it('enregistrerPointDeDepart sans consentement (« Passer ») ne stocke aucun poids', async () => {
      const port = creerFauxPortDonnees();
      await port.creerProfilClient('Camille', '');

      await port.enregistrerPointDeDepart({
        consentementAccorde: false,
        versionConsentement: '2026-09-04',
      });

      expect(await port.lireProfilOnboarding()).toMatchObject({
        poidsDepartGrammes: null,
        poidsCibleGrammes: null,
      });
    });

    it('terminerOnboarding fait passer onboarding_etape à 5', async () => {
      const port = creerFauxPortDonnees();
      await port.creerProfilClient('Camille', '');

      const resultat = await port.terminerOnboarding();

      expect(resultat).toEqual({ succes: true });
      expect((await port.lireEtatProfils()).clientOnboardingEtape).toBe(5);
    });

    it('echouerProchaineEcriturePourTest fait échouer un seul appel, puis revient au succès', async () => {
      const port = creerFauxPortDonnees();
      await port.creerProfilClient('Camille', '');
      port.echouerProchaineEcriturePourTest('panne de test');

      const echec = await port.enregistrerObjectifsEtRythme(['perdre-du-poids'], null);
      expect(echec).toEqual({ succes: false, erreur: 'panne de test' });
      expect((await port.lireEtatProfils()).clientOnboardingEtape).toBe(2); // inchangé

      const succes = await port.enregistrerObjectifsEtRythme(['perdre-du-poids'], null);
      expect(succes).toEqual({ succes: true });
      expect((await port.lireEtatProfils()).clientOnboardingEtape).toBe(3);
    });
  });
});
