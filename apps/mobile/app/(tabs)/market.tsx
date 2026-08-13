import Ionicons from '@expo/vector-icons/Ionicons';
import { CONDITION_LABELS, conditionSchema, type Condition } from '@garimpo/contracts';
import { Chip, EmptyState, Field, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { fetchWizardCategories, searchBrands } from '@/features/check/api';
import { searchListings, type MarketFilters } from '@/features/listing/api';
import { ListingCard } from '@/features/listing/components/ListingCard';

const SORTS: { key: NonNullable<MarketFilters['sort']>; label: string }[] = [
  { key: 'recent', label: 'Recentes' },
  { key: 'price_asc', label: 'Menor preço' },
  { key: 'price_desc', label: 'Maior preço' },
];

export default function MarketScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<MarketFilters>({ sort: 'recent', verifiedOnly: false });

  const { data: brands } = useQuery({
    queryKey: ['market-brands'],
    queryFn: () => searchBrands(''),
    staleTime: 10 * 60 * 1000,
  });
  const { data: categories } = useQuery({
    queryKey: ['wizard-categories'],
    queryFn: fetchWizardCategories,
    staleTime: 10 * 60 * 1000,
  });

  const effective: MarketFilters = { ...filters, query: query.trim() || undefined };
  const { data: listings, isPending } = useQuery({
    queryKey: ['market', effective],
    queryFn: () => searchListings(effective),
  });

  function patch(next: Partial<MarketFilters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  const activeFilterCount = [
    filters.brandId,
    filters.categoryId,
    filters.condition,
    filters.sizeLabel,
    filters.minPriceCents,
    filters.maxPriceCents,
    filters.state,
    filters.verifiedOnly ? true : undefined,
  ].filter(Boolean).length;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="titleLg">Marketplace</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtros"
          onPress={() => setFiltersOpen((open) => !open)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? theme.colors.brand.primary : theme.colors.text.secondary}
          />
          {activeFilterCount > 0 ? (
            <Text variant="caption" color="brand">
              {activeFilterCount}
            </Text>
          ) : null}
        </Pressable>
      </View>

      <Field
        label="Buscar"
        value={query}
        onChangeText={setQuery}
        placeholder="Box logo, Dunk Panda, jaqueta…"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <Chip
          label="🛡️ Só autenticadas"
          selected={Boolean(filters.verifiedOnly)}
          onPress={() => patch({ verifiedOnly: !filters.verifiedOnly })}
        />
        {SORTS.map((sort) => (
          <Chip
            key={sort.key}
            label={sort.label}
            selected={filters.sort === sort.key}
            onPress={() => patch({ sort: sort.key })}
          />
        ))}
      </View>

      {filtersOpen ? (
        <View style={{ gap: theme.space.lg }}>
          <FilterRow label="Marca">
            <Chip
              label="Todas"
              selected={!filters.brandId}
              onPress={() => patch({ brandId: undefined })}
            />
            {(brands ?? []).slice(0, 12).map((brand) => (
              <Chip
                key={brand.id}
                label={brand.name}
                selected={filters.brandId === brand.id}
                onPress={() => patch({ brandId: brand.id })}
              />
            ))}
          </FilterRow>

          <FilterRow label="Categoria">
            <Chip
              label="Todas"
              selected={!filters.categoryId}
              onPress={() => patch({ categoryId: undefined })}
            />
            {(categories ?? []).map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={filters.categoryId === category.id}
                onPress={() => patch({ categoryId: category.id })}
              />
            ))}
          </FilterRow>

          <FilterRow label="Condição">
            <Chip
              label="Qualquer"
              selected={!filters.condition}
              onPress={() => patch({ condition: undefined })}
            />
            {conditionSchema.options.map((option: Condition) => (
              <Chip
                key={option}
                label={CONDITION_LABELS[option]}
                selected={filters.condition === option}
                onPress={() => patch({ condition: option })}
              />
            ))}
          </FilterRow>

          <View style={{ flexDirection: 'row', gap: theme.space.md }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Tamanho"
                value={filters.sizeLabel ?? ''}
                onChangeText={(text) => patch({ sizeLabel: text || undefined })}
                placeholder="G, 42…"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="UF"
                value={filters.state ?? ''}
                onChangeText={(text) =>
                  patch({ state: text.toUpperCase().slice(0, 2) || undefined })
                }
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: theme.space.md }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Preço mín. (R$)"
                value={filters.minPriceCents ? String(filters.minPriceCents / 100) : ''}
                onChangeText={(text) => {
                  const value = Number(text.replace(/[^0-9]/g, ''));
                  patch({ minPriceCents: value > 0 ? value * 100 : undefined });
                }}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Preço máx. (R$)"
                value={filters.maxPriceCents ? String(filters.maxPriceCents / 100) : ''}
                onChangeText={(text) => {
                  const value = Number(text.replace(/[^0-9]/g, ''));
                  patch({ maxPriceCents: value > 0 ? value * 100 : undefined });
                }}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Field
            label="Cidade"
            value={filters.city ?? ''}
            onChangeText={(text) => patch({ city: text || undefined })}
            placeholder="São Paulo"
          />
        </View>
      ) : null}

      {isPending ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : !listings || listings.length === 0 ? (
        <EmptyState
          title="Nenhum anúncio encontrado"
          description="Ajuste os filtros ou volte em breve — o acervo cresce a cada legit check."
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

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.sm }}>
      <Text variant="caption" color="tertiary">
        {label.toUpperCase()}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>{children}</View>
      </ScrollView>
    </View>
  );
}
