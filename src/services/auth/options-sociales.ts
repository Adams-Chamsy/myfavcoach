import { Platform } from 'react-native';

const apple = Platform.OS === 'ios' && process.env.EXPO_PUBLIC_CONNEXION_APPLE === '1';
const google =
  (Platform.OS === 'android' || apple) && process.env.EXPO_PUBLIC_CONNEXION_GOOGLE === '1';

export const optionsSociales = { google, apple };
