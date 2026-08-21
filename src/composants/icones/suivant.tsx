import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Suivant(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="m9 6 6 6-6 6" />
    </IconeBase>
  );
}
