import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { useTheme } from '../theme';

export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: theme.colors.bg.raised,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
          padding: theme.space.lg,
        },
        style,
      ]}
    />
  );
}

export interface PressableCardProps extends Omit<PressableProps, 'style'> {
  style?: ViewProps['style'];
}

export function PressableCard({ style, ...rest }: PressableCardProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? theme.colors.bg.overlay : theme.colors.bg.raised,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
          padding: theme.space.lg,
        },
        style,
      ]}
    />
  );
}
