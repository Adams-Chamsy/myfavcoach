-- Motif d'anomalie « moyen indéterminé » -- L4, P4.5c (docs/dette.md, « moyenUtilise rend null
-- sur un prélèvement SEPA rejeté », trouvé le 31 octobre 2026).
--
-- Consigné par le point d'entrée (supabase/functions/_partage/session-paiement.ts) quand une
-- session est terminée mais qu'aucune des trois sources lues chez Stripe ne donne le moyen de
-- paiement : le moyen attaché au paiement, le dernier débit, la dernière erreur. Distinct de
-- etat_incoherent, qui garde son sens : un moyen LU, mais que la page ne propose pas.
--
-- Rien d'autre ne change : enregistrer_anomalie_paiement (0038) prend déjà le motif en type
-- énuméré, ses droits (le serveur seul) restent ceux de 0038.

alter type public.anomalie_paiement_motif_enum add value 'moyen_indetermine';
