import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Reordonner(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M4 8h16M4 16h16" />
    </IconeBase>
  );
}
