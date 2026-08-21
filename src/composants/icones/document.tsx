import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Document(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M6 3h8l4 4v14H6z" />
      <Path d="M14 3v4h4M9 13h6M9 17h4" />
    </IconeBase>
  );
}
