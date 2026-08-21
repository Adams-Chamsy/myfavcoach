import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Modifier(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M4 20h4L20 8l-4-4L4 16z" />
    </IconeBase>
  );
}
