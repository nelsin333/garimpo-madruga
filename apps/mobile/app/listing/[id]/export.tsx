import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EXPORT_TARGET_LABELS,
  buildExportPackage,
  exportTargetSchema,
  type ExportTarget,
} from '@garimpo/contracts';
import { Button, Card, Chip, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Share, View } from 'react-native';
import { fetchListingDraft } from '@/features/listing/api';
import { certificateUrl, listingUrl } from '@/features/listing/share';

/**
 * Exportação estruturada. Não automatizamos publicação em plataformas de
 * terceiros: geramos o pacote pronto (título, descrição, specs, preço) para o
 * usuário colar. Integração por API oficial entra aqui quando disponível.
 */
const TARGET_LINKS: Record<ExportTarget, string> = {
  enjoei: 'https://www.enjoei.com.br',
  olx: 'https://www.olx.com.br',
  droper: 'https://droper.app',
};

export default function ExportListingScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [target, setTarget] = useState<ExportTarget>('enjoei');

  const { data: listing, isPending } = useQuery({
    queryKey: ['listing-draft', id],
    queryFn: () => fetchListingDraft(id),
  });

  if (isPending || !listing) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }

  const pkg = buildExportPackage(target, {
    title: listing.title,
    description_md: listing.description_md,
    price_cents: listing.price_cents ?? 0,
    condition: listing.condition ?? 'good',
    size_label: listing.size_label ?? '—',
    brand: listing.brandName,
    category: listing.categoryName,
    location_city: listing.location_city,
    location_state: listing.location_state,
    hashtags: listing.hashtags,
    certificate_code: listing.certificateCode,
    certificate_url: listing.certificateCode ? certificateUrl(listing.certificateCode) : null,
  });

  async function copy(label: string, value: string) {
    await Clipboard.setStringAsync(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copiado', `${label} está na área de transferência.`);
  }

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
          <Text variant="titleLg">Exportar anúncio</Text>
          <Text variant="caption" color="secondary">
            Pacote pronto para colar na plataforma de destino.
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        {exportTargetSchema.options.map((option) => (
          <Chip
            key={option}
            label={EXPORT_TARGET_LABELS[option]}
            selected={target === option}
            onPress={() => setTarget(option)}
          />
        ))}
      </View>

      <ExportBlock label="Título" value={pkg.title} onCopy={() => void copy('Título', pkg.title)} />
      <ExportBlock label="Preço" value={pkg.price} onCopy={() => void copy('Preço', pkg.price)} />
      <ExportBlock
        label="Descrição"
        value={pkg.body}
        onCopy={() => void copy('Descrição', pkg.body)}
      />

      <Card style={{ gap: theme.space.sm }}>
        <Text variant="caption" color="tertiary">
          FOTOS
        </Text>
        <Text variant="caption" color="secondary">
          {listing.photos.length} fotos do anúncio. Use “Compartilhar fotos” para enviá-las ao seu
          dispositivo e selecioná-las no app de destino.
        </Text>
        <Button
          variant="secondary"
          size="md"
          title="Compartilhar fotos e link"
          onPress={() =>
            void Share.share({
              message: [listingUrl(listing.id), ...listing.photos.map((photo) => photo.url)].join(
                '\n',
              ),
            })
          }
        />
      </Card>

      <Card style={{ gap: theme.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={theme.colors.feedback.info}
          />
          <Text variant="caption" color="secondary" style={{ flex: 1 }}>
            {pkg.instructions}
          </Text>
        </View>
        <Button
          size="md"
          title={`Abrir ${EXPORT_TARGET_LABELS[target]}`}
          onPress={() => void Linking.openURL(TARGET_LINKS[target])}
        />
      </Card>

      <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
        Publicamos automaticamente apenas onde há API oficial. Nas demais plataformas, o
        preenchimento é assistido — sem automação que viole os termos de uso.
      </Text>
    </Screen>
  );
}

function ExportBlock({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  const theme = useTheme();
  return (
    <Card style={{ gap: theme.space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="tertiary">
          {label.toUpperCase()}
        </Text>
        <Pressable accessibilityRole="button" onPress={onCopy} hitSlop={theme.space.sm}>
          <Text variant="caption" color="brand">
            copiar
          </Text>
        </Pressable>
      </View>
      <Text color="secondary">{value}</Text>
    </Card>
  );
}
