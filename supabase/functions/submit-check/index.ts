// Valida o checklist do check, move para a fila e dispara o processamento.
// Entrada: { check_id: string }. Auth: JWT do usuário (RLS garante posse).
import { corsHeaders, json, serviceClient, userClient } from '../_shared/client.ts';

interface ChecklistStep {
  region: string;
  required: boolean;
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

  // RLS: se o check não é do usuário, simplesmente não aparece.
  const { data: check, error: checkError } = await supabase
    .from('checks')
    .select('id, status, category_id, brand_id')
    .eq('id', checkId)
    .maybeSingle();
  if (checkError) return json({ error: checkError.message }, 500);
  if (!check) return json({ error: 'check_not_found' }, 404);
  if (check.status !== 'awaiting_photos') {
    return json({ error: 'check_already_submitted', status: check.status }, 409);
  }

  // Checklist efetivo: override da marca > default da categoria.
  const [{ data: category }, { data: brand }, { data: photos }] = await Promise.all([
    supabase
      .from('categories')
      .select('slug, photo_checklist')
      .eq('id', check.category_id ?? '')
      .maybeSingle(),
    check.brand_id
      ? supabase.from('brands').select('photo_checklist').eq('id', check.brand_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('check_photos').select('region').eq('check_id', checkId),
  ]);

  const brandOverride =
    brand?.photo_checklist && category?.slug
      ? (brand.photo_checklist as Record<string, ChecklistStep[]>)[category.slug]
      : undefined;
  const checklist: ChecklistStep[] =
    brandOverride && brandOverride.length > 0
      ? brandOverride
      : ((category?.photo_checklist as ChecklistStep[] | null) ?? []);

  const captured = new Set((photos ?? []).map((p) => p.region));
  const missing = checklist.filter((s) => s.required && !captured.has(s.region));
  if (missing.length > 0) {
    return json({ error: 'missing_required_photos', regions: missing.map((s) => s.region) }, 422);
  }

  // Transição + job com service role (o cliente não pode se auto-promover).
  const service = serviceClient();
  const { error: updateError } = await service
    .from('checks')
    .update({ status: 'queued', submitted_at: new Date().toISOString() })
    .eq('id', checkId)
    .eq('status', 'awaiting_photos');
  if (updateError) return json({ error: updateError.message }, 500);

  const { data: job, error: jobError } = await service
    .from('check_jobs')
    .insert({ check_id: checkId })
    .select('id')
    .single();
  if (jobError) return json({ error: jobError.message }, 500);

  // O worker do serviço de IA (services/ai-pipeline) consome a fila de
  // check_jobs com FOR UPDATE SKIP LOCKED — nada mais a fazer aqui.
  return json({ job_id: job.id }, 202);
});
