import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

// "Masquer le mot de passe" (docs/ecrans/L1-02-creation-compte.md). Ajout hors dossier de
// design, voir docs/design-system.md §5 : L1-02 n'a aucune maquette de référence.
export function OeilBarre(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M3.5 3.5l17 17" />
      <Path d="M10.6 6.3C11 6.2 11.5 6 12 6c6.5 0 10 7 10 7-.6 1.2-1.7 2.9-3.3 4.3M6.8 7.7C4.4 9.3 2 12 2 12s3.5 7 10 7c1.4 0 2.6-.3 3.7-.8" />
      <Path d="M9.9 10.1a3 3 0 0 0 4.2 4.2" />
    </IconeBase>
  );
}
