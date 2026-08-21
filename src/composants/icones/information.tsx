import { Path, Circle } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Information(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 11v5M12 8h.01" />
    </IconeBase>
  );
}
