import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Pause(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M8 5v14M16 5v14" />
    </IconeBase>
  );
}
