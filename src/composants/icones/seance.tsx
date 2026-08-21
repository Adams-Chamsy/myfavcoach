import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Seance(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M3 12h3l3-7 4 14 3-7h4" />
    </IconeBase>
  );
}
