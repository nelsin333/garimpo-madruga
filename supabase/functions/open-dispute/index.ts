// Abertura de disputa pelo comprador. Entrada:
// { order_id, reason, description, evidence }.
//
// Abrir disputa congela o repasse: o pedido vai para 'disputed', de onde só
// sai por resolução (completed, refunded ou returned). Uma disputa por pedido.
import { corsHeaders, json, serviceClient } from '../_shared/client.ts';
import { requireUser } from '../_shared/auth.ts';
import { canOpenDispute, type OrderStatus } from '../_shared/domain/orders.ts';

const REASONS = ['not_received', 'not_as_described', 'damaged', 'suspected_fake', 'other'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let orderId: string | undefined;
  let reason = 'other';
  let description = '';
  let evidence: unknown[] = [];
  try {
    const body = await req.json();
    orderId = body.order_id;
    if (body.reason) reason = body.reason;
    if (typeof body.description === 'string') description = body.description.slice(0, 4000);
    if (Array.isArray(body.evidence)) evidence = body.evidence.slice(0, 10);
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!orderId) return json({ error: 'order_id_required' }, 400);
  if (!REASONS.includes(reason)) return json({ error: 'invalid_reason' }, 400);

  const service = serviceClient();
  const { data: order, error: orderError } = await service
    .from('orders')
    .select('id, buyer_id, seller_id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 500);
  if (!order) return json({ error: 'order_not_found' }, 404);

  // Comprador e vendedor podem abrir; terceiros não.
  const actorKind =
    order.buyer_id === user.id ? 'buyer' : order.seller_id === user.id ? 'seller' : null;
  if (!actorKind) return json({ error: 'forbidden' }, 403);

  if (!canOpenDispute(order.status as OrderStatus)) {
    return json({ error: 'order_not_disputable', status: order.status }, 409);
  }

  // Idempotente: disputa já aberta é devolvida como está.
  const { data: existing } = await service
    .from('disputes')
    .select('id, status, reason, resolution')
    .eq('order_id', order.id)
    .neq('status', 'closed')
    .maybeSingle();
  if (existing) return json({ dispute: existing }, 200);

  const { data: dispute, error: disputeError } = await service
    .from('disputes')
    .insert({
      order_id: order.id,
      opened_by: user.id,
      reason,
      description,
      evidence,
    })
    .select('id, status, reason, resolution')
    .single();
  if (disputeError) return json({ error: disputeError.message }, 500);

  const { error: transitionError } = await service.rpc('apply_order_transition', {
    p_order_id: order.id,
    p_to_status: 'disputed',
    p_kind: 'dispute_opened',
    p_actor_id: user.id,
    p_actor_kind: actorKind,
    p_data: { dispute_id: dispute.id, reason },
  });
  if (transitionError) return json({ error: transitionError.message }, 500);

  return json({ dispute }, 201);
});
