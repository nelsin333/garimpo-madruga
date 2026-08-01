import { Pressable } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

/** Pill selecionável — filtros, ordenação e tags. */
export function Chip({ label, selected = false, onPress }: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.sm,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: selected ? theme.colors.brand.primary : theme.colors.border.subtle,
        backgroundColor: selected
          ? theme.colors.brand.primary
          : pressed
            ? theme.colors.bg.overlay
            : theme.colors.bg.raised,
      })}
    >
      <Text
        variant="caption"
        style={{ color: selected ? theme.colors.text.onBrand : theme.colors.text.secondary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
