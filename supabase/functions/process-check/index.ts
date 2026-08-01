// Worker do pipeline de análise — versão simulada do Sprint 2.
// Percorre os estágios reais, atualiza check_jobs em tempo real e escreve
// verdict + findings + certificate nas tabelas definitivas. No Sprint 3 o
// pipeline Python substitui APENAS o conteúdo de runAnalysis(); o contrato
// (job, estágios, tabelas) permanece idêntico.
// Entrada: { job_id: string }. Auth: service role.
import { corsHeaders, json, serviceClient } from '../_shared/client.ts';

const STAGES = [
  'preparing',
  'extracting_regions',
  'analyzing_details',
  'comparing_references',
  'scoring',
  'generating_report',
  'finalizing',
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** PRNG determinístico — mesmo check, mesmo laudo simulado. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface RegionTemplate {
  kind: string;
  title: string;
  positive: string;
  suspicious: string;
  positiveConclusion: string;
  suspiciousConclusion: string;
}

const TEMPLATES: Record<string, RegionTemplate> = {
  neck_tag: {
    kind: 'typography',
    title: 'Tipografia da etiqueta principal',
    positive:
      'Espaçamento entre letras, peso do traço e alinhamento da linha de base conferem com as referências da mesma era.',
    suspicious:
      'O espaçamento entre letras está levemente acima do padrão observado nas referências desta era.',
    positiveConclusion: 'Compatível com o padrão da marca.',
    suspiciousConclusion: 'Desvio pequeno — recomenda-se contraprova com fotos adicionais.',
  },
  wash_tag: {
    kind: 'label_content',
    title: 'Etiqueta de composição',
    positive:
      'Ordem dos idiomas, símbolos de lavagem e código de fábrica seguem o formato esperado para o período.',
    suspicious:
      'A sequência de idiomas difere do formato mais comum nas referências catalogadas para este período.',
    positiveConclusion: 'Formato consistente com peças autênticas.',
    suspiciousConclusion: 'Formato pouco usual para a era declarada.',
  },
  collar_stitch: {
    kind: 'stitch_density',
    title: 'Costura da gola',
    positive: 'Densidade de pontos regular e simétrica, dentro da faixa típica da marca.',
    suspicious: 'Espaçamento de pontos irregular em parte da gola.',
    positiveConclusion: 'Acabamento compatível com produção original.',
    suspiciousConclusion: 'Irregularidade pontual — peso limitado na análise.',
  },
  hem_stitch: {
    kind: 'stitch_density',
    title: 'Costura da barra',
    positive: 'Pontos por centímetro dentro do padrão, sem fios soltos ou tensão irregular.',
    suspicious: 'Tensão da linha levemente irregular na barra.',
    positiveConclusion: 'Acabamento compatível com produção original.',
    suspiciousConclusion: 'Desvio discreto de acabamento.',
  },
  pocket_stitch: {
    kind: 'stitch_density',
    title: 'Costura do bolso',
    positive: 'Reforços e arremates posicionados como nas referências.',
    suspicious: 'Arremate do bolso com padrão diferente das referências.',
    positiveConclusion: 'Compatível com o padrão da marca.',
    suspiciousConclusion: 'Padrão de arremate atípico.',
  },
  stitching: {
    kind: 'stitch_density',
    title: 'Costura',
    positive: 'Densidade e regularidade dos pontos dentro da faixa esperada.',
    suspicious: 'Regularidade dos pontos abaixo do esperado no trecho analisado.',
    positiveConclusion: 'Acabamento compatível com produção original.',
    suspiciousConclusion: 'Acabamento abaixo do padrão usual.',
  },
  logo: {
    kind: 'logo_geometry',
    title: 'Geometria do logo',
    positive: 'Proporções, curvas e posicionamento do logo conferem com o gabarito da marca.',
    suspicious: 'Proporção do logo apresenta desvio pequeno em relação ao gabarito.',
    positiveConclusion: 'Logo consistente com peças autênticas.',
    suspiciousConclusion: 'Desvio geométrico a confirmar.',
  },
  embroidery: {
    kind: 'embroidery_density',
    title: 'Densidade do bordado',
    positive:
      'Contagem e direção dos pontos do bordado compatíveis com produção industrial da marca.',
    suspicious: 'Pontos do bordado mais espaçados que o usual nas curvas.',
    positiveConclusion: 'Bordado compatível com o padrão original.',
    suspiciousConclusion: 'Densidade fora da faixa típica.',
  },
  print: {
    kind: 'print_quality',
    title: 'Qualidade da estampa',
    positive:
      'Bordas nítidas, cobertura uniforme e toque de tinta consistentes com o processo original.',
    suspicious: 'Bordas da estampa com serrilhado além do esperado.',
    positiveConclusion: 'Estampa compatível com o processo original.',
    suspiciousConclusion: 'Indício de processo de impressão diferente.',
  },
  cuffs: {
    kind: 'ribbing',
    title: 'Ribbing dos punhos',
    positive: 'Elasticidade aparente e trama do ribbing dentro do padrão.',
    suspicious: 'Trama do ribbing visivelmente mais aberta que nas referências.',
    positiveConclusion: 'Compatível com o padrão da marca.',
    suspiciousConclusion: 'Trama atípica para a era.',
  },
  zipper: {
    kind: 'hardware',
    title: 'Zíper',
    positive:
      'Marcações do puller e trilho conferem com os fornecedores usados pela marca no período.',
    suspicious: 'Acabamento do puller com brilho acima do usual para o período.',
    positiveConclusion: 'Hardware compatível.',
    suspiciousConclusion: 'Hardware possivelmente de fornecedor diferente.',
  },
  buttons: {
    kind: 'hardware',
    title: 'Botões',
    positive: 'Gravação e relevo dos botões conferem com as referências.',
    suspicious: 'Gravação do botão com profundidade irregular.',
    positiveConclusion: 'Hardware compatível.',
    suspiciousConclusion: 'Gravação atípica.',
  },
  hardware: {
    kind: 'hardware',
    title: 'Ferragens',
    positive: 'Peso aparente, banho e gravações das ferragens dentro do padrão.',
    suspicious: 'Banho das ferragens com tonalidade fora do padrão.',
    positiveConclusion: 'Ferragens compatíveis.',
    suspiciousConclusion: 'Tonalidade a confirmar.',
  },
  lining: {
    kind: 'material',
    title: 'Forro',
    positive: 'Padronagem e etiquetagem do forro conferem com o período.',
    suspicious: 'Padronagem do forro difere das referências do período.',
    positiveConclusion: 'Forro compatível.',
    suspiciousConclusion: 'Padronagem atípica.',
  },
  interior_label: {
    kind: 'label_content',
    title: 'Etiqueta interna',
    positive: 'Layout e conteúdo da etiqueta interna conferem com o esperado.',
    suspicious: 'Layout da etiqueta interna com variação não catalogada.',
    positiveConclusion: 'Etiqueta consistente.',
    suspiciousConclusion: 'Variação não catalogada — inconclusivo isolado.',
  },
  serial: {
    kind: 'serial_format',
    title: 'Serial',
    positive: 'Formato do serial válido para a era, sem colisão com seriais já catalogados.',
    suspicious: 'Formato do serial não corresponde ao padrão documentado da era.',
    positiveConclusion: 'Serial válido.',
    suspiciousConclusion: 'Formato de serial suspeito.',
  },
  size_tag: {
    kind: 'label_content',
    title: 'Etiqueta de tamanho',
    positive: 'Código, fonte e disposição da etiqueta de tamanho conferem com as referências.',
    suspicious: 'Fonte da etiqueta de tamanho difere do padrão do período.',
    positiveConclusion: 'Etiqueta consistente.',
    suspiciousConclusion: 'Fonte atípica para o período.',
  },
  hang_tag: {
    kind: 'label_content',
    title: 'Tag',
    positive: 'Gramatura aparente e impressão da tag conferem com o padrão.',
    suspicious: 'Impressão da tag com registro de cor deslocado.',
    positiveConclusion: 'Tag compatível.',
    suspiciousConclusion: 'Impressão fora do padrão.',
  },
  qr_code: {
    kind: 'code_validation',
    title: 'QR Code',
    positive: 'QR decodifica para o domínio oficial e o formato do payload confere com a era.',
    suspicious: 'QR não decodifica para o destino esperado.',
    positiveConclusion: 'Código válido.',
    suspiciousConclusion: 'Destino do código incompatível.',
  },
  insole: {
    kind: 'material',
    title: 'Palmilha',
    positive: 'Impressão e textura da palmilha conferem com as referências do modelo.',
    suspicious: 'Impressão da palmilha com tonalidade fora do padrão.',
    positiveConclusion: 'Palmilha compatível.',
    suspiciousConclusion: 'Tonalidade a confirmar.',
  },
  outsole: {
    kind: 'material',
    title: 'Solado',
    positive: 'Padrão de tração e marcações do solado conferem com o molde original.',
    suspicious: 'Marcações do solado com definição abaixo do esperado.',
    positiveConclusion: 'Solado compatível com o molde original.',
    suspiciousConclusion: 'Definição do molde suspeita.',
  },
  heel_tab: {
    kind: 'stitch_density',
    title: 'Heel tab',
    positive: 'Costura e proporção do heel tab dentro do padrão do modelo.',
    suspicious: 'Proporção do heel tab levemente diferente das referências.',
    positiveConclusion: 'Compatível com o padrão do modelo.',
    suspiciousConclusion: 'Proporção a confirmar.',
  },
  box_label: {
    kind: 'label_content',
    title: 'Etiqueta da caixa',
    positive: 'SKU, tamanho e layout da etiqueta da caixa conferem entre si e com o modelo.',
    suspicious: 'Layout da etiqueta da caixa difere do padrão do período.',
    positiveConclusion: 'Etiqueta da caixa consistente.',
    suspiciousConclusion: 'Layout atípico.',
  },
  front: {
    kind: 'silhouette',
    title: 'Silhueta e proporções',
    positive: 'Proporções gerais e caimento compatíveis com o modelo identificado.',
    suspicious: 'Proporções gerais com pequeno desvio do modelo identificado.',
    positiveConclusion: 'Silhueta compatível.',
    suspiciousConclusion: 'Desvio de modelagem a confirmar.',
  },
  back: {
    kind: 'silhouette',
    title: 'Vista traseira',
    positive: 'Construção traseira e posicionamento de recortes conferem com o modelo.',
    suspicious: 'Posicionamento de recortes traseiros com desvio pequeno.',
    positiveConclusion: 'Construção compatível.',
    suspiciousConclusion: 'Desvio pequeno de construção.',
  },
};

const GENERIC_TEMPLATE: RegionTemplate = {
  kind: 'visual_inspection',
  title: 'Inspeção visual',
  positive: 'Sem desvios visíveis em relação às referências disponíveis.',
  suspicious: 'Detalhe com variação em relação às referências disponíveis.',
  positiveConclusion: 'Sem apontamentos.',
  suspiciousConclusion: 'Variação a confirmar.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return json({ error: 'forbidden' }, 403);
  }

  let jobId: string | undefined;
  try {
    ({ job_id: jobId } = await req.json());
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!jobId) return json({ error: 'job_id_required' }, 400);

  const db = serviceClient();
  const { data: job } = await db
    .from('check_jobs')
    .select('id, check_id, status')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return json({ error: 'job_not_found' }, 404);
  if (job.status !== 'queued') return json({ error: 'job_not_queued', status: job.status }, 409);

  const work = runAnalysis(db, job.id, job.check_id).catch(async (e) => {
    console.error('analysis failed', e);
    await db
      .from('check_jobs')
      .update({ status: 'failed', error: String(e), finished_at: new Date().toISOString() })
      .eq('id', job.id);
    await db.from('checks').update({ status: 'failed' }).eq('id', job.check_id);
  });
  // @ts-ignore EdgeRuntime existe no runtime do Supabase
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }

  return json({ ok: true }, 202);
});

async function runAnalysis(
  db: ReturnType<typeof serviceClient>,
  jobId: string,
  checkId: string,
): Promise<void> {
  const setStage = async (stage: string, progress: number) => {
    await db
      .from('check_jobs')
      .update({ status: 'running', stage, progress, started_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  await db.from('checks').update({ status: 'processing' }).eq('id', checkId);

  const { data: photos } = await db
    .from('check_photos')
    .select('id, region')
    .eq('check_id', checkId)
    .order('created_at');

  // Cancelamento é respeitado entre estágios.
  for (let i = 0; i < STAGES.length; i++) {
    const { data: current } = await db.from('checks').select('status').eq('id', checkId).single();
    if (current?.status === 'cancelled') {
      await db
        .from('check_jobs')
        .update({ status: 'failed', error: 'cancelled', finished_at: new Date().toISOString() })
        .eq('id', jobId);
      return;
    }
    await setStage(STAGES[i], Math.round(((i + 1) / (STAGES.length + 1)) * 100));
    await sleep(900 + (hashString(checkId + i) % 600));
  }

  // ---- Simulação determinística (substituída pelo pipeline no Sprint 3) ----
  const rand = mulberry32(hashString(checkId));
  const bucket = rand();
  const probability =
    bucket < 0.6
      ? 0.88 + rand() * 0.1 // maioria: alta probabilidade
      : bucket < 0.85
        ? 0.55 + rand() * 0.29 // zona incerta
        : 0.12 + rand() * 0.22; // réplica provável

  const risk = probability >= 0.9 ? 'low' : probability >= 0.7 ? 'medium' : ('high' as const);
  const outcome =
    risk === 'low' && probability >= 0.85
      ? 'original'
      : probability <= 0.35
        ? 'replica'
        : 'inconclusive';
  const confidence =
    Math.abs(probability - 0.5) > 0.38
      ? 'high'
      : Math.abs(probability - 0.5) > 0.2
        ? 'medium'
        : 'low';

  const suspiciousBudget =
    outcome === 'original' ? 1 : outcome === 'replica' ? Math.max(3, (photos ?? []).length - 2) : 3;

  let suspiciousUsed = 0;
  const findings = (photos ?? []).map((photo, i) => {
    const template = TEMPLATES[photo.region] ?? GENERIC_TEMPLATE;
    const wantSuspicious =
      suspiciousUsed < suspiciousBudget && rand() < (outcome === 'replica' ? 0.7 : 0.25);
    if (wantSuspicious) suspiciousUsed++;
    const polarity = wantSuspicious ? 'suspicious' : 'positive';
    return {
      check_id: checkId,
      photo_id: photo.id,
      region: photo.region,
      kind: template.kind,
      polarity,
      score: Number(
        (polarity === 'positive' ? 0.7 + rand() * 0.3 : 0.15 + rand() * 0.35).toFixed(3),
      ),
      title: template.title,
      detail_md: polarity === 'positive' ? template.positive : template.suspicious,
      conclusion_md:
        polarity === 'positive' ? template.positiveConclusion : template.suspiciousConclusion,
      bbox: {
        x: Number((0.12 + rand() * 0.4).toFixed(3)),
        y: Number((0.12 + rand() * 0.4).toFixed(3)),
        w: Number((0.2 + rand() * 0.25).toFixed(3)),
        h: Number((0.15 + rand() * 0.2).toFixed(3)),
      },
      position: i,
    };
  });

  const positives = findings.filter((f) => f.polarity === 'positive').length;
  const suspicious = findings.length - positives;

  const summaryByOutcome = {
    original: `Analisamos ${findings.length} regiões da peça. ${positives} pontos conferem com as referências catalogadas e ${suspicious} merecem atenção. O conjunto de evidências é consistente com uma peça autêntica.`,
    replica: `Analisamos ${findings.length} regiões da peça. Encontramos ${suspicious} desvios relevantes em relação às referências catalogadas — o conjunto de evidências indica alta probabilidade de a peça não ser original.`,
    inconclusive: `Analisamos ${findings.length} regiões da peça. ${positives} pontos conferem com as referências, mas ${suspicious} apresentam desvios que impedem uma conclusão segura com as fotos enviadas.`,
  } as const;

  const recommendationsByOutcome = {
    original:
      '- Guarde o certificado digital junto da peça.\n- Ao anunciar, inclua o link do laudo para valorizar a venda.',
    replica:
      '- Não recomendamos a compra/venda desta peça como original.\n- Se você comprou recentemente, acione o vendedor com este laudo.\n- Este resultado é uma análise probabilística, não uma acusação.',
    inconclusive:
      '- Refaça as fotos marcadas com atenção em boa iluminação.\n- Adicione fotos opcionais (tag, QR, nota fiscal) se disponíveis.\n- Uma segunda análise não será cobrada.',
  } as const;

  const nextStepsByOutcome = {
    original:
      '1. Salve o certificado.\n2. Compartilhe o laudo com o comprador.\n3. Anuncie a peça com o selo.',
    replica:
      '1. Revise as evidências marcadas.\n2. Solicite revisão humana se discordar.\n3. Consulte nossos guias sobre devolução.',
    inconclusive:
      '1. Refaça as fotos indicadas.\n2. Reenvie para análise.\n3. Solicite revisão humana se preferir.',
  } as const;

  await db.from('check_findings').delete().eq('check_id', checkId);
  const { error: findingsError } = await db.from('check_findings').insert(findings);
  if (findingsError) throw new Error(findingsError.message);

  const { error: verdictError } = await db.from('verdicts').upsert(
    {
      check_id: checkId,
      authenticity_probability: Number(probability.toFixed(3)),
      risk,
      outcome,
      confidence,
      source: 'ai_auto',
      summary_md: summaryByOutcome[outcome],
      recommendations_md: recommendationsByOutcome[outcome],
      next_steps_md: nextStepsByOutcome[outcome],
      ai_model_version: 'mock-v0',
    },
    { onConflict: 'check_id' },
  );
  if (verdictError) throw new Error(verdictError.message);

  if (outcome === 'original') {
    const code = `GM-${crypto.randomUUID().replaceAll('-', '').slice(0, 4).toUpperCase()}-${crypto
      .randomUUID()
      .replaceAll('-', '')
      .slice(0, 4)
      .toUpperCase()}`;
    await db
      .from('certificates')
      .upsert({ check_id: checkId, public_code: code }, { onConflict: 'check_id' });
  }

  await db
    .from('check_jobs')
    .update({ status: 'completed', progress: 100, finished_at: new Date().toISOString() })
    .eq('id', jobId);
  await db.from('checks').update({ status: 'completed' }).eq('id', checkId);
}
