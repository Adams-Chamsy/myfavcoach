import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Favori(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Path d="M12 20s-7-4.6-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7 2.6C19 15.4 12 20 12 20z" />
    </IconeBase>
  );
}
