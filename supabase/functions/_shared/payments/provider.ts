// Contrato de provedor de pagamento. O domínio depende desta interface, não
// do SDK de nenhum provedor — trocar de gateway não toca o resto do sistema.

import type { ProviderPaymentStatus } from '../domain/orders.ts';

export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

export interface CreatePaymentInput {
  orderId: string;
  amountCents: number;
  method: PaymentMethod;
  description: string;
  payer: { email: string; firstName?: string };
  /** Ecoado pelo provedor no webhook — nossa âncora para achar o pedido. */
  metadata: Record<string, string>;
  /** Split: quanto fica com a plataforma (marketplace fee). */
  platformFeeCents: number;
  /** Conta do vendedor no provedor. Sem ela, o valor cai na conta da plataforma. */
  sellerAccountId?: string | null;
  idempotencyKey: string;
}

export interface CreatePaymentResult {
  externalId: string;
  status: ProviderPaymentStatus;
  rawStatus: string;
  /** Dados públicos para o comprador concluir — QR Pix, copia-e-cola, URL. */
  checkout: {
    qrCode?: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
    checkoutUrl?: string;
    expiresAt?: string;
  };
}

export interface PaymentSnapshot {
  externalId: string;
  status: ProviderPaymentStatus;
  rawStatus: string;
  amountCents: number;
  metadata: Record<string, string>;
}

export interface WebhookVerification {
  valid: boolean;
  /** Id do evento para deduplicação idempotente. */
  eventId: string | null;
  /** Id do recurso (pagamento) a consultar server-side. */
  resourceId: string | null;
  topic: string | null;
  reason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** false quando faltam credenciais — a rota responde 503 em vez de fingir. */
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Fonte da verdade: consulta o provedor, nunca confia no corpo do webhook. */
  getPayment(externalId: string): Promise<PaymentSnapshot>;
  refund(externalId: string, amountCents?: number): Promise<void>;
  verifyWebhook(req: Request, rawBody: string): WebhookVerification;
}
