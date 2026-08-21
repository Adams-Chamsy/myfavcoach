import { Path, Circle } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Profil(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Circle cx="12" cy="8.5" r="3.6" />
      <Path d="M4.5 20c1.6-3.6 4.2-5.4 7.5-5.4s5.9 1.8 7.5 5.4" />
    </IconeBase>
  );
}
