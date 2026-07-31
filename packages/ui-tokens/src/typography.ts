/**
 * Madruga DS — tipografia.
 * Display: Archivo (títulos e score) · Texto: Inter · Mono: JetBrains Mono
 * (seriais, códigos de certificado). Os nomes referenciam as fontes carregadas
 * via expo-font no app; fallback de sistema até as fontes serem embarcadas.
 */
export const fontFamily = {
  display: 'Archivo_700Bold',
  displayHeavy: 'Archivo_800ExtraBold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

export const textStyles = {
  displayXl: { fontFamily: fontFamily.displayHeavy, fontSize: 34, lineHeight: 40 },
  titleLg: { fontFamily: fontFamily.display, fontSize: 24, lineHeight: 30 },
  title: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  monoSm: { fontFamily: fontFamily.mono, fontSize: 13, lineHeight: 18 },
} as const satisfies Record<string, TextStyleToken>;

export type TextVariant = keyof typeof textStyles;
