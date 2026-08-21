import { Path, Circle } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Duree(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 8v4l3 2" />
    </IconeBase>
  );
}
