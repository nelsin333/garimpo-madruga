import Ionicons from '@expo/vector-icons/Ionicons';
import { ProgressBar, Text, useTheme } from '@garimpo/ui';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

export interface WizardHeaderProps {
  title: string;
  subtitle?: string;
  step: number;
  totalSteps?: number;
  onClose?: () => void;
}

const TOTAL_STEPS = 6;

/** Cabeçalho padrão do wizard: voltar/fechar, título e progresso do funil. */
export function WizardHeader({
  title,
  subtitle,
  step,
  totalSteps = TOTAL_STEPS,
  onClose,
}: WizardHeaderProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? 'Fechar' : 'Voltar'}
          hitSlop={theme.space.md}
          onPress={() => (onClose ? onClose() : router.back())}
        >
          <Ionicons
            name={step === 1 ? 'close' : 'chevron-back'}
            size={26}
            color={theme.colors.text.primary}
          />
        </Pressable>
        <Text variant="caption" color="tertiary">
          Etapa {step} de {totalSteps}
        </Text>
      </View>
      <ProgressBar progress={step / totalSteps} height={4} />
      <View style={{ gap: theme.space.xs }}>
        <Text variant="titleLg">{title}</Text>
        {subtitle ? <Text color="secondary">{subtitle}</Text> : null}
      </View>
    </View>
  );
}
