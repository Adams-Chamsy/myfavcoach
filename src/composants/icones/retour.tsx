import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Retour(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M14 6l-6 6 6 6" />
    </IconeBase>
  );
}
