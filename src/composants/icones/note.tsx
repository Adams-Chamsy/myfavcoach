import { Path } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Note(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes} plein>
      <Path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" />
    </IconeBase>
  );
}
