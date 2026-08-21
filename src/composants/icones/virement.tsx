import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Virement(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
    </IconeBase>
  );
}
