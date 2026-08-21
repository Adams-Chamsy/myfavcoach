import { Path, Rect } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Carte(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Rect x="2.5" y="6" width="19" height="13" rx="3" />
      <Path d="M2.5 10.5h19M17 15h2" />
    </IconeBase>
  );
}
