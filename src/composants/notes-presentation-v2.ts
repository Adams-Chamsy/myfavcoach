// Textes du panneau éditorial de la référence V2 du 14 novembre 2026.
export type NotePresentationV2 = { titre: string; texte: string; photo: boolean };
export const notesPresentationV2: Readonly<Record<string, NotePresentationV2>> = {
  'verification-email': {
    titre: 'La suite t’attend.',
    texte: 'Une fois le lien confirmé, tu pourras compléter ton profil.',
    photo: false,
  },
  identite: {
    titre: 'À chacun\nson élan.',
    texte: 'Quelques repères pour commencer. Tu pourras modifier tes informations dans ton compte.',
    photo: false,
  },
  objectifs: {
    titre: 'Une direction,\npas une obligation.',
    texte: 'Tes objectifs et ton rythme peuvent évoluer.',
    photo: false,
  },
  'point-depart': {
    titre: 'Ce choix\nt’appartient.',
    texte: 'Ces informations sont facultatives.',
    photo: false,
  },
  'cest-parti': {
    titre: 'Le bon coach.\nTon prochain déclic.',
    texte: 'Compare les approches, puis choisis celle qui te correspond.',
    photo: true,
  },
  compte: {
    titre: 'Un compte,\ndeux espaces.',
    texte: 'Tu peux passer de ton espace client à ton espace coach quand tu veux.',
    photo: false,
  },
  'activation-coach': {
    titre: 'Ce que tu sais.\nCe que tu transmets.',
    texte: 'Prépare ta présentation et ton offre avant de publier.',
    photo: true,
  },
  'presentation-coach': {
    titre: 'Des mots\nqui te ressemblent.',
    texte: 'Décris ta manière d’accompagner et les personnes à qui tu t’adresses.',
    photo: false,
  },
  justificatifs: {
    titre: 'Un dossier.\nUn seul examen.',
    texte: 'Les pièces sont examinées ensemble.',
    photo: false,
  },
  'recap-coach': {
    titre: 'Préparer\nla rencontre.',
    texte: 'Ton offre donne aux futurs clients une vision concrète de ton accompagnement.',
    photo: false,
  },
  'attente-coach': {
    titre: 'Tu peux\ndéjà avancer.',
    texte: 'La rédaction du profil et la préparation d’une offre restent disponibles.',
    photo: false,
  },
  'mise-en-route': {
    titre: 'Une offre claire,\npour commencer.',
    texte:
      'Un titre, un prix et un engagement humain concret : l’essentiel pour expliquer ton accompagnement.',
    photo: true,
  },
  'profil-coach': {
    titre: 'Ce que les clients\nverront de toi.',
    texte: 'Présente ton approche et les personnes que tu accompagnes.',
    photo: false,
  },
  'creation-offre': {
    titre: 'La relation humaine,\nau centre.',
    texte:
      'Explique précisément tes engagements : ce que tu ajustes, quand tu échanges et comment tu accompagnes.',
    photo: false,
  },
  invitations: {
    titre: 'Le même lien,\nsans données cachées.',
    texte: 'Partage ton lien avec les personnes que tu accompagnes déjà.',
    photo: false,
  },
  invitation: {
    titre: 'Une invitation,\naucune obligation.',
    texte: 'Tu peux découvrir l’offre et le profil avant de faire ton choix.',
    photo: false,
  },
  bascule: {
    titre: 'Le même compte.\nDeux rôles.',
    texte: 'Tu conserves le même compte et utilises ton identité active.',
    photo: false,
  },
  'admin-dossier': {
    titre: 'Une décision\npour le dossier.',
    texte:
      'Le motif peut nommer précisément la pièce concernée. Aucun statut individuel n’est attribué à chaque document.',
    photo: false,
  },
  'etat-chargement': {
    titre: 'Un instant.',
    texte: 'La structure reste stable pendant le chargement.',
    photo: false,
  },
};
