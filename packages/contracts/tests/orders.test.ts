/**
 * Testa o domínio real usado pelas Edge Functions (supabase/functions/_shared),
 * não uma cópia — importamos o mesmo arquivo que roda em produção.
 */
import { describe, expect, it } from 'vitest';
import {
  BUYER_FEE_CENTS,
  MoneyError,
  amountToCents,
  centsToAmountString,
  computeOrderAmounts,
  platformFee,
} from '../../../supabase/functions/_shared/domain/money';
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  canOpenDispute,
  canSellerShip,
  canTransition,
  isTerminal,
  orderStatusForPayment,
  orderStatusForShipment,
  type OrderStatus,
} from '../../../supabase/functions/_shared/domain/orders';

describe('money', () => {
  it('calcula o total do pedido com taxas', () => {
    const amounts = computeOrderAmounts({ itemCents: 145000, shippingCents: 3200 });
    expect(amounts.buyerFeeCents).toBe(BUYER_FEE_CENTS);
    expect(amounts.platformFeeCents).toBe(13050); // 9% de 1450,00
    expect(amounts.totalCents).toBe(145000 + 3200 + 990);
    expect(amounts.sellerAmountCents).toBe(145000 - 13050);
  });

  it('mantém a identidade total = item + frete + taxa - desconto', () => {
    const amounts = computeOrderAmounts({
      itemCents: 99999,
      shippingCents: 1234,
      discountCents: 500,
    });
    expect(amounts.totalCents).toBe(
      amounts.itemCents + amounts.shippingCents + amounts.buyerFeeCents - amounts.discountCents,
    );
  });

  it('trunca a taxa como a divisão inteira do Postgres', () => {
    // 9% de 1 real = 9 centavos exatos; 9% de 1,11 = 9,99 → trunca para 9
    expect(platformFee(100)).toBe(9);
    expect(platformFee(111)).toBe(9);
    expect(platformFee(1)).toBe(0);
  });

  it('rejeita valores não inteiros, negativos e desconto maior que o pedido', () => {
    expect(() => computeOrderAmounts({ itemCents: 10.5, shippingCents: 0 })).toThrow(MoneyError);
    expect(() => computeOrderAmounts({ itemCents: -1, shippingCents: 0 })).toThrow(MoneyError);
    expect(() => computeOrderAmounts({ itemCents: 0, shippingCents: 0 })).toThrow(MoneyError);
    expect(() =>
      computeOrderAmounts({ itemCents: 1000, shippingCents: 0, discountCents: 99999 }),
    ).toThrow(MoneyError);
  });

  it('converte centavos ↔ string sem erro de ponto flutuante', () => {
    expect(centsToAmountString(149190)).toBe('1491.90');
    expect(centsToAmountString(1)).toBe('0.01');
    expect(amountToCents('1491.90')).toBe(149190);
    expect(amountToCents('0.1')).toBe(10);
    expect(amountToCents(1491.9)).toBe(149190);
    // 0.1 + 0.2 clássico: se fosse float, daria 30.000000000000004
    expect(amountToCents('0.10') + amountToCents('0.20')).toBe(30);
  });
});

describe('máquina de estados', () => {
  it('permite o caminho feliz completo', () => {
    const path: OrderStatus[] = [
      'pending_payment',
      'paid',
      'preparing_shipment',
      'shipped',
      'delivered',
      'completed',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('bloqueia transições arbitrárias', () => {
    expect(canTransition('pending_payment', 'shipped')).toBe(false);
    expect(canTransition('pending_payment', 'delivered')).toBe(false);
    expect(canTransition('pending_payment', 'completed')).toBe(false);
    expect(canTransition('cancelled', 'paid')).toBe(false);
    expect(canTransition('refunded', 'paid')).toBe(false);
    expect(canTransition('completed', 'disputed')).toBe(false);
  });

  it('é idempotente para o mesmo estado', () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(true);
    }
  });

  it('estados terminais não têm saída', () => {
    for (const status of ORDER_STATUSES) {
      if (isTerminal(status)) expect(ORDER_TRANSITIONS[status]).toHaveLength(0);
    }
  });

  it('nenhuma transição aponta para estado inexistente', () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
      for (const target of targets) {
        expect(ORDER_STATUSES).toContain(target);
        expect(target).not.toBe(from);
      }
    }
  });

  it('define quem pode disputar e quem pode enviar', () => {
    expect(canOpenDispute('paid')).toBe(true);
    expect(canOpenDispute('delivered')).toBe(true);
    expect(canOpenDispute('pending_payment')).toBe(false);
    expect(canOpenDispute('completed')).toBe(false);

    expect(canSellerShip('paid')).toBe(true);
    expect(canSellerShip('preparing_shipment')).toBe(true);
    expect(canSellerShip('pending_payment')).toBe(false);
  });
});

describe('provedor de pagamento → pedido', () => {
  it('aprovação leva a paid e é idempotente', () => {
    expect(orderStatusForPayment('approved', 'pending_payment')).toBe('paid');
    expect(orderStatusForPayment('approved', 'payment_processing')).toBe('paid');
    // já pago: reprocessar o webhook não gera novo efeito
    expect(orderStatusForPayment('approved', 'paid')).toBeNull();
  });

  it('pendente só move de pending_payment para processing', () => {
    expect(orderStatusForPayment('pending', 'pending_payment')).toBe('payment_processing');
    expect(orderStatusForPayment('pending', 'paid')).toBeNull();
    expect(orderStatusForPayment('pending', 'shipped')).toBeNull();
  });

  it('recusa, cancelamento e estorno mapeiam corretamente', () => {
    expect(orderStatusForPayment('rejected', 'pending_payment')).toBe('payment_failed');
    expect(orderStatusForPayment('cancelled', 'pending_payment')).toBe('cancelled');
    expect(orderStatusForPayment('refunded', 'paid')).toBe('refunded');
    expect(orderStatusForPayment('charged_back', 'paid')).toBe('refunded');
  });

  it('nunca produz transição inválida a partir do estado atual', () => {
    const providerStatuses = [
      'approved',
      'pending',
      'rejected',
      'cancelled',
      'refunded',
      'charged_back',
      'created',
    ] as const;
    for (const status of ORDER_STATUSES) {
      for (const providerStatus of providerStatuses) {
        const next = orderStatusForPayment(providerStatus, status);
        if (next !== null) expect(canTransition(status, next)).toBe(true);
      }
    }
  });
});

describe('provedor de frete → pedido', () => {
  it('mapeia etiqueta, postagem e entrega', () => {
    expect(orderStatusForShipment('label_created', 'paid')).toBe('preparing_shipment');
    expect(orderStatusForShipment('posted', 'preparing_shipment')).toBe('shipped');
    expect(orderStatusForShipment('delivered', 'shipped')).toBe('delivered');
  });

  it('ignora eventos fora de ordem em vez de forçar transição inválida', () => {
    expect(orderStatusForShipment('delivered', 'pending_payment')).toBeNull();
    expect(orderStatusForShipment('posted', 'delivered')).toBeNull();
  });

  it('nunca produz transição inválida a partir do estado atual', () => {
    const shipmentStatuses = [
      'pending',
      'label_created',
      'posted',
      'in_transit',
      'delivered',
      'returned',
      'cancelled',
    ] as const;
    for (const status of ORDER_STATUSES) {
      for (const shipmentStatus of shipmentStatuses) {
        const next = orderStatusForShipment(shipmentStatus, status);
        if (next !== null) expect(canTransition(status, next)).toBe(true);
      }
    }
  });
});
