// Cota o frete de um anúncio para um endereço do comprador.
// Entrada: { listing_id, address_id }.
//
// As opções são gravadas em shipping_quotes e devolvidas com seus ids: o
// checkout referencia a cotação por id, nunca um preço vindo do cliente.
import { corsHeaders, json, serviceClient, userClient } from '../_shared/client.ts';
import { requireUser } from '../_shared/auth.ts';
import { MelhorEnvioProvider, normalizeZip } from '../_shared/shipping/melhorenvio.ts';

/** Uma cotação vale 30 minutos — depois disso o preço pode ter mudado. */
const QUOTE_TTL_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let listingId: string | undefined;
  let addressId: string | undefined;
  try {
    const body = await req.json();
    listingId = body.listing_id;
    addressId = body.address_id;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!listingId || !addressId) return json({ error: 'listing_id_and_address_id_required' }, 400);

  const provider = new MelhorEnvioProvider();
  if (!provider.isConfigured()) return json({ error: 'shipping_provider_unavailable' }, 503);

  // Endereço lido com o JWT: a RLS garante que pertence a quem pediu.
  const supabase = userClient(req);
  const { data: address, error: addressError } = await supabase
    .from('addresses')
    .select('id, zip_code')
    .eq('id', addressId)
    .maybeSingle();
  if (addressError) return json({ error: addressError.message }, 500);
  if (!address) return json({ error: 'address_not_found' }, 404);

  const service = serviceClient();
  const { data: listing, error: listingError } = await service
    .from('listings')
    .select(
      'id, seller_id, status, price_cents, parcel_weight_grams, parcel_length_cm, parcel_width_cm, parcel_height_cm',
    )
    .eq('id', listingId)
    .maybeSingle();
  if (listingError) return json({ error: listingError.message }, 500);
  if (!listing) return json({ error: 'listing_not_found' }, 404);
  if (listing.status !== 'active') return json({ error: 'listing_not_available' }, 409);
  if (listing.seller_id === user.id) return json({ error: 'cannot_buy_own_listing' }, 403);

  // Origem: endereço padrão do vendedor. Sem ele não há como cotar.
  const { data: origin } = await service
    .from('addresses')
    .select('zip_code')
    .eq('profile_id', listing.seller_id)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!origin) return json({ error: 'seller_without_origin_address' }, 409);

  let options;
  try {
    options = await provider.quote({
      from: { zipCode: origin.zip_code },
      to: { zipCode: address.zip_code },
      parcel: {
        weightGrams: listing.parcel_weight_grams,
        lengthCm: listing.parcel_length_cm,
        widthCm: listing.parcel_width_cm,
        heightCm: listing.parcel_height_cm,
      },
      insuranceCents: listing.price_cents ?? 0,
    });
  } catch (error) {
    return json({ error: 'quote_failed', detail: String(error) }, 502);
  }
  if (options.length === 0) return json({ error: 'no_shipping_options' }, 409);

  const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000).toISOString();
  const { data: saved, error: saveError } = await service
    .from('shipping_quotes')
    .insert(
      options.map((option) => ({
        profile_id: user.id,
        listing_id: listing.id,
        provider: provider.name,
        service_id: option.serviceId,
        service_name: option.serviceName,
        carrier: option.carrier,
        price_cents: option.priceCents,
        estimated_days: option.estimatedDays,
        from_zip: normalizeZip(origin.zip_code),
        to_zip: normalizeZip(address.zip_code),
        expires_at: expiresAt,
      })),
    )
    .select('id, service_name, carrier, price_cents, estimated_days, expires_at');
  if (saveError) return json({ error: saveError.message }, 500);

  return json({ quotes: saved }, 200);
});
