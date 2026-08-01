import {
  photoChecklistSchema,
  type PhotoChecklist,
  type PhotoQuality,
} from '@garimpo/contracts';
import type { Tables } from '@garimpo/db';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import type { WizardBrand, WizardCategory, WizardPhoto, WizardProduct } from './store';

const BUCKET = 'check-photos';
const UPLOAD_WIDTH = 2048;
export const SIGNED_URL_TTL = 3600;

// ---------- Catálogo ----------

export async function fetchWizardCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, display_order')
    .not('display_order', 'is', null)
    .order('display_order');
  if (error) throw error;
  return data;
}

export async function searchBrands(query: string) {
  let builder = supabase.from('brands').select('id, name, slug, tier').order('tier').order('name');
  if (query.trim()) builder = builder.ilike('name', `%${query.trim()}%`);
  const { data, error } = await builder.limit(15);
  if (error) throw error;
  return data;
}

export async function createBrand(name: string, profileId: string): Promise<WizardBrand> {
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from('brands')
    .insert({ name: name.trim(), slug, tier: 3, created_by: profileId })
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}

export async function searchProducts(brandId: string, categoryId: string, query: string) {
  let builder = supabase
    .from('products')
    .select('id, name, style_code, colorway, release_year')
    .eq('brand_id', brandId)
    .or(`category_id.eq.${categoryId},category_id.is.null`)
    .order('name');
  if (query.trim()) builder = builder.ilike('name', `%${query.trim()}%`);
  const { data, error } = await builder.limit(15);
  if (error) throw error;
  return data;
}

export async function createProduct(input: {
  brandId: string;
  categoryId: string;
  name: string;
  profileId: string;
}): Promise<WizardProduct> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      brand_id: input.brandId,
      category_id: input.categoryId,
      name: input.name.trim(),
      source: 'user',
      created_by: input.profileId,
    })
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}

/** Checklist efetivo: override da marca > default da categoria. */
export async function fetchChecklist(
  categoryId: string,
  categorySlug: string,
  brandId: string | null,
): Promise<PhotoChecklist> {
  const [{ data: category, error }, brandResult] = await Promise.all([
    supabase.from('categories').select('photo_checklist').eq('id', categoryId).single(),
    brandId
      ? supabase.from('brands').select('photo_checklist').eq('id', brandId).single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (error) throw error;

  const override = (brandResult.data?.photo_checklist as Record<string, unknown> | null)?.[
    categorySlug
  ];
  const raw = Array.isArray(override) && override.length > 0 ? override : category.photo_checklist;
  return photoChecklistSchema.parse(raw);
}

// ---------- Check (rascunho, fotos, envio) ----------

export async function ensureCheck(input: {
  checkId: string | null;
  profileId: string;
  category: WizardCategory;
  brand: WizardBrand | null;
  product: WizardProduct | null;
}): Promise<string> {
  const declared = { model_name: input.product?.name ?? null };
  if (input.checkId) {
    const { error } = await supabase
      .from('checks')
      .update({
        category_id: input.category.id,
        brand_id: input.brand?.id ?? null,
        product_id: input.product?.id ?? null,
        declared,
      })
      .eq('id', input.checkId);
    if (error) throw error;
    return input.checkId;
  }
  const { data, error } = await supabase
    .from('checks')
    .insert({
      profile_id: input.profileId,
      category_id: input.category.id,
      brand_id: input.brand?.id ?? null,
      product_id: input.product?.id ?? null,
      declared,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Redimensiona, sobe para o Storage (caminho {profile}/{check}/{region}.jpg —
 * exigido pela política RLS do bucket) e faz upsert da linha em check_photos.
 */
export async function uploadCheckPhoto(input: {
  checkId: string;
  profileId: string;
  region: string;
  localUri: string;
  quality: PhotoQuality | null;
}): Promise<void> {
  const context = ImageManipulator.manipulate(input.localUri).resize({ width: UPLOAD_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new Error('Falha ao preparar a imagem');

  const path = `${input.profileId}/${input.checkId}/${input.region}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, decodeBase64(saved.base64), { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { error } = await supabase
    .from('check_photos')
    .upsert(
      {
        check_id: input.checkId,
        region: input.region,
        storage_path: path,
        quality: input.quality,
      },
      { onConflict: 'check_id,region' },
    );
  if (error) throw error;
}

export async function submitCheck(checkId: string): Promise<{ job_id: string }> {
  const { data, error } = await supabase.functions.invoke('submit-check', {
    body: { check_id: checkId },
  });
  if (error) throw error;
  return data as { job_id: string };
}

export async function cancelCheck(checkId: string): Promise<void> {
  const { error } = await supabase.from('checks').update({ status: 'cancelled' }).eq('id', checkId);
  if (error) throw error;
}

// ---------- Consulta (processamento, laudo, histórico) ----------

export async function fetchCheckWithJob(checkId: string) {
  const [{ data: check, error }, { data: jobs }] = await Promise.all([
    supabase
      .from('checks')
      .select('id, status, brands(name), categories(name), declared')
      .eq('id', checkId)
      .single(),
    supabase
      .from('check_jobs')
      .select('id, status, stage, progress, error')
      .eq('check_id', checkId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  if (error) throw error;
  return { check, job: jobs?.[0] ?? null };
}

export interface Report {
  check: {
    id: string;
    status: string;
    created_at: string;
    brandName: string | null;
    categoryName: string | null;
    modelName: string | null;
  };
  verdict: Tables<'verdicts'> | null;
  findings: Tables<'check_findings'>[];
  certificate: Pick<Tables<'certificates'>, 'public_code' | 'revoked'> | null;
  /** region → URL assinada da foto. */
  photoUrls: Record<string, string>;
  /** photo_id → region (para ancorar findings). */
  photoRegionById: Record<string, string>;
}

export async function fetchReport(checkId: string): Promise<Report> {
  const [checkRes, verdictRes, findingsRes, certRes, photosRes] = await Promise.all([
    supabase
      .from('checks')
      .select('id, status, created_at, declared, brands(name), categories(name), products(name)')
      .eq('id', checkId)
      .single(),
    supabase.from('verdicts').select('*').eq('check_id', checkId).maybeSingle(),
    supabase.from('check_findings').select('*').eq('check_id', checkId).order('position'),
    supabase
      .from('certificates')
      .select('public_code, revoked')
      .eq('check_id', checkId)
      .maybeSingle(),
    supabase.from('check_photos').select('id, region, storage_path').eq('check_id', checkId),
  ]);
  if (checkRes.error) throw checkRes.error;

  const photos = photosRes.data ?? [];
  const photoUrls: Record<string, string> = {};
  if (photos.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        photos.map((p) => p.storage_path),
        SIGNED_URL_TTL,
      );
    signed?.forEach((entry, i) => {
      if (entry.signedUrl) photoUrls[photos[i]!.region] = entry.signedUrl;
    });
  }

  const check = checkRes.data as unknown as {
    id: string;
    status: string;
    created_at: string;
    declared: { model_name?: string | null } | null;
    brands: { name: string } | null;
    categories: { name: string } | null;
    products: { name: string } | null;
  };

  return {
    check: {
      id: check.id,
      status: check.status,
      created_at: check.created_at,
      brandName: check.brands?.name ?? null,
      categoryName: check.categories?.name ?? null,
      modelName: check.products?.name ?? check.declared?.model_name ?? null,
    },
    verdict: (verdictRes.data as Tables<'verdicts'> | null) ?? null,
    findings: (findingsRes.data as Tables<'check_findings'>[] | null) ?? [],
    certificate: certRes.data ?? null,
    photoUrls,
    photoRegionById: Object.fromEntries(photos.map((p) => [p.id, p.region])),
  };
}

export interface HistoryItem {
  id: string;
  status: string;
  created_at: string;
  brandName: string | null;
  categoryName: string | null;
  modelName: string | null;
  probability: number | null;
  outcome: string | null;
  risk: string | null;
}

export async function fetchHistory(): Promise<HistoryItem[]> {
  const { data, error } = await supabase
    .from('checks')
    .select(
      'id, status, created_at, declared, brands(name), categories(name), products(name), verdicts(authenticity_probability, outcome, risk)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data as unknown as Array<Record<string, unknown>>).map((row) => {
    const verdict = row.verdicts as {
      authenticity_probability: number;
      outcome: string;
      risk: string;
    } | null;
    return {
      id: row.id as string,
      status: row.status as string,
      created_at: row.created_at as string,
      brandName: (row.brands as { name: string } | null)?.name ?? null,
      categoryName: (row.categories as { name: string } | null)?.name ?? null,
      modelName:
        (row.products as { name: string } | null)?.name ??
        ((row.declared as { model_name?: string | null } | null)?.model_name ?? null),
      probability: verdict?.authenticity_probability ?? null,
      outcome: verdict?.outcome ?? null,
      risk: verdict?.risk ?? null,
    };
  });
}

// ---------- Retomada de rascunho ----------

export async function fetchDraftForResume(checkId: string) {
  const { data, error } = await supabase
    .from('checks')
    .select(
      'id, status, declared, categories(id, slug, name), brands(id, name), products(id, name)',
    )
    .eq('id', checkId)
    .single();
  if (error) throw error;

  const row = data as unknown as {
    id: string;
    status: string;
    declared: { model_name?: string | null } | null;
    categories: { id: string; slug: string; name: string } | null;
    brands: { id: string; name: string } | null;
    products: { id: string; name: string } | null;
  };

  const { data: photos } = await supabase
    .from('check_photos')
    .select('region, storage_path, quality')
    .eq('check_id', checkId);

  const paths = (photos ?? []).map((p) => p.storage_path);
  const urls: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    signed?.forEach((entry, i) => {
      if (entry.signedUrl) urls[(photos ?? [])[i]!.region] = entry.signedUrl;
    });
  }

  const wizardPhotos: Record<string, WizardPhoto> = {};
  for (const p of photos ?? []) {
    const url = urls[p.region];
    if (!url) continue;
    wizardPhotos[p.region] = {
      region: p.region,
      localUri: url,
      quality: (p.quality as PhotoQuality | null) ?? null,
      upload: 'uploaded',
    };
  }

  return { row, wizardPhotos };
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
