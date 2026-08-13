// Gera um anúncio (rascunho) a partir de um legit check concluído:
// valida posse + veredito, seleciona as melhores fotos do check (ranqueadas
// por nitidez e prioridade de região), copia para o bucket público de
// anúncios e gera título/descrição/hashtags com Claude (fallback
// determinístico sem chave). Entrada: { check_id }. Auth: JWT do usuário.
import { corsHeaders, json, serviceClient, userClient } from '../_shared/client.ts';

const MAX_PHOTOS = 6;

// Ordem de vitrine: peça inteira primeiro, detalhes depois.
const REGION_PRIORITY = [
  'front',
  'back',
  'logo',
  'print',
  'embroidery',
  'insole',
  'heel_tab',
  'neck_tag',
  'hang_tag',
  'box_label',
];

interface GeneratedCopy {
  title: string;
  description_md: string;
  specs: string[];
  hashtags: string[];
  keywords: string[];
  source: 'claude' | 'template';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let checkId: string | undefined;
  try {
    ({ check_id: checkId } = await req.json());
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!checkId) return json({ error: 'check_id_required' }, 400);

  const supabase = userClient(req);
  const { data: check, error: checkError } = await supabase
    .from('checks')
    .select(
      'id, profile_id, status, brand_id, category_id, product_id, declared, submitted_at, brands(name), categories(name, slug), products(name)',
    )
    .eq('id', checkId)
    .maybeSingle();
  if (checkError) return json({ error: checkError.message }, 500);
  if (!check) return json({ error: 'check_not_found' }, 404);
  if (check.status !== 'completed') return json({ error: 'check_not_completed' }, 409);

  const service = serviceClient();

  const { data: existing } = await service
    .from('listings')
    .select('id')
    .eq('check_id', checkId)
    .maybeSingle();
  if (existing) return json({ listing_id: existing.id, existing: true });

  const [{ data: verdict }, { data: certificate }, { data: photos }, { data: ocrRows }] =
    await Promise.all([
      service.from('verdicts').select('*').eq('check_id', checkId).maybeSingle(),
      service.from('certificates').select('id, public_code').eq('check_id', checkId).maybeSingle(),
      service
        .from('check_photos')
        .select('id, region, storage_path, quality')
        .eq('check_id', checkId),
      service.from('check_ocr').select('extracted').eq('check_id', checkId),
    ]);

  if (!verdict) return json({ error: 'verdict_not_found' }, 409);
  // Política: peça com indicação de réplica não entra no marketplace.
  if (verdict.outcome === 'replica') return json({ error: 'replica_cannot_be_listed' }, 422);

  // ---- melhores fotos: nitidez (quality.metrics.sharpness) + prioridade ----
  const ranked = [...(photos ?? [])].sort((a, b) => {
    const pa = REGION_PRIORITY.indexOf(a.region);
    const pb = REGION_PRIORITY.indexOf(b.region);
    const prioA = pa === -1 ? REGION_PRIORITY.length : pa;
    const prioB = pb === -1 ? REGION_PRIORITY.length : pb;
    if (prioA !== prioB) return prioA - prioB;
    return sharpness(b) - sharpness(a);
  });
  const selected = ranked.slice(0, MAX_PHOTOS);

  // ---- metadados extraídos no check preenchem o anúncio ----
  const extracted: Record<string, string[]> = {};
  for (const row of ocrRows ?? []) {
    for (const [key, values] of Object.entries((row.extracted ?? {}) as Record<string, string[]>)) {
      extracted[key] = [...(extracted[key] ?? []), ...values];
    }
  }

  const brandName = (check.brands as { name: string } | null)?.name ?? null;
  const categoryName = (check.categories as { name: string } | null)?.name ?? null;
  const modelName =
    (check.products as { name: string } | null)?.name ??
    (check.declared as { model_name?: string } | null)?.model_name ??
    null;

  const copy = await generateCopy({
    brandName,
    categoryName,
    modelName,
    probability: Number(verdict.authenticity_probability),
    summary: verdict.summary_md,
    composition: extracted.composition?.[0] ?? null,
    country: extracted.countries?.[0] ?? null,
    certificateCode: certificate?.public_code ?? null,
  });

  const { data: listing, error: listingError } = await service
    .from('listings')
    .insert({
      seller_id: check.profile_id,
      check_id: checkId,
      certificate_id: certificate?.id ?? null,
      brand_id: check.brand_id,
      category_id: check.category_id,
      product_id: check.product_id,
      title: copy.title,
      description_md: copy.description_md,
      hashtags: copy.hashtags,
      keywords: copy.keywords,
      ai_generated: {
        ...copy,
        generated_at: new Date().toISOString(),
        photo_count: selected.length,
      },
    })
    .select('id')
    .single();
  if (listingError) return json({ error: listingError.message }, 500);

  // ---- copia as fotos selecionadas para o bucket público de anúncios ----
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  let position = 0;
  for (const photo of selected) {
    const destination = `${check.profile_id}/${listing.id}/${position}-${photo.region}.jpg`;
    const copyResponse = await fetch(`${supabaseUrl}/storage/v1/object/copy`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        bucketId: 'check-photos',
        sourceKey: photo.storage_path,
        destinationBucket: 'listing-photos',
        destinationKey: destination,
      }),
    });
    if (!copyResponse.ok) {
      console.error('copy failed', photo.storage_path, await copyResponse.text());
      continue;
    }
    await service.from('listing_photos').insert({
      listing_id: listing.id,
      storage_path: destination,
      position,
      source: 'check',
    });
    position++;
  }

  return json({ listing_id: listing.id }, 201);
});

function sharpness(photo: { quality: unknown }): number {
  const quality = photo.quality as { metrics?: { sharpness?: number } } | null;
  return quality?.metrics?.sharpness ?? 0;
}

async function generateCopy(input: {
  brandName: string | null;
  categoryName: string | null;
  modelName: string | null;
  probability: number;
  summary: string;
  composition: string | null;
  country: string | null;
  certificateCode: string | null;
}): Promise<GeneratedCopy> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (apiKey) {
    try {
      return await generateWithClaude(apiKey, input);
    } catch (e) {
      console.error('claude generation failed, using template', e);
    }
  }
  return generateFromTemplate(input);
}

async function generateWithClaude(
  apiKey: string,
  input: Parameters<typeof generateFromTemplate>[0],
): Promise<GeneratedCopy> {
  const piece = [input.brandName, input.modelName, input.categoryName].filter(Boolean).join(' ');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5',
      max_tokens: 1024,
      system:
        'Você escreve anúncios de moda de segunda mão para o marketplace brasileiro ' +
        'Garimpo Madruga. Tom: direto, confiável, streetwear sem exagero. Nunca invente ' +
        'informações que não foram fornecidas (medidas, defeitos, ano). Nunca prometa ' +
        'autenticidade absoluta — a peça tem laudo probabilístico.',
      tools: [
        {
          name: 'write_listing',
          description: 'Registra o anúncio gerado.',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título otimizado, máx. 80 caracteres.' },
              description_md: {
                type: 'string',
                description: 'Descrição completa em pt-BR, 2–4 parágrafos curtos.',
              },
              specs: { type: 'array', items: { type: 'string' } },
              hashtags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
              keywords: { type: 'array', items: { type: 'string' }, maxItems: 10 },
            },
            required: ['title', 'description_md', 'specs', 'hashtags', 'keywords'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'write_listing' },
      messages: [
        {
          role: 'user',
          content:
            `Peça: ${piece || 'peça de moda'}\n` +
            `Laudo: ${Math.round(input.probability * 100)}% de probabilidade de autenticidade.\n` +
            `Resumo do laudo: ${input.summary}\n` +
            (input.composition ? `Composição (da etiqueta): ${input.composition}\n` : '') +
            (input.country ? `Fabricação: ${input.country}\n` : '') +
            (input.certificateCode ? `Certificado público: ${input.certificateCode}\n` : '') +
            'Gere o anúncio.',
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`anthropic ${response.status}: ${await response.text()}`);
  const body = await response.json();
  const toolUse = (body.content as Array<{ type: string; name?: string; input?: unknown }>).find(
    (block) => block.type === 'tool_use' && block.name === 'write_listing',
  );
  if (!toolUse?.input) throw new Error('no tool_use in response');
  const output = toolUse.input as Omit<GeneratedCopy, 'source'>;
  return { ...output, source: 'claude' };
}

function generateFromTemplate(input: {
  brandName: string | null;
  categoryName: string | null;
  modelName: string | null;
  probability: number;
  summary: string;
  composition: string | null;
  country: string | null;
  certificateCode: string | null;
}): GeneratedCopy {
  const piece = [input.brandName, input.modelName].filter(Boolean).join(' ');
  const title = [piece || input.categoryName || 'Peça', 'autenticada'].join(' — ');
  const specs = [
    input.brandName ? `Marca: ${input.brandName}` : null,
    input.categoryName ? `Categoria: ${input.categoryName}` : null,
    input.composition ? `Composição: ${input.composition}` : null,
    input.country ? `Fabricação: ${input.country}` : null,
  ].filter((line): line is string => line !== null);

  const description_md =
    `${piece || 'Peça'} verificada no Garimpo Madruga com ` +
    `${Math.round(input.probability * 100)}% de probabilidade de autenticidade.\n\n` +
    `${specs.join('\n')}\n\n` +
    (input.certificateCode ? `Certificado público: ${input.certificateCode}. ` : '') +
    'Laudo completo com evidências disponível no anúncio.';

  const tagBase = [input.brandName, input.categoryName, 'garimpo', 'streetwear', 'autenticado']
    .filter((tag): tag is string => Boolean(tag))
    .map((tag) => tag.toLowerCase().replace(/\s+/g, ''));

  return {
    title: title.slice(0, 80),
    description_md,
    specs,
    hashtags: [...new Set(tagBase)],
    keywords: [...new Set([piece.toLowerCase(), ...tagBase])].filter(Boolean),
    source: 'template',
  };
}
