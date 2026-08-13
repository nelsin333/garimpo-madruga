/**
 * Testa o adapter real do Mercado Pago (supabase/functions/_shared/payments).
 * Nada de rede: as funções puras são exercitadas diretamente e o fluxo de
 * pagamento roda contra um test double do contrato PaymentProvider.
 *
 * A integração de verdade continua aguardando MERCADOPAGO_ACCESS_TOKEN e
 * MERCADOPAGO_WEBHOOK_SECRET — aqui validamos contrato, mapeamento e
 * assinatura, não a conta do provedor.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  MercadoPagoProvider,
  buildSignatureManifest,
  mapMercadoPagoStatus,
  parseSignatureHeader,
  timingSafeEqual,
} from '../../../supabase/functions/_shared/payments/mercadopago';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentSnapshot,
} from '../../../supabase/functions/_shared/payments/provider';
import {
  orderStatusForPayment,
  type OrderStatus,
} from '../../../supabase/functions/_shared/domain/orders';

// O adapter roda em Deno; no vitest só precisamos que env.get exista para os
// defaults do construtor e para a notification_url.
beforeAll(() => {
  (globalThis as { Deno?: unknown }).Deno ??= { env: { get: () => undefined } };
});

const WEBHOOK_SECRET = 'segredo-de-teste';

async function signManifest(secret: string, manifest: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)),
  );
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function webhookRequest(options: {
  dataId: string;
  requestId: string;
  ts: string;
  v1?: string;
  topic?: string;
}): Request {
  const headers: Record<string, string> = { 'x-request-id': options.requestId };
  if (options.v1) headers['x-signature'] = `ts=${options.ts},v1=${options.v1}`;
  return new Request(
    `https://edge.local/payments-webhook?data.id=${options.dataId}&type=${options.topic ?? 'payment'}`,
    { method: 'POST', headers, body: '{}' },
  );
}

describe('mapeamento de status do Mercado Pago', () => {
  it('cobre todos os status documentados', () => {
    expect(mapMercadoPagoStatus('approved')).toBe('approved');
    expect(mapMercadoPagoStatus('authorized')).toBe('approved');
    expect(mapMercadoPagoStatus('pending')).toBe('pending');
    expect(mapMercadoPagoStatus('in_process')).toBe('pending');
    expect(mapMercadoPagoStatus('in_mediation')).toBe('pending');
    expect(mapMercadoPagoStatus('rejected')).toBe('rejected');
    expect(mapMercadoPagoStatus('cancelled')).toBe('cancelled');
    expect(mapMercadoPagoStatus('refunded')).toBe('refunded');
    expect(mapMercadoPagoStatus('charged_back')).toBe('charged_back');
  });

  it('trata status desconhecido como pendente, nunca como aprovado', () => {
    expect(mapMercadoPagoStatus('status_novo_do_provedor')).toBe('pending');
    expect(mapMercadoPagoStatus('')).toBe('pending');
  });
});

describe('assinatura do webhook', () => {
  it('monta o manifest no formato oficial', () => {
    expect(buildSignatureManifest({ dataId: '123', requestId: 'req-1', ts: '17000' })).toBe(
      'id:123;request-id:req-1;ts:17000;',
    );
  });

  it('faz o parse do header x-signature', () => {
    expect(parseSignatureHeader('ts=1700,v1=abc')).toEqual({ ts: '1700', v1: 'abc' });
    expect(parseSignatureHeader(' ts=1700 , v1=abc ')).toEqual({ ts: '1700', v1: 'abc' });
    expect(parseSignatureHeader('v1=abc')).toBeNull();
    expect(parseSignatureHeader('ts=1700')).toBeNull();
    expect(parseSignatureHeader(null)).toBeNull();
  });

  it('compara em tempo constante', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('aceita assinatura válida', async () => {
    const provider = new MercadoPagoProvider('token-de-teste', WEBHOOK_SECRET);
    const ts = '1723500000';
    const v1 = await signManifest(
      WEBHOOK_SECRET,
      buildSignatureManifest({ dataId: '999', requestId: 'req-abc', ts }),
    );
    const result = await provider.verifyWebhookAsync(
      webhookRequest({ dataId: '999', requestId: 'req-abc', ts, v1 }),
      '{}',
    );
    expect(result.valid).toBe(true);
    expect(result.resourceId).toBe('999');
    expect(result.eventId).toBe('payment:999');
  });

  it('recusa assinatura forjada, adulterada ou de outro recurso', async () => {
    const provider = new MercadoPagoProvider('token-de-teste', WEBHOOK_SECRET);
    const ts = '1723500000';
    const valid = await signManifest(
      WEBHOOK_SECRET,
      buildSignatureManifest({ dataId: '999', requestId: 'req-abc', ts }),
    );

    const forged = await provider.verifyWebhookAsync(
      webhookRequest({ dataId: '999', requestId: 'req-abc', ts, v1: 'f'.repeat(64) }),
      '{}',
    );
    expect(forged.valid).toBe(false);
    expect(forged.reason).toBe('invalid_signature');

    // assinatura correta, mas apontando para outro pagamento
    const swapped = await provider.verifyWebhookAsync(
      webhookRequest({ dataId: '1000', requestId: 'req-abc', ts, v1: valid }),
      '{}',
    );
    expect(swapped.valid).toBe(false);

    // mesmo pagamento, request-id diferente (replay em outra entrega)
    const replayed = await provider.verifyWebhookAsync(
      webhookRequest({ dataId: '999', requestId: 'req-outro', ts, v1: valid }),
      '{}',
    );
    expect(replayed.valid).toBe(false);
  });

  it('recusa quando falta assinatura ou id do recurso', async () => {
    const provider = new MercadoPagoProvider('token-de-teste', WEBHOOK_SECRET);

    const semAssinatura = await provider.verifyWebhookAsync(
      webhookRequest({ dataId: '999', requestId: 'req-abc', ts: '1' }),
      '{}',
    );
    expect(semAssinatura.valid).toBe(false);
    expect(semAssinatura.reason).toBe('missing_signature');

    const semId = await provider.verifyWebhookAsync(
      new Request('https://edge.local/payments-webhook', { method: 'POST', body: '{}' }),
      '{}',
    );
    expect(semId.valid).toBe(false);
    expect(semId.reason).toBe('missing_data_id');
  });

  it('sem secret configurado recusa em vez de confiar no corpo', async () => {
    const provider = new MercadoPagoProvider('token-de-teste', '');
    const result = await provider.verifyWebhookAsync(
      webhookRequest({ dataId: '999', requestId: 'req-abc', ts: '1', v1: 'a'.repeat(64) }),
      '{}',
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('webhook_secret_not_configured');
  });

  it('extrai o id do corpo quando a query string não traz', async () => {
    const provider = new MercadoPagoProvider('token-de-teste', WEBHOOK_SECRET);
    const body = JSON.stringify({ type: 'payment', data: { id: 4242 } });
    const result = await provider.verifyWebhookAsync(
      new Request('https://edge.local/payments-webhook', { method: 'POST', body }),
      body,
    );
    expect(result.resourceId).toBe('4242');
    expect(result.reason).toBe('missing_signature');
  });
});

describe('provedor não configurado', () => {
  it('não finge estar pronto e não simula pagamento', async () => {
    const provider = new MercadoPagoProvider('', '');
    expect(provider.isConfigured()).toBe(false);
    await expect(provider.getPayment('1')).rejects.toThrow('mercadopago_not_configured');
    await expect(provider.refund('1')).rejects.toThrow('mercadopago_not_configured');
  });
});

/**
 * Test double do contrato: garante que o domínio funciona contra a interface,
 * sem depender do SDK nem de credenciais do Mercado Pago.
 */
class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  readonly created: CreatePaymentInput[] = [];
  readonly refunded: Array<{ id: string; amountCents?: number }> = [];
  private snapshot: PaymentSnapshot | null = null;

  isConfigured(): boolean {
    return true;
  }

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // idempotência: a mesma chave devolve o mesmo pagamento
    const existing = this.created.find((item) => item.idempotencyKey === input.idempotencyKey);
    if (!existing) this.created.push(input);
    const externalId = `mp-${input.idempotencyKey}`;
    this.snapshot = {
      externalId,
      status: 'pending',
      rawStatus: 'pending',
      amountCents: input.amountCents,
      metadata: input.metadata,
    };
    return Promise.resolve({
      externalId,
      status: 'pending',
      rawStatus: 'pending',
      checkout: { qrCode: '00020126' },
    });
  }

  getPayment(externalId: string): Promise<PaymentSnapshot> {
    if (!this.snapshot || this.snapshot.externalId !== externalId) {
      return Promise.reject(new Error('payment_not_found'));
    }
    return Promise.resolve(this.snapshot);
  }

  refund(externalId: string, amountCents?: number): Promise<void> {
    this.refunded.push({ id: externalId, amountCents });
    this.snapshot = { ...this.snapshot!, status: 'refunded', rawStatus: 'refunded' };
    return Promise.resolve();
  }

  verifyWebhook() {
    return {
      valid: true,
      eventId: 'fake:1',
      resourceId: this.snapshot?.externalId ?? null,
      topic: 'payment',
    };
  }

  /** Só nos testes: simula o provedor mudando o status do pagamento. */
  advance(status: PaymentSnapshot['status']): void {
    this.snapshot = { ...this.snapshot!, status, rawStatus: status };
  }
}

describe('fluxo de pagamento sobre o contrato', () => {
  it('cria uma vez para a mesma chave de idempotência', async () => {
    const provider = new FakePaymentProvider();
    const input: CreatePaymentInput = {
      orderId: 'order-1',
      amountCents: 149190,
      method: 'pix',
      description: 'Jaqueta',
      payer: { email: 'comprador@exemplo.com' },
      metadata: { order_id: 'order-1' },
      platformFeeCents: 13050,
      idempotencyKey: 'order-1:pix',
    };
    const first = await provider.createPayment(input);
    const second = await provider.createPayment(input);
    expect(second.externalId).toBe(first.externalId);
    expect(provider.created).toHaveLength(1);
  });

  it('leva o pedido a paid apenas após consulta ao provedor', async () => {
    const provider = new FakePaymentProvider();
    const created = await provider.createPayment({
      orderId: 'order-2',
      amountCents: 10000,
      method: 'pix',
      description: 'Camiseta',
      payer: { email: 'c@exemplo.com' },
      metadata: { order_id: 'order-2' },
      platformFeeCents: 900,
      idempotencyKey: 'order-2:pix',
    });

    let orderStatus: OrderStatus = 'pending_payment';
    const apply = () => {
      return provider.getPayment(created.externalId).then((snapshot) => {
        const next = orderStatusForPayment(snapshot.status, orderStatus);
        if (next) orderStatus = next;
        return next;
      });
    };

    expect(await apply()).toBe('payment_processing');
    provider.advance('approved');
    expect(await apply()).toBe('paid');
    // webhook reentregue: nenhum efeito adicional
    expect(await apply()).toBeNull();
    expect(orderStatus).toBe('paid');
  });

  it('estorno leva o pedido a refunded', async () => {
    const provider = new FakePaymentProvider();
    const created = await provider.createPayment({
      orderId: 'order-3',
      amountCents: 20000,
      method: 'pix',
      description: 'Tênis',
      payer: { email: 'c@exemplo.com' },
      metadata: { order_id: 'order-3' },
      platformFeeCents: 1800,
      idempotencyKey: 'order-3:pix',
    });
    provider.advance('approved');
    await provider.refund(created.externalId);

    const snapshot = await provider.getPayment(created.externalId);
    expect(provider.refunded).toEqual([{ id: created.externalId, amountCents: undefined }]);
    expect(orderStatusForPayment(snapshot.status, 'paid')).toBe('refunded');
  });

  it('pagamento recusado não avança o pedido para pago', async () => {
    const provider = new FakePaymentProvider();
    const created = await provider.createPayment({
      orderId: 'order-4',
      amountCents: 5000,
      method: 'credit_card',
      description: 'Boné',
      payer: { email: 'c@exemplo.com' },
      metadata: { order_id: 'order-4' },
      platformFeeCents: 450,
      idempotencyKey: 'order-4:card',
    });
    provider.advance('rejected');
    const snapshot = await provider.getPayment(created.externalId);
    expect(orderStatusForPayment(snapshot.status, 'pending_payment')).toBe('payment_failed');
  });
});
