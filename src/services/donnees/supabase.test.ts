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

// update() est CHAÎNABLE, jamais directement awaitable : Supabase précharge `safeupdate` sur
// le rôle authenticator (confirmé en direct sur le projet — pg_roles.rolconfig,
// session_preload_libraries), qui refuse tout UPDATE/DELETE sans clause WHERE avec l'erreur
// Postgres 21000 "UPDATE requires a WHERE clause". `update(x)` seul, sans `.eq(...)` derrière,
// est donc TOUJOURS un bug côté vrai serveur — même si un mock naïf (qui résout `update()`
// directement) ne le voit jamais. Trouvé en P1.11 : enregistrerObjectifsEtRythme,
// enregistrerPointDeDepart et terminerOnboarding envoyaient tous les trois un UPDATE sans
// filtre, jamais détecté par ce fichier (mocké) ni par src/test/rls.banc.ts (qui filtre
// toujours ses PATCH, sans jamais avoir comparé sa forme à celle réellement envoyée par ce
// port). `.eq` exposé séparément pour que chaque test puisse vérifier qu'il a été appelé.
function tableEcriture(erreur: unknown = null) {
  const eq = jest.fn(() => Promise.resolve({ error: erreur }));
  return {
    insert: jest.fn(() => Promise.resolve({ error: erreur })),
    update: jest.fn(() => ({ eq })),
    eq,
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
    // UPDATE d'abord, INSERT seulement si 0 ligne affectée — jamais un upsert (compte_id n'a
    // aucun grant UPDATE, voir le commentaire de creerProfilClient dans supabase.ts). Nécessaire
    // depuis que le bouton retour (P1.11) peut ramener à l'étape 1 après qu'un profil existe.
    function tablePourCreerProfilClient(
      ligneExistante: unknown[] | null,
      erreurUpdate: unknown = null,
      erreurInsert: unknown = null,
    ) {
      const select = jest.fn(() => Promise.resolve({ data: ligneExistante, error: erreurUpdate }));
      const eq = jest.fn(() => ({ select }));
      const update = jest.fn(() => ({ eq }));
      const insert = jest.fn(() => Promise.resolve({ error: erreurInsert }));
      return { update, eq, select, insert };
    }

    it("aucun profil existant : l'UPDATE ne touche aucune ligne, alors INSERT — nom vide traduit en null", async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      const table = tablePourCreerProfilClient([]);
      supabaseMock.from.mockReturnValue(table);

      const resultat = await portDonneesSupabase.creerProfilClient('Camille', '');

      expect(resultat).toEqual({ succes: true });
      expect(supabaseMock.from).toHaveBeenCalledWith('profils_client');
      expect(table.update).toHaveBeenCalledWith({
        prenom: 'Camille',
        nom: null,
        onboarding_etape: 2,
      });
      expect(table.eq).toHaveBeenCalledWith('compte_id', 'compte-a');
      expect(table.insert).toHaveBeenCalledWith({
        compte_id: 'compte-a',
        prenom: 'Camille',
        nom: null,
        onboarding_etape: 2,
      });
    });

    it('un profil existe déjà (retour à l’étape 1) : met à jour, jamais un second INSERT', async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      const table = tablePourCreerProfilClient([{ id: 'p-client' }]);
      supabaseMock.from.mockReturnValue(table);

      const resultat = await portDonneesSupabase.creerProfilClient('Camille', 'Dupont');

      expect(resultat).toEqual({ succes: true });
      expect(table.insert).not.toHaveBeenCalled();
    });

    it("un échec de l'UPDATE rend ResultatEcriture en échec, jamais une exception", async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      supabaseMock.from.mockReturnValue(tablePourCreerProfilClient(null, new Error('panne')));

      const resultat = await portDonneesSupabase.creerProfilClient('Camille', 'Dupont');

      expect(resultat.succes).toBe(false);
    });

    it("un échec de l'INSERT (première fois) rend ResultatEcriture en échec", async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      supabaseMock.from.mockReturnValue(tablePourCreerProfilClient([], null, new Error('panne')));

      const resultat = await portDonneesSupabase.creerProfilClient('Camille', 'Dupont');

      expect(resultat.succes).toBe(false);
    });
  });

  describe('enregistrerObjectifsEtRythme', () => {
    it('met à jour objectifs, rythme_hebdo et fait passer onboarding_etape à 3, filtré sur compte_id', async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
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
      // Sans ce .eq, safeupdate refuse la requête côté vrai serveur (voir le commentaire de
      // tableEcriture ci-dessus) — c'est exactement le bug trouvé en P1.11.
      expect(table.eq).toHaveBeenCalledWith('compte_id', 'compte-a');
    });
  });

  describe('enregistrerPointDeDepart', () => {
    it('sans consentement : aucun appel à consentements, poids absents de la mise à jour, filtré sur compte_id', async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
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
      expect(table.eq).toHaveBeenCalledWith('compte_id', 'compte-a');
    });

    it("avec consentement : écrit d'abord le consentement, puis le poids, filtré sur compte_id", async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      const ordreAppels: string[] = [];
      const tableConsentements = {
        insert: jest.fn(() => {
          ordreAppels.push('consentements');
          return Promise.resolve({ error: null });
        }),
      };
      const eqProfil = jest.fn(() => {
        ordreAppels.push('profils_client');
        return Promise.resolve({ error: null });
      });
      const tableProfil = {
        update: jest.fn(() => ({ eq: eqProfil })),
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
      expect(eqProfil).toHaveBeenCalledWith('compte_id', 'compte-a');
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
    it('fait passer onboarding_etape à 5, filtré sur compte_id', async () => {
      supabaseMock.auth.getSession.mockResolvedValue(SESSION_A);
      const table = tableEcriture();
      supabaseMock.from.mockReturnValue(table);

      const resultat = await portDonneesSupabase.terminerOnboarding();

      expect(resultat).toEqual({ succes: true });
      expect(table.update).toHaveBeenCalledWith({ onboarding_etape: 5 });
      expect(table.eq).toHaveBeenCalledWith('compte_id', 'compte-a');
    });
  });
});
