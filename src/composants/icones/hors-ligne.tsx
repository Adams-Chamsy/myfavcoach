import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function HorsLigne(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M3 5l18 14M5.5 12.5a9 9 0 0 1 4-2.3M2.5 8.8a14 14 0 0 1 5-3M9 16.2a4.5 4.5 0 0 1 6 0M12 20h.01" />
    </IconeBase>
  );
}
