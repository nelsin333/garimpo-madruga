import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CONDITION_LABELS,
  LISTING_STATUS_LABELS,
  SHIPPING_METHOD_LABELS,
  VERDICT_OUTCOME_LABELS,
  formatPriceBRL,
  type ShippingMethod,
  type VerdictOutcome,
} from '@garimpo/contracts';
import type { RiskLevel } from '@garimpo/db';
import {
  Button,
  Card,
  PressableCard,
  RiskBadge,
  Screen,
  Text,
  VerifiedShield,
  useTheme,
} from '@garimpo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchListingDetail, toggleFavorite } from '@/features/listing/api';
import { certificateUrl, shareListing } from '@/features/listing/share';

export default function ListingDetailScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [photoIndex, setPhotoIndex] = useState(0);

  const { data: listing, isPending } = useQuery({
    queryKey: ['listing', id, session?.user.id],
    queryFn: () => fetchListingDetail(id, session?.user.id ?? null),
  });

  const favorite = useMutation({
    mutationFn: () =>
      toggleFavorite({
        listingId: id,
        profileId: session!.user.id,
        favorited: listing!.favorited,
        priceCents: listing!.price_cents,
      }),
    onSuccess: () => {
      void Haptics.selectionAsync();
      void queryClient.invalidateQueries({ queryKey: ['listing', id] });
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  if (isPending || !listing) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }

  const width = Dimensions.get('window').width;
  const isOwner = session?.user.id === listing.seller_id;
  const outcome = listing.outcome as VerdictOutcome | null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={theme.space.md}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/market'))}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: theme.space.lg }}>
          {session && !isOwner ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={listing.favorited ? 'Remover dos salvos' : 'Salvar anúncio'}
              hitSlop={theme.space.md}
              onPress={() => favorite.mutate()}
            >
              <Ionicons
                name={listing.favorited ? 'heart' : 'heart-outline'}
                size={24}
                color={listing.favorited ? theme.colors.feedback.danger : theme.colors.text.primary}
              />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartilhar"
            hitSlop={theme.space.md}
            onPress={() =>
              void shareListing({
                listingId: listing.id,
                title: listing.title,
                priceCents: listing.price_cents,
                certificateCode: listing.certificateCode,
              })
            }
          >
            <Ionicons name="share-outline" size={24} color={theme.colors.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* Galeria */}
      {listing.photos.length > 0 ? (
        <View style={{ gap: theme.space.sm }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) =>
              setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / (width - 40)))
            }
            style={{ marginHorizontal: -theme.space.xl }}
            contentContainerStyle={{ paddingHorizontal: theme.space.xl }}
          >
            {listing.photos.map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: photo.url }}
                style={{
                  width: width - 40,
                  aspectRatio: 1,
                  borderRadius: theme.radius.lg,
                }}
                contentFit="cover"
                transition={150}
              />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {listing.photos.map((photo, index) => (
              <View
                key={photo.id}
                style={{
                  width: index === photoIndex ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    index === photoIndex ? theme.colors.brand.primary : theme.colors.border.strong,
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        <Text variant="titleLg">{listing.title}</Text>
        <Text variant="caption" color="secondary">
          {[
            listing.size_label ? `Tam ${listing.size_label}` : null,
            listing.condition ? CONDITION_LABELS[listing.condition] : null,
            listing.location_city && listing.location_state
              ? `${listing.location_city}/${listing.location_state}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {listing.status !== 'active' ? (
          <Text variant="caption" color="brand">
            {LISTING_STATUS_LABELS[listing.status]}
          </Text>
        ) : null}
      </View>

      {/* Laudo + certificado */}
      {listing.certificateCode && listing.probability != null ? (
        <Card style={{ gap: theme.space.lg, borderColor: `${theme.colors.brand.primary}55` }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: theme.space.sm }}>
              <VerifiedShield />
              <Text variant="displayXl" style={{ color: theme.colors.risk.low }}>
                {Math.round(Number(listing.probability) * 100)}%
              </Text>
              <Text variant="caption" color="secondary">
                probabilidade de autenticidade
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
                {listing.risk ? <RiskBadge risk={listing.risk as RiskLevel} size="sm" /> : null}
                {outcome ? (
                  <Text variant="caption" color="secondary">
                    {VERDICT_OUTCOME_LABELS[outcome]}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: theme.space.sm }}>
              <View style={{ padding: 6, backgroundColor: '#FFFFFF', borderRadius: 8 }}>
                <QRCode value={certificateUrl(listing.certificateCode)} size={96} />
              </View>
              <Text variant="monoSm" color="secondary">
                {listing.certificateCode}
              </Text>
            </View>
          </View>

          {listing.summary_md ? (
            <Text variant="caption" color="secondary">
              {listing.summary_md}
            </Text>
          ) : null}

          <View style={{ gap: 4 }}>
            {listing.checkedAt ? (
              <Text variant="caption" color="tertiary">
                Autenticada em {new Date(listing.checkedAt).toLocaleDateString('pt-BR')}
              </Text>
            ) : null}
            {listing.publishedAt ? (
              <Text variant="caption" color="tertiary">
                Anunciada em {new Date(listing.publishedAt).toLocaleDateString('pt-BR')}
              </Text>
            ) : null}
          </View>
        </Card>
      ) : (
        <Card style={{ flexDirection: 'row', gap: theme.space.md, alignItems: 'center' }}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.colors.text.tertiary} />
          <Text variant="caption" color="secondary" style={{ flex: 1 }}>
            Peça sem laudo de autenticidade vinculado.
          </Text>
        </Card>
      )}

      <View style={{ gap: theme.space.xs }}>
        <Text variant="displayXl">
          {listing.price_cents != null ? formatPriceBRL(listing.price_cents) : 'a combinar'}
        </Text>
        {listing.shipping_methods.length > 0 ? (
          <Text variant="caption" color="secondary">
            📦{' '}
            {listing.shipping_methods
              .map((method) => SHIPPING_METHOD_LABELS[method as ShippingMethod] ?? method)
              .join(' · ')}
          </Text>
        ) : null}
      </View>

      {listing.description_md ? (
        <View style={{ gap: theme.space.sm }}>
          <Text variant="caption" color="tertiary">
            DESCRIÇÃO
          </Text>
          <Text color="secondary">{listing.description_md}</Text>
        </View>
      ) : null}

      {Object.keys(listing.measurements).length > 0 ? (
        <View style={{ gap: theme.space.sm }}>
          <Text variant="caption" color="tertiary">
            MEDIDAS
          </Text>
          <Card style={{ gap: theme.space.sm }}>
            {Object.entries(listing.measurements).map(([key, value]) => (
              <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" color="secondary">
                  {key.replace(/_cm$/, '').replace(/_/g, ' ')}
                </Text>
                <Text variant="caption">{value} cm</Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {listing.defects_md ? (
        <View style={{ gap: theme.space.sm }}>
          <Text variant="caption" color="tertiary">
            DEFEITOS INFORMADOS
          </Text>
          <Text color="secondary">{listing.defects_md}</Text>
        </View>
      ) : null}

      <PressableCard
        onPress={() =>
          router.push({ pathname: '/u/[username]', params: { username: listing.seller.username } })
        }
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}
      >
        <Ionicons name="person-circle-outline" size={36} color={theme.colors.text.secondary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyMedium">
            {listing.seller.display_name ?? `@${listing.seller.username}`}
          </Text>
          <Text variant="caption" color="secondary">
            ★ {Number(listing.seller.reputation_score).toFixed(1)} · ver perfil
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
      </PressableCard>

      {isOwner ? (
        <View style={{ gap: theme.space.md }}>
          <Button
            title="Editar anúncio"
            variant="secondary"
            onPress={() => router.push({ pathname: '/listing/[id]/edit', params: { id } })}
          />
          <Button
            title="Exportar para outros canais"
            onPress={() => router.push({ pathname: '/listing/[id]/export', params: { id } })}
          />
        </View>
      ) : (
        <View style={{ gap: theme.space.md }}>
          {listing.status === 'active' && listing.price_cents != null ? (
            <>
              <Button
                title="Comprar com garantia"
                onPress={() =>
                  session
                    ? router.push({ pathname: '/checkout/[listingId]', params: { listingId: id } })
                    : router.push('/(auth)/sign-in')
                }
              />
              <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
                O pagamento fica retido até você confirmar o recebimento.
              </Text>
            </>
          ) : (
            <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
              {listing.status === 'sold' || listing.status === 'reserved'
                ? 'Esta peça já foi vendida.'
                : 'Anúncio indisponível para compra no momento.'}
            </Text>
          )}
          <Button
            title="Compartilhar anúncio"
            variant="secondary"
            onPress={() =>
              void shareListing({
                listingId: listing.id,
                title: listing.title,
                priceCents: listing.price_cents,
                certificateCode: listing.certificateCode,
              })
            }
          />
        </View>
      )}

      <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
        ⓘ O laudo é uma análise probabilística baseada em evidências, não uma garantia absoluta.
      </Text>
    </Screen>
  );
}
