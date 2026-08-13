// Conclusão do pedido: libera o valor retido para o vendedor.
// Entrada: { order_id }.
//
// Dois caminhos chegam aqui — o comprador confirma o recebimento, ou o prazo
// de custódia (escrow_release_at, 3 dias após a entrega) vence e a plataforma
// conclui automaticamente. Um pedido em disputa nunca é concluído por prazo.
import { corsHeaders, json, serviceClient } from '../_shared/client.ts';
import { requireUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const service = serviceClient();

  // Modo automático: chamado por agendamento com a service role, sem JWT de
  // usuário. Percorre os pedidos entregues cujo prazo de custódia venceu.
  const url = new URL(req.url);
  if (url.searchParams.get('mode') === 'escrow') {
    const authorized = req.headers.get('x-escrow-token');
    const expected = Deno.env.get('ESCROW_CRON_TOKEN') ?? '';
    if (!expected || authorized !== expected) return json({ error: 'unauthorized' }, 401);

    const { data: due, error } = await service
      .from('orders')
      .select('id')
      .eq('status', 'delivered')
      .lt('escrow_release_at', new Date().toISOString())
      .limit(100);
    if (error) return json({ error: error.message }, 500);

    const released: string[] = [];
    for (const order of due ?? []) {
      const { error: transitionError } = await service.rpc('apply_order_transition', {
        p_order_id: order.id,
        p_to_status: 'completed',
        p_kind: 'escrow_released',
        p_actor_id: null,
        p_actor_kind: 'system',
        p_data: { reason: 'escrow_window_elapsed' },
      });
      if (!transitionError) released.push(order.id);
    }
    return json({ released_count: released.length, released }, 200);
  }

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let orderId: string | undefined;
  try {
    ({ order_id: orderId } = await req.json());
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!orderId) return json({ error: 'order_id_required' }, 400);

  const { data: order, error: orderError } = await service
    .from('orders')
    .select('id, buyer_id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 500);
  if (!order) return json({ error: 'order_not_found' }, 404);

  // Só o comprador confirma o recebimento — o vendedor não libera o próprio
  // pagamento.
  if (order.buyer_id !== user.id) return json({ error: 'forbidden' }, 403);
  if (order.status !== 'delivered' && order.status !== 'shipped') {
    return json({ error: 'order_not_confirmable', status: order.status }, 409);
  }

  // Confirmação antecipada (ainda em trânsito) passa por 'delivered' antes de
  // concluir, para que o histórico do pedido continue coerente.
  if (order.status === 'shipped') {
    const { error } = await service.rpc('apply_order_transition', {
      p_order_id: order.id,
      p_to_status: 'delivered',
      p_kind: 'delivery_confirmed_by_buyer',
      p_actor_id: user.id,
      p_actor_kind: 'buyer',
      p_data: {},
    });
    if (error) return json({ error: error.message }, 500);
  }

  const { error: completeError } = await service.rpc('apply_order_transition', {
    p_order_id: order.id,
    p_to_status: 'completed',
    p_kind: 'order_completed_by_buyer',
    p_actor_id: user.id,
    p_actor_kind: 'buyer',
    p_data: {},
  });
  if (completeError) return json({ error: completeError.message }, 500);

  return json({ order_id: order.id, status: 'completed' }, 200);
});
