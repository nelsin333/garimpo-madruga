// Adapter Melhor Envio (API v2), sem SDK.
//
// Aguardando credenciais para operar: MELHORENVIO_TOKEN (OAuth bearer da
// aplicação) e, opcionalmente, MELHORENVIO_SANDBOX=1 para o ambiente de
// homologação e MELHORENVIO_WEBHOOK_SECRET para validar as notificações.
// Sem token, isConfigured() é false e as rotas respondem 503 — nenhuma
// cotação ou etiqueta é inventada.
//
// O fluxo oficial tem três passos: /shipment/calculate (cotação) →
// /cart + /shipment/checkout (compra) → /shipment/generate + /shipment/print
// (etiqueta). O adapter esconde isso atrás de quote/createShipment/buyLabel.

import { amountToCents, centsToAmountString } from '../domain/money.ts';
import type { ShipmentStatus } from '../domain/orders.ts';
import type {
  CreateShipmentInput,
  PostalAddress,
  QuoteInput,
  ShipmentSnapshot,
  ShippingOption,
  ShippingProvider,
  ShippingWebhookVerification,
} from './provider.ts';

const PRODUCTION = 'https://melhorenvio.com.br/api/v2';
const SANDBOX = 'https://sandbox.melhorenvio.com.br/api/v2';

/** Status do Melhor Envio → nosso domínio. */
export function mapMelhorEnvioStatus(status: string): ShipmentStatus {
  switch (status) {
    case 'pending':
    case 'paid':
      return 'pending';
    case 'generated':
    case 'released':
      return 'label_created';
    case 'posted':
      return 'posted';
    case 'in_transit':
      return 'in_transit';
    case 'delivered':
      return 'delivered';
    case 'undelivered':
    case 'returning':
    case 'returned':
      return 'returned';
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/** Normaliza CEP para os 8 dígitos que a API espera. */
export function normalizeZip(zip: string): string {
  return zip.replace(/\D/g, '').padStart(8, '0').slice(-8);
}

/** Dias úteis estimados: a API devolve string ou número conforme o serviço. */
export function parseEstimatedDays(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.ceil(value);
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    if (match) return Number(match[0]);
  }
  return null;
}

/** Uma cotação da API vira opção do nosso domínio; erros viram null. */
export function parseQuoteEntry(entry: Record<string, unknown>): ShippingOption | null {
  if (entry.error) return null;
  const price = entry.price ?? entry.custom_price;
  if (price === undefined || price === null) return null;
  const company = entry.company as { name?: string } | undefined;
  return {
    serviceId: String(entry.id),
    serviceName: String(entry.name ?? 'Serviço'),
    carrier: String(company?.name ?? 'Transportadora'),
    priceCents: amountToCents(String(price)),
    estimatedDays: parseEstimatedDays(entry.delivery_time),
  };
}

function toApiAddress(address: PostalAddress): Record<string, unknown> {
  return {
    name: address.recipientName,
    phone: address.phone ?? undefined,
    email: address.email ?? undefined,
    document: address.document ?? undefined,
    address: address.street,
    complement: address.complement ?? undefined,
    number: address.number,
    district: address.district,
    city: address.city,
    state_abbr: address.state,
    postal_code: normalizeZip(address.zipCode),
    country_id: 'BR',
  };
}

export class MelhorEnvioProvider implements ShippingProvider {
  readonly name = 'melhorenvio';
  private readonly base: string;

  constructor(
    private readonly token = Deno.env.get('MELHORENVIO_TOKEN') ?? '',
    private readonly webhookSecret = Deno.env.get('MELHORENVIO_WEBHOOK_SECRET') ?? '',
    sandbox = Deno.env.get('MELHORENVIO_SANDBOX') === '1',
  ) {
    this.base = sandbox ? SANDBOX : PRODUCTION;
  }

  isConfigured(): boolean {
    return this.token.length > 0;
  }

  private headers(): HeadersInit {
    return {
      'content-type': 'application/json',
      accept: 'application/json',
      Authorization: `Bearer ${this.token}`,
      // A API exige User-Agent identificando a aplicação e um contato.
      'User-Agent':
        Deno.env.get('MELHORENVIO_USER_AGENT') ?? 'Garimpo Madruga (suporte@garimpo.app)',
    };
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    if (!this.isConfigured()) throw new Error('melhorenvio_not_configured');
    const response = await fetch(`${this.base}${path}`, { ...init, headers: this.headers() });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`melhorenvio_request_failed: ${path} ${response.status} ${text}`);
    }
    return text ? JSON.parse(text) : null;
  }

  async quote(input: QuoteInput): Promise<ShippingOption[]> {
    const payload = await this.request('/me/shipment/calculate', {
      method: 'POST',
      body: JSON.stringify({
        from: { postal_code: normalizeZip(input.from.zipCode) },
        to: { postal_code: normalizeZip(input.to.zipCode) },
        package: {
          weight: input.parcel.weightGrams / 1000,
          width: input.parcel.widthCm,
          height: input.parcel.heightCm,
          length: input.parcel.lengthCm,
        },
        options: {
          insurance_value: Number(centsToAmountString(input.insuranceCents)),
          receipt: false,
          own_hand: false,
        },
      }),
    });

    const entries = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
    return entries
      .map(parseQuoteEntry)
      .filter((option): option is ShippingOption => option !== null)
      .sort((a, b) => a.priceCents - b.priceCents);
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentSnapshot> {
    const cart = (await this.request('/me/cart', {
      method: 'POST',
      body: JSON.stringify({
        service: Number(input.serviceId),
        from: toApiAddress(input.from),
        to: toApiAddress(input.to),
        products: [
          {
            name: input.description,
            quantity: 1,
            unitary_value: Number(centsToAmountString(input.insuranceCents)),
          },
        ],
        volumes: [
          {
            height: input.parcel.heightCm,
            width: input.parcel.widthCm,
            length: input.parcel.lengthCm,
            weight: input.parcel.weightGrams / 1000,
          },
        ],
        options: {
          insurance_value: Number(centsToAmountString(input.insuranceCents)),
          receipt: false,
          own_hand: false,
          reverse: false,
          non_commercial: true,
          // Ecoado nos webhooks: nossa âncora para achar o pedido.
          platform: 'Garimpo Madruga',
          tags: [{ tag: input.orderId, url: null }],
        },
      }),
    })) as Record<string, unknown>;

    return this.snapshotFrom(cart);
  }

  async buyLabel(externalId: string): Promise<ShipmentSnapshot> {
    // checkout paga a etiqueta com o saldo da conta; generate a emite.
    await this.request('/me/shipment/checkout', {
      method: 'POST',
      body: JSON.stringify({ orders: [externalId] }),
    });
    await this.request('/me/shipment/generate', {
      method: 'POST',
      body: JSON.stringify({ orders: [externalId] }),
    });
    const printed = (await this.request('/me/shipment/print', {
      method: 'POST',
      body: JSON.stringify({ orders: [externalId], mode: 'public' }),
    })) as { url?: string } | null;

    const snapshot = await this.track(externalId);
    return { ...snapshot, labelUrl: printed?.url ?? snapshot.labelUrl };
  }

  async track(externalId: string): Promise<ShipmentSnapshot> {
    const payload = (await this.request(`/me/orders/${externalId}`)) as Record<string, unknown>;
    return this.snapshotFrom(payload);
  }

  private snapshotFrom(payload: Record<string, unknown>): ShipmentSnapshot {
    const status = String(payload.status ?? 'pending');
    return {
      externalId: String(payload.id),
      status: mapMelhorEnvioStatus(status),
      rawStatus: status,
      trackingCode: (payload.tracking as string | null) ?? null,
      labelUrl: null,
      priceCents: payload.price === undefined ? 0 : amountToCents(String(payload.price)),
      serviceName: ((payload.service as { name?: string } | undefined)?.name ?? null) as
        string | null,
      estimatedDays: parseEstimatedDays(payload.delivery_time),
    };
  }

  verifyWebhook(req: Request, rawBody: string): ShippingWebhookVerification {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawBody || '{}') as Record<string, unknown>;
    } catch {
      return {
        valid: false,
        eventId: null,
        resourceId: null,
        topic: null,
        reason: 'invalid_body',
      };
    }

    const data = (parsed.data ?? parsed) as Record<string, unknown>;
    const resourceId = data.id ? String(data.id) : null;
    const topic = (parsed.event as string | undefined) ?? null;
    if (!resourceId) {
      return { valid: false, eventId: null, resourceId: null, topic, reason: 'missing_data_id' };
    }

    // O Melhor Envio autentica o webhook por um token compartilhado no header.
    // Sem secret configurado recusamos: um evento forjado moveria o pedido.
    if (!this.webhookSecret) {
      return {
        valid: false,
        eventId: `${topic ?? 'shipment'}:${resourceId}`,
        resourceId,
        topic,
        reason: 'webhook_secret_not_configured',
      };
    }

    const sent = req.headers.get('x-melhorenvio-token') ?? req.headers.get('authorization') ?? '';
    const normalized = sent.replace(/^Bearer\s+/i, '');
    const valid = timingSafeEqual(normalized, this.webhookSecret);

    return {
      valid,
      // O mesmo status pode ser reentregue: o id do evento inclui o status
      // para que uma mudança nova não seja descartada como duplicada.
      eventId: `${topic ?? 'shipment'}:${resourceId}:${String(data.status ?? '')}`,
      resourceId,
      topic,
      reason: valid ? undefined : 'invalid_token',
    };
  }
}

/** Comparação em tempo constante — evita timing attack no token. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
