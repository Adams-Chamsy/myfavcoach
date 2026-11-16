import type { ReactElement } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

/** Symbole existant, transcrit en SVG natif pour le web, iOS et Android. */
export function Marque({
  inverse = false,
  symboleSeul = false,
  surFondClair = false,
}: {
  inverse?: boolean;
  symboleSeul?: boolean;
  surFondClair?: boolean;
}) {
  const theme = useTheme();
  const couleur = inverse
    ? themes.clair.texte.surMarque
    : surFondClair
      ? themes.clair.marque.primaire
      : theme.couleur.marque.primaire;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.espace[2],
        minHeight: theme.taille.tapMin,
      }}
    >
      <SymboleMarque taille={theme.taille.logo} couleur={couleur} />
      {!symboleSeul ? (
        <Text style={{ ...theme.texte.marque, color: couleur }}>MyFavCoach</Text>
      ) : null}
    </View>
  );
}

export const traceRubanMarque =
  'M125.53,143.65L124.71,143.65L115.34,150.44L104.21,158.18L103.67,158.86L102.58,158.86L102.85,166.06L102.58,174.21L102.72,191.18L103.67,191.18L117.92,178.28L123.22,173.93L124.85,171.90L125.26,170.13Z M195.86,35.71L161.10,54.44L147.25,62.73L131.77,74.13L122.68,83.09L113.85,94.36L108.15,104.96L104.89,114.19L103.39,120.57L102.58,128.31L102.99,130.08L103.80,130.08L103.67,128.04L104.62,125.32L110.46,117.04L118.87,108.08L126.07,101.70L143.59,89.34L176.99,68.97L182.69,64.76L188.40,59.47L195.19,50.78L195.86,50.64Z';
export const traceCorpsMarque =
  'M50.17,113.10L50.17,141.62L50.44,143.52L51.93,146.91L54.38,149.49L86.69,178.14L87.51,178.14L87.51,146.91L87.24,145.01L86.29,142.70L84.79,140.67L52.20,114.05L50.98,113.10Z M154.72,95.86L153.77,95.86L133.67,109.17L107.06,128.04L103.12,131.30L102.85,132.25L102.85,158.18L103.67,158.18L149.56,125.05L152.41,122.07L153.91,119.35L154.72,116.36Z M6.58,156.69L32.24,178.01L32.65,84.32L75.83,117.72L108.15,84.45L121.05,72.91L154.72,50.23L137.21,51.46L117.11,57.97L100.27,67.62L74.61,87.03L22.60,44.12L15.00,41.41L7.94,43.31L5.49,45.89L4.14,50.10L4.00,149.77Z M161.51,8.96L158.66,8.68L154.45,8.96L151.46,9.91L148.61,11.40L146.71,12.89L143.99,15.75L142.64,18.05L141.55,20.63L140.87,23.76L140.74,26.20L141.01,29.05L142.36,33.13L144.13,35.98L145.90,37.88L148.07,39.51L151.73,41.14L155.81,41.82L158.25,41.68L161.51,41.00L165.18,39.37L168.57,36.93L170.34,34.89L171.83,32.45L172.92,29.73L173.60,26.61L173.73,24.16L172.92,19.55L171.97,17.10L169.79,13.98L167.21,11.54L164.36,9.91Z';

/** Tracés officiels réutilisés par la signature de lancement, sans redessiner la marque. */
export function SymboleMarque({
  taille,
  couleur,
  monochrome = false,
}: {
  taille: number;
  couleur: string;
  monochrome?: boolean;
}): ReactElement {
  return (
    <Svg
      width={taille}
      height={taille}
      viewBox="0 0 200 200"
      {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false })}
    >
      <Path
        d={traceRubanMarque}
        fill={monochrome ? couleur : themes.clair.marque.ruban}
        fillRule="evenodd"
      />
      <Path d={traceCorpsMarque} fill={couleur} fillRule="evenodd" />
    </Svg>
  );
}
