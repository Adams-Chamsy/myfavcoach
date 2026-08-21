import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Ajouter(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M12 5v14M5 12h14" />
    </IconeBase>
  );
}
