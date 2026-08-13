// Detalhe do pedido, mesma tela para comprador e vendedor — o papel decide
// as ações disponíveis. Nenhuma ação muda o estado localmente: cada botão
// chama a Edge Function correspondente e a tela recarrega do banco.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  DISPUTE_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
  formatPriceBRL,
  orderErrorMessage,
  type DisputeStatus,
} from '@garimpo/contracts';
import { Button, Card, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { listingPhotoUrl } from '@/features/listing/api';
import {
  OrderApiError,
  confirmDelivery,
  createShipment,
  fetchOrderDetail,
} from '@/features/order/api';
import { openConversation } from '@/features/order/chat';
import { OrderStatusBadge } from '@/features/order/components/OrderStatusBadge';
import { OrderTimeline } from '@/features/order/components/OrderTimeline';
import { supabase } from '@/lib/supabase';

export default function OrderDetailScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  const { data: order, isPending } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrderDetail(id),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`order-detail:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => void queryClient.invalidateQueries({ queryKey: ['order', id] }),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [id, queryClient]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['order', id] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  };
  const onActionError = (mutationError: unknown) =>
    setError(orderErrorMessage((mutationError as OrderApiError).code));

  const ship = useMutation({
    mutationFn: () => createShipment(id),
    onSuccess: invalidate,
    onError: onActionError,
  });
  const confirm = useMutation({
    mutationFn: () => confirmDelivery(id),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
    },
    onError: onActionError,
  });
  const chat = useMutation({
    mutationFn: () =>
      openConversation({
        listingId: order!.listing_id,
        buyerId: order!.buyer_id,
        sellerId: order!.seller_id,
        orderId: order!.id,
      }),
    onSuccess: (conversation) => router.push(`/chat/${conversation.id}`),
  });

  if (isPending || !order) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }

  const isBuyer = session?.user.id === order.buyer_id;
  const address = order.shipping_address as unknown as {
    recipient_name: string;
    street: string;
    number: string;
    complement: string | null;
    district: string;
    city: string;
    state: string;
    zip_code: string;
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={theme.space.md}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text variant="titleLg">{isBuyer ? 'Minha compra' : 'Minha venda'}</Text>
      </View>

      <Card style={{ gap: theme.space.md }}>
        <View style={{ flexDirection: 'row', gap: theme.space.lg, alignItems: 'center' }}>
          {order.listing.photo ? (
            <Image
              source={{ uri: listingPhotoUrl(order.listing.photo) }}
              style={{ width: 64, height: 64, borderRadius: theme.radius.sm }}
              contentFit="cover"
            />
          ) : null}
          <View style={{ flex: 1, gap: theme.space.xs }}>
            <Text variant="bodyMedium" numberOfLines={2}>
              {order.listing.title}
            </Text>
            <OrderStatusBadge status={order.status} />
          </View>
        </View>
      </Card>

      <Card style={{ gap: theme.space.lg }}>
        <Text variant="title">Andamento</Text>
        <OrderTimeline status={order.status} />
        {order.escrow_release_at && order.status === 'delivered' ? (
          <Text variant="caption" color="tertiary">
            {isBuyer
              ? 'Confirme o recebimento para liberar o pagamento ao vendedor. Sem ação, liberamos automaticamente após o prazo.'
              : 'O valor é liberado após a confirmação do comprador ou o fim do prazo de custódia.'}
          </Text>
        ) : null}
      </Card>

      {order.shipment ? (
        <Card style={{ gap: theme.space.sm }}>
          <Text variant="title">Envio</Text>
          <Text variant="body" color="secondary">
            {SHIPMENT_STATUS_LABELS[order.shipment.status]}
            {order.shipment.service_name ? ` · ${order.shipment.service_name}` : ''}
          </Text>
          {order.shipment.tracking_code ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copiar código de rastreio"
              onPress={async () => {
                await Clipboard.setStringAsync(order.shipment!.tracking_code!);
                void Haptics.selectionAsync();
              }}
            >
              <Text variant="monoSm" color="brand">
                {order.shipment.tracking_code}
              </Text>
            </Pressable>
          ) : null}
          {!isBuyer && order.shipment.label_url ? (
            <Button
              title="Abrir etiqueta"
              variant="secondary"
              size="md"
              onPress={() => void WebBrowser.openBrowserAsync(order.shipment!.label_url!)}
            />
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: theme.space.sm }}>
        <Text variant="title">Entrega</Text>
        <Text variant="body" color="secondary">
          {address.recipient_name}
        </Text>
        <Text variant="caption" color="secondary">
          {address.street}, {address.number}
          {address.complement ? ` — ${address.complement}` : ''} · {address.district}
        </Text>
        <Text variant="caption" color="secondary">
          {address.city}/{address.state} · CEP {address.zip_code}
        </Text>
      </Card>

      <Card style={{ gap: theme.space.sm }}>
        <Text variant="title">Valores</Text>
        <Row label="Peça" value={formatPriceBRL(order.item_cents)} />
        <Row label="Frete" value={formatPriceBRL(order.shipping_cents)} />
        {isBuyer ? (
          <Row label="Taxa de serviço" value={formatPriceBRL(order.buyer_fee_cents)} />
        ) : (
          <Row label="Taxa da plataforma" value={`- ${formatPriceBRL(order.platform_fee_cents)}`} />
        )}
        <Row
          label={isBuyer ? 'Total pago' : 'Você recebe'}
          value={formatPriceBRL(isBuyer ? order.total_cents : order.seller_amount_cents)}
          emphasis
        />
      </Card>

      {order.dispute ? (
        <Card
          style={{ gap: theme.space.xs, borderColor: theme.colors.feedback.danger, borderWidth: 1 }}
        >
          <Text variant="title">Disputa aberta</Text>
          <Text variant="caption" color="secondary">
            {DISPUTE_STATUS_LABELS[order.dispute.status as DisputeStatus]}
          </Text>
        </Card>
      ) : null}

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <View style={{ gap: theme.space.md }}>
        {isBuyer && (order.status === 'pending_payment' || order.status === 'payment_failed') ? (
          <Button title="Pagar agora" onPress={() => router.push(`/order/${id}/payment`)} />
        ) : null}

        {!isBuyer && (order.status === 'paid' || order.status === 'preparing_shipment') ? (
          <Button
            title={order.shipment?.label_url ? 'Etiqueta emitida' : 'Gerar etiqueta de envio'}
            loading={ship.isPending}
            disabled={Boolean(order.shipment?.label_url)}
            onPress={() => {
              setError(null);
              ship.mutate();
            }}
          />
        ) : null}

        {isBuyer && (order.status === 'shipped' || order.status === 'delivered') ? (
          <Button
            title="Confirmar recebimento"
            loading={confirm.isPending}
            onPress={() => {
              setError(null);
              confirm.mutate();
            }}
          />
        ) : null}

        <Button
          title="Falar com o outro lado"
          variant="secondary"
          loading={chat.isPending}
          onPress={() => chat.mutate()}
        />

        {!order.dispute &&
        ['paid', 'preparing_shipment', 'shipped', 'delivered'].includes(order.status) ? (
          <Button
            title="Abrir disputa"
            variant="ghost"
            onPress={() => router.push(`/order/${id}/dispute`)}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant={emphasis ? 'title' : 'body'} color={emphasis ? 'primary' : 'secondary'}>
        {label}
      </Text>
      <Text variant={emphasis ? 'title' : 'bodyMedium'}>{value}</Text>
    </View>
  );
}
