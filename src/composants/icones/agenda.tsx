import { Path, Rect } from 'react-native-svg';

import { IconeBase, type ProprietesIcone } from './icone-base';

export function Agenda(proprietes: ProprietesIcone) {
  return (
    <IconeBase {...proprietes}>
      <Rect x="3" y="5" width="18" height="16" rx="3" />
      <Path d="M8 3v4M16 3v4M3 10h18" />
    </IconeBase>
  );
}
