import { Path, Rect } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Visio(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Rect x="2.5" y="6" width="13" height="12" rx="3" />
      <Path d="m15.5 12 6-3.5v7z" />
    </IconeBase>
  );
}
