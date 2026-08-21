import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Reessayer(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />
    </IconeBase>
  );
}
