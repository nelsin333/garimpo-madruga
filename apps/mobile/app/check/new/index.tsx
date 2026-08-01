import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { fetchWizardCategories } from '@/features/check/api';
import { WizardHeader } from '@/features/check/components/WizardHeader';
import { categoryIcon } from '@/features/check/regions';
import { useCheckWizard } from '@/features/check/store';

export default function CategoryStep() {
  const theme = useTheme();
  const setCategory = useCheckWizard((s) => s.setCategory);
  const reset = useCheckWizard((s) => s.reset);

  const { data: categories, isPending } = useQuery({
    queryKey: ['wizard-categories'],
    queryFn: fetchWizardCategories,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <Screen>
      <WizardHeader
        title="O que vamos verificar?"
        subtitle="Escolha a categoria da peça."
        step={1}
        onClose={() => {
          reset();
          router.back();
        }}
      />

      {isPending ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md }}>
          {(categories ?? []).map((category) => (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={category.name}
              onPress={() => {
                void Haptics.selectionAsync();
                setCategory({ id: category.id, slug: category.slug, name: category.name });
                router.push('/check/new/brand');
              }}
              style={({ pressed }) => ({
                width: '47.5%',
                aspectRatio: 1.35,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: pressed ? theme.colors.brand.primary : theme.colors.border.subtle,
                backgroundColor: pressed ? theme.colors.bg.overlay : theme.colors.bg.raised,
                padding: theme.space.lg,
                justifyContent: 'space-between',
              })}
            >
              <Ionicons
                name={categoryIcon(category.slug)}
                size={26}
                color={theme.colors.brand.primary}
              />
              <Text variant="bodyMedium">{category.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
