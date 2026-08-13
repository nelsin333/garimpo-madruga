// Adapter Mercado Pago (API v1 /payments, sem SDK).
//
// Aguardando credenciais para operar: MERCADOPAGO_ACCESS_TOKEN e
// MERCADOPAGO_WEBHOOK_SECRET. Sem elas isConfigured() é false e as rotas
// respondem 503 — nada é simulado como pago.
//
// Split (marketplace): application_fee + conta do vendedor. Requer que o
// vendedor tenha autorizado a aplicação via OAuth (provider_account_id em
// seller_accounts). Sem isso o valor cai na conta da plataforma e o repasse
// acontece via payout — ver docs/ENVIRONMENT.md.

import { amountToCents, centsToAmountString } from '../domain/money.ts';
import type { ProviderPaymentStatus } from '../domain/orders.ts';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentSnapshot,
  WebhookVerification,
} from './provider.ts';

const API = 'https://api.mercadopago.com';

/** Mapa oficial de status do MP → nosso domínio. */
export function mapMercadoPagoStatus(status: string): ProviderPaymentStatus {
  switch (status) {
    case 'approved':
    case 'authorized':
      return 'approved';
    case 'pending':
    case 'in_process':
    case 'in_mediation':
      return 'pending';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'charged_back':
      return 'charged_back';
    default:
      return 'pending';
  }
}

/**
 * Assinatura do webhook conforme a documentação do Mercado Pago:
 * header `x-signature: ts=<ts>,v1=<hash>` e `x-request-id`.
 * O manifest é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * assinado em HMAC-SHA256 com o secret do webhook.
 */
export function buildSignatureManifest(input: {
  dataId: string;
  requestId: string;
  ts: string;
}): string {
  return `id:${input.dataId};request-id:${input.requestId};ts:${input.ts};`;
}

export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(',').map((piece) => {
      const [key, ...rest] = piece.trim().split('=');
      return [key?.trim() ?? '', rest.join('=').trim()];
    }),
  );
  if (!parts.ts || !parts.v1) return null;
  return { ts: parts.ts, v1: parts.v1 };
}

/** Comparação em tempo constante — evita timing attack na assinatura. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercadopago';

  constructor(
    private readonly accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? '',
    private readonly webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET') ?? '',
  ) {}

  isConfigured(): boolean {
    return this.accessToken.length > 0;
  }

  private headers(idempotencyKey?: string): HeadersInit {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
    };
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    return headers;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.isConfigured()) throw new Error('mercadopago_not_configured');

    const body: Record<string, unknown> = {
      transaction_amount: Number(centsToAmountString(input.amountCents)),
      description: input.description,
      payment_method_id: input.method === 'pix' ? 'pix' : undefined,
      payer: { email: input.payer.email, first_name: input.payer.firstName },
      metadata: input.metadata,
      external_reference: input.orderId,
      notification_url: Deno.env.get('MERCADOPAGO_WEBHOOK_URL') || undefined,
    };

    // Split: a plataforma retém a taxa e o restante vai ao vendedor.
    if (input.sellerAccountId) {
      body.application_fee = Number(centsToAmountString(input.platformFeeCents));
    }

    const response = await fetch(`${API}/v1/payments`, {
      method: 'POST',
      headers: this.headers(input.idempotencyKey),
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`mercadopago_create_failed: ${response.status} ${JSON.stringify(payload)}`);
    }

    const transaction = payload.point_of_interaction?.transaction_data ?? {};
    return {
      externalId: String(payload.id),
      status: mapMercadoPagoStatus(payload.status),
      rawStatus: String(payload.status),
      checkout: {
        qrCode: transaction.qr_code,
        qrCodeBase64: transaction.qr_code_base64,
        ticketUrl: transaction.ticket_url,
        checkoutUrl: payload.transaction_details?.external_resource_url,
        expiresAt: payload.date_of_expiration,
      },
    };
  }

  async getPayment(externalId: string): Promise<PaymentSnapshot> {
    if (!this.isConfigured()) throw new Error('mercadopago_not_configured');
    const response = await fetch(`${API}/v1/payments/${externalId}`, {
      headers: this.headers(),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`mercadopago_get_failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return {
      externalId: String(payload.id),
      status: mapMercadoPagoStatus(payload.status),
      rawStatus: String(payload.status),
      amountCents: amountToCents(String(payload.transaction_amount)),
      metadata: (payload.metadata ?? {}) as Record<string, string>,
    };
  }

  async refund(externalId: string, amountCents?: number): Promise<void> {
    if (!this.isConfigured()) throw new Error('mercadopago_not_configured');
    const response = await fetch(`${API}/v1/payments/${externalId}/refunds`, {
      method: 'POST',
      headers: this.headers(`refund-${externalId}-${amountCents ?? 'full'}`),
      body: amountCents
        ? JSON.stringify({ amount: Number(centsToAmountString(amountCents)) })
        : '{}',
    });
    if (!response.ok) {
      throw new Error(`mercadopago_refund_failed: ${response.status} ${await response.text()}`);
    }
  }

  verifyWebhook(req: Request, rawBody: string): WebhookVerification {
    const url = new URL(req.url);
    let dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
    let topic = url.searchParams.get('type') ?? url.searchParams.get('topic');

    if (!dataId || !topic) {
      try {
        const parsed = JSON.parse(rawBody || '{}');
        dataId = dataId ?? (parsed.data?.id ? String(parsed.data.id) : null);
        topic = topic ?? parsed.type ?? parsed.action ?? null;
      } catch {
        // corpo não-JSON: seguimos com o que veio na query string
      }
    }

    if (!dataId) {
      return { valid: false, eventId: null, resourceId: null, topic, reason: 'missing_data_id' };
    }

    const requestId = req.headers.get('x-request-id') ?? '';
    const signature = parseSignatureHeader(req.headers.get('x-signature'));

    // Sem secret configurado não há como validar: recusamos em vez de
    // aceitar cegamente (um webhook forjado moveria dinheiro).
    if (!this.webhookSecret) {
      return {
        valid: false,
        eventId: `${topic ?? 'payment'}:${dataId}`,
        resourceId: dataId,
        topic,
        reason: 'webhook_secret_not_configured',
      };
    }
    if (!signature) {
      return {
        valid: false,
        eventId: null,
        resourceId: dataId,
        topic,
        reason: 'missing_signature',
      };
    }

    return {
      valid: false, // confirmado de forma assíncrona por verifyWebhookAsync
      eventId: `${topic ?? 'payment'}:${dataId}`,
      resourceId: dataId,
      topic,
      reason: 'pending_async_verification',
    };
  }

  /** Verificação real da assinatura (HMAC exige await). */
  async verifyWebhookAsync(req: Request, rawBody: string): Promise<WebhookVerification> {
    const base = this.verifyWebhook(req, rawBody);
    if (base.reason === 'missing_data_id' || base.reason === 'missing_signature') return base;
    if (base.reason === 'webhook_secret_not_configured') return base;

    const signature = parseSignatureHeader(req.headers.get('x-signature'))!;
    const manifest = buildSignatureManifest({
      dataId: base.resourceId!,
      requestId: req.headers.get('x-request-id') ?? '',
      ts: signature.ts,
    });
    const expected = await hmacSha256Hex(this.webhookSecret, manifest);
    const valid = timingSafeEqual(expected, signature.v1);

    return {
      valid,
      eventId: base.eventId,
      resourceId: base.resourceId,
      topic: base.topic,
      reason: valid ? undefined : 'invalid_signature',
    };
  }
}
