// Cria o pedido a partir de um anúncio. Entrada:
// { listing_id, address_id, quote_id, idempotency_key }.
//
// O cliente não informa preço, taxa nem total: quem calcula é a função
// create_order no banco, que também trava o anúncio (FOR UPDATE), rejeita
// autocompra, anúncio indisponível e segunda venda do mesmo anúncio.
// O frete vem da cotação persistida em shipping_quotes, nunca do corpo.
import { corsHeaders, json, serviceClient, userClient } from '../_shared/client.ts';
import { requireUser } from '../_shared/auth.ts';
import { BUYER_FEE_CENTS, PLATFORM_FEE_BPS } from '../_shared/domain/money.ts';

interface Body {
  listing_id?: string;
  address_id?: string;
  quote_id?: string;
  idempotency_key?: string;
}

/** Erros do banco → status HTTP e código estável para o app. */
const ERROR_STATUS: Record<string, number> = {
  listing_not_found: 404,
  listing_not_available: 409,
  listing_without_price: 409,
  cannot_buy_own_listing: 403,
};

function domainError(message: string): { code: string; status: number } | null {
  for (const code of Object.keys(ERROR_STATUS)) {
    if (message.includes(code)) return { code, status: ERROR_STATUS[code]! };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const { listing_id: listingId, address_id: addressId, quote_id: quoteId } = body;
  const idempotencyKey = body.idempotency_key;
  if (!listingId || !addressId || !idempotencyKey) {
    return json({ error: 'listing_id_address_id_and_idempotency_key_required' }, 400);
  }

  // O endereço é lido com o JWT do usuário: a RLS garante que é dele.
  const supabase = userClient(req);
  const { data: address, error: addressError } = await supabase
    .from('addresses')
    .select('id, recipient_name, zip_code, street, number, complement, district, city, state')
    .eq('id', addressId)
    .maybeSingle();
  if (addressError) return json({ error: addressError.message }, 500);
  if (!address) return json({ error: 'address_not_found' }, 404);

  const service = serviceClient();

  // Frete: só aceitamos uma cotação que nós mesmos emitimos, ainda válida e
  // para este anúncio e este comprador. Sem isso o cliente escolheria o preço.
  let shippingCents = 0;
  let shippingOption: Record<string, unknown> = {};
  if (quoteId) {
    const { data: quote, error: quoteError } = await service
      .from('shipping_quotes')
      .select(
        'id, listing_id, profile_id, price_cents, service_id, service_name, carrier, estimated_days, expires_at',
      )
      .eq('id', quoteId)
      .maybeSingle();
    if (quoteError) return json({ error: quoteError.message }, 500);
    if (!quote) return json({ error: 'quote_not_found' }, 404);
    if (quote.listing_id !== listingId || quote.profile_id !== user.id) {
      return json({ error: 'quote_mismatch' }, 409);
    }
    if (new Date(quote.expires_at).getTime() < Date.now()) {
      return json({ error: 'quote_expired' }, 409);
    }
    shippingCents = quote.price_cents;
    shippingOption = {
      quote_id: quote.id,
      service_id: quote.service_id,
      service_name: quote.service_name,
      carrier: quote.carrier,
      estimated_days: quote.estimated_days,
    };
  }

  const { data: orderId, error } = await service.rpc('create_order', {
    p_buyer_id: user.id,
    p_listing_id: listingId,
    p_idempotency_key: idempotencyKey,
    p_shipping_address: {
      recipient_name: address.recipient_name,
      zip_code: address.zip_code,
      street: address.street,
      number: address.number,
      complement: address.complement,
      district: address.district,
      city: address.city,
      state: address.state,
    },
    p_shipping_option: shippingOption,
    p_shipping_cents: shippingCents,
    p_buyer_fee_cents: BUYER_FEE_CENTS,
    p_platform_fee_bps: PLATFORM_FEE_BPS,
  });

  if (error) {
    const known = domainError(error.message);
    if (known) return json({ error: known.code }, known.status);
    return json({ error: error.message }, 500);
  }

  // Devolvemos o pedido lido com o JWT: se por algum motivo o comprador não
  // puder vê-lo, ele também não o recebe aqui.
  const { data: order, error: readError } = await supabase
    .from('orders')
    .select(
      'id, status, item_cents, shipping_cents, buyer_fee_cents, platform_fee_cents, discount_cents, total_cents, currency, shipping_address, shipping_option, payment_expires_at, created_at',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (readError) return json({ error: readError.message }, 500);

  return json({ order }, 201);
});
