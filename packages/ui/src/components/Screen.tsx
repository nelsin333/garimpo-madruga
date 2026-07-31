import type { PropsWithChildren } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export interface ScreenProps extends PropsWithChildren {
  /** Rola o conteúdo (default). Desligar em telas com FlatList própria. */
  scroll?: boolean;
  style?: ViewStyle;
}

/** Wrapper de tela: fundo do tema + safe area + padding padrão. */
export function Screen({ scroll = true, style, children }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const base: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.bg.base,
  };
  const padding: ViewStyle = {
    paddingTop: insets.top + theme.space.lg,
    paddingBottom: insets.bottom + theme.space.lg,
    paddingHorizontal: theme.space.xl,
    gap: theme.space.xl,
  };

  if (!scroll) {
    return <View style={[base, padding, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={base}
      contentContainerStyle={[padding, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
