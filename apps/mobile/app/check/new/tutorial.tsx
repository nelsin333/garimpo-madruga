import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { ensureCheck, fetchChecklist } from '@/features/check/api';
import { WizardHeader } from '@/features/check/components/WizardHeader';
import { regionIcon } from '@/features/check/regions';
import { useCheckWizard } from '@/features/check/store';

export default function TutorialStep() {
  const theme = useTheme();
  const { session } = useAuth();
  const wizard = useCheckWizard();

  const { data: checklist, isPending } = useQuery({
    queryKey: ['wizard-checklist', wizard.category?.id, wizard.brand?.id],
    enabled: !!wizard.category,
    queryFn: () =>
      fetchChecklist(wizard.category!.id, wizard.category!.slug, wizard.brand?.id ?? null),
  });

  const start = useMutation({
    mutationFn: async () => {
      wizard.setChecklist(checklist!);
      const checkId = await ensureCheck({
        checkId: wizard.checkId,
        profileId: session!.user.id,
        category: wizard.category!,
        brand: wizard.brand,
        product: wizard.product,
      });
      wizard.setCheckId(checkId);
    },
    onSuccess: () => router.push('/check/new/photos'),
    onError: () =>
      Alert.alert('Não foi possível iniciar', 'Verifique sua conexão e tente de novo.'),
  });

  const required = (checklist ?? []).filter((s) => s.required);
  const optional = (checklist ?? []).filter((s) => !s.required);

  return (
    <Screen>
      <WizardHeader
        title="As fotos que vamos precisar"
        subtitle={`${wizard.brand?.name ?? 'Peça'} · ${wizard.category?.name ?? ''}. Quanto melhores as fotos, mais preciso o laudo.`}
        step={4}
      />

      {isPending ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : (
        <>
          <View style={{ gap: theme.space.md }}>
            <Text variant="caption" color="tertiary">
              OBRIGATÓRIAS ({required.length})
            </Text>
            {required.map((step) => (
              <Card
                key={step.region}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}
              >
                <Ionicons
                  name={regionIcon(step.region)}
                  size={22}
                  color={theme.colors.brand.primary}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyMedium">{step.label}</Text>
                  <Text variant="caption" color="secondary">
                    {step.hint}
                  </Text>
                </View>
              </Card>
            ))}
          </View>

          {optional.length > 0 ? (
            <View style={{ gap: theme.space.md }}>
              <Text variant="caption" color="tertiary">
                OPCIONAIS — AUMENTAM A PRECISÃO ({optional.length})
              </Text>
              {optional.map((step) => (
                <Card
                  key={step.region}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space.md,
                    opacity: 0.75,
                  }}
                >
                  <Ionicons
                    name={regionIcon(step.region)}
                    size={22}
                    color={theme.colors.text.secondary}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyMedium">{step.label}</Text>
                    <Text variant="caption" color="secondary">
                      {step.hint}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          <Button
            title="Começar as fotos"
            onPress={() => start.mutate()}
            loading={start.isPending}
            disabled={!checklist || !session}
          />
        </>
      )}
    </Screen>
  );
}
