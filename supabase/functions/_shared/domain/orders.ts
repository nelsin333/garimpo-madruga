// Máquina de estados do pedido — espelho exato da tabela order_transitions.
// O banco é a autoridade final (apply_order_transition valida de novo), mas
// as Edge Functions checam antes para falhar cedo e com mensagem clara.

export const ORDER_STATUSES = [
  'pending_payment',
  'payment_processing',
  'paid',
  'preparing_shipment',
  'shipped',
  'delivered',
  'completed',
  'payment_failed',
  'expired',
  'cancelled',
  'disputed',
  'returned',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['payment_processing', 'paid', 'payment_failed', 'expired', 'cancelled'],
  payment_processing: ['paid', 'payment_failed', 'cancelled'],
  payment_failed: ['pending_payment', 'cancelled'],
  paid: ['preparing_shipment', 'cancelled', 'disputed', 'refunded'],
  preparing_shipment: ['shipped', 'disputed', 'cancelled'],
  shipped: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  disputed: ['completed', 'refunded', 'returned'],
  returned: ['refunded'],
  completed: [],
  cancelled: [],
  expired: [],
  refunded: [],
};

/** Estados finais: o pedido não muda mais. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'completed',
  'cancelled',
  'expired',
  'refunded',
];

/** Estados em que o anúncio continua indisponível para outros compradores. */
export const LIVE_STATUSES: readonly OrderStatus[] = [
  'pending_payment',
  'payment_processing',
  'paid',
  'preparing_shipment',
  'shipped',
  'delivered',
  'completed',
  'disputed',
  'returned',
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true; // idempotente, como no banco
  return ORDER_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** O comprador pode abrir disputa depois de pagar e até a conclusão. */
export function canOpenDispute(status: OrderStatus): boolean {
  return ['paid', 'preparing_shipment', 'shipped', 'delivered'].includes(status);
}

/** O vendedor só despacha depois do pagamento confirmado. */
export function canSellerShip(status: OrderStatus): boolean {
  return status === 'paid' || status === 'preparing_shipment';
}

// ---------- Mapeamento provedor → domínio ----------

export type ProviderPaymentStatus =
  'created' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';

/**
 * Transição a aplicar, ou `null` quando não há nada a fazer.
 *
 * Dois casos viram `null`: a transição é inválida a partir do estado atual
 * (webhook atrasado chegando num pedido já cancelado, por exemplo) e o pedido
 * já está no estado de destino (webhook reentregue). Assim o chamador só
 * escreve no banco quando o estado realmente muda.
 */
function nextStatus(from: OrderStatus, to: OrderStatus): OrderStatus | null {
  if (from === to) return null;
  return canTransition(from, to) ? to : null;
}

/**
 * Estado do pagamento → transição a aplicar no pedido.
 * `null` significa "nada a fazer" (ex.: pagamento ainda pendente num pedido
 * que já está processando).
 */
export function orderStatusForPayment(
  paymentStatus: ProviderPaymentStatus,
  currentOrderStatus: OrderStatus,
): OrderStatus | null {
  switch (paymentStatus) {
    case 'approved':
      return nextStatus(currentOrderStatus, 'paid');
    case 'pending':
      return currentOrderStatus === 'pending_payment' ? 'payment_processing' : null;
    case 'rejected':
      return nextStatus(currentOrderStatus, 'payment_failed');
    case 'cancelled':
      return nextStatus(currentOrderStatus, 'cancelled');
    case 'refunded':
    case 'charged_back':
      return nextStatus(currentOrderStatus, 'refunded');
    case 'created':
      return null;
  }
}

// ---------- Frete ----------

export type ShipmentStatus =
  'pending' | 'label_created' | 'posted' | 'in_transit' | 'delivered' | 'returned' | 'cancelled';

/** Status da remessa → transição do pedido (quando houver). */
export function orderStatusForShipment(
  shipmentStatus: ShipmentStatus,
  currentOrderStatus: OrderStatus,
): OrderStatus | null {
  switch (shipmentStatus) {
    case 'label_created':
      return nextStatus(currentOrderStatus, 'preparing_shipment');
    case 'posted':
    case 'in_transit':
      return nextStatus(currentOrderStatus, 'shipped');
    case 'delivered':
      return nextStatus(currentOrderStatus, 'delivered');
    case 'returned':
      return nextStatus(currentOrderStatus, 'returned');
    default:
      return null;
  }
}
