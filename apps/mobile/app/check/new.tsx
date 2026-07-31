import Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState, Screen, Text, useTheme } from '@garimpo/ui';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

/**
 * Ponto de entrada do fluxo de legit check.
 * Sprint 2 substitui este placeholder pelo fluxo completo:
 * categoria → marca → câmera guiada → envio → laudo.
 */
export default function NewCheck() {
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          hitSlop={theme.space.md}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text variant="titleLg">Legit Check</Text>
      </View>

      <EmptyState
        title="Quase lá"
        description="O fluxo de verificação — categoria, fotos guiadas e laudo — chega no próximo sprint."
        action={{ title: 'Voltar ao início', onPress: () => router.back() }}
      />
    </Screen>
  );
}
