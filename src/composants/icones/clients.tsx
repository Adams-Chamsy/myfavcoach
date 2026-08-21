import { Path, Circle } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Clients(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Circle cx="9" cy="8.5" r="3.4" />
      <Path d="M2.5 20c1.3-3.3 3.6-5 6.5-5s5.2 1.7 6.5 5" />
      <Path d="M16.5 6.2a3.4 3.4 0 0 1 0 6.6M18 15.4c2 .8 3 2.2 3.5 4.6" />
    </IconeBase>
  );
}
