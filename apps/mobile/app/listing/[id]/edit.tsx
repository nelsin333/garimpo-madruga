import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CONDITION_LABELS,
  SHIPPING_METHOD_LABELS,
  conditionSchema,
  formatPriceBRL,
  listingEditSchema,
  shippingMethodSchema,
  type Condition,
  type ShippingMethod,
} from '@garimpo/contracts';
import { Button, Card, Chip, Field, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  fetchListingDraft,
  publishListing,
  removeListingPhoto,
  reorderListingPhotos,
  saveListingDraft,
  uploadListingPhoto,
} from '@/features/listing/api';
import { PhotoManager } from '@/features/listing/components/PhotoManager';

const MEASUREMENT_FIELDS: { key: string; label: string }[] = [
  { key: 'ombro_cm', label: 'Ombro (cm)' },
  { key: 'peito_cm', label: 'Peito (cm)' },
  { key: 'comprimento_cm', label: 'Comprimento (cm)' },
  { key: 'manga_cm', label: 'Manga (cm)' },
];

export default function EditListingScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: draft, isPending } = useQuery({
    queryKey: ['listing-draft', id],
    queryFn: () => fetchListingDraft(id),
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<Condition>('excellent');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [defects, setDefects] = useState('');
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [shipping, setShipping] = useState<ShippingMethod[]>(['correios']);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Preenche o formulário com o que a IA gerou + dados do check.
  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setDescription(draft.description_md);
    if (draft.condition) setCondition(draft.condition);
    setSize(draft.size_label ?? '');
    setPrice(draft.price_cents != null ? String(draft.price_cents / 100) : '');
    setDefects(draft.defects_md);
    setMeasurements(
      Object.fromEntries(Object.entries(draft.measurements).map(([k, v]) => [k, String(v)])),
    );
    setCity(draft.location_city ?? '');
    setState(draft.location_state ?? '');
    if (draft.shipping_methods.length > 0) {
      setShipping(
        draft.shipping_methods.filter(
          (method): method is ShippingMethod => shippingMethodSchema.safeParse(method).success,
        ),
      );
    }
  }, [draft]);

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const parsed = listingEditSchema.safeParse({
        title,
        description_md: description,
        condition,
        size_label: size,
        price_cents: Math.round(Number(price.replace(',', '.')) * 100),
        defects_md: defects,
        measurements: Object.fromEntries(
          Object.entries(measurements)
            .filter(([, value]) => value.trim() !== '' && Number(value.replace(',', '.')) > 0)
            .map(([key, value]) => [key, Number(value.replace(',', '.'))]),
        ),
        location_city: city,
        location_state: state,
        shipping_methods: shipping,
        hashtags: draft?.hashtags ?? [],
      });
      if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;
        setErrors(
          Object.fromEntries(
            Object.entries(flat).map(([key, value]) => [key, value?.[0] ?? 'Campo inválido']),
          ),
        );
        throw new Error('validation');
      }
      setErrors({});
      await saveListingDraft(id, parsed.data);
      if (publish) await publishListing(id);
      return publish;
    },
    onSuccess: (published) => {
      void queryClient.invalidateQueries({ queryKey: ['listing-draft', id] });
      void queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      if (published) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: '/listing/[id]', params: { id } });
      } else {
        Alert.alert('Rascunho salvo', 'Você pode publicar quando quiser.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'validation') return;
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    },
  });

  const photoMutations = {
    async add() {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled || !draft) return;
      await uploadListingPhoto({
        listingId: id,
        sellerId: draft.seller_id,
        localUri: result.assets[0]!.uri,
        position: draft.photos.length,
      });
      void queryClient.invalidateQueries({ queryKey: ['listing-draft', id] });
    },
    async remove(photoId: string, storagePath: string) {
      await removeListingPhoto(photoId, storagePath);
      void queryClient.invalidateQueries({ queryKey: ['listing-draft', id] });
    },
    async reorder(ids: string[]) {
      await reorderListingPhotos(ids);
      void queryClient.invalidateQueries({ queryKey: ['listing-draft', id] });
    },
  };

  if (isPending || !draft) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }

  const priceCents = Math.round(Number(price.replace(',', '.')) * 100);

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
        <View style={{ flex: 1 }}>
          <Text variant="titleLg">Revisar anúncio</Text>
          <Text variant="caption" color="secondary">
            Gerado a partir do seu legit check — edite o que quiser.
          </Text>
        </View>
      </View>

      {draft.certificateCode ? (
        <Card
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            borderColor: `${theme.colors.brand.primary}55`,
          }}
        >
          <Ionicons name="shield-checkmark" size={18} color={theme.colors.brand.primary} />
          <Text variant="caption" color="secondary" style={{ flex: 1 }}>
            Certificado {draft.certificateCode} será exibido no anúncio.
          </Text>
        </Card>
      ) : null}

      <PhotoManager
        photos={draft.photos}
        onAdd={() => void photoMutations.add()}
        onRemove={(photo) => void photoMutations.remove(photo.id, photo.storage_path)}
        onReorder={(ids) => void photoMutations.reorder(ids)}
      />

      <Field
        label="Título"
        value={title}
        onChangeText={setTitle}
        error={errors.title}
        maxLength={120}
      />

      <View style={{ gap: theme.space.sm }}>
        <Text variant="caption" color="secondary">
          Descrição
        </Text>
        <View
          style={{
            backgroundColor: theme.colors.bg.raised,
            borderWidth: 1,
            borderColor: errors.description_md
              ? theme.colors.feedback.danger
              : theme.colors.border.subtle,
            borderRadius: theme.radius.md,
          }}
        >
          <Field
            label=""
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            style={{ height: 140, textAlignVertical: 'top', paddingTop: theme.space.md }}
          />
        </View>
        {errors.description_md ? (
          <Text variant="caption" color="danger">
            {errors.description_md}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: theme.space.sm }}>
        <Text variant="caption" color="secondary">
          Estado da peça
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          {conditionSchema.options.map((option) => (
            <Chip
              key={option}
              label={CONDITION_LABELS[option]}
              selected={condition === option}
              onPress={() => setCondition(option)}
            />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="Tamanho" value={size} onChangeText={setSize} error={errors.size_label} />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Preço (R$)"
            value={price}
            onChangeText={(text) => setPrice(text.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            error={errors.price_cents}
          />
        </View>
      </View>
      {priceCents > 0 ? (
        <Text variant="caption" color="tertiary">
          Comprador vê {formatPriceBRL(priceCents)}
        </Text>
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        <Text variant="caption" color="secondary">
          Medidas (opcional)
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md }}>
          {MEASUREMENT_FIELDS.map((field) => (
            <View key={field.key} style={{ width: '47%' }}>
              <Field
                label={field.label}
                value={measurements[field.key] ?? ''}
                onChangeText={(text) =>
                  setMeasurements((current) => ({
                    ...current,
                    [field.key]: text.replace(/[^0-9.,]/g, ''),
                  }))
                }
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </View>
      </View>

      <Field
        label="Defeitos / observações"
        value={defects}
        onChangeText={setDefects}
        placeholder="Puxado na manga, leve desgaste na sola…"
      />

      <View style={{ flexDirection: 'row', gap: theme.space.md }}>
        <View style={{ flex: 2 }}>
          <Field label="Cidade" value={city} onChangeText={setCity} error={errors.location_city} />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="UF"
            value={state}
            onChangeText={(text) => setState(text.toUpperCase().slice(0, 2))}
            autoCapitalize="characters"
            maxLength={2}
            error={errors.location_state}
          />
        </View>
      </View>

      <View style={{ gap: theme.space.sm }}>
        <Text variant="caption" color="secondary">
          Formas de envio
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          {shippingMethodSchema.options.map((method) => (
            <Chip
              key={method}
              label={SHIPPING_METHOD_LABELS[method]}
              selected={shipping.includes(method)}
              onPress={() =>
                setShipping((current) =>
                  current.includes(method)
                    ? current.filter((item) => item !== method)
                    : [...current, method],
                )
              }
            />
          ))}
        </View>
        {errors.shipping_methods ? (
          <Text variant="caption" color="danger">
            {errors.shipping_methods}
          </Text>
        ) : null}
      </View>

      <Button
        title={draft.status === 'active' ? 'Salvar alterações' : 'Publicar anúncio'}
        loading={save.isPending}
        disabled={!session}
        onPress={() => save.mutate(draft.status !== 'active')}
      />
      {draft.status !== 'active' ? (
        <Button
          variant="ghost"
          size="md"
          title="Salvar rascunho"
          onPress={() => save.mutate(false)}
        />
      ) : null}
    </Screen>
  );
}
