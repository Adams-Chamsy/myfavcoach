import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Valide(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M20 6 9 17l-5-5" />
    </IconeBase>
  );
}
