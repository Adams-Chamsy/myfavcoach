import type { ComponentType } from 'react';

import { Accueil } from './accueil';
import { Recherche } from './recherche';
import { Seance } from './seance';
import { Message } from './message';
import { Agenda } from './agenda';
import { Pilotage } from './pilotage';
import { Carte } from './carte';
import { Clients } from './clients';
import { Profil } from './profil';
import { Ajouter } from './ajouter';
import { Valide } from './valide';
import { Fermer } from './fermer';
import { Retour } from './retour';
import { Suivant } from './suivant';
import { Deplier } from './deplier';
import { Filtres } from './filtres';
import { Lecture } from './lecture';
import { Pause } from './pause';
import { Vocal } from './vocal';
import { Visio } from './visio';
import { Raccrocher } from './raccrocher';
import { Notification } from './notification';
import { Favori } from './favori';
import { Note } from './note';
import { Securite } from './securite';
import { Document } from './document';
import { Duree } from './duree';
import { Information } from './information';
import { Alerte } from './alerte';
import { Modifier } from './modifier';
import { Reordonner } from './reordonner';
import { Virement } from './virement';
import { HorsLigne } from './hors-ligne';
import { Reessayer } from './reessayer';
import { Reglages } from './reglages';
import { Plus } from './plus';
import type { ProprietesIcone } from './icone-base';

// Les 36 pictogrammes de docs/design-system.md §5, dans l'ordre de la fiche. Cinq d'entre
// eux (vocal, visio, raccrocher, hors-ligne, et l'usage montre de duree) servent des
// fonctionnalites du jalon 2 : ils sont extraits quand meme, voir la fiche.
export type NomIcone =
  | 'accueil'
  | 'recherche'
  | 'seance'
  | 'message'
  | 'agenda'
  | 'pilotage'
  | 'carte'
  | 'clients'
  | 'profil'
  | 'ajouter'
  | 'valide'
  | 'fermer'
  | 'retour'
  | 'suivant'
  | 'deplier'
  | 'filtres'
  | 'lecture'
  | 'pause'
  | 'vocal'
  | 'visio'
  | 'raccrocher'
  | 'notification'
  | 'favori'
  | 'note'
  | 'securite'
  | 'document'
  | 'duree'
  | 'information'
  | 'alerte'
  | 'modifier'
  | 'reordonner'
  | 'virement'
  | 'hors-ligne'
  | 'reessayer'
  | 'reglages'
  | 'plus';

export const icones: Record<NomIcone, ComponentType<ProprietesIcone>> = {
  accueil: Accueil,
  recherche: Recherche,
  seance: Seance,
  message: Message,
  agenda: Agenda,
  pilotage: Pilotage,
  carte: Carte,
  clients: Clients,
  profil: Profil,
  ajouter: Ajouter,
  valide: Valide,
  fermer: Fermer,
  retour: Retour,
  suivant: Suivant,
  deplier: Deplier,
  filtres: Filtres,
  lecture: Lecture,
  pause: Pause,
  vocal: Vocal,
  visio: Visio,
  raccrocher: Raccrocher,
  notification: Notification,
  favori: Favori,
  note: Note,
  securite: Securite,
  document: Document,
  duree: Duree,
  information: Information,
  alerte: Alerte,
  modifier: Modifier,
  reordonner: Reordonner,
  virement: Virement,
  'hors-ligne': HorsLigne,
  reessayer: Reessayer,
  reglages: Reglages,
  plus: Plus,
};

export { Icone } from './icone';
export type { ProprietesIcone } from './icone-base';
