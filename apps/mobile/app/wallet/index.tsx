// Carteira do vendedor: saldo retido, saldo disponível, verificação de
// identidade e saques.
//
// O saldo é sempre o que está no banco — o app não soma nada. O saque é
// recusado pelo servidor sem KYC aprovado ou sem saldo, e a tela apenas
// reflete essa decisão.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  KYC_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  formatPriceBRL,
  orderErrorMessage,
} from '@garimpo/contracts';
import { Button, Card, EmptyState, Field, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  OrderApiError,
  fetchPayouts,
  fetchSellerAccount,
  requestPayout,
} from '@/features/order/api';

export default function WalletScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: account, isPending } = useQuery({
    queryKey: ['seller-account', session?.user.id],
    queryFn: () => fetchSellerAccount(session!.user.id),
    enabled: Boolean(session),
  });

  const { data: payouts } = useQuery({
    queryKey: ['payouts', session?.user.id],
    queryFn: () => fetchPayouts(session!.user.id),
    enabled: Boolean(session),
  });

  // "1.234,56" → 123456 centavos, sem passar por float.
  const amountCents = (() => {
    const digits = amount.replace(/\D/g, '');
    return digits ? Number(digits) : 0;
  })();

  const payout = useMutation({
    mutationFn: () => requestPayout(amountCents),
    onSuccess: () => {
      setAmount('');
      void queryClient.invalidateQueries({ queryKey: ['seller-account'] });
      void queryClient.invalidateQueries({ queryKey: ['payouts'] });
    },
    onError: (mutationError) => setError(orderErrorMessage((mutationError as OrderApiError).code)),
  });

  if (isPending) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }

  const kycApproved = account?.kyc_status === 'approved';
  const available = account?.available_balance_cents ?? 0;

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
        <Text variant="titleLg">Carteira</Text>
      </View>

      {!account ? (
        <EmptyState
          title="Você ainda não vendeu nada"
          description="A carteira aparece quando sua primeira venda for paga."
          action={{ title: 'Ver meus anúncios', onPress: () => router.push('/(tabs)/profile') }}
        />
      ) : (
        <>
          <Card style={{ gap: theme.space.sm }}>
            <Text variant="caption" color="secondary">
              Disponível para saque
            </Text>
            <Text variant="displayXl">{formatPriceBRL(available)}</Text>
            <Text variant="caption" color="tertiary">
              Em custódia: {formatPriceBRL(account.pending_balance_cents)} — liberado quando o
              comprador confirmar o recebimento.
            </Text>
          </Card>

          <Card style={{ gap: theme.space.sm }}>
            <Text variant="title">Verificação de identidade</Text>
            <Text variant="body" color="secondary">
              {KYC_STATUS_LABELS[account.kyc_status]}
            </Text>
            {account.kyc_rejection_reason ? (
              <Text variant="caption" color="danger">
                {account.kyc_rejection_reason}
              </Text>
            ) : null}
            {account.document_masked ? (
              <Text variant="monoSm" color="tertiary">
                {account.document_masked}
              </Text>
            ) : null}
            {account.payout_key_masked ? (
              <Text variant="caption" color="secondary">
                Chave de recebimento: {account.payout_key_masked}
              </Text>
            ) : null}
            {!kycApproved ? (
              <Text variant="caption" color="tertiary">
                O saque fica liberado assim que a verificação for aprovada.
              </Text>
            ) : null}
          </Card>

          <Card style={{ gap: theme.space.md }}>
            <Text variant="title">Sacar</Text>
            <Field
              label="Valor (R$)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="0,00"
            />
            {error ? (
              <Text variant="caption" color="danger">
                {error}
              </Text>
            ) : null}
            <Button
              title="Solicitar saque"
              loading={payout.isPending}
              disabled={!kycApproved || amountCents <= 0 || amountCents > available}
              onPress={() => {
                setError(null);
                payout.mutate();
              }}
            />
          </Card>

          <View style={{ gap: theme.space.md }}>
            <Text variant="title">Saques</Text>
            {(payouts ?? []).length === 0 ? (
              <Text variant="caption" color="tertiary">
                Nenhum saque solicitado.
              </Text>
            ) : null}
            {(payouts ?? []).map((item) => (
              <Card key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodyMedium">{formatPriceBRL(item.amount_cents)}</Text>
                <Text variant="caption" color="secondary">
                  {PAYOUT_STATUS_LABELS[item.status]}
                </Text>
              </Card>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
