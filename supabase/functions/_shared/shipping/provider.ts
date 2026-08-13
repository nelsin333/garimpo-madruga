// Contrato de provedor de frete. O domínio conhece cotação, etiqueta e
// rastreio — não conhece Melhor Envio, Correios nem transportadora alguma.

import type { ShipmentStatus } from '../domain/orders.ts';

export interface PostalAddress {
  recipientName: string;
  zipCode: string; // 8 dígitos, só números
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string; // UF
  phone?: string | null;
  email?: string | null;
  document?: string | null; // CPF/CNPJ, exigido pela transportadora
}

export interface ParcelDimensions {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface QuoteInput {
  from: { zipCode: string };
  to: { zipCode: string };
  parcel: ParcelDimensions;
  /** Valor declarado para seguro, em centavos. */
  insuranceCents: number;
}

export interface ShippingOption {
  /** Id do serviço no provedor — o cliente devolve isto na criação. */
  serviceId: string;
  serviceName: string;
  carrier: string;
  priceCents: number;
  estimatedDays: number | null;
}

export interface CreateShipmentInput {
  orderId: string;
  serviceId: string;
  from: PostalAddress;
  to: PostalAddress;
  parcel: ParcelDimensions;
  insuranceCents: number;
  description: string;
  idempotencyKey: string;
}

export interface ShipmentSnapshot {
  externalId: string;
  status: ShipmentStatus;
  rawStatus: string;
  trackingCode: string | null;
  labelUrl: string | null;
  priceCents: number;
  serviceName: string | null;
  estimatedDays: number | null;
}

export interface ShippingWebhookVerification {
  valid: boolean;
  eventId: string | null;
  resourceId: string | null;
  topic: string | null;
  reason?: string;
}

export interface ShippingProvider {
  readonly name: string;
  /** false quando faltam credenciais — a rota responde 503 em vez de fingir. */
  isConfigured(): boolean;
  quote(input: QuoteInput): Promise<ShippingOption[]>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentSnapshot>;
  /** Compra + gera a etiqueta; devolve o snapshot já com label_url. */
  buyLabel(externalId: string): Promise<ShipmentSnapshot>;
  /** Fonte da verdade do rastreio: consulta o provedor, não o webhook. */
  track(externalId: string): Promise<ShipmentSnapshot>;
  verifyWebhook(req: Request, rawBody: string): ShippingWebhookVerification;
}
