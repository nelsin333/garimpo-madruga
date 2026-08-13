// Aritmética monetária do marketplace. Tudo em centavos inteiros — nunca
// float. É o mesmo cálculo que a função create_order aplica no banco, usado
// aqui para montar o resumo do checkout antes de criar o pedido.

/** Taxa da plataforma sobre o item, em basis points (900 = 9%). */
export const PLATFORM_FEE_BPS = 900;

/** Taxa de serviço do comprador (financia a Garantia Garimpo). */
export const BUYER_FEE_CENTS = 990;

export interface OrderAmounts {
  itemCents: number;
  shippingCents: number;
  buyerFeeCents: number;
  platformFeeCents: number;
  discountCents: number;
  totalCents: number;
  sellerAmountCents: number;
}

export class MoneyError extends Error {}

function assertInteger(value: number, field: string): void {
  if (!Number.isInteger(value)) throw new MoneyError(`${field} precisa ser inteiro (centavos)`);
  if (value < 0) throw new MoneyError(`${field} não pode ser negativo`);
}

/**
 * Trunca para baixo, como a divisão inteira do Postgres em create_order.
 * Manter as duas implementações idênticas evita divergência de centavos
 * entre o resumo mostrado e o pedido efetivamente criado.
 */
export function platformFee(itemCents: number, bps = PLATFORM_FEE_BPS): number {
  assertInteger(itemCents, 'itemCents');
  return Math.floor((itemCents * bps) / 10000);
}

export function computeOrderAmounts(input: {
  itemCents: number;
  shippingCents: number;
  buyerFeeCents?: number;
  discountCents?: number;
  platformFeeBps?: number;
}): OrderAmounts {
  const buyerFeeCents = input.buyerFeeCents ?? BUYER_FEE_CENTS;
  const discountCents = input.discountCents ?? 0;

  assertInteger(input.itemCents, 'itemCents');
  assertInteger(input.shippingCents, 'shippingCents');
  assertInteger(buyerFeeCents, 'buyerFeeCents');
  assertInteger(discountCents, 'discountCents');
  if (input.itemCents <= 0) throw new MoneyError('itemCents precisa ser positivo');

  const platformFeeCents = platformFee(input.itemCents, input.platformFeeBps ?? PLATFORM_FEE_BPS);
  const totalCents = input.itemCents + input.shippingCents + buyerFeeCents - discountCents;
  if (totalCents <= 0) throw new MoneyError('total precisa ser positivo');
  if (discountCents > input.itemCents + input.shippingCents + buyerFeeCents) {
    throw new MoneyError('desconto maior que o pedido');
  }

  return {
    itemCents: input.itemCents,
    shippingCents: input.shippingCents,
    buyerFeeCents,
    platformFeeCents,
    discountCents,
    totalCents,
    sellerAmountCents: input.itemCents - platformFeeCents,
  };
}

/** Centavos → valor decimal string para APIs de pagamento (ex.: "1491.90"). */
export function centsToAmountString(cents: number): string {
  assertInteger(cents, 'cents');
  return (cents / 100).toFixed(2);
}

/** Valor decimal do provedor → centavos, sem erro de ponto flutuante. */
export function amountToCents(amount: number | string): number {
  const text = typeof amount === 'string' ? amount.trim() : amount.toFixed(2);
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new MoneyError(`valor inválido: ${text}`);
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const cents =
    Number(whole) * 100 +
    Number((fraction + '00').slice(0, 2)) +
    (fraction.length > 2 && Number(fraction[2]) >= 5 ? 1 : 0);
  return negative ? -cents : cents;
}
