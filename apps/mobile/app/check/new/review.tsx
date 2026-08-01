import { Button, Card, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Alert, View } from 'react-native';
import { submitCheck } from '@/features/check/api';
import { PhotoSlot } from '@/features/check/components/PhotoSlot';
import { WizardHeader } from '@/features/check/components/WizardHeader';
import { requiredProgress, useCheckWizard } from '@/features/check/store';

export default function ReviewStep() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const wizard = useCheckWizard();

  const captured = wizard.checklist.filter((s) => wizard.photos[s.region]);
  const progress = requiredProgress(wizard.checklist, wizard.photos);

  const submit = useMutation({
    mutationFn: () => submitCheck(wizard.checkId!),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const checkId = wizard.checkId!;
      wizard.reset();
      void queryClient.invalidateQueries({ queryKey: ['checks'] });
      router.dismissAll();
      router.replace({ pathname: '/check/[id]/processing', params: { id: checkId } });
    },
    onError: () =>
      Alert.alert(
        'Não foi possível enviar',
        'Confira sua conexão e se todas as fotos obrigatórias foram enviadas.',
      ),
  });

  return (
    <Screen>
      <WizardHeader
        title="Revise antes de enviar"
        subtitle="Toque em qualquer foto para substituí-la."
        step={6}
      />

      <Card style={{ gap: theme.space.xs }}>
        <Text variant="caption" color="tertiary">
          PEÇA
        </Text>
        <Text variant="title">
          {[wizard.brand?.name, wizard.product?.name].filter(Boolean).join(' ') ||
            'Modelo a identificar'}
        </Text>
        <Text variant="caption" color="secondary">
          {wizard.category?.name} · {captured.length} fotos
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md }}>
        {captured.map((step) => (
          <PhotoSlot
            key={step.region}
            step={step}
            photo={wizard.photos[step.region]}
            onPress={() =>
              router.push({ pathname: '/check/new/capture', params: { region: step.region } })
            }
          />
        ))}
      </View>

      <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
        Ao enviar, você concorda que a análise é probabilística e baseada nas fotos enviadas.
      </Text>

      <Button
        title="Enviar para análise"
        loading={submit.isPending}
        disabled={!progress.complete || !wizard.checkId}
        onPress={() => submit.mutate()}
      />
    </Screen>
  );
}
