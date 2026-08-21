import { Path, Rect } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Securite(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Rect x="5" y="10" width="14" height="10" rx="2.5" />
      <Path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </IconeBase>
  );
}
