// Vocabulário do fluxo transacional compartilhado entre app e backend.
// A máquina de estados canônica vive em supabase/functions/_shared/domain —
// aqui ficam apenas rótulos e derivações de apresentação.

export type OrderStatus =
  | 'pending_payment'
  | 'payment_processing'
  | 'paid'
  | 'preparing_shipment'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'payment_failed'
  | 'expired'
  | 'cancelled'
  | 'disputed'
  | 'returned'
  | 'refunded';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Aguardando pagamento',
  payment_processing: 'Processando pagamento',
  paid: 'Pago',
  preparing_shipment: 'Preparando envio',
  shipped: 'A caminho',
  delivered: 'Entregue',
  completed: 'Concluído',
  payment_failed: 'Pagamento recusado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
  disputed: 'Em disputa',
  returned: 'Devolvido',
  refunded: 'Reembolsado',
};

/** O que o comprador vê como "o pedido acabou bem/mal/está andando". */
export type OrderTone = 'pending' | 'progress' | 'success' | 'danger';

export const ORDER_STATUS_TONE: Record<OrderStatus, OrderTone> = {
  pending_payment: 'pending',
  payment_processing: 'pending',
  paid: 'progress',
  preparing_shipment: 'progress',
  shipped: 'progress',
  delivered: 'progress',
  completed: 'success',
  payment_failed: 'danger',
  expired: 'danger',
  cancelled: 'danger',
  disputed: 'danger',
  returned: 'danger',
  refunded: 'danger',
};

/** Etapas mostradas na linha do tempo do pedido, em ordem. */
export const ORDER_TIMELINE: readonly OrderStatus[] = [
  'pending_payment',
  'paid',
  'preparing_shipment',
  'shipped',
  'delivered',
  'completed',
];

/**
 * Índice do pedido na linha do tempo. Estados fora do caminho feliz
 * (cancelado, disputa…) devolvem -1: a tela mostra o estado, não a régua.
 */
export function orderTimelineIndex(status: OrderStatus): number {
  if (status === 'payment_processing') return ORDER_TIMELINE.indexOf('pending_payment');
  return ORDER_TIMELINE.indexOf(status);
}

export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  boleto: 'Boleto',
};

export type ShipmentStatus =
  'pending' | 'label_created' | 'posted' | 'in_transit' | 'delivered' | 'returned' | 'cancelled';

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Aguardando etiqueta',
  label_created: 'Etiqueta emitida',
  posted: 'Postado',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  returned: 'Devolvido',
  cancelled: 'Cancelado',
};

export type DisputeReason =
  'not_received' | 'not_as_described' | 'damaged' | 'suspected_fake' | 'other';

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  not_received: 'Não recebi o produto',
  not_as_described: 'Diferente do anunciado',
  damaged: 'Chegou danificado',
  suspected_fake: 'Suspeita de falsificação',
  other: 'Outro motivo',
};

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Aberta',
  under_review: 'Em análise',
  resolved: 'Resolvida',
  closed: 'Encerrada',
};

export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected';

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  not_started: 'Não iniciada',
  pending: 'Em análise',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

export type PayoutStatus = 'requested' | 'processing' | 'paid' | 'failed';

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  requested: 'Solicitado',
  processing: 'Processando',
  paid: 'Pago',
  failed: 'Falhou',
};

/** Mensagens de erro do backend em português, para o app não vazar códigos. */
export const ORDER_ERROR_MESSAGES: Record<string, string> = {
  listing_not_found: 'Anúncio não encontrado.',
  listing_not_available: 'Este anúncio não está mais disponível.',
  listing_without_price: 'O anúncio ainda não tem preço definido.',
  cannot_buy_own_listing: 'Você não pode comprar o próprio anúncio.',
  address_not_found: 'Endereço não encontrado.',
  quote_not_found: 'Cotação de frete não encontrada.',
  quote_mismatch: 'A cotação de frete não corresponde a este anúncio.',
  quote_expired: 'A cotação de frete expirou. Calcule o frete novamente.',
  no_shipping_options: 'Nenhuma opção de frete disponível para este endereço.',
  seller_without_origin_address: 'O vendedor ainda não cadastrou o endereço de origem.',
  order_not_payable: 'Este pedido não está aguardando pagamento.',
  order_not_shippable: 'O pedido ainda não pode ser enviado.',
  order_not_disputable: 'Não é possível abrir disputa neste momento.',
  order_not_confirmable: 'Ainda não é possível confirmar o recebimento.',
  order_without_shipping_service: 'O pedido não tem serviço de frete selecionado.',
  payment_provider_unavailable: 'Pagamento indisponível no momento. Tente mais tarde.',
  shipping_provider_unavailable: 'Cálculo de frete indisponível no momento.',
  kyc_not_approved: 'Conclua a verificação de identidade para sacar.',
  insufficient_balance: 'Saldo disponível insuficiente.',
  invalid_amount: 'Valor inválido.',
  forbidden: 'Você não tem permissão para esta ação.',
};

export function orderErrorMessage(code: string | null | undefined): string {
  if (!code) return 'Não foi possível concluir. Tente novamente.';
  return ORDER_ERROR_MESSAGES[code] ?? 'Não foi possível concluir. Tente novamente.';
}
