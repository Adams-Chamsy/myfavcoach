import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Lecture(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M6 4.5v15l13-7.5z" />
    </IconeBase>
  );
}
