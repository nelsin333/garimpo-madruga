import {
  ORDER_STATUS_LABELS,
  ORDER_TIMELINE,
  orderTimelineIndex,
  type OrderStatus,
} from '@garimpo/contracts';
import { Text, useTheme } from '@garimpo/ui';
import { View } from 'react-native';

export interface OrderTimelineProps {
  status: OrderStatus;
}

/**
 * Régua do caminho feliz. Pedidos fora dele (cancelado, disputa, reembolso)
 * não têm posição na régua — a tela mostra o estado em destaque no lugar.
 */
export function OrderTimeline({ status }: OrderTimelineProps) {
  const theme = useTheme();
  const current = orderTimelineIndex(status);
  if (current < 0) return null;

  return (
    <View style={{ gap: theme.space.md }}>
      {ORDER_TIMELINE.map((step, index) => {
        const done = index <= current;
        const color = done ? theme.colors.brand.primary : theme.colors.border.strong;
        return (
          <View
            key={step}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}
          >
            <View style={{ alignItems: 'center', width: 16 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: color,
                  backgroundColor: done ? color : 'transparent',
                }}
              />
              {index < ORDER_TIMELINE.length - 1 ? (
                <View style={{ width: 2, height: theme.space.lg, backgroundColor: color }} />
              ) : null}
            </View>
            <Text variant="bodyMedium" color={done ? 'primary' : 'tertiary'}>
              {ORDER_STATUS_LABELS[step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
