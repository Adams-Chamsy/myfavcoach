import { Circle, Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

// "Afficher le mot de passe" (docs/ecrans/L1-02-creation-compte.md). Ajout hors dossier de
// design, voir docs/design-system.md §5 : L1-02 n'a aucune maquette de référence.
export function Oeil(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <Circle cx="12" cy="12" r="3" />
    </IconeBase>
  );
}
