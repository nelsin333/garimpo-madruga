import { ActivityIndicator, Pressable, type PressableProps, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const height = size === 'lg' ? 52 : theme.touchTarget.min;

  const backgrounds: Record<string, (pressed: boolean) => string> = {
    primary: (p) => (p ? theme.colors.brand.primaryPressed : theme.colors.brand.primary),
    secondary: (p) => (p ? theme.colors.bg.overlay : theme.colors.bg.raised),
    ghost: (p) => (p ? theme.colors.bg.raised : 'transparent'),
    danger: () => theme.colors.feedback.danger,
  };

  const textColor =
    variant === 'primary'
      ? theme.colors.text.onBrand
      : variant === 'danger'
        ? '#FFFFFF'
        : theme.colors.text.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        {
          height,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.space['2xl'],
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          backgroundColor: backgrounds[variant]!(pressed),
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: theme.colors.border.subtle,
          opacity: isDisabled && !loading ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text variant="bodyMedium" style={{ color: textColor }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
