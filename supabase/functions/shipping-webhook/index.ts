// Webhook de rastreio da transportadora.
//
// Mesmas regras do webhook de pagamento: token verificado, evento gravado em
// webhook_events para idempotência, e o status confirmado por consulta nossa
// ao provedor — o corpo recebido não decide se o pedido foi entregue.
//
// Publicar com --no-verify-jwt: a autenticação é o token compartilhado.
import { corsHeaders, json, serviceClient } from '../_shared/client.ts';
import { MelhorEnvioProvider } from '../_shared/shipping/melhorenvio.ts';
import { orderStatusForShipment, type OrderStatus } from '../_shared/domain/orders.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const rawBody = await req.text();
  const provider = new MelhorEnvioProvider();
  const verification = provider.verifyWebhook(req, rawBody);

  if (!verification.valid) {
    const status = verification.reason === 'webhook_secret_not_configured' ? 503 : 401;
    return json({ error: verification.reason ?? 'invalid_token' }, status);
  }

  const service = serviceClient();
  const { data: reserved, error: reserveError } = await service
    .from('webhook_events')
    .insert({
      provider: provider.name,
      event_id: verification.eventId!,
      topic: verification.topic,
      payload: safeJson(rawBody),
    })
    .select('id')
    .maybeSingle();

  if (reserveError) {
    if (reserveError.code === '23505') return json({ ok: true, duplicate: true }, 200);
    return json({ error: reserveError.message }, 500);
  }

  try {
    const result = await processShipment(service, provider, verification.resourceId!);
    await service
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', reserved!.id);
    return json({ ok: true, ...result }, 200);
  } catch (error) {
    await service
      .from('webhook_events')
      .update({ error: String(error) })
      .eq('id', reserved!.id);
    return json({ error: 'processing_failed' }, 500);
  }
});

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return { raw };
  }
}

async function processShipment(
  service: ReturnType<typeof serviceClient>,
  provider: MelhorEnvioProvider,
  externalId: string,
): Promise<{ order_id?: string; status?: string }> {
  const snapshot = await provider.track(externalId);

  const { data: shipment } = await service
    .from('shipments')
    .select('id, order_id')
    .eq('provider', provider.name)
    .eq('external_id', snapshot.externalId)
    .maybeSingle();
  if (!shipment) return {};

  const now = new Date().toISOString();
  await service
    .from('shipments')
    .update({
      status: snapshot.status,
      tracking_code: snapshot.trackingCode,
      posted_at: snapshot.status === 'posted' ? now : undefined,
      delivered_at: snapshot.status === 'delivered' ? now : undefined,
      updated_at: now,
    })
    .eq('id', shipment.id);

  await service.from('shipment_events').insert({
    shipment_id: shipment.id,
    status: snapshot.status,
    description: snapshot.rawStatus,
  });

  const { data: order } = await service
    .from('orders')
    .select('id, status')
    .eq('id', shipment.order_id)
    .maybeSingle();
  if (!order) return {};

  const next = orderStatusForShipment(snapshot.status, order.status as OrderStatus);
  if (!next) return { order_id: order.id, status: order.status };

  const { error } = await service.rpc('apply_order_transition', {
    p_order_id: order.id,
    p_to_status: next,
    p_kind: `shipment_${snapshot.status}`,
    p_actor_id: null,
    p_actor_kind: 'system',
    p_data: { provider: provider.name, tracking_code: snapshot.trackingCode },
  });
  if (error) throw new Error(error.message);

  return { order_id: order.id, status: next };
}
