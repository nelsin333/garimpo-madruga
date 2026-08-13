/**
 * Testa o adapter real do Melhor Envio (supabase/functions/_shared/shipping).
 * As funções puras rodam direto; o fluxo de remessa roda contra um test double
 * do contrato ShippingProvider. Sem MELHORENVIO_TOKEN não há chamada de rede.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  MelhorEnvioProvider,
  mapMelhorEnvioStatus,
  normalizeZip,
  parseEstimatedDays,
  parseQuoteEntry,
} from '../../../supabase/functions/_shared/shipping/melhorenvio';
import type {
  CreateShipmentInput,
  QuoteInput,
  ShipmentSnapshot,
  ShippingOption,
  ShippingProvider,
} from '../../../supabase/functions/_shared/shipping/provider';
import {
  orderStatusForShipment,
  type OrderStatus,
} from '../../../supabase/functions/_shared/domain/orders';

beforeAll(() => {
  (globalThis as { Deno?: unknown }).Deno ??= { env: { get: () => undefined } };
});

describe('mapeamento de status do Melhor Envio', () => {
  it('cobre o ciclo de vida da remessa', () => {
    expect(mapMelhorEnvioStatus('pending')).toBe('pending');
    expect(mapMelhorEnvioStatus('paid')).toBe('pending');
    expect(mapMelhorEnvioStatus('generated')).toBe('label_created');
    expect(mapMelhorEnvioStatus('released')).toBe('label_created');
    expect(mapMelhorEnvioStatus('posted')).toBe('posted');
    expect(mapMelhorEnvioStatus('in_transit')).toBe('in_transit');
    expect(mapMelhorEnvioStatus('delivered')).toBe('delivered');
    expect(mapMelhorEnvioStatus('returned')).toBe('returned');
    expect(mapMelhorEnvioStatus('canceled')).toBe('cancelled');
  });

  it('trata status desconhecido como pendente, nunca como entregue', () => {
    expect(mapMelhorEnvioStatus('status_novo')).toBe('pending');
  });
});

describe('normalização de dados da API', () => {
  it('reduz o CEP a oito dígitos', () => {
    expect(normalizeZip('01310-100')).toBe('01310100');
    expect(normalizeZip('01310100')).toBe('01310100');
    expect(normalizeZip('1310100')).toBe('01310100');
  });

  it('lê prazo em número ou texto', () => {
    expect(parseEstimatedDays(3)).toBe(3);
    expect(parseEstimatedDays(2.2)).toBe(3);
    expect(parseEstimatedDays('5 dias úteis')).toBe(5);
    expect(parseEstimatedDays(null)).toBeNull();
    expect(parseEstimatedDays('sem prazo')).toBeNull();
  });

  it('converte cotação em opção com preço em centavos', () => {
    const option = parseQuoteEntry({
      id: 2,
      name: 'SEDEX',
      price: '24.90',
      delivery_time: 2,
      company: { name: 'Correios' },
    });
    expect(option).toEqual({
      serviceId: '2',
      serviceName: 'SEDEX',
      carrier: 'Correios',
      priceCents: 2490,
      estimatedDays: 2,
    });
  });

  it('descarta serviços que voltaram com erro ou sem preço', () => {
    expect(parseQuoteEntry({ id: 3, error: 'Serviço indisponível' })).toBeNull();
    expect(parseQuoteEntry({ id: 4, name: 'PAC' })).toBeNull();
  });
});

describe('webhook de frete', () => {
  const SECRET = 'token-de-teste';
  const body = JSON.stringify({ event: 'order.posted', data: { id: 'me-1', status: 'posted' } });

  function request(headers: Record<string, string>): Request {
    return new Request('https://edge.local/shipping-webhook', { method: 'POST', headers, body });
  }

  it('aceita o token compartilhado correto', () => {
    const provider = new MelhorEnvioProvider('tok', SECRET);
    const result = provider.verifyWebhook(request({ 'x-melhorenvio-token': SECRET }), body);
    expect(result.valid).toBe(true);
    expect(result.resourceId).toBe('me-1');
    expect(result.eventId).toBe('order.posted:me-1:posted');
  });

  it('aceita o token via Authorization: Bearer', () => {
    const provider = new MelhorEnvioProvider('tok', SECRET);
    expect(provider.verifyWebhook(request({ authorization: `Bearer ${SECRET}` }), body).valid).toBe(
      true,
    );
  });

  it('recusa token errado, ausente ou secret não configurado', () => {
    const provider = new MelhorEnvioProvider('tok', SECRET);
    expect(provider.verifyWebhook(request({ 'x-melhorenvio-token': 'errado' }), body).reason).toBe(
      'invalid_token',
    );
    expect(provider.verifyWebhook(request({}), body).valid).toBe(false);

    const semSecret = new MelhorEnvioProvider('tok', '');
    expect(semSecret.verifyWebhook(request({ 'x-melhorenvio-token': SECRET }), body).reason).toBe(
      'webhook_secret_not_configured',
    );
  });

  it('recusa corpo inválido ou sem id', () => {
    const provider = new MelhorEnvioProvider('tok', SECRET);
    const invalid = provider.verifyWebhook(
      new Request('https://edge.local/shipping-webhook', { method: 'POST', body: 'nao-json' }),
      'nao-json',
    );
    expect(invalid.reason).toBe('invalid_body');

    const semId = provider.verifyWebhook(
      new Request('https://edge.local/shipping-webhook', { method: 'POST', body: '{}' }),
      '{}',
    );
    expect(semId.reason).toBe('missing_data_id');
  });

  it('distingue eventos de status diferentes do mesmo pedido', () => {
    const provider = new MelhorEnvioProvider('tok', SECRET);
    const posted = provider.verifyWebhook(request({ 'x-melhorenvio-token': SECRET }), body);
    const deliveredBody = JSON.stringify({
      event: 'order.delivered',
      data: { id: 'me-1', status: 'delivered' },
    });
    const delivered = provider.verifyWebhook(
      new Request('https://edge.local/shipping-webhook', {
        method: 'POST',
        headers: { 'x-melhorenvio-token': SECRET },
        body: deliveredBody,
      }),
      deliveredBody,
    );
    expect(delivered.eventId).not.toBe(posted.eventId);
  });
});

describe('provedor não configurado', () => {
  it('não finge estar pronto e não cota nada', async () => {
    const provider = new MelhorEnvioProvider('', '');
    expect(provider.isConfigured()).toBe(false);
    await expect(
      provider.quote({
        from: { zipCode: '01310100' },
        to: { zipCode: '20040020' },
        parcel: { weightGrams: 800, lengthCm: 30, widthCm: 25, heightCm: 10 },
        insuranceCents: 145000,
      }),
    ).rejects.toThrow('melhorenvio_not_configured');
    await expect(provider.track('1')).rejects.toThrow('melhorenvio_not_configured');
  });
});

/** Test double do contrato de frete, sem rede nem credenciais. */
class FakeShippingProvider implements ShippingProvider {
  readonly name = 'fake';
  private shipments = new Map<string, ShipmentSnapshot>();
  private byKey = new Map<string, string>();

  isConfigured(): boolean {
    return true;
  }

  quote(input: QuoteInput): Promise<ShippingOption[]> {
    const base = 1500 + Math.floor(input.parcel.weightGrams / 100) * 10;
    return Promise.resolve([
      {
        serviceId: '1',
        serviceName: 'PAC',
        carrier: 'Correios',
        priceCents: base,
        estimatedDays: 7,
      },
      {
        serviceId: '2',
        serviceName: 'SEDEX',
        carrier: 'Correios',
        priceCents: base * 2,
        estimatedDays: 2,
      },
    ]);
  }

  createShipment(input: CreateShipmentInput): Promise<ShipmentSnapshot> {
    const existing = this.byKey.get(input.idempotencyKey);
    if (existing) return Promise.resolve(this.shipments.get(existing)!);
    const externalId = `me-${this.shipments.size + 1}`;
    const snapshot: ShipmentSnapshot = {
      externalId,
      status: 'pending',
      rawStatus: 'pending',
      trackingCode: null,
      labelUrl: null,
      priceCents: 1500,
      serviceName: 'PAC',
      estimatedDays: 7,
    };
    this.shipments.set(externalId, snapshot);
    this.byKey.set(input.idempotencyKey, externalId);
    return Promise.resolve(snapshot);
  }

  buyLabel(externalId: string): Promise<ShipmentSnapshot> {
    const snapshot: ShipmentSnapshot = {
      ...this.shipments.get(externalId)!,
      status: 'label_created',
      rawStatus: 'generated',
      labelUrl: `https://etiqueta.local/${externalId}.pdf`,
      trackingCode: `BR${externalId}`,
    };
    this.shipments.set(externalId, snapshot);
    return Promise.resolve(snapshot);
  }

  track(externalId: string): Promise<ShipmentSnapshot> {
    return Promise.resolve(this.shipments.get(externalId)!);
  }

  verifyWebhook() {
    return { valid: true, eventId: 'fake:1', resourceId: null, topic: 'shipment' };
  }

  advance(externalId: string, status: ShipmentSnapshot['status'], raw = status): void {
    this.shipments.set(externalId, {
      ...this.shipments.get(externalId)!,
      status,
      rawStatus: raw,
    });
  }
}

describe('fluxo de frete sobre o contrato', () => {
  const address = {
    recipientName: 'Comprador',
    zipCode: '01310100',
    street: 'Av. Paulista',
    number: '1000',
    district: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  };

  it('cota opções ordenadas e cria a remessa uma única vez', async () => {
    const provider = new FakeShippingProvider();
    const options = await provider.quote({
      from: { zipCode: '01310100' },
      to: { zipCode: '20040020' },
      parcel: { weightGrams: 800, lengthCm: 30, widthCm: 25, heightCm: 10 },
      insuranceCents: 145000,
    });
    expect(options[0]!.priceCents).toBeLessThan(options[1]!.priceCents);

    const input: CreateShipmentInput = {
      orderId: 'order-1',
      serviceId: options[0]!.serviceId,
      from: address,
      to: address,
      parcel: { weightGrams: 800, lengthCm: 30, widthCm: 25, heightCm: 10 },
      insuranceCents: 145000,
      description: 'Jaqueta',
      idempotencyKey: 'order-1:shipment',
    };
    const first = await provider.createShipment(input);
    const second = await provider.createShipment(input);
    expect(second.externalId).toBe(first.externalId);
  });

  it('etiqueta, postagem e entrega movem o pedido na ordem certa', async () => {
    const provider = new FakeShippingProvider();
    const shipment = await provider.createShipment({
      orderId: 'order-2',
      serviceId: '1',
      from: address,
      to: address,
      parcel: { weightGrams: 500, lengthCm: 20, widthCm: 20, heightCm: 5 },
      insuranceCents: 50000,
      description: 'Camiseta',
      idempotencyKey: 'order-2:shipment',
    });

    let orderStatus: OrderStatus = 'paid';
    const sync = async () => {
      const snapshot = await provider.track(shipment.externalId);
      const next = orderStatusForShipment(snapshot.status, orderStatus);
      if (next) orderStatus = next;
      return next;
    };

    const labeled = await provider.buyLabel(shipment.externalId);
    expect(labeled.labelUrl).toContain('.pdf');
    expect(labeled.trackingCode).not.toBeNull();
    expect(await sync()).toBe('preparing_shipment');

    provider.advance(shipment.externalId, 'posted');
    expect(await sync()).toBe('shipped');

    provider.advance(shipment.externalId, 'in_transit');
    expect(await sync()).toBeNull(); // já está em shipped

    provider.advance(shipment.externalId, 'delivered');
    expect(await sync()).toBe('delivered');
    expect(orderStatus).toBe('delivered');
  });

  it('evento fora de ordem não força transição inválida', async () => {
    const provider = new FakeShippingProvider();
    const shipment = await provider.createShipment({
      orderId: 'order-3',
      serviceId: '1',
      from: address,
      to: address,
      parcel: { weightGrams: 300, lengthCm: 20, widthCm: 20, heightCm: 5 },
      insuranceCents: 10000,
      description: 'Boné',
      idempotencyKey: 'order-3:shipment',
    });
    provider.advance(shipment.externalId, 'delivered');
    const snapshot = await provider.track(shipment.externalId);
    expect(orderStatusForShipment(snapshot.status, 'pending_payment')).toBeNull();
  });
});
