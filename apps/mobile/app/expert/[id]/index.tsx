import Ionicons from '@expo/vector-icons/Ionicons';
import { REFERENCE_REGIONS } from '@garimpo/contracts';
import { Button, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import {
  enqueueReferenceProcessing,
  fetchLatestReferenceJob,
  fetchReferencePhotoCounts,
} from '@/features/reference/api';
import { regionIcon } from '@/features/check/regions';

export default function ExpertItemScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: counts } = useQuery({
    queryKey: ['reference-photo-counts', id],
    queryFn: () => fetchReferencePhotoCounts(id),
  });
  const { data: job } = useQuery({
    queryKey: ['reference-job', id],
    queryFn: () => fetchLatestReferenceJob(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 2000 : false;
    },
  });

  const countByRegion = new Map((counts ?? []).map((c) => [c.region, c.count]));
  const totalPhotos = (counts ?? []).reduce((sum, c) => sum + c.count, 0);

  async function process() {
    await enqueueReferenceProcessing(id);
    void queryClient.invalidateQueries({ queryKey: ['reference-job', id] });
    Alert.alert('Na fila', 'A peça será processada pelo motor em instantes.');
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
          <Text variant="titleLg">Fotos da peça</Text>
          <Text variant="caption" color="secondary">
            {totalPhotos} fotos · quanto mais regiões, melhor a referência
          </Text>
        </View>
      </View>

      {job ? (
        <View
          style={{
            backgroundColor: theme.colors.bg.raised,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
            padding: theme.space.md,
          }}
        >
          <Text variant="caption" color={job.status === 'failed' ? 'danger' : 'secondary'}>
            Processamento: {job.status}
            {job.stage ? ` · ${job.stage} (${job.progress}%)` : ''}
            {job.error ? ` · ${job.error}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        {REFERENCE_REGIONS.map(({ region, label }) => {
          const count = countByRegion.get(region) ?? 0;
          return (
            <PressableCard
              key={region}
              onPress={() =>
                router.push({ pathname: '/expert/[id]/capture', params: { id, region, label } })
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.md,
                paddingVertical: theme.space.md,
              }}
            >
              <Ionicons
                name={regionIcon(region)}
                size={20}
                color={count > 0 ? theme.colors.brand.primary : theme.colors.text.tertiary}
              />
              <Text variant="bodyMedium" style={{ flex: 1 }}>
                {label}
              </Text>
              {count > 0 ? (
                <Text variant="caption" color="brand">
                  {count} ✓
                </Text>
              ) : (
                <Ionicons name="camera-outline" size={18} color={theme.colors.text.tertiary} />
              )}
            </PressableCard>
          );
        })}
      </View>

      <Button
        title="Enviar para processamento"
        disabled={totalPhotos === 0 || job?.status === 'queued' || job?.status === 'running'}
        onPress={() => void process()}
      />
      <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
        A peça entra em quarentena até um segundo especialista revisar no painel.
      </Text>
    </Screen>
  );
}
