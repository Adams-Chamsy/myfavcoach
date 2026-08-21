import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Filtres(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M4 7h16M7 12h10M10 17h4" />
    </IconeBase>
  );
}
