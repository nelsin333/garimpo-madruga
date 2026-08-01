import { z } from 'zod';

export const listingStatusSchema = z.enum([
  'draft',
  'active',
  'reserved',
  'sold',
  'paused',
  'removed',
]);
export type ListingStatus = z.infer<typeof listingStatusSchema>;

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  reserved: 'Reservado',
  sold: 'Vendido',
  paused: 'Pausado',
  removed: 'Removido',
};

export const conditionSchema = z.enum([
  'new_with_tags',
  'new_no_tags',
  'excellent',
  'good',
  'fair',
  'poor',
]);
export type Condition = z.infer<typeof conditionSchema>;

export const CONDITION_LABELS: Record<Condition, string> = {
  new_with_tags: 'Novo com etiquetas',
  new_no_tags: 'Novo sem etiquetas',
  excellent: 'Excelente',
  good: 'Bom',
  fair: 'Razoável',
  poor: 'Com marcas de uso',
};

export const shippingMethodSchema = z.enum(['correios', 'melhor_envio', 'em_maos']);
export type ShippingMethod = z.infer<typeof shippingMethodSchema>;

export const SHIPPING_METHOD_LABELS: Record<ShippingMethod, string> = {
  correios: 'Correios',
  melhor_envio: 'Melhor Envio',
  em_maos: 'Em mãos',
};

/** Campos editáveis do anúncio (validação do editor). */
export const listingEditSchema = z.object({
  title: z.string().trim().min(8, 'Título muito curto').max(120),
  description_md: z.string().trim().min(20, 'Descreva melhor a peça').max(4000),
  condition: conditionSchema,
  size_label: z.string().trim().min(1, 'Informe o tamanho').max(20),
  price_cents: z.number().int().min(100, 'Preço mínimo R$ 1,00'),
  defects_md: z.string().max(2000).default(''),
  measurements: z.record(z.string(), z.number().positive()).default({}),
  location_city: z.string().trim().min(2, 'Informe a cidade').max(80),
  location_state: z.string().trim().length(2, 'UF com 2 letras').toUpperCase(),
  shipping_methods: z.array(shippingMethodSchema).min(1, 'Escolha ao menos uma forma de envio'),
  hashtags: z.array(z.string()).default([]),
});
export type ListingEdit = z.infer<typeof listingEditSchema>;

export function formatPriceBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

// ---------- Exportação estruturada para marketplaces externos ----------
// Sem automação sobre plataformas de terceiros: geramos um pacote pronto
// (texto + metadados) que o usuário cola no app de destino. Integração via
// API oficial entra aqui quando/se a plataforma oferecer.

export const exportTargetSchema = z.enum(['enjoei', 'olx', 'droper']);
export type ExportTarget = z.infer<typeof exportTargetSchema>;

export const EXPORT_TARGET_LABELS: Record<ExportTarget, string> = {
  enjoei: 'Enjoei',
  olx: 'OLX',
  droper: 'Droper',
};

/** Limites conservadores de título por plataforma. */
const TITLE_LIMITS: Record<ExportTarget, number> = {
  enjoei: 60,
  olx: 70,
  droper: 80,
};

export interface ExportListingInput {
  title: string;
  description_md: string;
  price_cents: number;
  condition: Condition;
  size_label: string;
  brand: string | null;
  category: string | null;
  location_city: string | null;
  location_state: string | null;
  hashtags: string[];
  certificate_code: string | null;
  certificate_url: string | null;
}

export interface ExportPackage {
  target: ExportTarget;
  title: string;
  body: string;
  price: string;
  instructions: string;
}

export function truncateTitle(title: string, limit: number): string {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export function buildExportPackage(target: ExportTarget, input: ExportListingInput): ExportPackage {
  const title = truncateTitle(input.title, TITLE_LIMITS[target]);
  const price = formatPriceBRL(input.price_cents);
  const location =
    input.location_city && input.location_state
      ? `${input.location_city}/${input.location_state}`
      : null;

  const specs = [
    input.brand ? `Marca: ${input.brand}` : null,
    input.category ? `Categoria: ${input.category}` : null,
    `Tamanho: ${input.size_label}`,
    `Condição: ${CONDITION_LABELS[input.condition]}`,
    location ? `Local: ${location}` : null,
  ].filter((line): line is string => line !== null);

  const certificate = input.certificate_code
    ? `\n✅ Peça autenticada — certificado ${input.certificate_code}` +
      (input.certificate_url ? `\nConfira o laudo: ${input.certificate_url}` : '')
    : '';

  const hashtags =
    target !== 'olx' && input.hashtags.length > 0
      ? `\n\n${input.hashtags
          .slice(0, 10)
          .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
          .join(' ')}`
      : '';

  const body = `${input.description_md.trim()}\n\n${specs.join('\n')}${certificate}${hashtags}`;

  const instructionsByTarget: Record<ExportTarget, string> = {
    enjoei:
      'Abra o Enjoei → vender → cole o título e a descrição, defina o preço e suba as fotos salvas na galeria.',
    olx: 'Abra a OLX → anunciar → cole o título e a descrição, defina o preço e selecione as fotos.',
    droper:
      'Abra o Droper → novo anúncio → cole os dados e selecione as fotos. Informe o certificado no campo de descrição.',
  };

  return {
    target,
    title,
    body,
    price,
    instructions: instructionsByTarget[target],
  };
}
