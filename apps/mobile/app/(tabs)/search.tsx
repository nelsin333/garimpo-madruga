import { Card, EmptyState, Field, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function Search() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  const { data: brands, isFetching } = useQuery({
    queryKey: ['brand-search', trimmed],
    queryFn: async () => {
      let builder = supabase.from('brands').select('id, name, slug, tier').order('name');
      if (trimmed.length > 0) {
        builder = builder.ilike('name', `%${trimmed}%`);
      }
      const { data, error } = await builder.limit(20);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Screen>
      <Text variant="titleLg">Buscar</Text>
      <Field
        label="Marca"
        value={query}
        onChangeText={setQuery}
        placeholder="Nike, Supreme, Stone Island…"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {isFetching ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : !brands || brands.length === 0 ? (
        <EmptyState
          title="Nada encontrado"
          description="Anúncios e peças entram na busca em breve — por enquanto, busque marcas."
        />
      ) : (
        <View style={{ gap: theme.space.md }}>
          {brands.map((brand) => (
            <Card key={brand.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodyMedium">{brand.name}</Text>
              {brand.tier === 1 ? (
                <Text variant="caption" color="brand">
                  cobertura completa
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
