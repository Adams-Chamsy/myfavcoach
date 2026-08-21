import type { ProprietesIcone } from './icone-base';
import { icones, type NomIcone } from './index';

type ProprietesIconeGenerique = ProprietesIcone & {
  nom: NomIcone;
};

export function Icone({ nom, ...proprietes }: ProprietesIconeGenerique) {
  const ComposantIcone = icones[nom];
  return <ComposantIcone {...proprietes} />;
}
