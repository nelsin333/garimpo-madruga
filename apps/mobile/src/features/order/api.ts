// Acesso a dados do fluxo transacional.
//
// Toda escrita financeira passa por Edge Function: o app não insere pedido,
// pagamento, remessa nem saque, e as RLS/GRANTs do banco garantem isso mesmo
// que alguém chame o PostgREST direto. Aqui só lemos e invocamos as rotas.
import type { DisputeReason, OrderStatus, PaymentMethod, ShipmentStatus } from '@garimpo/contracts';
import type { Json } from '@garimpo/db';
import { supabase } from '@/lib/supabase';

/** Erro com o código estável devolvido pelo backend (para traduzir na tela). */
export class OrderApiError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OrderApiError';
  }
}

/**
 * supabase-js embrulha respostas de erro das functions; o corpo com o código
 * fica no contexto da resposta. Sem isto o app mostraria "Edge Function
 * returned a non-2xx status code" ao usuário.
 */
async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data as T;

  const response = (error as { context?: Response }).context;
  if (response && typeof response.json === 'function') {
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) throw new OrderApiError(payload.error);
    } catch (parsed) {
      if (parsed instanceof OrderApiError) throw parsed;
    }
  }
  throw new OrderApiError('unknown', error.message);
}

// ---------- Endereços ----------

export interface Address {
  id: string;
  label: string | null;
  recipient_name: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  is_default: boolean;
}

export async function fetchAddresses(profileId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select(
      'id, label, recipient_name, zip_code, street, number, complement, district, city, state, is_default',
    )
    .eq('profile_id', profileId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface AddressInput {
  label?: string | null;
  recipient_name: string;
  zip_code: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  is_default?: boolean;
}

export async function saveAddress(profileId: string, input: AddressInput): Promise<Address> {
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...input, zip_code: input.zip_code.replace(/\D/g, ''), profile_id: profileId })
    .select(
      'id, label, recipient_name, zip_code, street, number, complement, district, city, state, is_default',
    )
    .single();
  if (error) throw error;
  return data;
}

// ---------- Frete ----------

export interface ShippingQuote {
  id: string;
  service_name: string;
  carrier: string;
  price_cents: number;
  estimated_days: number | null;
  expires_at: string;
}

export function quoteShipping(listingId: string, addressId: string): Promise<ShippingQuote[]> {
  return invoke<{ quotes: ShippingQuote[] }>('shipping-quote', {
    listing_id: listingId,
    address_id: addressId,
  }).then((result) => result.quotes);
}

// ---------- Pedido ----------

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  item_cents: number;
  shipping_cents: number;
  buyer_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  created_at: string;
}

export function createOrder(input: {
  listingId: string;
  addressId: string;
  quoteId?: string;
  idempotencyKey: string;
}): Promise<OrderSummary> {
  return invoke<{ order: OrderSummary }>('create-order', {
    listing_id: input.listingId,
    address_id: input.addressId,
    quote_id: input.quoteId,
    idempotency_key: input.idempotencyKey,
  }).then((result) => result.order);
}

export interface OrderListItem {
  id: string;
  status: OrderStatus;
  total_cents: number;
  created_at: string;
  listing: { id: string; title: string; photo: string | null };
  counterparty: { username: string; display_name: string | null };
}

interface OrderJoinRow {
  id: string;
  status: OrderStatus;
  total_cents: number;
  created_at: string;
  buyer_id: string;
  seller_id: string;
  listings: { id: string; title: string; listing_photos: { storage_path: string }[] } | null;
  buyer: { username: string; display_name: string | null } | null;
  seller: { username: string; display_name: string | null } | null;
}

const ORDER_LIST_SELECT = `
  id, status, total_cents, created_at, buyer_id, seller_id,
  listings!inner (id, title, listing_photos (storage_path)),
  buyer:profiles!orders_buyer_id_fkey (username, display_name),
  seller:profiles!orders_seller_id_fkey (username, display_name)
`;

function toListItem(row: OrderJoinRow, side: 'buying' | 'selling'): OrderListItem {
  const other = side === 'buying' ? row.seller : row.buyer;
  return {
    id: row.id,
    status: row.status,
    total_cents: row.total_cents,
    created_at: row.created_at,
    listing: {
      id: row.listings?.id ?? '',
      title: row.listings?.title ?? 'Peça',
      photo: row.listings?.listing_photos?.[0]?.storage_path ?? null,
    },
    counterparty: {
      username: other?.username ?? '',
      display_name: other?.display_name ?? null,
    },
  };
}

/** `side` decide o papel: compras do usuário ou vendas dele. */
export async function fetchOrders(
  profileId: string,
  side: 'buying' | 'selling',
): Promise<OrderListItem[]> {
  const column = side === 'buying' ? 'buyer_id' : 'seller_id';
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_LIST_SELECT)
    .eq(column, profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as OrderJoinRow[]).map((row) => toListItem(row, side));
}

export interface OrderDetail {
  id: string;
  status: OrderStatus;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  item_cents: number;
  shipping_cents: number;
  buyer_fee_cents: number;
  platform_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  seller_amount_cents: number;
  shipping_address: Json;
  shipping_option: Json;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  escrow_release_at: string | null;
  created_at: string;
  listing: { id: string; title: string; photo: string | null };
  payment: {
    id: string;
    method: PaymentMethod;
    status: string;
    checkout: Json;
  } | null;
  shipment: {
    id: string;
    status: ShipmentStatus;
    tracking_code: string | null;
    label_url: string | null;
    service_name: string | null;
  } | null;
  events: { id: string; kind: string; to_status: OrderStatus | null; created_at: string }[];
  dispute: { id: string; status: string; reason: DisputeReason } | null;
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `id, status, buyer_id, seller_id, listing_id, item_cents, shipping_cents, buyer_fee_cents,
       platform_fee_cents, discount_cents, total_cents, seller_amount_cents, shipping_address,
       shipping_option, paid_at, shipped_at, delivered_at, escrow_release_at, created_at,
       listings!inner (id, title, listing_photos (storage_path)),
       shipments (id, status, tracking_code, label_url, service_name),
       order_events (id, kind, to_status, created_at),
       disputes (id, status, reason)`,
    )
    .eq('id', orderId)
    .single();
  if (error) throw error;

  const row = order as unknown as Record<string, never> & {
    listings: { id: string; title: string; listing_photos: { storage_path: string }[] } | null;
    shipments: OrderDetail['shipment'][];
    order_events: OrderDetail['events'];
    disputes: OrderDetail['dispute'][];
  };

  // payment_attempts só é visível para o comprador (RLS): para o vendedor a
  // consulta volta vazia, e a tela dele não mostra dados de pagamento.
  const { data: payment } = await supabase
    .from('payment_attempts')
    .select('id, method, status, checkout')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ...(order as unknown as OrderDetail),
    listing: {
      id: row.listings?.id ?? '',
      title: row.listings?.title ?? 'Peça',
      photo: row.listings?.listing_photos?.[0]?.storage_path ?? null,
    },
    payment: (payment as OrderDetail['payment']) ?? null,
    shipment: row.shipments?.[0] ?? null,
    events: (row.order_events ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    dispute: row.disputes?.[0] ?? null,
  };
}

// ---------- Pagamento ----------

export interface PaymentCheckout {
  id: string;
  status: string;
  external_id: string | null;
  checkout: {
    qrCode?: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
    checkoutUrl?: string;
    expiresAt?: string;
  };
  amount_cents: number;
}

export function createPayment(orderId: string, method: PaymentMethod): Promise<PaymentCheckout> {
  return invoke<{ payment: PaymentCheckout }>('create-payment', {
    order_id: orderId,
    method,
  }).then((result) => result.payment);
}

// ---------- Envio ----------

export function createShipment(orderId: string): Promise<{
  id: string;
  status: ShipmentStatus;
  tracking_code: string | null;
  label_url: string | null;
}> {
  return invoke<{
    shipment: {
      id: string;
      status: ShipmentStatus;
      tracking_code: string | null;
      label_url: string | null;
    };
  }>('create-shipment', { order_id: orderId }).then((result) => result.shipment);
}

export function confirmDelivery(orderId: string): Promise<{ status: string }> {
  return invoke<{ status: string }>('confirm-delivery', { order_id: orderId });
}

// ---------- Disputa ----------

export function openDispute(input: {
  orderId: string;
  reason: DisputeReason;
  description: string;
}): Promise<{ id: string; status: string }> {
  return invoke<{ dispute: { id: string; status: string } }>('open-dispute', {
    order_id: input.orderId,
    reason: input.reason,
    description: input.description,
  }).then((result) => result.dispute);
}

// ---------- Conta do vendedor e saque ----------

export interface SellerAccount {
  kyc_status: 'not_started' | 'pending' | 'approved' | 'rejected';
  kyc_rejection_reason: string | null;
  legal_name: string | null;
  document_masked: string | null;
  payout_method: 'pix' | 'bank_transfer' | null;
  payout_key_masked: string | null;
  pending_balance_cents: number;
  available_balance_cents: number;
}

export async function fetchSellerAccount(profileId: string): Promise<SellerAccount | null> {
  const { data, error } = await supabase
    .from('seller_accounts')
    .select(
      'kyc_status, kyc_rejection_reason, legal_name, document_masked, payout_method, payout_key_masked, pending_balance_cents, available_balance_cents',
    )
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface Payout {
  id: string;
  amount_cents: number;
  status: 'requested' | 'processing' | 'paid' | 'failed';
  requested_at: string;
  paid_at: string | null;
}

export async function fetchPayouts(profileId: string): Promise<Payout[]> {
  const { data, error } = await supabase
    .from('payouts')
    .select('id, amount_cents, status, requested_at, paid_at')
    .eq('profile_id', profileId)
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function requestPayout(amountCents: number): Promise<Payout> {
  return invoke<{ payout: Payout }>('request-payout', { amount_cents: amountCents }).then(
    (result) => result.payout,
  );
}
