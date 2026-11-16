// L'identification du coach (L5, P5.2 ; docs/api.md §8, docs/domaine.md §3.3) : son compte de
// versement chez le prestataire, et son identité fiscale. La base décide de qui il s'agit (sous
// le jeton du coach) et garde l'état ; le prestataire dit si le compte peut recevoir de
// l'argent ; ce module relie les deux et traduit pour l'application.
//
// Jamais rendu à l'application : la référence du compte chez le prestataire, ni le détail de ce
// qu'il réclame au coach (c'est sur sa page d'inscription).
import { reponseJson } from './http.ts';
import { type ClientPostgres, codeMetier } from './postgres.ts';
import { reponseRefus } from './refus.ts';
import { ErreurPassagere } from './session-paiement.ts';

export type EtatCompteVersement =
  'absent' | 'a_completer' | 'en_verification' | 'operationnel' | 'restreint';

// Une capacité du compte, telle que le prestataire la rend. `aFournir` : le coach doit donner
// une information pour la débloquer (par opposition à un compte que le prestataire a fermé).
export type Capacite = {
  statut: 'active' | 'pending' | 'restricted' | 'unsupported';
  aFournir: boolean;
};

export type CapacitesCompte = { transferts: Capacite | null; virements: Capacite | null };

export type PrestataireComptes = {
  // Crée le compte du coach et rend sa référence. Une clé par coach : deux appels qui se
  // croisent créent le même compte, jamais deux.
  creerCompte(
    coach: { profilCoachId: string; email: string | null; nomAffiche: string },
    cleIdempotence: string,
  ): Promise<string>;
  lireCapacites(reference: string): Promise<CapacitesCompte>;
  // La page d'inscription hébergée par le prestataire : à usage unique, valable quelques minutes.
  creerLienInscription(reference: string, urlRetour: string, urlReprise: string): Promise<string>;
};

// docs/domaine.md §3.3 (critère du 16 novembre 2026) : opérationnel quand le compte peut
// recevoir un virement de la plateforme ET le virer à la banque du coach. L'un sans l'autre ne
// suffit pas.
export function etatDepuisCapacites(c: CapacitesCompte): Exclude<EtatCompteVersement, 'absent'> {
  const deux = [c.transferts, c.virements];
  if (deux.every((x) => x?.statut === 'active')) return 'operationnel';
  // Une capacité absente n'a pas encore été demandée ou décrite : le coach n'a pas fini.
  if (deux.some((x) => x === null)) return 'a_completer';
  if (deux.some((x) => x?.statut === 'restricted' && x.aFournir)) return 'a_completer';
  if (deux.some((x) => x?.statut === 'restricted' || x?.statut === 'unsupported')) {
    return 'restreint';
  }
  return 'en_verification';
}

type Identification = {
  profil_coach_id: string;
  compte_versement: EtatCompteVersement;
  identite_fiscale_complete: boolean;
};

// Qui est ce coach, et où en est-il : la base le dit, sous SON jeton. Un compte qui n'est pas en
// espace coach reçoit un refus, pas une erreur.
async function identifier(duCoach: ClientPostgres): Promise<Identification | Response> {
  const { data, error } = await duCoach.rpc('mon_identification', {});
  if (error) {
    if ((error as { code?: string }).code === '42501') return reponseRefus(401, 'non_authentifie');
    if (codeMetier(error) === 'profil_coach_requis')
      return reponseRefus(403, 'profil_coach_requis');
    throw new ErreurPassagere(codeMetier(error) ?? 'identification_illisible');
  }
  const ligne = (data as Identification[] | null)?.[0];
  if (!ligne) throw new ErreurPassagere('identification_illisible');
  return ligne;
}

async function referenceDuCompte(serveur: ClientPostgres, profilCoachId: string) {
  const { data, error } = await serveur.rpc('compte_versement_serveur', {
    p_profil_coach_id: profilCoachId,
  });
  if (error) throw new ErreurPassagere('compte_versement_illisible');
  const ligne = (data as { reference_compte_prestataire: string }[] | null)?.[0];
  return ligne?.reference_compte_prestataire ?? null;
}

// Relit l'état chez le prestataire et le garde en base. Rend l'état relu.
export async function relireCompte(
  serveur: ClientPostgres,
  prestataire: PrestataireComptes,
  profilCoachId: string,
  reference: string,
): Promise<Exclude<EtatCompteVersement, 'absent'>> {
  const etat = etatDepuisCapacites(await prestataire.lireCapacites(reference));
  const { error } = await serveur.rpc('poser_etat_compte_versement', {
    p_profil_coach_id: profilCoachId,
    p_etat: etat,
  });
  if (error) throw new ErreurPassagere('etat_non_pose');
  return etat;
}

// POST /coach-identification : où en est le coach. L'état du compte est relu chez le
// prestataire à chaque appel (docs/prompts/L5.md, décision 2 : pas de webhook Connect).
export async function lireIdentification(
  duCoach: ClientPostgres,
  serveur: ClientPostgres,
  prestataire: PrestataireComptes,
): Promise<Response> {
  const identification = await identifier(duCoach);
  if (identification instanceof Response) return identification;
  const reference = await referenceDuCompte(serveur, identification.profil_coach_id);
  const compteVersement: EtatCompteVersement =
    reference === null
      ? 'absent'
      : await relireCompte(serveur, prestataire, identification.profil_coach_id, reference);
  return reponseJson(200, {
    compteVersement,
    identiteFiscaleComplete: identification.identite_fiscale_complete,
    peutPublier: compteVersement === 'operationnel' && identification.identite_fiscale_complete,
  });
}

// POST /coach-identification/lien : la page d'inscription du prestataire. Le compte est créé au
// premier appel ; la base n'en garde qu'un par coach.
export async function creerLienIdentification(
  duCoach: ClientPostgres,
  serveur: ClientPostgres,
  prestataire: PrestataireComptes,
  // Le nom et l'adresse du coach, lus par l'appelant POUR CE PROFIL (désigné par son
  // identifiant, jamais par le compte) : seulement si le compte reste à créer.
  lireCoach: (profilCoachId: string) => Promise<{ email: string | null; nomAffiche: string }>,
  urls: { retour: string; reprise: string },
): Promise<Response> {
  const identification = await identifier(duCoach);
  if (identification instanceof Response) return identification;
  const profilCoachId = identification.profil_coach_id;

  let reference = await referenceDuCompte(serveur, profilCoachId);
  if (reference === null) {
    const coach = await lireCoach(profilCoachId);
    const creee = await prestataire.creerCompte(
      { profilCoachId, ...coach },
      `compte-versement-${profilCoachId}`,
    );
    const { data, error } = await serveur.rpc('poser_compte_versement', {
      p_profil_coach_id: profilCoachId,
      p_reference: creee,
    });
    if (error || typeof data !== 'string') throw new ErreurPassagere('compte_non_pose');
    // La référence GARDÉE par la base : celle d'un appel concurrent si l'on a été doublé.
    reference = data;
  }
  const url = await prestataire.creerLienInscription(reference, urls.retour, urls.reprise);
  return reponseJson(200, { url });
}

export type SaisieIdentiteFiscale = {
  siren: string;
  adresseLigne: string;
  codePostal: string;
  commune: string;
  regimeTva: 'franchise_en_base' | 'assujetti';
  tauxTvaPourMille: number | null;
};

// La FORME du corps seulement : les règles (clé du SIREN, code postal, cohérence régime/taux)
// sont celles de la base (0070), qui refuse avec un texte.
export function lireSaisieIdentiteFiscale(corps: unknown): SaisieIdentiteFiscale | null {
  if (typeof corps !== 'object' || corps === null) return null;
  const c = corps as Record<string, unknown>;
  const textes = [c.siren, c.adresseLigne, c.codePostal, c.commune];
  if (!textes.every((t) => typeof t === 'string')) return null;
  if (c.regimeTva !== 'franchise_en_base' && c.regimeTva !== 'assujetti') return null;
  const taux = c.tauxTvaPourMille ?? null;
  if (taux !== null && (typeof taux !== 'number' || !Number.isInteger(taux))) return null;
  return {
    siren: c.siren as string,
    adresseLigne: c.adresseLigne as string,
    codePostal: c.codePostal as string,
    commune: c.commune as string,
    regimeTva: c.regimeTva,
    tauxTvaPourMille: taux,
  };
}

// POST /coach-identification/identite-fiscale : la base décide (0070), sous le jeton du coach.
export async function enregistrerIdentiteFiscale(
  duCoach: ClientPostgres,
  saisie: SaisieIdentiteFiscale,
): Promise<Response> {
  const { error } = await duCoach.rpc('enregistrer_identite_fiscale', {
    p_siren: saisie.siren,
    p_adresse_ligne: saisie.adresseLigne,
    p_code_postal: saisie.codePostal,
    p_commune: saisie.commune,
    p_regime_tva: saisie.regimeTva,
    p_taux_tva_pour_mille: saisie.tauxTvaPourMille,
  });
  if (!error) return reponseJson(200, { enregistree: true });
  if ((error as { code?: string }).code === '42501') return reponseRefus(401, 'non_authentifie');
  const code = codeMetier(error);
  if (code === 'profil_coach_requis') return reponseRefus(403, 'profil_coach_requis');
  if (code === 'identite_fiscale_invalide') return reponseRefus(422, 'identite_fiscale_invalide');
  throw new ErreurPassagere(code ?? 'identite_fiscale_non_enregistree');
}
