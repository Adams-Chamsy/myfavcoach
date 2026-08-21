import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Deplier(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="m6 9 6 6 6-6" />
    </IconeBase>
  );
}
