import { Path, Circle } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Recherche(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Circle cx="11" cy="11" r="7" />
      <Path d="m16.5 16.5 4 4" />
    </IconeBase>
  );
}
