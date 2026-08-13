// Compras e vendas do usuário.
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatPriceBRL } from '@garimpo/contracts';
import { Chip, EmptyState, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { listingPhotoUrl } from '@/features/listing/api';
import { fetchOrders } from '@/features/order/api';
import { OrderStatusBadge } from '@/features/order/components/OrderStatusBadge';

export default function OrdersScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [side, setSide] = useState<'buying' | 'selling'>('buying');

  const { data: orders, isPending } = useQuery({
    queryKey: ['orders', session?.user.id, side],
    queryFn: () => fetchOrders(session!.user.id, side),
    enabled: Boolean(session),
  });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={theme.space.md}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text variant="titleLg">Pedidos</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <Chip label="Comprando" selected={side === 'buying'} onPress={() => setSide('buying')} />
        <Chip label="Vendendo" selected={side === 'selling'} onPress={() => setSide('selling')} />
      </View>

      {isPending ? <ActivityIndicator color={theme.colors.brand.primary} /> : null}

      {!isPending && (orders ?? []).length === 0 ? (
        <EmptyState
          title={side === 'buying' ? 'Nenhuma compra ainda' : 'Nenhuma venda ainda'}
          description={
            side === 'buying'
              ? 'Suas compras aparecem aqui com pagamento, rastreio e garantia.'
              : 'Quando alguém comprar uma peça sua, o pedido aparece aqui.'
          }
          action={
            side === 'buying'
              ? { title: 'Explorar o marketplace', onPress: () => router.push('/(tabs)/market') }
              : { title: 'Ver meus anúncios', onPress: () => router.push('/(tabs)/profile') }
          }
        />
      ) : null}

      {(orders ?? []).map((order) => (
        <PressableCard key={order.id} onPress={() => router.push(`/order/${order.id}`)}>
          <View style={{ flexDirection: 'row', gap: theme.space.lg, alignItems: 'center' }}>
            {order.listing.photo ? (
              <Image
                source={{ uri: listingPhotoUrl(order.listing.photo) }}
                style={{ width: 56, height: 56, borderRadius: theme.radius.sm }}
                contentFit="cover"
              />
            ) : null}
            <View style={{ flex: 1, gap: theme.space.xs }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {order.listing.title}
              </Text>
              <Text variant="caption" color="secondary">
                {formatPriceBRL(order.total_cents)} ·{' '}
                {order.counterparty.display_name ?? `@${order.counterparty.username}`}
              </Text>
              <OrderStatusBadge status={order.status} />
            </View>
          </View>
        </PressableCard>
      ))}
    </Screen>
  );
}
