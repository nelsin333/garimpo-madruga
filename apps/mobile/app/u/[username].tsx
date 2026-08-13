import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, EmptyState, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { fetchSellerListings, fetchSellerProfile } from '@/features/listing/api';
import { ListingCard } from '@/features/listing/components/ListingCard';

export default function SellerProfileScreen() {
  const theme = useTheme();
  const { username } = useLocalSearchParams<{ username: string }>();

  const { data: seller, isPending } = useQuery({
    queryKey: ['seller', username],
    queryFn: () => fetchSellerProfile(username),
  });

  const { data: listings } = useQuery({
    queryKey: ['seller-listings', seller?.profile.id],
    enabled: !!seller,
    queryFn: () => fetchSellerListings(seller!.profile.id),
  });

  if (isPending) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }

  if (!seller) {
    return (
      <Screen>
        <EmptyState title="Perfil não encontrado" description="Este vendedor não existe." />
      </Screen>
    );
  }

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
        <Text variant="title">Perfil do vendedor</Text>
      </View>

      <Card style={{ gap: theme.space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <Ionicons name="person-circle-outline" size={52} color={theme.colors.text.secondary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">
              {seller.profile.display_name ?? `@${seller.profile.username}`}
            </Text>
            <Text variant="monoSm" color="secondary">
              @{seller.profile.username}
            </Text>
            <Text variant="caption" color="tertiary">
              Desde {new Date(seller.profile.member_since).toLocaleDateString('pt-BR')} · nível{' '}
              {seller.profile.level}
            </Text>
          </View>
        </View>

        {seller.profile.bio ? <Text color="secondary">{seller.profile.bio}</Text> : null}

        <View style={{ flexDirection: 'row', gap: theme.space['2xl'], flexWrap: 'wrap' }}>
          <Stat
            label="Avaliação"
            value={`★ ${Number(seller.profile.reputation_score).toFixed(1)}`}
          />
          <Stat label="Vendas" value={String(seller.sales_count)} />
          <Stat label="Anúncios" value={String(seller.active_listings_count)} />
          <Stat label="Legit checks" value={String(seller.checks_count)} />
          <Stat
            label="Peças verificadas"
            value={String(seller.verified_count)}
            color={theme.colors.risk.low}
          />
        </View>
      </Card>

      <Text variant="title">Peças</Text>
      {!listings || listings.length === 0 ? (
        <EmptyState
          title="Nenhum anúncio publicado"
          description="Quando este vendedor anunciar, as peças aparecem aqui."
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md }}>
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text variant="title" style={color ? { color } : undefined}>
        {value}
      </Text>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
    </View>
  );
}
