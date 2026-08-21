import { Circle } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Plus(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Circle cx="12" cy="5" r="2" />
      <Circle cx="12" cy="12" r="2" />
      <Circle cx="12" cy="19" r="2" />
    </IconeBase>
  );
}
