import { creerFauxPortDonnees, etatProfilsParDefaut } from './faux';

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
      identiteActive: { prenom: '', nom: null },
      attentesCoach: 0,
    });
  });

  it('definirEtatProfilsPourTest change ce que lireEtatProfils rend ensuite', async () => {
    const port = creerFauxPortDonnees();

    port.definirEtatProfilsPourTest({
      profilActif: 'coach',
      clientExiste: true,
      clientOnboardingEtape: 3,
      coachExiste: true,
      identiteActive: { prenom: 'Camille', nom: 'Dupré' },
      attentesCoach: 0,
    });

    expect(await port.lireEtatProfils()).toEqual({
      profilActif: 'coach',
      clientExiste: true,
      clientOnboardingEtape: 3,
      coachExiste: true,
      identiteActive: { prenom: 'Camille', nom: 'Dupré' },
      attentesCoach: 0,
    });
  });

  it('basculerProfil change profilActif, et se relit', async () => {
    const port = creerFauxPortDonnees();
    port.definirEtatProfilsPourTest({
      profilActif: 'client',
      clientExiste: true,
      clientOnboardingEtape: 5,
      coachExiste: true,
      identiteActive: { prenom: 'Camille', nom: 'Dupré' },
      attentesCoach: 0,
    });

    const resultat = await port.basculerProfil('coach');

    expect(resultat).toEqual({ succes: true });
    expect((await port.lireEtatProfils()).profilActif).toBe('coach');
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

  // A1 (2 novembre 2026) : miroir de soumettre_dossier_si_complet (0053).
  describe('soumission automatique du dossier', () => {
    const TROIS = ['identite', 'diplome_ou_certification', 'assurance_rc_pro'] as const;

    it('absent : reste absent à deux types, passe en examen au troisième, daté', async () => {
      const port = creerFauxPortDonnees();
      await port.deposerPieceVerification('identite', { uri: 'f', nom: 'f', typeMime: 'x' });
      await port.deposerPieceVerification('diplome_ou_certification', {
        uri: 'f',
        nom: 'f',
        typeMime: 'x',
      });
      expect((await port.lireDossierVerification()).statut).toBe('absente');

      await port.deposerPieceVerification('assurance_rc_pro', {
        uri: 'f',
        nom: 'f',
        typeMime: 'x',
      });
      const dossier = await port.lireDossierVerification();
      expect(dossier.statut).toBe('en_examen');
      expect(dossier.deposeLe).not.toBeNull();
    });

    it('complément demandé : une pièce fournie le remet en examen, date inchangée', async () => {
      const port = creerFauxPortDonnees();
      port.definirDossierVerificationPourTest({
        statut: 'complement_demande',
        deposeLe: '2026-11-01T10:00:00.000Z',
        motif: null,
      });
      await port.deposerPieceVerification('identite', { uri: 'f', nom: 'f', typeMime: 'x' });
      expect(await port.lireDossierVerification()).toMatchObject({
        statut: 'en_examen',
        deposeLe: '2026-11-01T10:00:00.000Z',
      });
    });

    it('refusé : deux pièces ne suffisent pas, les trois redéposées le remettent en examen', async () => {
      const port = creerFauxPortDonnees();
      port.definirDossierVerificationPourTest({
        statut: 'refusee',
        deposeLe: '2026-11-01T10:00:00.000Z',
        motif: null,
      });
      await port.deposerPieceVerification(TROIS[0], { uri: 'f', nom: 'f', typeMime: 'x' });
      await port.deposerPieceVerification(TROIS[1], { uri: 'f', nom: 'f', typeMime: 'x' });
      expect((await port.lireDossierVerification()).statut).toBe('refusee');
      await port.deposerPieceVerification(TROIS[2], { uri: 'f', nom: 'f', typeMime: 'x' });
      const dossier = await port.lireDossierVerification();
      expect(dossier.statut).toBe('en_examen');
      expect(dossier.deposeLe).not.toBe('2026-11-01T10:00:00.000Z');
    });

    it('en examen : une pièce remplacée ne change ni le statut ni la date', async () => {
      const port = creerFauxPortDonnees();
      const enExamen = {
        statut: 'en_examen' as const,
        deposeLe: '2026-11-01T10:00:00.000Z',
        motif: null,
      };
      port.definirDossierVerificationPourTest(enExamen);
      await port.deposerPieceVerification('identite', { uri: 'f', nom: 'f', typeMime: 'x' });
      expect(await port.lireDossierVerification()).toEqual(enExamen);
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

    // Option B (2 novembre 2026) : comme creer_profil_client côté serveur (0051), la création
    // active l'espace client — c'est ce qui sort un compte seulement coach de son espace.
    it('creerProfilClient active l’espace client, avec l’identité du profil créé', async () => {
      const port = creerFauxPortDonnees();
      port.definirEtatProfilsPourTest(
        etatProfilsParDefaut({
          profilActif: 'coach',
          coachExiste: true,
          identiteActive: { prenom: 'Yannick', nom: 'Coach' },
        }),
      );

      await port.creerProfilClient('Camille', 'Dupont');

      expect(await port.lireEtatProfils()).toMatchObject({
        profilActif: 'client',
        identiteActive: { prenom: 'Camille', nom: 'Dupont' },
      });
    });

    // Le vrai basculer_profil refuse un profil inexistant (0002). Le faux l'acceptait : c'est
    // pourquoi aucun test n'a vu un compte seulement coach bloqué sur « Espace client ».
    it('basculerProfil vers un profil qui n’existe pas : refusé, profil actif inchangé', async () => {
      const port = creerFauxPortDonnees();
      port.definirEtatProfilsPourTest(
        etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true, clientExiste: false }),
      );

      const resultat = await port.basculerProfil('client');

      expect(resultat.succes).toBe(false);
      expect((await port.lireEtatProfils()).profilActif).toBe('coach');
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
