// Webhook do provedor de pagamento.
//
// Três regras inegociáveis:
//  1. assinatura verificada antes de qualquer efeito — evento sem assinatura
//     válida não move dinheiro;
//  2. idempotência por (provider, event_id) em webhook_events — reentrega não
//     duplica efeito;
//  3. o corpo do webhook não é fonte da verdade: o status vem de uma consulta
//     nossa ao provedor (getPayment).
//
// Esta rota é pública por natureza (chamada pelo provedor), então precisa ser
// publicada com --no-verify-jwt. A autenticação é a assinatura HMAC.
import { corsHeaders, json, serviceClient } from '../_shared/client.ts';
import { MercadoPagoProvider } from '../_shared/payments/mercadopago.ts';
import { orderStatusForPayment, type OrderStatus } from '../_shared/domain/orders.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const rawBody = await req.text();
  const provider = new MercadoPagoProvider();
  const verification = await provider.verifyWebhookAsync(req, rawBody);

  if (!verification.valid) {
    // 401 sinaliza ao provedor que ele deve reentregar quando estivermos
    // configurados; assinatura inválida é rejeição definitiva mas silenciosa.
    const status = verification.reason === 'webhook_secret_not_configured' ? 503 : 401;
    return json({ error: verification.reason ?? 'invalid_signature' }, status);
  }

  const service = serviceClient();
  const eventId = verification.eventId!;

  // Reserva o evento. O unique (provider, event_id) é o que garante que duas
  // entregas simultâneas não sejam processadas duas vezes.
  const { data: reserved, error: reserveError } = await service
    .from('webhook_events')
    .insert({
      provider: provider.name,
      event_id: eventId,
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
    const result = await processPayment(service, provider, verification.resourceId!);
    await service
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', reserved!.id);
    return json({ ok: true, ...result }, 200);
  } catch (error) {
    // Guardamos o erro e devolvemos 500 para o provedor reentregar. O registro
    // do evento fica sem processed_at, sinalizando pendência.
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

async function processPayment(
  service: ReturnType<typeof serviceClient>,
  provider: MercadoPagoProvider,
  externalId: string,
): Promise<{ order_id?: string; status?: string }> {
  // Fonte da verdade: o provedor, não o corpo recebido.
  const snapshot = await provider.getPayment(externalId);

  const { data: attempt } = await service
    .from('payment_attempts')
    .select('id, order_id, amount_cents')
    .eq('provider', provider.name)
    .eq('external_id', snapshot.externalId)
    .maybeSingle();

  const orderId = attempt?.order_id ?? snapshot.metadata.order_id;
  if (!orderId) return {};

  await service
    .from('payment_attempts')
    .update({
      // ProviderPaymentStatus tem exatamente os mesmos valores do enum
      // payment_status no banco.
      status: snapshot.status,
      raw_status: snapshot.rawStatus,
      approved_at: snapshot.status === 'approved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('provider', provider.name)
    .eq('external_id', snapshot.externalId);

  const { data: order } = await service
    .from('orders')
    .select('id, status, total_cents')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return {};

  // Valor divergente nunca aprova o pedido: registramos e paramos.
  if (snapshot.status === 'approved' && snapshot.amountCents !== order.total_cents) {
    await service.from('order_events').insert({
      order_id: order.id,
      kind: 'payment_amount_mismatch',
      actor_kind: 'system',
      data: { expected_cents: order.total_cents, received_cents: snapshot.amountCents },
    });
    return { order_id: order.id, status: 'amount_mismatch' };
  }

  const next = orderStatusForPayment(snapshot.status, order.status as OrderStatus);
  if (!next) return { order_id: order.id, status: order.status };

  const { error } = await service.rpc('apply_order_transition', {
    p_order_id: order.id,
    p_to_status: next,
    p_kind: `payment_${snapshot.status}`,
    p_actor_id: null,
    p_actor_kind: 'system',
    p_data: { provider: provider.name, external_id: snapshot.externalId, raw: snapshot.rawStatus },
  });
  if (error) throw new Error(error.message);

  return { order_id: order.id, status: next };
}
