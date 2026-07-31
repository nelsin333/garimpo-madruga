import type { TextVariant } from '@garimpo/ui-tokens';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../theme';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: 'primary' | 'secondary' | 'tertiary' | 'brand' | 'danger';
}

export function Text({ variant = 'body', color = 'primary', style, ...rest }: TextProps) {
  const theme = useTheme();
  const colorValue = {
    primary: theme.colors.text.primary,
    secondary: theme.colors.text.secondary,
    tertiary: theme.colors.text.tertiary,
    brand: theme.colors.brand.primary,
    danger: theme.colors.feedback.danger,
  }[color];

  return <RNText {...rest} style={[theme.textStyles[variant], { color: colorValue }, style]} />;
}
