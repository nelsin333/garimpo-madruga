import Ionicons from '@expo/vector-icons/Ionicons';
import { AUTHENTICITY_LABELS } from '@garimpo/contracts';
import { Button, EmptyState, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchMyReferenceItems } from '@/features/reference/api';

export default function ExpertHome() {
  const theme = useTheme();
  const { session } = useAuth();

  const { data: items, isPending } = useQuery({
    queryKey: ['my-references', session?.user.id],
    enabled: !!session,
    queryFn: () => fetchMyReferenceItems(session!.user.id),
  });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={theme.space.md}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="titleLg">Modo especialista</Text>
          <Text variant="caption" color="secondary">
            Catalogação do banco de referências
          </Text>
        </View>
      </View>

      <Button title="＋ Catalogar nova peça" onPress={() => router.push('/expert/new')} />

      <Text variant="title">Suas peças recentes</Text>
      {isPending ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : !items || items.length === 0 ? (
        <EmptyState
          title="Nenhuma peça catalogada"
          description="Cada peça fotografada torna o motor mais preciso."
        />
      ) : (
        <View style={{ gap: theme.space.md }}>
          {items.map((item) => (
            <PressableCard
              key={item.id}
              onPress={() => router.push({ pathname: '/expert/[id]', params: { id: item.id } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}
            >
              <Ionicons
                name={item.authenticity === 'authentic' ? 'shield-checkmark' : 'skull-outline'}
                size={20}
                color={
                  item.authenticity === 'authentic' ? theme.colors.risk.low : theme.colors.risk.high
                }
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyMedium">
                  {[item.brands?.name, item.categories?.name].filter(Boolean).join(' · ')}
                  {item.sku ? ` · ${item.sku}` : ''}
                </Text>
                <Text variant="caption" color="secondary">
                  {AUTHENTICITY_LABELS[item.authenticity]}
                  {item.replica_batch ? ` (${item.replica_batch})` : ''} · {item.photoCount} fotos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
            </PressableCard>
          ))}
        </View>
      )}
    </Screen>
  );
}
