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
      // Webhook atrasado/reentregue pode chegar com o pedido já adiante
      // (shipped, completed…). Nesse caso não há nada a fazer — voltar para
      // 'paid' seria uma transição inválida.
      return canTransition(currentOrderStatus, 'paid') && currentOrderStatus !== 'paid'
        ? 'paid'
        : null;
    case 'pending':
      return currentOrderStatus === 'pending_payment' ? 'payment_processing' : null;
    case 'rejected':
      return canTransition(currentOrderStatus, 'payment_failed') ? 'payment_failed' : null;
    case 'cancelled':
      return canTransition(currentOrderStatus, 'cancelled') ? 'cancelled' : null;
    case 'refunded':
    case 'charged_back':
      return canTransition(currentOrderStatus, 'refunded') ? 'refunded' : null;
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
      return canTransition(currentOrderStatus, 'preparing_shipment') ? 'preparing_shipment' : null;
    case 'posted':
    case 'in_transit':
      return canTransition(currentOrderStatus, 'shipped') ? 'shipped' : null;
    case 'delivered':
      return canTransition(currentOrderStatus, 'delivered') ? 'delivered' : null;
    case 'returned':
      return canTransition(currentOrderStatus, 'returned') ? 'returned' : null;
    default:
      return null;
  }
}
