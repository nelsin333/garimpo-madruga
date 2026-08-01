import { Button, Screen, Text, useTheme } from '@garimpo/ui';
import { router } from 'expo-router';
import { View } from 'react-native';
import { WizardHeader } from '@/features/check/components/WizardHeader';
import { PhotoSlot } from '@/features/check/components/PhotoSlot';
import { requiredProgress, useCheckWizard } from '@/features/check/store';

export default function PhotosStep() {
  const theme = useTheme();
  const checklist = useCheckWizard((s) => s.checklist);
  const photos = useCheckWizard((s) => s.photos);

  const progress = requiredProgress(checklist, photos);
  const uploading = Object.values(photos).some((p) => p.upload === 'uploading');

  return (
    <Screen>
      <WizardHeader
        title="Captura das fotos"
        subtitle={`${progress.done} de ${progress.total} obrigatórias concluídas.`}
        step={5}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md }}>
        {checklist.map((step) => (
          <PhotoSlot
            key={step.region}
            step={step}
            photo={photos[step.region]}
            onPress={() =>
              router.push({ pathname: '/check/new/capture', params: { region: step.region } })
            }
          />
        ))}
      </View>

      {!progress.complete ? (
        <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
          Complete as fotos obrigatórias para continuar.
        </Text>
      ) : null}

      <Button
        title={uploading ? 'Enviando fotos…' : 'Revisar e enviar'}
        disabled={!progress.complete || uploading}
        loading={uploading}
        onPress={() => router.push('/check/new/review')}
      />
    </Screen>
  );
}
