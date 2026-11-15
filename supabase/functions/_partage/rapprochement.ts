// Le rapprochement quotidien (P4.11a ; docs/prompts/L4.md, point 12 ; migration 0066) : ce que
// le prestataire a encaissé face à ce que nos factures disent payé, dans les DEUX sens. Il
// signale, il ne corrige jamais : chaque écart est écrit (enregistrer_ecart_rapprochement), et
// une personne décide.
//
// Pas de comparaison de deux listes sur la même fenêtre : un prélèvement SEPA naît un jour et
// réussit trois jours plus tard, les bords de fenêtre fabriqueraient de faux écarts. Deux
// recherches exactes, par référence :
//   1. chaque paiement RÉUSSI chez le prestataire sur la fenêtre -> sa facture, quelle que soit
//      sa date ;
//   2. chaque facture payée sur la fenêtre -> son paiement chez le prestataire.
import { type ClientPostgres } from './postgres.ts';
import { ErreurPassagere } from './session-paiement.ts';

export type Encaissement = { reference: string; montantCentimes: number };

export type PrestataireRapprochement = {
  // Les paiements réussis créés entre deux instants (secondes Unix), chacun sous la référence
  // que porte sa facture chez nous (la session de paiement pour une souscription, le paiement
  // lui-même pour une échéance).
  listerEncaissements(depuis: number, jusqua: number): Promise<Encaissement[]>;
  // Le montant encaissé sous cette référence ; null si elle n'existe pas chez le prestataire, ou
  // pas comme un paiement réussi.
  lireEncaissement(reference: string): Promise<number | null>;
};

export type ClasseEcart =
  'encaisse_sans_facture' | 'facture_sans_encaissement' | 'montant_different';

export type Ecart = {
  classe: ClasseEcart;
  reference: string;
  montantPrestataireCentimes: number | null;
  montantFactureCentimes: number | null;
};

export type BilanRapprochement = {
  du: string;
  au: string;
  encaissements: number;
  factures: number;
  ecarts: Ecart[];
  // Écarts écrits pour la première fois par CE passage (les autres étaient déjà connus).
  nouveaux: number;
  // Factures de la fenêtre que ce passage n'a pas vérifiées chez le prestataire (plafond).
  nonVerifiees: number;
};

// Au plus tant de lectures unitaires chez le prestataire par passage : la tâche a deux minutes,
// et elle prélève aussi. Au-delà, les factures restantes sont comptées, pas devinées.
export const LECTURES_MAX = 100;
const ECRITURES_PAR_PAQUET = 25;
export const TAILLE_PAGE = 1000;

// Une référence que le prestataire a pu émettre : « cs_test_… », « cs_live_… », « pi_… », suivis
// de lettres et de chiffres. Toute autre (celles du banc, par exemple) n'y existe pas : inutile
// de le lui demander.
const REFERENCE_PLAUSIBLE = /^(cs_(test|live)_|pi_)[A-Za-z0-9]+$/;

type LigneFacture = { reference_prestataire: string; montant_ttc_centimes: number };

async function lire(
  serveur: ClientPostgres,
  fonction: string,
  args: Record<string, unknown>,
): Promise<LigneFacture[]> {
  const { data, error } = await serveur.rpc(fonction, args);
  if (error) throw new ErreurPassagere(`${fonction}_illisible`);
  return (data ?? []) as LigneFacture[];
}

// Le jour qui précède ou suit de n jours (AAAA-MM-JJ), sans fuseau : un calcul de calendrier.
export function decalerJour(jour: string, jours: number): string {
  const date = new Date(`${jour}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

export async function executerRapprochement(
  serveur: ClientPostgres,
  prestataire: PrestataireRapprochement,
  du: string,
  au: string,
): Promise<BilanRapprochement> {
  // Bornes élargies de deux heures de chaque côté plutôt que le minuit exact de Paris : la
  // recherche de la facture se fait par référence, un paiement de plus ne coûte rien.
  const depuis = Math.floor(Date.parse(`${du}T00:00:00Z`) / 1000) - 7200;
  const jusqua = Math.floor(Date.parse(`${decalerJour(au, 1)}T00:00:00Z`) / 1000) + 7200;
  const encaissements = await prestataire.listerEncaissements(depuis, jusqua);
  const ecarts: Ecart[] = [];

  // 1. Chaque paiement réussi a-t-il sa facture, au même montant ?
  const facturees = new Map<string, number>();
  if (encaissements.length > 0) {
    const lignes = await lire(serveur, 'factures_par_reference', {
      p_references: encaissements.map((e) => e.reference),
    });
    for (const l of lignes) facturees.set(l.reference_prestataire, l.montant_ttc_centimes);
  }
  const encaisses = new Map<string, number>();
  for (const e of encaissements) {
    encaisses.set(e.reference, e.montantCentimes);
    const facture = facturees.get(e.reference);
    if (facture === undefined) {
      ecarts.push({
        classe: 'encaisse_sans_facture',
        reference: e.reference,
        montantPrestataireCentimes: e.montantCentimes,
        montantFactureCentimes: null,
      });
    } else if (facture !== e.montantCentimes) {
      ecarts.push({
        classe: 'montant_different',
        reference: e.reference,
        montantPrestataireCentimes: e.montantCentimes,
        montantFactureCentimes: facture,
      });
    }
  }

  // 2. Chaque facture payée sur la fenêtre a-t-elle son paiement, au même montant ?
  // Lues page par page : l'API de la base rend au plus mille lignes par appel, sans le dire
  // (trouvé à la preuve sur le dev, 15 novembre 2026 : « factures : 1000 », tout rond, pour plus
  // de mille cinq cents). L'ordre de la fonction est stable (date de paiement, référence).
  const factures: LigneFacture[] = [];
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const { data, error } = await serveur
      .rpc('factures_payees_entre', { p_du: du, p_au: au })
      .range(debut, debut + TAILLE_PAGE - 1);
    if (error) throw new ErreurPassagere('factures_payees_entre_illisible');
    const page = (data ?? []) as LigneFacture[];
    factures.push(...page);
    if (page.length < TAILLE_PAGE) break;
  }
  let lectures = 0;
  let nonVerifiees = 0;
  for (const f of factures) {
    // Déjà comparée au point 1.
    if (encaisses.has(f.reference_prestataire)) continue;
    let encaisse: number | null = null;
    if (REFERENCE_PLAUSIBLE.test(f.reference_prestataire)) {
      if (lectures >= LECTURES_MAX) {
        nonVerifiees += 1;
        continue;
      }
      lectures += 1;
      encaisse = await prestataire.lireEncaissement(f.reference_prestataire);
    }
    if (encaisse === null) {
      ecarts.push({
        classe: 'facture_sans_encaissement',
        reference: f.reference_prestataire,
        montantPrestataireCentimes: null,
        montantFactureCentimes: f.montant_ttc_centimes,
      });
    } else if (encaisse !== f.montant_ttc_centimes) {
      ecarts.push({
        classe: 'montant_different',
        reference: f.reference_prestataire,
        montantPrestataireCentimes: encaisse,
        montantFactureCentimes: f.montant_ttc_centimes,
      });
    }
  }

  // 3. Chaque écart est écrit, une seule fois (0066) ; rien d'autre n'est modifié. Par paquets :
  // sur le projet de développement, les factures du banc en produisent plus d'un millier par
  // passage, et une écriture après l'autre dépasserait le temps accordé à la tâche.
  let nouveaux = 0;
  for (let debut = 0; debut < ecarts.length; debut += ECRITURES_PAR_PAQUET) {
    const reponses = await Promise.all(
      ecarts.slice(debut, debut + ECRITURES_PAR_PAQUET).map((e) =>
        serveur.rpc('enregistrer_ecart_rapprochement', {
          p_classe: e.classe,
          p_reference: e.reference,
          p_montant_prestataire: e.montantPrestataireCentimes,
          p_montant_facture: e.montantFactureCentimes,
        }),
      ),
    );
    for (const { data, error } of reponses) {
      if (error) throw new ErreurPassagere('ecart_non_enregistre');
      if (data === true) nouveaux += 1;
    }
  }

  return {
    du,
    au,
    encaissements: encaissements.length,
    factures: factures.length,
    ecarts,
    nouveaux,
    nonVerifiees,
  };
}
