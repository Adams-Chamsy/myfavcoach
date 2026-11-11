import { piecesEnVigueur } from './pieces-en-vigueur';

// L2-06, règle 6 : « l'ancienne version du fichier disparaît dès l'envoi de la nouvelle ». Le
// serveur garde chaque dépôt (0012) : c'est ici qu'un remplacement efface l'ancien, pour l'écran
// du coach comme pour le back-office.
describe('piecesEnVigueur', () => {
  it('ne garde que le dépôt le plus récent de chaque type, quel que soit l’ordre reçu', () => {
    const pieces = [
      { type: 'identite', deposeLe: '2026-11-11T13:00:00.000Z', chemin: 'nouvelle' },
      { type: 'identite', deposeLe: '2026-09-10T10:00:00.000Z', chemin: 'ancienne' },
      { type: 'assurance_rc_pro', deposeLe: '2026-09-10T10:02:00.000Z', chemin: 'assurance' },
    ];

    expect(piecesEnVigueur(pieces).map((p) => p.chemin)).toEqual(['nouvelle', 'assurance']);
  });

  it('une pièce par type : rien à écarter', () => {
    const pieces = [
      { type: 'identite', deposeLe: '2026-09-10T10:00:00.000Z' },
      { type: 'diplome_ou_certification', deposeLe: '2026-09-10T10:01:00.000Z' },
    ];

    expect(piecesEnVigueur(pieces)).toEqual(pieces);
  });
});
