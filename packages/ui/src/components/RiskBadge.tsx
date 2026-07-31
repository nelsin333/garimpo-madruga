import { View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export type Risk = 'low' | 'medium' | 'high' | 'inconclusive';

const LABELS: Record<Risk, string> = {
  low: 'Baixo risco',
  medium: 'Médio risco',
  high: 'Alto risco',
  inconclusive: 'Inconclusivo',
};

// Acessibilidade: risco nunca é só cor — o ponto + label fazem parte do componente.
export function RiskBadge({ risk, size = 'md' }: { risk: Risk; size?: 'sm' | 'md' }) {
  const theme = useTheme();
  const color = theme.colors.risk[risk];

  return (
    <View
      accessibilityLabel={`Nível de risco: ${LABELS[risk]}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.space.sm,
        backgroundColor: `${color}22`,
        borderRadius: theme.radius.pill,
        paddingHorizontal: size === 'md' ? theme.space.md : theme.space.sm,
        paddingVertical: size === 'md' ? 6 : 3,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption" style={{ color }}>
        {LABELS[risk]}
      </Text>
    </View>
  );
}
