// Checkout: endereço → frete → resumo → pedido.
//
// Nenhum valor daqui vira preço: o resumo é calculado com a mesma aritmética
// do servidor (centavos inteiros) só para exibir, e o pedido é criado pela
// Edge Function, que recalcula tudo a partir do anúncio e da cotação.
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatPriceBRL, orderErrorMessage } from '@garimpo/contracts';
import { Button, Card, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchListingDetail, listingPhotoUrl } from '@/features/listing/api';
import {
  OrderApiError,
  createOrder,
  fetchAddresses,
  quoteShipping,
  type Address,
  type ShippingQuote,
} from '@/features/order/api';

/** Taxa de serviço do comprador — espelha BUYER_FEE_CENTS no servidor. */
const BUYER_FEE_CENTS = 990;

export default function CheckoutScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Uma chave por abertura do checkout: tocar duas vezes em "Confirmar" não
  // cria dois pedidos, porque o servidor devolve o mesmo pedido da chave.
  const idempotencyKey = useRef(`${listingId}:${Date.now()}`).current;

  const { data: listing } = useQuery({
    queryKey: ['listing', listingId, session?.user.id],
    queryFn: () => fetchListingDetail(listingId, session?.user.id ?? null),
  });

  const { data: addresses } = useQuery({
    queryKey: ['addresses', session?.user.id],
    queryFn: () => fetchAddresses(session!.user.id),
    enabled: Boolean(session),
  });

  const quotes = useMutation({
    mutationFn: (id: string) => quoteShipping(listingId, id),
    onError: (mutationError) => setError(orderErrorMessage((mutationError as OrderApiError).code)),
  });

  const confirm = useMutation({
    mutationFn: () =>
      createOrder({
        listingId,
        addressId: addressId!,
        quoteId: quote?.id,
        idempotencyKey,
      }),
    onSuccess: (order) => router.replace(`/order/${order.id}/payment`),
    onError: (mutationError) => setError(orderErrorMessage((mutationError as OrderApiError).code)),
  });

  const amounts = useMemo(() => {
    const itemCents = listing?.price_cents ?? 0;
    const shippingCents = quote?.price_cents ?? 0;
    return {
      itemCents,
      shippingCents,
      buyerFeeCents: BUYER_FEE_CENTS,
      totalCents: itemCents + shippingCents + BUYER_FEE_CENTS,
    };
  }, [listing?.price_cents, quote?.price_cents]);

  if (!listing) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }

  const selectAddress = (address: Address) => {
    setAddressId(address.id);
    setQuote(null);
    setError(null);
    quotes.mutate(address.id);
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={theme.space.md}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/market'))}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text variant="titleLg">Finalizar compra</Text>
      </View>

      <Card style={{ flexDirection: 'row', gap: theme.space.lg, alignItems: 'center' }}>
        {listing.photos[0] ? (
          <Image
            source={{ uri: listingPhotoUrl(listing.photos[0].storage_path) }}
            style={{ width: 64, height: 64, borderRadius: theme.radius.sm }}
            contentFit="cover"
          />
        ) : null}
        <View style={{ flex: 1, gap: theme.space.xs }}>
          <Text variant="bodyMedium" numberOfLines={2}>
            {listing.title}
          </Text>
          <Text variant="caption" color="secondary">
            {formatPriceBRL(listing.price_cents ?? 0)}
          </Text>
        </View>
      </Card>

      <View style={{ gap: theme.space.md }}>
        <Text variant="title">Entrega</Text>
        {(addresses ?? []).map((address) => (
          <PressableCard
            key={address.id}
            onPress={() => selectAddress(address)}
            style={{
              borderColor:
                addressId === address.id ? theme.colors.brand.primary : theme.colors.border.subtle,
              borderWidth: 1,
            }}
          >
            <Text variant="bodyMedium">{address.recipient_name}</Text>
            <Text variant="caption" color="secondary">
              {address.street}, {address.number}
              {address.complement ? ` — ${address.complement}` : ''}
            </Text>
            <Text variant="caption" color="secondary">
              {address.district}, {address.city}/{address.state} · CEP {address.zip_code}
            </Text>
          </PressableCard>
        ))}
        <Button
          title="Adicionar endereço"
          variant="secondary"
          size="md"
          onPress={() => router.push('/address/new')}
        />
      </View>

      {addressId ? (
        <View style={{ gap: theme.space.md }}>
          <Text variant="title">Frete</Text>
          {quotes.isPending ? (
            <ActivityIndicator color={theme.colors.brand.primary} />
          ) : (
            (quotes.data ?? []).map((option) => (
              <PressableCard
                key={option.id}
                onPress={() => setQuote(option)}
                style={{
                  borderColor:
                    quote?.id === option.id
                      ? theme.colors.brand.primary
                      : theme.colors.border.subtle,
                  borderWidth: 1,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodyMedium">
                    {option.carrier} · {option.service_name}
                  </Text>
                  <Text variant="bodyMedium">{formatPriceBRL(option.price_cents)}</Text>
                </View>
                {option.estimated_days ? (
                  <Text variant="caption" color="secondary">
                    Entrega em até {option.estimated_days} dias úteis
                  </Text>
                ) : null}
              </PressableCard>
            ))
          )}
        </View>
      ) : null}

      <Card style={{ gap: theme.space.sm }}>
        <Text variant="title">Resumo</Text>
        <SummaryRow label="Peça" value={formatPriceBRL(amounts.itemCents)} />
        <SummaryRow
          label="Frete"
          value={quote ? formatPriceBRL(amounts.shippingCents) : 'A calcular'}
        />
        <SummaryRow
          label="Taxa de serviço"
          value={formatPriceBRL(amounts.buyerFeeCents)}
          hint="Cobre a Garantia Garimpo: o valor só vai ao vendedor depois que você receber."
        />
        <View
          style={{
            height: 1,
            backgroundColor: theme.colors.border.subtle,
            marginVertical: theme.space.sm,
          }}
        />
        <SummaryRow label="Total" value={formatPriceBRL(amounts.totalCents)} emphasis />
      </Card>

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <Button
        title="Confirmar e pagar"
        loading={confirm.isPending}
        disabled={!addressId || !quote}
        onPress={() => {
          setError(null);
          confirm.mutate();
        }}
      />
      <Text variant="caption" color="tertiary">
        O pagamento fica retido até a confirmação de entrega. Em caso de problema, você pode abrir
        uma disputa pelo pedido.
      </Text>
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant={emphasis ? 'title' : 'body'} color={emphasis ? 'primary' : 'secondary'}>
          {label}
        </Text>
        <Text variant={emphasis ? 'title' : 'bodyMedium'}>{value}</Text>
      </View>
      {hint ? (
        <Text variant="caption" color="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
