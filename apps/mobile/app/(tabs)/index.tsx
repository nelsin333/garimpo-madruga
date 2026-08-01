import type { CheckStatus } from '@garimpo/contracts';
import { EmptyState, PressableCard, Screen, Text, VerifiedShield, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { openCheck } from '@/features/check/navigation';
import { useResumeDraft } from '@/features/check/resume';
import { CHECK_STATUS_LABELS } from '@/features/check/status';
import { supabase } from '@/lib/supabase';

interface CheckListItem {
  id: string;
  status: CheckStatus;
  created_at: string;
  brands: { name: string } | null;
  categories: { name: string } | null;
}

export default function Home() {
  const theme = useTheme();
  const { session } = useAuth();
  const resume = useResumeDraft();

  const { data: checks, isPending } = useQuery({
    queryKey: ['checks', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<CheckListItem[]> => {
      const { data, error } = await supabase
        .from('checks')
        .select('id, status, created_at, brands(name), categories(name)')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as unknown as CheckListItem[];
    },
  });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="titleLg">garimpo madruga</Text>
        <VerifiedShield label="beta" />
      </View>

      <PressableCard
        onPress={() => router.push('/check/new')}
        style={{
          backgroundColor: theme.colors.brand.primary,
          borderColor: theme.colors.brand.primary,
          gap: theme.space.sm,
        }}
      >
        <Text variant="title" style={{ color: theme.colors.text.onBrand }}>
          🛡️ Fazer Legit Check
        </Text>
        <Text variant="body" style={{ color: theme.colors.text.onBrand, opacity: 0.75 }}>
          Descubra em minutos se a sua peça é real.
        </Text>
      </PressableCard>

      <View style={{ gap: theme.space.md }}>
        <Text variant="title">Seus checks</Text>

        {isPending ? (
          <ActivityIndicator color={theme.colors.brand.primary} />
        ) : !checks || checks.length === 0 ? (
          <EmptyState
            title="Nenhum check ainda"
            description="Sua primeira peça verificada aparece aqui."
            action={{ title: 'Fazer o primeiro', onPress: () => router.push('/check/new') }}
          />
        ) : (
          checks.map((check) => (
            <PressableCard
              key={check.id}
              onPress={() => {
                if (check.status === 'awaiting_photos') resume.mutate(check.id);
                else openCheck(check);
              }}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ gap: 2 }}>
                <Text variant="bodyMedium">
                  {[check.brands?.name, check.categories?.name].filter(Boolean).join(' · ') ||
                    'Peça sem identificação'}
                </Text>
                <Text variant="caption" color="secondary">
                  {new Date(check.created_at).toLocaleDateString('pt-BR')}
                </Text>
              </View>
              <Text variant="caption" color="brand">
                {CHECK_STATUS_LABELS[check.status]}
              </Text>
            </PressableCard>
          ))
        )}
      </View>
    </Screen>
  );
}
