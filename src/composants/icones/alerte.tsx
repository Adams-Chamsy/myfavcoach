import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Alerte(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M12 3 2 20h20L12 3zM12 9v5M12 17h.01" />
    </IconeBase>
  );
}
