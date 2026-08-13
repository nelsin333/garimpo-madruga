import Ionicons from '@expo/vector-icons/Ionicons';
import { CONDITION_LABELS, formatPriceBRL } from '@garimpo/contracts';
import { Text, useTheme } from '@garimpo/ui';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import type { MarketListing } from '../api';

export interface ListingCardProps {
  listing: MarketListing;
  onPress: () => void;
  /** Largura relativa no grid (padrão: 2 colunas). */
  width?: `${number}%`;
}

export function ListingCard({ listing, onPress, width = '47.5%' }: ListingCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listing.title}
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: pressed ? theme.colors.brand.primary : theme.colors.border.subtle,
        backgroundColor: theme.colors.bg.raised,
        overflow: 'hidden',
      })}
    >
      <View style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.colors.bg.overlay }}>
        {listing.coverUrl ? (
          <Image
            source={{ uri: listing.coverUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
          />
        ) : null}
        {listing.certificate_id ? (
          <View
            style={{
              position: 'absolute',
              top: theme.space.sm,
              left: theme.space.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: '#000000CC',
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.space.sm,
              paddingVertical: 3,
            }}
          >
            <Ionicons name="shield-checkmark" size={11} color={theme.colors.brand.primary} />
            <Text variant="caption" style={{ color: theme.colors.brand.primary, fontSize: 11 }}>
              {listing.probability != null
                ? `${Math.round(Number(listing.probability) * 100)}%`
                : 'verificada'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: theme.space.md, gap: 2 }}>
        <Text variant="caption" numberOfLines={2} style={{ minHeight: 34 }}>
          {listing.title}
        </Text>
        <Text variant="bodyMedium">
          {listing.price_cents != null ? formatPriceBRL(listing.price_cents) : 'a combinar'}
        </Text>
        <Text variant="caption" color="tertiary" numberOfLines={1}>
          {[
            listing.size_label ? `Tam ${listing.size_label}` : null,
            listing.condition ? CONDITION_LABELS[listing.condition] : null,
            listing.location_state,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}
