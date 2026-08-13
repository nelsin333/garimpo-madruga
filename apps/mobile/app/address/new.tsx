// Cadastro de endereço de entrega/origem.
//
// O CEP é normalizado para 8 dígitos porque é assim que o banco valida e a
// transportadora espera.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Field, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { saveAddress } from '@/features/order/api';

const UF = /^[A-Za-z]{2}$/;

export default function NewAddressScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    recipient_name: '',
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const zipDigits = form.zip_code.replace(/\D/g, '');
  const valid =
    form.recipient_name.trim().length > 2 &&
    zipDigits.length === 8 &&
    form.street.trim() &&
    form.number.trim() &&
    form.district.trim() &&
    form.city.trim() &&
    UF.test(form.state);

  const save = useMutation({
    mutationFn: () =>
      saveAddress(session!.user.id, {
        ...form,
        complement: form.complement || null,
        state: form.state.toUpperCase(),
        is_default: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
      router.back();
    },
    onError: () => setError('Não foi possível salvar o endereço. Confira os dados.'),
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
        <Text variant="titleLg">Novo endereço</Text>
      </View>

      <Field
        label="Nome de quem recebe"
        value={form.recipient_name}
        onChangeText={set('recipient_name')}
        autoCapitalize="words"
      />
      <Field
        label="CEP"
        value={form.zip_code}
        onChangeText={set('zip_code')}
        keyboardType="number-pad"
        maxLength={9}
      />
      <Field label="Rua" value={form.street} onChangeText={set('street')} />
      <View style={{ flexDirection: 'row', gap: theme.space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="Número" value={form.number} onChangeText={set('number')} />
        </View>
        <View style={{ flex: 2 }}>
          <Field
            label="Complemento (opcional)"
            value={form.complement}
            onChangeText={set('complement')}
          />
        </View>
      </View>
      <Field label="Bairro" value={form.district} onChangeText={set('district')} />
      <View style={{ flexDirection: 'row', gap: theme.space.md }}>
        <View style={{ flex: 3 }}>
          <Field label="Cidade" value={form.city} onChangeText={set('city')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="UF"
            value={form.state}
            onChangeText={set('state')}
            autoCapitalize="characters"
            maxLength={2}
          />
        </View>
      </View>

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <Button
        title="Salvar endereço"
        loading={save.isPending}
        disabled={!valid}
        onPress={() => {
          setError(null);
          save.mutate();
        }}
      />
    </Screen>
  );
}
