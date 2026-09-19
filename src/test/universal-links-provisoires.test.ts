import { readFileSync } from 'fs';
import { join } from 'path';

// Règle 8 (docs/prompts/L3bis.md) : un test qui deviendra faux plus tard porte son intention
// dans le fichier. `public/.well-known/apple-app-site-association` et
// `public/.well-known/assetlinks.json` (P3bis.2) portent des valeurs provisoires marquées
// « _A_REMPLACER » (ID d'équipe Apple, empreinte de certificat Android) faute de comptes
// développeur (`docs/perimetre.md` §6) — un marqueur texte qui, seul, ne signale rien à
// personne : `EQUIPE_APPLE_A_REMPLACER` tiendra en silence jusqu'à ce qu'un vrai lien ne
// s'ouvre pas, après publication, sur un fichier déjà servi publiquement.
//
// `it.failing` (Jest ≥ 29.4, confirmé ici en 29.7) inverse la lecture habituelle d'un
// vert/rouge : l'assertion ci-dessous (« aucun marqueur ») est censée ÉCHOUER aujourd'hui —
// `it.failing` rapporte donc CE fichier de test comme VERT tant qu'elle échoue, sans jamais
// bloquer `npm run verif`. Le jour où un vrai ID d'équipe et une vraie empreinte remplacent les
// marqueurs, cette même assertion RÉUSSIT — et `it.failing` la rapporte alors comme ROUGE,
// nommément, précisément parce qu'elle a réussi alors qu'elle était censée échouer. C'est le
// signal voulu : pas un silence qui attend qu'un humain se souvienne, un rouge qui apparaît de
// lui-même le jour où il devient pertinent.
//
// CE QU'IL FAUDRA FAIRE à ce moment-là, écrit ici pour que personne n'ait à le deviner :
// 1. Retirer `it.failing` autour des deux tests ci-dessous (les transformer en `it` normaux).
// 2. Vérifier qu'ils passent alors pour de bon (assertion réussie, plus de marqueur).
// 3. Retirer l'entrée correspondante de docs/dette.md (celle qui cite ce fichier).
// Ne pas juste supprimer ce fichier en croyant nettoyer : c'est lui qui aurait fait son travail.

const RACINE = join(__dirname, '..', '..');
const MARQUEUR = 'A_REMPLACER';

function lireFichierPublic(cheminRelatif: string): string {
  return readFileSync(join(RACINE, 'public', cheminRelatif), 'utf8');
}

describe('Universal Links / App Links (L3bis, P3bis.2) : valeurs provisoires encore présentes', () => {
  it.failing('apple-app-site-association ne porte plus de marqueur provisoire', () => {
    const contenu = lireFichierPublic('.well-known/apple-app-site-association');
    expect(contenu).not.toContain(MARQUEUR);
  });

  it.failing('assetlinks.json ne porte plus de marqueur provisoire', () => {
    const contenu = lireFichierPublic('.well-known/assetlinks.json');
    expect(contenu).not.toContain(MARQUEUR);
  });
});
