import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Accueil(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
    </IconeBase>
  );
}
