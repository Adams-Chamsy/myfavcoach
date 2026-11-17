// L6 — les textes des refus du studio et de la séance du jour (docs/ecrans/L6-11-studio.md,
// docs/ecrans/L6-05-seance-du-jour.md). Le serveur rend un code (0081, 0083, 0085, 0087) ; ces
// phrases sont celles que lit le coach ou le client. Écrites par Claude, à relire
// (docs/decisions-en-attente.md).
export type TexteRefus = { titre: string; detail: string };

const TEXTES: Record<string, TexteRefus> = {
  programme_introuvable: {
    titre: 'Ce programme est introuvable',
    detail: 'Reviens au studio pour le retrouver.',
  },
  programme_non_modifiable: {
    titre: 'Ce programme n’est plus modifiable',
    detail: 'Un programme publié ou archivé ne se modifie pas. Reviens en édition d’abord.',
  },
  programme_invalide: {
    titre: 'Ces informations ne sont pas valides',
    detail: 'Un titre de 80 caractères au plus, une durée de 1 à 12 semaines.',
  },
  duree_trop_courte: {
    titre: 'Durée trop courte',
    detail: 'Des séances tombent après la fin. Retire-les ou garde une durée plus longue.',
  },
  jour_hors_programme: {
    titre: 'Ce jour est en dehors du programme',
    detail: 'Choisis un jour dans la durée du programme.',
  },
  seance_introuvable: {
    titre: 'Cette séance est introuvable',
    detail: 'Reviens à ton programme pour la retrouver.',
  },
  seance_invalide: {
    titre: 'Ces informations ne sont pas valides',
    detail: 'Un titre de 80 caractères au plus, une durée de 1 à 300 minutes.',
  },
  seance_utilisee: {
    titre: 'Cette séance est déjà programmée',
    detail: 'Un abonné l’a reçue : elle reste, pour garder son historique.',
  },
  exercice_invalide: {
    titre: 'Cet exercice n’est pas valide',
    detail: 'Donne-lui un nom. Séries de 1 à 20, répétitions de 1 à 200, charge de 500 kg au plus.',
  },
  exercice_introuvable: {
    titre: 'Cet exercice est introuvable',
    detail: 'Reviens à la séance pour le retrouver.',
  },
  identite_non_verifiee: {
    titre: 'Ton identité n’est pas encore vérifiée',
    detail: 'Ton identité doit être vérifiée avant de publier un programme.',
  },
  programme_vide: {
    titre: 'Ce programme est vide',
    detail: 'Ajoute au moins une séance avant de le publier.',
  },
  retour_edition_interdit: {
    titre: 'Des abonnés suivent ce programme',
    detail: 'Il ne repasse en édition qu’une fois leurs séances terminées. Tu peux l’archiver.',
  },
  transition_interdite: {
    titre: 'Ce n’est pas possible maintenant',
    detail: 'L’état a changé entre-temps. Recharge l’écran.',
  },
  programme_deja_en_cours: {
    titre: 'Cet abonné suit déjà un de tes programmes',
    detail: 'Il en reçoit un nouveau quand les séances du premier sont passées.',
  },
  abonnement_sans_acces: {
    titre: 'Pas d’accès pour l’instant',
    detail: 'L’abonnement est en pause, suspendu ou terminé.',
  },
  date_invalide: {
    titre: 'Cette date est passée',
    detail: 'Choisis aujourd’hui ou un jour à venir.',
  },
  media_invalide: {
    titre: 'Ce fichier n’est pas accepté',
    detail: 'Images JPEG ou PNG, vidéos MP4 ou PDF, 50 Mo au plus.',
  },
  media_introuvable: {
    titre: 'Ce média est introuvable',
    detail: 'Reviens à ta bibliothèque pour le retrouver.',
  },
  media_utilise: {
    titre: 'Ce média sert un programme publié',
    detail: 'Tes abonnés le perdraient. Repasse le programme en édition pour le retirer.',
  },
  seance_pas_encore: {
    titre: 'Pas encore',
    detail: 'Cette séance s’ouvre le jour prévu.',
  },
  rattrapage_expire: {
    titre: 'Trop tard pour la rattraper',
    detail: 'Cette séance ne peut plus être rattrapée.',
  },
  consentement_sante_absent: {
    titre: 'Ressenti non enregistré',
    detail: 'Il demande ton accord pour les données de santé, depuis Moi, Confidentialité.',
  },
  profil_coach_requis: {
    titre: 'Passe sur ton espace coach',
    detail: 'Cette démarche se fait depuis ton espace coach.',
  },
  profil_client_requis: {
    titre: 'Passe sur ton espace client',
    detail: 'Cette démarche se fait depuis ton espace client.',
  },
};

export const SANS_REPONSE: TexteRefus = {
  titre: 'Pas de connexion',
  detail: 'Rien n’a été enregistré. Réessaie.',
};

export function texteRefus(code: string): TexteRefus {
  return (
    TEXTES[code] ?? {
      titre: 'On a un souci de notre côté',
      detail: 'Ce n’est pas toi. Réessaie dans un instant.',
    }
  );
}

export const LIBELLES_STATUT_PROGRAMME = {
  brouillon: 'Brouillon',
  publie: 'Publié',
  archive: 'Archivé',
} as const;

export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

// Le jour dans la semaine (0 = lundi) et la semaine (à partir de 1) d'un jour relatif.
export function semaineEtJour(jourRelatif: number): { semaine: number; jour: number } {
  return { semaine: Math.floor((jourRelatif - 1) / 7) + 1, jour: (jourRelatif - 1) % 7 };
}
