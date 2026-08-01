import Ionicons from '@expo/vector-icons/Ionicons';
import { Field, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { createBrand, searchBrands } from '@/features/check/api';
import { WizardHeader } from '@/features/check/components/WizardHeader';
import { useCheckWizard } from '@/features/check/store';

export default function BrandStep() {
  const theme = useTheme();
  const { session } = useAuth();
  const setBrand = useCheckWizard((s) => s.setBrand);
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  const { data: brands, isFetching } = useQuery({
    queryKey: ['wizard-brands', trimmed],
    queryFn: () => searchBrands(trimmed),
    placeholderData: (prev) => prev,
  });

  const addBrand = useMutation({
    mutationFn: () => createBrand(trimmed, session!.user.id),
    onSuccess: (brand) => {
      setBrand(brand);
      router.push('/check/new/model');
    },
    onError: () => Alert.alert('Não foi possível adicionar a marca', 'Tente novamente.'),
  });

  const hasExactMatch = (brands ?? []).some((b) => b.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <Screen>
      <WizardHeader title="Qual é a marca?" subtitle="Busque no catálogo." step={2} />

      <Field
        label="Marca"
        value={query}
        onChangeText={setQuery}
        placeholder="Nike, Supreme, Stone Island…"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />

      {isFetching && !brands ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : (
        <View style={{ gap: theme.space.md }}>
          {(brands ?? []).map((brand) => (
            <PressableCard
              key={brand.id}
              onPress={() => {
                setBrand({ id: brand.id, name: brand.name });
                router.push('/check/new/model');
              }}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text variant="bodyMedium">{brand.name}</Text>
              {brand.tier === 1 ? (
                <Text variant="caption" color="brand">
                  cobertura completa
                </Text>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
              )}
            </PressableCard>
          ))}

          {trimmed.length >= 2 && !hasExactMatch ? (
            <PressableCard
              onPress={() => addBrand.mutate()}
              disabled={addBrand.isPending}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.md,
                borderStyle: 'dashed',
              }}
            >
              {addBrand.isPending ? (
                <ActivityIndicator color={theme.colors.brand.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={theme.colors.brand.primary} />
              )}
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">Adicionar “{trimmed}”</Text>
                <Text variant="caption" color="secondary">
                  Marca fora do catálogo — a análise usa referências genéricas.
                </Text>
              </View>
            </PressableCard>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
