/**
 * Madruga DS — cores.
 * Dark-first: o app é escuro por padrão; light mode espelha os mesmos papéis.
 * As cores de risco são RESERVADAS para semântica de autenticidade — nunca
 * reutilizar em promoções, badges genéricos etc.
 */
export const palette = {
  // núcleo dark
  ink950: '#0A0A0B',
  ink900: '#131316',
  ink800: '#1C1C21',
  ink700: '#26262C',
  ink500: '#63636E',
  ink300: '#A0A0AB',
  ink100: '#F5F5F6',

  // núcleo light
  paper0: '#FFFFFF',
  paper50: '#F6F6F7',
  paper100: '#ECECEE',
  paper200: '#DDDDE1',

  // marca
  lime: '#C8F04A',
  limePressed: '#B2D93E',

  // semântica
  green: '#34C77B',
  amber: '#F5B942',
  red: '#F0564A',
  gray: '#8E8E99',
  blue: '#5AA7F0',
} as const;

export interface ThemeColors {
  bg: { base: string; raised: string; overlay: string };
  border: { subtle: string; strong: string };
  text: { primary: string; secondary: string; tertiary: string; onBrand: string };
  brand: { primary: string; primaryPressed: string };
  risk: { low: string; medium: string; high: string; inconclusive: string };
  feedback: { success: string; warning: string; danger: string; info: string };
}

export const darkColors: ThemeColors = {
  bg: { base: palette.ink950, raised: palette.ink900, overlay: palette.ink800 },
  border: { subtle: palette.ink700, strong: palette.ink500 },
  text: {
    primary: palette.ink100,
    secondary: palette.ink300,
    tertiary: palette.ink500,
    onBrand: palette.ink950,
  },
  brand: { primary: palette.lime, primaryPressed: palette.limePressed },
  risk: {
    low: palette.green,
    medium: palette.amber,
    high: palette.red,
    inconclusive: palette.gray,
  },
  feedback: {
    success: palette.green,
    warning: palette.amber,
    danger: palette.red,
    info: palette.blue,
  },
};

export const lightColors: ThemeColors = {
  bg: { base: palette.paper0, raised: palette.paper50, overlay: palette.paper100 },
  border: { subtle: palette.paper200, strong: palette.ink300 },
  text: {
    primary: palette.ink950,
    secondary: palette.ink500,
    tertiary: palette.ink300,
    onBrand: palette.ink950,
  },
  brand: { primary: palette.lime, primaryPressed: palette.limePressed },
  risk: {
    low: palette.green,
    medium: palette.amber,
    high: palette.red,
    inconclusive: palette.gray,
  },
  feedback: {
    success: palette.green,
    warning: palette.amber,
    danger: palette.red,
    info: palette.blue,
  },
};
