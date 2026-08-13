// O vendedor gera a etiqueta do pedido pago. Entrada: { order_id }.
//
// Só o vendedor, só depois do pagamento confirmado, e uma etiqueta por pedido
// (unique provider+external_id em shipments + reaproveitamento da remessa
// existente tornam a chamada idempotente).
import { corsHeaders, json, serviceClient } from '../_shared/client.ts';
import { requireUser } from '../_shared/auth.ts';
import { MelhorEnvioProvider } from '../_shared/shipping/melhorenvio.ts';
import {
  canSellerShip,
  orderStatusForShipment,
  type OrderStatus,
} from '../_shared/domain/orders.ts';
import type { PostalAddress } from '../_shared/shipping/provider.ts';

interface AddressRow {
  recipient_name: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
}

function toPostal(row: AddressRow, extra: Partial<PostalAddress> = {}): PostalAddress {
  return {
    recipientName: row.recipient_name,
    zipCode: row.zip_code,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    ...extra,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let orderId: string | undefined;
  try {
    ({ order_id: orderId } = await req.json());
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!orderId) return json({ error: 'order_id_required' }, 400);

  const provider = new MelhorEnvioProvider();
  if (!provider.isConfigured()) return json({ error: 'shipping_provider_unavailable' }, 503);

  const service = serviceClient();
  const { data: order, error: orderError } = await service
    .from('orders')
    .select('id, seller_id, status, item_cents, shipping_address, shipping_option, listing_id')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 500);
  if (!order) return json({ error: 'order_not_found' }, 404);
  if (order.seller_id !== user.id) return json({ error: 'forbidden' }, 403);
  if (!canSellerShip(order.status as OrderStatus)) {
    return json({ error: 'order_not_shippable', status: order.status }, 409);
  }

  // Já existe remessa: devolvemos a mesma em vez de comprar outra etiqueta.
  const { data: existing } = await service
    .from('shipments')
    .select('id, status, external_id, tracking_code, label_url, service_name, price_cents')
    .eq('order_id', order.id)
    .maybeSingle();
  if (existing?.label_url) return json({ shipment: existing }, 200);

  const { data: originRow } = await service
    .from('addresses')
    .select('recipient_name, zip_code, street, number, complement, district, city, state')
    .eq('profile_id', order.seller_id)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!originRow) return json({ error: 'seller_without_origin_address' }, 409);

  const { data: listing } = await service
    .from('listings')
    .select('title, parcel_weight_grams, parcel_length_cm, parcel_width_cm, parcel_height_cm')
    .eq('id', order.listing_id)
    .maybeSingle();
  if (!listing) return json({ error: 'listing_not_found' }, 404);

  const destination = order.shipping_address as unknown as AddressRow;
  const serviceId = (order.shipping_option as Record<string, unknown>)?.service_id;
  if (!serviceId) return json({ error: 'order_without_shipping_service' }, 409);

  let snapshot;
  try {
    snapshot =
      existing?.external_id != null
        ? await provider.buyLabel(existing.external_id)
        : await provider
            .createShipment({
              orderId: order.id,
              serviceId: String(serviceId),
              from: toPostal(originRow),
              to: toPostal(destination),
              parcel: {
                weightGrams: listing.parcel_weight_grams,
                lengthCm: listing.parcel_length_cm,
                widthCm: listing.parcel_width_cm,
                heightCm: listing.parcel_height_cm,
              },
              insuranceCents: order.item_cents,
              description: listing.title || 'Peça Garimpo Madruga',
              idempotencyKey: `${order.id}:shipment`,
            })
            .then((created) => provider.buyLabel(created.externalId));
  } catch (error) {
    return json({ error: 'shipment_failed', detail: String(error) }, 502);
  }

  const { data: shipment, error: shipmentError } = await service
    .from('shipments')
    .upsert(
      {
        order_id: order.id,
        provider: provider.name,
        service_name: snapshot.serviceName,
        status: snapshot.status,
        external_id: snapshot.externalId,
        tracking_code: snapshot.trackingCode,
        label_url: snapshot.labelUrl,
        price_cents: snapshot.priceCents,
        estimated_days: snapshot.estimatedDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,external_id' },
    )
    .select('id, status, external_id, tracking_code, label_url, service_name, price_cents')
    .single();
  if (shipmentError) return json({ error: shipmentError.message }, 500);

  await service
    .from('orders')
    .update({ external_shipment_id: snapshot.externalId })
    .eq('id', order.id);

  const next = orderStatusForShipment(snapshot.status, order.status as OrderStatus);
  if (next) {
    const { error } = await service.rpc('apply_order_transition', {
      p_order_id: order.id,
      p_to_status: next,
      p_kind: 'shipment_label_created',
      p_actor_id: user.id,
      p_actor_kind: 'seller',
      p_data: { provider: provider.name, tracking_code: snapshot.trackingCode },
    });
    if (error) return json({ error: error.message }, 500);
  }

  return json({ shipment }, 201);
});
