import Ionicons from '@expo/vector-icons/Ionicons';
import { formatPriceBRL } from '@garimpo/contracts';
import { Card, EmptyState, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFavorites, fetchNotifications, markNotificationsRead } from '@/features/listing/api';
import { ListingCard } from '@/features/listing/components/ListingCard';

export default function SavedScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites, isPending } = useQuery({
    queryKey: ['favorites', session?.user.id],
    enabled: !!session,
    queryFn: () => fetchFavorites(session!.user.id),
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', session?.user.id],
    enabled: !!session,
    queryFn: () => fetchNotifications(session!.user.id),
  });

  // Ao abrir a aba, marca os alertas como lidos.
  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      void markNotificationsRead(session.user.id).then(() =>
        queryClient.invalidateQueries({ queryKey: ['notifications', session.user.id] }),
      );
    }, [session, queryClient]),
  );

  const priceAlerts = (notifications ?? []).filter((item) => item.kind === 'price_change');

  return (
    <Screen>
      <Text variant="titleLg">Salvos</Text>

      {priceAlerts.length > 0 ? (
        <View style={{ gap: theme.space.md }}>
          <Text variant="caption" color="tertiary">
            ALERTAS DE PREÇO
          </Text>
          {priceAlerts.slice(0, 5).map((alert) => {
            const oldPrice = alert.payload.old_price_cents;
            const newPrice = alert.payload.new_price_cents;
            const dropped = oldPrice != null && newPrice != null && newPrice < oldPrice;
            return (
              <Card
                key={alert.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}
              >
                <Ionicons
                  name={dropped ? 'trending-down' : 'trending-up'}
                  size={20}
                  color={dropped ? theme.colors.risk.low : theme.colors.feedback.warning}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {alert.payload.title ?? 'Anúncio salvo'}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {oldPrice != null ? formatPriceBRL(oldPrice) : '—'} →{' '}
                    {newPrice != null ? formatPriceBRL(newPrice) : '—'}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      {isPending ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : !favorites || favorites.length === 0 ? (
        <EmptyState
          title="Nada salvo ainda"
          description="Toque no coração de um anúncio para acompanhá-lo e receber alerta quando o preço mudar."
          action={{ title: 'Explorar marketplace', onPress: () => router.push('/(tabs)/market') }}
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md }}>
          {favorites.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
