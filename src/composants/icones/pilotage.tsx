import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Pilotage(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M4 20V9M10 20V4M16 20v-7M22 20H2" />
    </IconeBase>
  );
}
