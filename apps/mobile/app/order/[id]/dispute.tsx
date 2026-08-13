// Abertura de disputa. Congela o repasse ao vendedor até a resolução.
import Ionicons from '@expo/vector-icons/Ionicons';
import { DISPUTE_REASON_LABELS, orderErrorMessage, type DisputeReason } from '@garimpo/contracts';
import { Button, Card, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { OrderApiError, openDispute } from '@/features/order/api';

const REASONS = Object.keys(DISPUTE_REASON_LABELS) as DisputeReason[];

export default function DisputeScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = useMutation({
    mutationFn: () => openDispute({ orderId: id, reason: reason!, description }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
      router.replace(`/order/${id}`);
    },
    onError: (mutationError) => setError(orderErrorMessage((mutationError as OrderApiError).code)),
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
        <Text variant="titleLg">Abrir disputa</Text>
      </View>

      <Card>
        <Text variant="body" color="secondary">
          Enquanto a disputa estiver aberta, o valor continua retido pela plataforma. Nossa equipe
          analisa as evidências das duas partes antes de decidir.
        </Text>
      </Card>

      <View style={{ gap: theme.space.md }}>
        <Text variant="title">O que aconteceu?</Text>
        {REASONS.map((option) => (
          <PressableCard
            key={option}
            onPress={() => setReason(option)}
            style={{
              borderWidth: 1,
              borderColor:
                reason === option ? theme.colors.brand.primary : theme.colors.border.subtle,
            }}
          >
            <Text variant="bodyMedium">{DISPUTE_REASON_LABELS[option]}</Text>
          </PressableCard>
        ))}
      </View>

      <View style={{ gap: theme.space.sm }}>
        <Text variant="caption" color="secondary">
          Descreva o problema
        </Text>
        <TextInput
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="Conte os detalhes: o que você recebeu, o que esperava, o que já tentou resolver com o vendedor."
          placeholderTextColor={theme.colors.text.tertiary}
          style={[
            theme.textStyles.body,
            {
              minHeight: 140,
              color: theme.colors.text.primary,
              backgroundColor: theme.colors.bg.raised,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border.subtle,
              padding: theme.space.lg,
              textAlignVertical: 'top',
            },
          ]}
        />
      </View>

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <Button
        title="Abrir disputa"
        variant="danger"
        loading={open.isPending}
        disabled={!reason || description.trim().length < 10}
        onPress={() => {
          setError(null);
          open.mutate();
        }}
      />
    </Screen>
  );
}
