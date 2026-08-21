import { Path, Rect } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Vocal(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Rect x="9" y="2.5" width="6" height="11" rx="3" />
      <Path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
    </IconeBase>
  );
}
