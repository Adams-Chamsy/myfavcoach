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
    functions: { invoke: jest.fn() },
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
  functions: { invoke: jest.Mock };
};

// Ce que supabase-js rend pour une réponse non 2xx d'une Edge Function (FunctionsHttpError) :
// la réponse elle-même dans `context`. Une erreur réseau (FunctionsFetchError) n'en a pas.
function refusHttp(statut: number, corps: unknown) {
  return {
    data: null,
    error: {
      name: 'FunctionsHttpError',
      context: { status: statut, json: () => Promise.resolve(corps) },
    },
  };
}
const SANS_REPONSE = { data: null, error: { name: 'FunctionsFetchError', context: undefined } };

const SESSION_A = { data: { session: { user: { id: 'compte-a' } } }, error: null };

describe('portDonneesSupabase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('lireEtatProfils', () => {
    it('compose profilActif, les deux existences, onboarding_etape et identiteActive en un seul EtatProfils', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: 'client', error: null });
      supabaseMock.from.mockImplementation((table: string) => {
        if (table === 'profils_client')
          return tableLecture([
            { id: 'p-client', prenom: 'Camille', nom: 'Dupré', onboarding_etape: 2 },
          ]);
        if (table === 'profils_coach') return tableLecture([]);
        throw new Error(`table inattendue dans ce test : ${table}`);
      });

      const resultat = await portDonneesSupabase.lireEtatProfils();

      expect(resultat).toEqual({
        profilActif: 'client',
        clientExiste: true,
        clientOnboardingEtape: 2,
        coachExiste: false,
        identiteActive: { prenom: 'Camille', nom: 'Dupré' },
        attentesCoach: 0,
      });
      expect(supabaseMock.rpc).toHaveBeenCalledWith('profil_actif_courant');
    });

    it('profilActif coach : identiteActive vient de profils_coach, pas de profils_client', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: 'coach', error: null });
      supabaseMock.from.mockImplementation((table: string) => {
        if (table === 'profils_client')
          return tableLecture([
            { id: 'p-client', prenom: 'Camille', nom: 'Dupré', onboarding_etape: 5 },
          ]);
        if (table === 'profils_coach')
          return tableLecture([{ id: 'p-coach', prenom: 'Camille', nom: 'Coach' }]);
        throw new Error(`table inattendue dans ce test : ${table}`);
      });

      const resultat = await portDonneesSupabase.lireEtatProfils();

      expect(resultat.identiteActive).toEqual({ prenom: 'Camille', nom: 'Coach' });
    });

    it('un compte sans aucun profil rend clientExiste/coachExiste à false, clientOnboardingEtape à null, identiteActive vide', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: 'client', error: null });
      supabaseMock.from.mockImplementation(() => tableLecture([]));

      const resultat = await portDonneesSupabase.lireEtatProfils();

      expect(resultat).toEqual({
        profilActif: 'client',
        clientExiste: false,
        clientOnboardingEtape: null,
        coachExiste: false,
        identiteActive: { prenom: '', nom: null },
        attentesCoach: 0,
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

  describe('basculerProfil', () => {
    it('appelle la fonction de base basculer_profil avec le profil demandé', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: 'coach', error: null });

      const resultat = await portDonneesSupabase.basculerProfil('coach');

      expect(resultat).toEqual({ succes: true });
      expect(supabaseMock.rpc).toHaveBeenCalledWith('basculer_profil', { profil: 'coach' });
    });

    // docs/prompts/L1.md, P1.12 : le message brut du serveur (ex. "Aucun profil coach pour ce
    // compte") ne fuite jamais jusqu'à l'écran — même discipline que echec() pour les écritures
    // d'onboarding. L'écran ne propose de toute façon cette action que pour un profil déjà
    // connu comme existant (voir le commentaire de PortDonnees.basculerProfil, port.ts).
    it('un échec du serveur rend ResultatEcriture en échec, jamais le message brut', async () => {
      supabaseMock.rpc.mockResolvedValue({
        data: null,
        error: new Error('Aucun profil coach pour ce compte : bascule refusée.'),
      });

      const resultat = await portDonneesSupabase.basculerProfil('coach');

      expect(resultat).toEqual({
        succes: false,
        erreur: 'On a un souci de notre côté. Réessaie dans un instant.',
      });
    });
  });

  // L4-04a (P4.6a) : docs/api.md §7 ; refus affichables tels quels (§1, règle du 31 octobre 2026).
  describe('demanderIntention', () => {
    const CREEE = {
      intentionId: 'int-1',
      recapitulatif: {
        prixCentimes: 4900,
        totalCentimes: 4900,
        prochainPrelevementLe: '2026-12-01',
        jourPrelevement: 1,
      },
      urlPaiement: 'https://paiement.exemple/session-x',
      moyensAcceptes: ['carte', 'sepa'],
    };

    it('appelle abonnement-intention avec la clé d’idempotence et l’offre, rend la page créée', async () => {
      supabaseMock.functions.invoke.mockResolvedValue({ data: CREEE, error: null });
      const resultat = await portDonneesSupabase.demanderIntention('offre-1', 'cle-1');
      expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('abonnement-intention', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'cle-1' },
        body: { offreId: 'offre-1' },
      });
      expect(resultat).toEqual({ issue: 'creee', ...CREEE });
    });

    it('un refus du serveur rend son code, son titre et son détail, tels quels', async () => {
      supabaseMock.functions.invoke.mockResolvedValue(
        refusHttp(409, {
          code: 'deja_abonne',
          title: 'Tu as déjà un abonnement avec ce coach',
          detail: 'Rien n’a été débité.',
          status: 409,
        }),
      );
      expect(await portDonneesSupabase.demanderIntention('offre-1', 'cle-1')).toEqual({
        issue: 'refusee',
        refus: {
          code: 'deja_abonne',
          title: 'Tu as déjà un abonnement avec ce coach',
          detail: 'Rien n’a été débité.',
        },
      });
    });

    it('un refus sans texte affichable n’est pas un refus exploitable : sans_reponse', async () => {
      supabaseMock.functions.invoke.mockResolvedValue(refusHttp(502, { message: 'Bad Gateway' }));
      expect(await portDonneesSupabase.demanderIntention('offre-1', 'cle-1')).toEqual({
        issue: 'sans_reponse',
      });
    });

    it('aucune réponse (réseau) : sans_reponse', async () => {
      supabaseMock.functions.invoke.mockResolvedValue(SANS_REPONSE);
      expect(await portDonneesSupabase.demanderIntention('offre-1', 'cle-1')).toEqual({
        issue: 'sans_reponse',
      });
    });

    it('une réponse 201 incomplète n’est jamais prise pour une page créée', async () => {
      supabaseMock.functions.invoke.mockResolvedValue({
        data: { intentionId: 'int-1' },
        error: null,
      });
      expect(await portDonneesSupabase.demanderIntention('offre-1', 'cle-1')).toEqual({
        issue: 'sans_reponse',
      });
    });
  });

  describe('constaterIntention', () => {
    it('appelle abonnement-constat sur l’intention, identifiant encodé dans le chemin', async () => {
      supabaseMock.functions.invoke.mockResolvedValue({ data: { etat: 'expiree' }, error: null });
      await portDonneesSupabase.constaterIntention('../autre/chemin');
      expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
        'abonnement-constat/..%2Fautre%2Fchemin',
        { method: 'POST' },
      );
    });

    it('rend chaque état du constat', async () => {
      const cas: [unknown, unknown][] = [
        [
          { etat: 'abonne', abonnement: { statut: 'en_attente_confirmation' } },
          { issue: 'constat', etat: 'abonne', statutAbonnement: 'en_attente_confirmation' },
        ],
        [
          { etat: 'non_terminee', urlPaiement: 'https://paiement.exemple/session-ouverte' },
          {
            issue: 'constat',
            etat: 'non_terminee',
            urlPaiement: 'https://paiement.exemple/session-ouverte',
          },
        ],
        [{ etat: 'paiement_recu' }, { issue: 'constat', etat: 'paiement_recu' }],
        [{ etat: 'expiree' }, { issue: 'constat', etat: 'expiree' }],
        [
          { etat: 'souscription_impossible' },
          { issue: 'constat', etat: 'souscription_impossible' },
        ],
        [{ etat: 'inconnu_du_contrat' }, { issue: 'sans_reponse' }],
      ];
      for (const [corps, attendu] of cas) {
        supabaseMock.functions.invoke.mockResolvedValue({ data: corps, error: null });
        expect(await portDonneesSupabase.constaterIntention('int-1')).toEqual(attendu);
      }
    });

    it('l’intention d’un autre (404) : le refus du serveur, rien de plus', async () => {
      supabaseMock.functions.invoke.mockResolvedValue(
        refusHttp(404, {
          code: 'intention_introuvable',
          title: 'Ce paiement est introuvable',
          detail: 'Reviens au profil du coach pour recommencer.',
          status: 404,
        }),
      );
      expect(await portDonneesSupabase.constaterIntention('int-autre')).toEqual({
        issue: 'refusee',
        refus: {
          code: 'intention_introuvable',
          title: 'Ce paiement est introuvable',
          detail: 'Reviens au profil du coach pour recommencer.',
        },
      });
    });
  });

  describe('avis (P4.9a)', () => {
    const SAISIE = { note: 4, etiquettes: ['ecoute'], texte: 'Bien' };

    it('lireEtiquettesAvis lit la table dans son ordre d’affichage', async () => {
      const order = jest.fn(() =>
        Promise.resolve({ data: [{ cle: 'ecoute', libelle: 'Écoute' }], error: null }),
      );
      const select = jest.fn(() => ({ order }));
      supabaseMock.from.mockReturnValue({ select });
      expect(await portDonneesSupabase.lireEtiquettesAvis()).toEqual([
        { cle: 'ecoute', libelle: 'Écoute' },
      ]);
      expect(supabaseMock.from).toHaveBeenCalledWith('etiquettes_avis');
      expect(select).toHaveBeenCalledWith('cle, libelle');
      expect(order).toHaveBeenCalledWith('ordre_affichage', { ascending: true });
    });

    it('lireAvisDuCoach : la liste et la synthèse du serveur, en camelCase, rien de recalculé', async () => {
      supabaseMock.rpc.mockImplementation((fonction: string) =>
        Promise.resolve(
          fonction === 'avis_du_coach'
            ? {
                data: [
                  {
                    id: 'avis-1',
                    prenom: 'Marc',
                    initiale_nom: 'T',
                    duree_suivi_mois: 7,
                    note: 5,
                    etiquettes: ['ecoute'],
                    texte: null,
                  },
                ],
                error: null,
              }
            : {
                data: [
                  {
                    nombre: 1,
                    moyenne: null,
                    distribution: [0, 0, 0, 0, 1],
                    etiquettes_portees: ['ecoute'],
                  },
                ],
                error: null,
              },
        ),
      );
      expect(await portDonneesSupabase.lireAvisDuCoach('coach-1')).toEqual({
        avis: [
          {
            id: 'avis-1',
            prenom: 'Marc',
            initialeNom: 'T',
            dureeSuiviMois: 7,
            note: 5,
            etiquettes: ['ecoute'],
            texte: null,
          },
        ],
        synthese: {
          nombre: 1,
          moyenne: null,
          distribution: [0, 0, 0, 0, 1],
          etiquettesPortees: ['ecoute'],
        },
      });
      expect(supabaseMock.rpc).toHaveBeenCalledWith('avis_du_coach', { p_coach_id: 'coach-1' });
      expect(supabaseMock.rpc).toHaveBeenCalledWith('synthese_avis_du_coach', {
        p_coach_id: 'coach-1',
      });
    });

    it('lireMonAvis rend chaque état du serveur', async () => {
      const cas: [unknown, unknown][] = [
        [{ etat: 'aucun' }, { etat: 'aucun' }],
        [{ etat: 'possible' }, { etat: 'possible' }],
        [{ etat: 'suivi_interrompu' }, { etat: 'suivi_interrompu' }],
        [
          { etat: 'pas_encore', jours_restants: 3 },
          { etat: 'pas_encore', joursRestants: 3 },
        ],
        [
          { etat: 'fige', note: 4, etiquettes: ['ecoute'], texte: null, statut: 'signale' },
          {
            etat: 'fige',
            avis: { note: 4, etiquettes: ['ecoute'], texte: null, statut: 'signale' },
          },
        ],
      ];
      for (const [ligne, attendu] of cas) {
        supabaseMock.rpc.mockResolvedValue({
          data: [
            {
              jours_restants: null,
              note: null,
              etiquettes: null,
              texte: null,
              statut: null,
              ...(ligne as object),
            },
          ],
          error: null,
        });
        expect(await portDonneesSupabase.lireMonAvis('coach-1')).toEqual(attendu);
      }
      expect(supabaseMock.rpc).toHaveBeenCalledWith('mon_avis_possible', { p_coach_id: 'coach-1' });
    });

    it('deposerAvis : POST sur la fonction avis, rend l’identifiant', async () => {
      supabaseMock.functions.invoke.mockResolvedValue({ data: { avisId: 'avis-1' }, error: null });
      expect(await portDonneesSupabase.deposerAvis('coach-1', SAISIE)).toEqual({
        issue: 'enregistre',
        avisId: 'avis-1',
      });
      expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('avis', {
        method: 'POST',
        body: { coachId: 'coach-1', ...SAISIE },
      });
    });

    it('modifierAvis : PATCH sur la fonction avis', async () => {
      supabaseMock.functions.invoke.mockResolvedValue({ data: { avisId: 'avis-1' }, error: null });
      await portDonneesSupabase.modifierAvis('coach-1', SAISIE);
      expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('avis', {
        method: 'PATCH',
        body: { coachId: 'coach-1', ...SAISIE },
      });
    });

    it('un refus du serveur rend son texte tel quel ; aucune réponse : sans_reponse', async () => {
      const refus = {
        code: 'avis_pas_encore',
        title: "Pas encore d'avis possible",
        detail: 'Il te reste 3 jours de suivi avant de pouvoir donner ton avis.',
      };
      supabaseMock.functions.invoke.mockResolvedValue(refusHttp(403, { ...refus, status: 403 }));
      expect(await portDonneesSupabase.deposerAvis('coach-1', SAISIE)).toEqual({
        issue: 'refusee',
        refus,
      });
      supabaseMock.functions.invoke.mockResolvedValue(SANS_REPONSE);
      expect(await portDonneesSupabase.modifierAvis('coach-1', SAISIE)).toEqual({
        issue: 'sans_reponse',
      });
    });

    it('une réponse 2xx sans identifiant n’est jamais prise pour un avis enregistré', async () => {
      supabaseMock.functions.invoke.mockResolvedValue({ data: {}, error: null });
      expect(await portDonneesSupabase.deposerAvis('coach-1', SAISIE)).toEqual({
        issue: 'sans_reponse',
      });
    });
  });
});
