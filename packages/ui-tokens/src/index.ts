export * from './colors';
export * from './layout';
export * from './typography';

import { darkColors, lightColors, type ThemeColors } from './colors';
import { duration, radius, space, touchTarget } from './layout';
import { fontFamily, textStyles } from './typography';

export interface Theme {
  scheme: 'dark' | 'light';
  colors: ThemeColors;
  space: typeof space;
  radius: typeof radius;
  touchTarget: typeof touchTarget;
  duration: typeof duration;
  fontFamily: typeof fontFamily;
  textStyles: typeof textStyles;
}

export const darkTheme: Theme = {
  scheme: 'dark',
  colors: darkColors,
  space,
  radius,
  touchTarget,
  duration,
  fontFamily,
  textStyles,
};

export const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  space,
  radius,
  touchTarget,
  duration,
  fontFamily,
  textStyles,
};
