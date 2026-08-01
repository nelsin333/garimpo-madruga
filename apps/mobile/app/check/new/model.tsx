import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Field, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { createProduct, searchProducts } from '@/features/check/api';
import { WizardHeader } from '@/features/check/components/WizardHeader';
import { useCheckWizard } from '@/features/check/store';

export default function ModelStep() {
  const theme = useTheme();
  const { session } = useAuth();
  const brand = useCheckWizard((s) => s.brand);
  const category = useCheckWizard((s) => s.category);
  const setProduct = useCheckWizard((s) => s.setProduct);
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  const { data: products, isFetching } = useQuery({
    queryKey: ['wizard-products', brand?.id, category?.id, trimmed],
    enabled: !!brand && !!category,
    queryFn: () => searchProducts(brand!.id, category!.id, trimmed),
    placeholderData: (prev) => prev,
  });

  const addProduct = useMutation({
    mutationFn: () =>
      createProduct({
        brandId: brand!.id,
        categoryId: category!.id,
        name: trimmed,
        profileId: session!.user.id,
      }),
    onSuccess: (product) => {
      setProduct(product);
      router.push('/check/new/tutorial');
    },
    onError: () => Alert.alert('Não foi possível adicionar o modelo', 'Tente novamente.'),
  });

  const hasExactMatch = (products ?? []).some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
  );

  return (
    <Screen>
      <WizardHeader
        title="Qual é o modelo?"
        subtitle={brand ? `${brand.name} · ${category?.name ?? ''}` : undefined}
        step={3}
      />

      <Field
        label="Modelo"
        value={query}
        onChangeText={setQuery}
        placeholder="Box Logo FW23, Dunk Low Panda…"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />

      {isFetching && !products ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : (
        <View style={{ gap: theme.space.md }}>
          {(products ?? []).map((product) => (
            <PressableCard
              key={product.id}
              onPress={() => {
                setProduct({ id: product.id, name: product.name });
                router.push('/check/new/tutorial');
              }}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyMedium">{product.name}</Text>
                {product.style_code || product.release_year ? (
                  <Text variant="caption" color="secondary">
                    {[product.style_code, product.release_year].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
            </PressableCard>
          ))}

          {trimmed.length >= 2 && !hasExactMatch ? (
            <PressableCard
              onPress={() => addProduct.mutate()}
              disabled={addProduct.isPending}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.md,
                borderStyle: 'dashed',
              }}
            >
              {addProduct.isPending ? (
                <ActivityIndicator color={theme.colors.brand.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={theme.colors.brand.primary} />
              )}
              <Text variant="bodyMedium">Adicionar “{trimmed}” manualmente</Text>
            </PressableCard>
          ) : null}
        </View>
      )}

      <Button
        variant="ghost"
        size="md"
        title="Não sei o modelo — identificar pelas fotos"
        onPress={() => {
          setProduct(null);
          router.push('/check/new/tutorial');
        }}
      />
    </Screen>
  );
}
