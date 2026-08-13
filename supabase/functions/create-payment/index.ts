// Inicia o pagamento de um pedido. Entrada: { order_id, method }.
//
// O valor cobrado é o total gravado no pedido — o cliente não envia valor.
// A tentativa é idempotente: repetir a chamada para o mesmo pedido e método
// devolve o mesmo pagamento em vez de criar outro.
import { corsHeaders, json, serviceClient } from '../_shared/client.ts';
import { requireUser } from '../_shared/auth.ts';
import { MercadoPagoProvider } from '../_shared/payments/mercadopago.ts';
import type { PaymentMethod } from '../_shared/payments/provider.ts';
import { orderStatusForPayment, type OrderStatus } from '../_shared/domain/orders.ts';

const METHODS: PaymentMethod[] = ['pix', 'credit_card', 'boleto'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let orderId: string | undefined;
  let method: PaymentMethod = 'pix';
  try {
    const body = await req.json();
    orderId = body.order_id;
    if (body.method) method = body.method;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!orderId) return json({ error: 'order_id_required' }, 400);
  if (!METHODS.includes(method)) return json({ error: 'unsupported_method' }, 400);

  const provider = new MercadoPagoProvider();
  if (!provider.isConfigured()) return json({ error: 'payment_provider_unavailable' }, 503);

  const service = serviceClient();
  const { data: order, error: orderError } = await service
    .from('orders')
    .select('id, buyer_id, seller_id, status, total_cents, platform_fee_cents, listing_id')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 500);
  if (!order) return json({ error: 'order_not_found' }, 404);

  // Só o comprador paga, e só enquanto o pedido aceita pagamento.
  if (order.buyer_id !== user.id) return json({ error: 'forbidden' }, 403);
  let status = order.status as OrderStatus;
  if (status !== 'pending_payment' && status !== 'payment_failed') {
    return json({ error: 'order_not_payable', status }, 409);
  }

  // Nova tentativa depois de uma recusa: o pedido volta a aguardar pagamento
  // antes de criarmos a cobrança, senão a confirmação não teria como entrar.
  if (status === 'payment_failed') {
    const { error } = await service.rpc('apply_order_transition', {
      p_order_id: order.id,
      p_to_status: 'pending_payment',
      p_kind: 'payment_retry',
      p_actor_id: user.id,
      p_actor_kind: 'buyer',
      p_data: {},
    });
    if (error) return json({ error: error.message }, 500);
    status = 'pending_payment';
  }

  // Idempotência: uma tentativa viva por pedido+método é reaproveitada.
  const idempotencyKey = `${order.id}:${method}`;
  const { data: existing } = await service
    .from('payment_attempts')
    .select('id, status, external_id, checkout, amount_cents')
    .eq('order_id', order.id)
    .eq('method', method)
    .in('status', ['created', 'pending'])
    .maybeSingle();
  if (existing?.external_id) {
    return json({ payment: existing }, 200);
  }

  const { data: sellerAccount } = await service
    .from('seller_accounts')
    .select('provider_account_id')
    .eq('profile_id', order.seller_id)
    .maybeSingle();

  const { data: listing } = await service
    .from('listings')
    .select('title')
    .eq('id', order.listing_id)
    .maybeSingle();

  let created;
  try {
    created = await provider.createPayment({
      orderId: order.id,
      amountCents: order.total_cents,
      method,
      description: listing?.title ?? 'Pedido Garimpo Madruga',
      payer: { email: user.email ?? '' },
      metadata: { order_id: order.id },
      platformFeeCents: order.platform_fee_cents,
      sellerAccountId: sellerAccount?.provider_account_id ?? null,
      idempotencyKey,
    });
  } catch (error) {
    return json({ error: 'payment_creation_failed', detail: String(error) }, 502);
  }

  const { data: attempt, error: attemptError } = await service
    .from('payment_attempts')
    .upsert(
      {
        order_id: order.id,
        provider: provider.name,
        method,
        status: created.status,
        amount_cents: order.total_cents,
        external_id: created.externalId,
        checkout: created.checkout,
        raw_status: created.rawStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,external_id' },
    )
    .select('id, status, external_id, checkout, amount_cents')
    .single();
  if (attemptError) return json({ error: attemptError.message }, 500);

  await service
    .from('orders')
    .update({ external_payment_id: created.externalId })
    .eq('id', order.id);

  // Pix criado ainda não é pagamento: o normal é o pedido ir para
  // payment_processing e só virar 'paid' quando o webhook confirmar, com
  // consulta nossa ao provedor. Cartão aprovado na hora já vem 'approved'.
  const next = orderStatusForPayment(created.status, status);
  if (next) {
    const { error } = await service.rpc('apply_order_transition', {
      p_order_id: order.id,
      p_to_status: next,
      p_kind: `payment_${created.status}`,
      p_actor_id: user.id,
      p_actor_kind: 'buyer',
      p_data: { provider: provider.name, method, external_id: created.externalId },
    });
    if (error) return json({ error: error.message }, 500);
  }

  return json({ payment: attempt }, 201);
});
