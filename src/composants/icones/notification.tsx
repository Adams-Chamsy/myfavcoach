import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Notification(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5M10 19a2 2 0 0 0 4 0" />
    </IconeBase>
  );
}
