import { supabase } from '@/services/supabase/client';
import { portDonneesSupabase } from './supabase';

// Doublure du client réel, même principe que src/services/auth/supabase.test.ts : ce test
// vérifie la COMPOSITION de portDonneesSupabase (quels appels, dans quel ordre, un seul
// résultat), pas le client Supabase lui-même (déjà testé par
// src/services/supabase/client.test.ts).
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

function tableLecture(donnees: unknown[] | null, erreur: unknown = null) {
  return { select: () => ({ limit: () => Promise.resolve({ data: donnees, error: erreur }) }) };
}

function tableEcriture(erreur: unknown = null) {
  return {
    insert: jest.fn(() => Promise.resolve({ error: erreur })),
    update: jest.fn(() => Promise.resolve({ error: erreur })),
  };
}

const supabaseMock = supabase as unknown as {
  auth: { getSession: jest.Mock };
  rpc: jest.Mock;
  from: jest.Mock;
};

const SESSION_A = { data: { session: { user: { id: 'compte-a' } } }, error: null };

describe('portDonneesSupabase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('lireEtatProfils', () => {
    it('compose profilActif, les deux existences et onboarding_etape en un seul EtatProfils', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: 'client', error: null });
      supabaseMock.from.mockImplementation((table: string) => {
        if (table === 'profils_client')
          return tableLecture([{ id: 'p-client', onboarding_etape: 2 }]);
        if (table === 'profils_coach') return tableLecture([]);
        throw new Error(`table inattendue dans ce test : ${table}`);
      });

      const resultat = await portDonneesSupabase.lireEtatProfils();

      expect(resultat).toEqual({
        profilActif: 'client',
        clientExiste: true,
        clientOnboardingEtape: 2,
        coachExiste: false,
      });
      expect(supabaseMock.rpc).toHaveBeenCalledWith('profil_actif_courant');
    });

    it('un compte sans aucun profil rend clientExiste/coachExiste à false et clientOnboardingEtape à null', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: 'client', error: null });
      supabaseMock.from.mockImplementation(() => tableLecture([]));

      const resultat = await portDonneesSupabase.lireEtatProfils();

      expect(resultat).toEqual({
        profilActif: 'client',
        clientExiste: false,
        clientOnboardingEtape: null,
        coachExiste: false,
      });
    });

    it('relance une erreur RPC plutôt que de la faire disparaître en silence', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: new Error('panne RPC') });
      supabaseMock.from.mockImplementation(() => tableLecture([]));

      await expect(portDonneesSupabase.lireEtatProfils()).rejects.toThrow('panne RPC');
    });

    it('relance une erreur de lecture profils_client', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: 'client', error: null });
      supabaseMock.from.mockImplementation((table: string) => {
        if (table === 'profils_client') return tableLecture(null, new Error('panne REST'));
        return tableLecture([]);
      });

      await expect(portDonneesSupabase.lireEtatProfils()).rejects.toThrow('panne REST');
    });
  });

  describe('lireProfilOnboarding', () => {
    it('compose les champs accumulés depuis profils_client', async () => {
      supabaseMock.from.mockReturnValue(
        tableLecture([
          {
            prenom: 'Camille',
            nom: 'Dupont',
            objectifs: ['perdre-du-poids'],
            rythme_hebdo: '3-4-fois',
            poids_depart_grammes: 70000,
            poids_cible_grammes: 65000,
          },
        ]),
      );

      const resultat = await portDonneesSupabase.lireProfilOnboarding();

      expect(resultat).toEqual({
        prenom: 'Camille',
        nom: 'Dupont',
        objectifs: ['perdre-du-poids'],
        rythme: '3-4-fois',
        poidsDepartGrammes: 70000,
        poidsCibleGrammes: 65000,
      });
    });

    it("sans ligne (avant l'étape 1), rend des valeurs par défaut plutôt qu'une exception", async () => {
      supabaseMock.from.mockReturnValue(tableLecture([]));

      const resultat = await portDonneesSupabase.lireProfilOnboarding();

      expect(resultat).toEqual({
        prenom: '',
        nom: null,
        objectifs: [],
        rythme: null,
        poidsDepartGrammes: null,
        poidsCibleGrammes: null,
      });
    });

    it('relance une erreur de lecture plutôt que de la faire disparaître en silence', async () => {
      supabaseMock.from.mockReturnValue(tableLecture(null, new Error('panne REST')));

      await expect(portDonneesSupabase.lireProfilOnboarding()).rejects.toThrow('panne REST');
    });
  });

  describe('creerProfilClient', () => {
    it('insère la ligne avec compte_id de la session, nom vide traduit en null', async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      const table = tableEcriture();
      supabaseMock.from.mockReturnValue(table);

      const resultat = await portDonneesSupabase.creerProfilClient('Camille', '');

      expect(resultat).toEqual({ succes: true });
      expect(supabaseMock.from).toHaveBeenCalledWith('profils_client');
      expect(table.insert).toHaveBeenCalledWith({
        compte_id: 'compte-a',
        prenom: 'Camille',
        nom: null,
        onboarding_etape: 2,
      });
    });

    it('un échec de la base rend ResultatEcriture en échec, jamais une exception', async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      supabaseMock.from.mockReturnValue(tableEcriture(new Error('panne')));

      const resultat = await portDonneesSupabase.creerProfilClient('Camille', 'Dupont');

      expect(resultat.succes).toBe(false);
    });
  });

  describe('enregistrerObjectifsEtRythme', () => {
    it('met à jour objectifs, rythme_hebdo et fait passer onboarding_etape à 3', async () => {
      const table = tableEcriture();
      supabaseMock.from.mockReturnValue(table);

      const resultat = await portDonneesSupabase.enregistrerObjectifsEtRythme(
        ['perdre-du-poids'],
        '3-4-fois',
      );

      expect(resultat).toEqual({ succes: true });
      expect(table.update).toHaveBeenCalledWith({
        objectifs: ['perdre-du-poids'],
        rythme_hebdo: '3-4-fois',
        onboarding_etape: 3,
      });
    });
  });

  describe('enregistrerPointDeDepart', () => {
    it('sans consentement : aucun appel à consentements, poids absents de la mise à jour', async () => {
      const table = tableEcriture();
      supabaseMock.from.mockReturnValue(table);

      const resultat = await portDonneesSupabase.enregistrerPointDeDepart({
        consentementAccorde: false,
        versionConsentement: '2026-09-04',
      });

      expect(resultat).toEqual({ succes: true });
      expect(supabaseMock.from).toHaveBeenCalledWith('profils_client');
      expect(supabaseMock.from).not.toHaveBeenCalledWith('consentements');
      expect(table.update).toHaveBeenCalledWith({ onboarding_etape: 4 });
    });

    it("avec consentement : écrit d'abord le consentement, puis le poids", async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      const ordreAppels: string[] = [];
      const tableConsentements = {
        insert: jest.fn(() => {
          ordreAppels.push('consentements');
          return Promise.resolve({ error: null });
        }),
      };
      const tableProfil = {
        update: jest.fn((valeurs: unknown) => {
          ordreAppels.push('profils_client');
          return Promise.resolve({ error: null, valeurs });
        }),
      };
      supabaseMock.from.mockImplementation((table: string) =>
        table === 'consentements' ? tableConsentements : tableProfil,
      );

      const resultat = await portDonneesSupabase.enregistrerPointDeDepart({
        consentementAccorde: true,
        versionConsentement: '2026-09-04',
        poidsDepartGrammes: 70000,
        poidsCibleGrammes: 65000,
      });

      expect(resultat).toEqual({ succes: true });
      expect(ordreAppels).toEqual(['consentements', 'profils_client']);
      expect(tableConsentements.insert).toHaveBeenCalledWith({
        compte_id: 'compte-a',
        type: 'donneesSante',
        accorde: true,
        version: '2026-09-04',
        origine: 'onboarding_client',
      });
      expect(tableProfil.update).toHaveBeenCalledWith({
        onboarding_etape: 4,
        poids_depart_grammes: 70000,
        poids_cible_grammes: 65000,
      });
    });

    it("un échec de l'écriture du consentement empêche celle du poids", async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      const tableProfil = { update: jest.fn() };
      supabaseMock.from.mockImplementation((table: string) =>
        table === 'consentements'
          ? { insert: () => Promise.resolve({ error: new Error('panne') }) }
          : tableProfil,
      );

      const resultat = await portDonneesSupabase.enregistrerPointDeDepart({
        consentementAccorde: true,
        versionConsentement: '2026-09-04',
        poidsDepartGrammes: 70000,
      });

      expect(resultat.succes).toBe(false);
      expect(tableProfil.update).not.toHaveBeenCalled();
    });
  });

  describe('terminerOnboarding', () => {
    it('fait passer onboarding_etape à 5', async () => {
      const table = tableEcriture();
      supabaseMock.from.mockReturnValue(table);

      const resultat = await portDonneesSupabase.terminerOnboarding();

      expect(resultat).toEqual({ succes: true });
      expect(table.update).toHaveBeenCalledWith({ onboarding_etape: 5 });
    });
  });
});
