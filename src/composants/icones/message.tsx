import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Message(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
    </IconeBase>
  );
}
