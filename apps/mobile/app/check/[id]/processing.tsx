import Ionicons from '@expo/vector-icons/Ionicons';
import { JOB_STAGES, JOB_STAGE_LABELS, type JobStage } from '@garimpo/contracts';
import { Button, Card, ProgressBar, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { cancelCheck, fetchCheckWithJob } from '@/features/check/api';
import { supabase } from '@/lib/supabase';

export default function ProcessingScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data } = useQuery({
    queryKey: ['check-processing', id],
    queryFn: () => fetchCheckWithJob(id),
    refetchInterval: (query) => {
      const status = query.state.data?.check.status;
      return status === 'completed' || status === 'failed' || status === 'cancelled' ? false : 1500;
    },
  });

  // Realtime como caminho rápido; o polling acima é o fallback.
  useEffect(() => {
    const channel = supabase
      .channel(`check-job-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'check_jobs', filter: `check_id=eq.${id}` },
        () => void queryClient.invalidateQueries({ queryKey: ['check-processing', id] }),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [id, queryClient]);

  const status = data?.check.status;
  useEffect(() => {
    if (status === 'completed') {
      router.replace({ pathname: '/check/[id]/report', params: { id } });
    }
  }, [status, id]);

  const job = data?.job;
  const currentStageIndex = job?.stage ? JOB_STAGES.indexOf(job.stage as JobStage) : -1;
  const pieceName = [data?.check.brands?.name, data?.check.categories?.name]
    .filter(Boolean)
    .join(' · ');

  const failed = status === 'failed' || job?.status === 'failed';
  const cancelled = status === 'cancelled';

  return (
    <Screen>
      <View style={{ gap: theme.space.xs, marginTop: theme.space['2xl'] }}>
        <Text variant="titleLg">{failed ? 'Algo deu errado' : 'Analisando sua peça'}</Text>
        <Text color="secondary">{pieceName || 'Legit check em andamento'}</Text>
      </View>

      {failed ? (
        <Card style={{ gap: theme.space.lg }}>
          <Text color="secondary">
            Não conseguimos concluir a análise. Nenhum crédito foi consumido — tente novamente em
            instantes.
          </Text>
          <Button
            variant="secondary"
            title="Voltar ao início"
            onPress={() => router.dismissAll()}
          />
        </Card>
      ) : cancelled ? (
        <Card style={{ gap: theme.space.lg }}>
          <Text color="secondary">Análise cancelada.</Text>
          <Button
            variant="secondary"
            title="Voltar ao início"
            onPress={() => router.dismissAll()}
          />
        </Card>
      ) : (
        <>
          <ProgressBar progress={(job?.progress ?? 2) / 100} />

          <Card style={{ gap: theme.space.lg }}>
            {JOB_STAGES.map((stage, index) => {
              const done = currentStageIndex > index || status === 'completed';
              const active = currentStageIndex === index;
              return (
                <View
                  key={stage}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}
                >
                  {done ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={theme.colors.feedback.success}
                    />
                  ) : active ? (
                    <ActivityIndicator size="small" color={theme.colors.brand.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={theme.colors.text.tertiary} />
                  )}
                  <Text
                    variant={active ? 'bodyMedium' : 'body'}
                    color={done || active ? 'primary' : 'tertiary'}
                  >
                    {JOB_STAGE_LABELS[stage]}
                  </Text>
                </View>
              );
            })}
          </Card>

          <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
            Você pode sair — avisaremos quando o laudo ficar pronto.
          </Text>

          <Button
            variant="ghost"
            size="md"
            title="Cancelar análise"
            onPress={() =>
              Alert.alert('Cancelar análise?', 'O check será interrompido.', [
                { text: 'Continuar analisando', style: 'cancel' },
                {
                  text: 'Cancelar check',
                  style: 'destructive',
                  onPress: () => {
                    void cancelCheck(id).then(() =>
                      queryClient.invalidateQueries({ queryKey: ['check-processing', id] }),
                    );
                  },
                },
              ])
            }
          />
        </>
      )}
    </Screen>
  );
}
