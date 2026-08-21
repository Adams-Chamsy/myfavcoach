import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Fermer(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M6 6l12 12M18 6 6 18" />
    </IconeBase>
  );
}
