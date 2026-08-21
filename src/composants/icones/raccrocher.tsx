import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Raccrocher(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M3 9a16 16 0 0 1 18 0v3.5l-4.5.8-1.2-2.6a12 12 0 0 0-6.6 0l-1.2 2.6L3 12.5z" />
    </IconeBase>
  );
}
