import Ionicons from '@expo/vector-icons/Ionicons';
import { referenceItemInputSchema } from '@garimpo/contracts';
import { Button, Chip, Field, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchWizardCategories, searchBrands } from '@/features/check/api';
import { createReferenceItem } from '@/features/reference/api';

export default function NewReferenceScreen() {
  const theme = useTheme();
  const { session } = useAuth();

  const [brandQuery, setBrandQuery] = useState('');
  const [brand, setBrand] = useState<{ id: string; name: string } | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [authenticity, setAuthenticity] = useState<'authentic' | 'replica'>('authentic');
  const [batch, setBatch] = useState('');
  const [sku, setSku] = useState('');
  const [confidence, setConfidence] = useState(3);

  const { data: categories } = useQuery({
    queryKey: ['wizard-categories'],
    queryFn: fetchWizardCategories,
    staleTime: 10 * 60 * 1000,
  });
  const { data: brands } = useQuery({
    queryKey: ['expert-brands', brandQuery.trim()],
    queryFn: () => searchBrands(brandQuery.trim()),
    placeholderData: (prev) => prev,
  });

  const create = useMutation({
    mutationFn: () => {
      const input = referenceItemInputSchema.parse({
        brand_id: brand!.id,
        category_id: categoryId!,
        authenticity,
        sku: sku.trim() || null,
        replica_batch: authenticity === 'replica' ? batch.trim() || null : null,
        provenance_confidence: confidence,
        quality_score: 3,
      });
      return createReferenceItem(input, session!.user.id);
    },
    onSuccess: (id) => router.replace({ pathname: '/expert/[id]', params: { id } }),
    onError: () => Alert.alert('Não foi possível cadastrar', 'Confira os campos e tente de novo.'),
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
        <Text variant="titleLg">Nova peça de referência</Text>
      </View>

      <View style={{ gap: theme.space.sm }}>
        <Text variant="caption" color="tertiary">
          TIPO DA PEÇA
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <Chip
            label="Original"
            selected={authenticity === 'authentic'}
            onPress={() => setAuthenticity('authentic')}
          />
          <Chip
            label="Réplica"
            selected={authenticity === 'replica'}
            onPress={() => setAuthenticity('replica')}
          />
        </View>
      </View>

      {authenticity === 'replica' ? (
        <Field
          label="Batch / fábrica (se conhecido)"
          value={batch}
          onChangeText={setBatch}
          placeholder="PK God, LJR…"
          autoCapitalize="none"
        />
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        <Text variant="caption" color="tertiary">
          CATEGORIA
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          {(categories ?? []).map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
        </View>
      </View>

      <Field
        label="Marca"
        value={brand ? brand.name : brandQuery}
        onChangeText={(text) => {
          setBrand(null);
          setBrandQuery(text);
        }}
        placeholder="Buscar marca…"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!brand ? (
        <View style={{ gap: theme.space.sm }}>
          {(brands ?? []).slice(0, 5).map((option) => (
            <PressableCard key={option.id} onPress={() => setBrand(option)}>
              <Text variant="bodyMedium">{option.name}</Text>
            </PressableCard>
          ))}
        </View>
      ) : null}

      <Field
        label="SKU (opcional)"
        value={sku}
        onChangeText={setSku}
        placeholder="DD1391-100"
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <View style={{ gap: theme.space.sm }}>
        <Text variant="caption" color="tertiary">
          CONFIANÇA DA ORIGEM: {confidence}/5
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Chip
              key={level}
              label={String(level)}
              selected={confidence === level}
              onPress={() => setConfidence(level)}
            />
          ))}
        </View>
        <Text variant="caption" color="secondary">
          5 = comprada lacrada em loja oficial · 1 = origem desconhecida
        </Text>
      </View>

      <Button
        title="Cadastrar e fotografar"
        loading={create.isPending}
        disabled={!brand || !categoryId || !session}
        onPress={() => create.mutate()}
      />
    </Screen>
  );
}
