/** Madruga DS — espaço (base 4), raio, alvo de toque e durações de movimento. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const touchTarget = { min: 44 } as const;

export const duration = {
  micro: 120,
  screen: 240,
  score: 800,
} as const;
