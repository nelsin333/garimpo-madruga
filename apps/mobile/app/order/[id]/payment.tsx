// Pagamento do pedido: escolha do método e, no Pix, QR + copia-e-cola.
//
// A tela nunca decide que o pedido foi pago. Ela observa o pedido (Realtime)
// e o estado muda quando o webhook confirma com o provedor.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  PAYMENT_METHOD_LABELS,
  formatPriceBRL,
  orderErrorMessage,
  type PaymentMethod,
} from '@garimpo/contracts';
import { Button, Card, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  OrderApiError,
  createPayment,
  fetchOrderDetail,
  type PaymentCheckout,
} from '@/features/order/api';
import { supabase } from '@/lib/supabase';

const METHODS: PaymentMethod[] = ['pix', 'credit_card'];

export default function PaymentScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [checkout, setCheckout] = useState<PaymentCheckout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: order } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrderDetail(id),
  });

  // O pedido vira 'paid' pelo webhook: escutamos a linha em vez de perguntar
  // ao provedor pelo app.
  useEffect(() => {
    const channel = supabase
      .channel(`order:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => void queryClient.invalidateQueries({ queryKey: ['order', id] }),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [id, queryClient]);

  useEffect(() => {
    if (order?.status === 'paid' || order?.status === 'preparing_shipment') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/order/${id}`);
    }
  }, [order?.status, id]);

  const pay = useMutation({
    mutationFn: () => createPayment(id, method),
    onSuccess: (payment) => setCheckout(payment),
    onError: (mutationError) => setError(orderErrorMessage((mutationError as OrderApiError).code)),
  });

  if (!order) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }

  const pixCode = checkout?.checkout?.qrCode;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={theme.space.md}
          onPress={() => router.replace(`/order/${id}`)}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text variant="titleLg">Pagamento</Text>
      </View>

      <Card style={{ gap: theme.space.xs }}>
        <Text variant="caption" color="secondary">
          Total do pedido
        </Text>
        <Text variant="displayXl">{formatPriceBRL(order.total_cents)}</Text>
        <Text variant="caption" color="tertiary" numberOfLines={2}>
          {order.listing.title}
        </Text>
      </Card>

      {!pixCode ? (
        <View style={{ gap: theme.space.md }}>
          <Text variant="title">Como você quer pagar?</Text>
          {METHODS.map((option) => (
            <PressableCard
              key={option}
              onPress={() => setMethod(option)}
              style={{
                borderWidth: 1,
                borderColor:
                  method === option ? theme.colors.brand.primary : theme.colors.border.subtle,
              }}
            >
              <Text variant="bodyMedium">{PAYMENT_METHOD_LABELS[option]}</Text>
              {option === 'pix' ? (
                <Text variant="caption" color="secondary">
                  Aprovação em segundos.
                </Text>
              ) : null}
            </PressableCard>
          ))}
        </View>
      ) : null}

      {pixCode ? (
        <Card style={{ gap: theme.space.lg, alignItems: 'center' }}>
          <Text variant="title">Pague com Pix</Text>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              padding: theme.space.lg,
              borderRadius: theme.radius.md,
            }}
          >
            <QRCode value={pixCode} size={200} />
          </View>
          <Button
            title={copied ? 'Código copiado' : 'Copiar código Pix'}
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(pixCode);
              setCopied(true);
              void Haptics.selectionAsync();
            }}
            style={{ alignSelf: 'stretch' }}
          />
          <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
            Assim que o pagamento for confirmado, esta tela avança sozinha. Não feche o app antes de
            concluir no banco.
          </Text>
        </Card>
      ) : null}

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      {!pixCode ? (
        <Button
          title="Gerar pagamento"
          loading={pay.isPending}
          onPress={() => {
            setError(null);
            pay.mutate();
          }}
        />
      ) : null}
    </Screen>
  );
}
