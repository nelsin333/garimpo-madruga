import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, type OrderStatus } from '@garimpo/contracts';
import { Text, useTheme } from '@garimpo/ui';
import { View } from 'react-native';

export interface OrderStatusBadgeProps {
  status: OrderStatus;
}

/**
 * Estado do pedido em uma pílula. As cores de risco do DS são reservadas para
 * autenticidade, então usamos as de feedback.
 */
export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const theme = useTheme();
  const color = {
    pending: theme.colors.feedback.warning,
    progress: theme.colors.feedback.info,
    success: theme.colors.feedback.success,
    danger: theme.colors.feedback.danger,
  }[ORDER_STATUS_TONE[status]];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.xs,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text variant="caption" style={{ color }}>
        {ORDER_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
