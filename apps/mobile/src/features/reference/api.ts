import type { ReferenceItemInput } from '@garimpo/contracts';
import type { PhotoQuality } from '@garimpo/contracts';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

const BUCKET = 'reference-photos';
const UPLOAD_WIDTH = 2048;

export async function fetchMyRole(userId: string): Promise<string> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error) throw error;
  return data.role;
}

export interface ExpertItem {
  id: string;
  authenticity: 'authentic' | 'replica';
  sku: string | null;
  replica_batch: string | null;
  created_at: string;
  brands: { name: string } | null;
  categories: { name: string } | null;
  photoCount: number;
}

export async function fetchMyReferenceItems(userId: string): Promise<ExpertItem[]> {
  const { data, error } = await supabase
    .from('reference_items')
    .select(
      'id, authenticity, sku, replica_batch, created_at, brands(name), categories(name), reference_photos(id)',
    )
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    authenticity: row.authenticity as 'authentic' | 'replica',
    sku: row.sku as string | null,
    replica_batch: row.replica_batch as string | null,
    created_at: row.created_at as string,
    brands: row.brands as { name: string } | null,
    categories: row.categories as { name: string } | null,
    photoCount: ((row.reference_photos as unknown[]) ?? []).length,
  }));
}

export async function createReferenceItem(
  input: ReferenceItemInput,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('reference_items')
    .insert({ ...input, created_by: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export interface RegionCount {
  region: string;
  count: number;
}

export async function fetchReferencePhotoCounts(itemId: string): Promise<RegionCount[]> {
  const { data, error } = await supabase
    .from('reference_photos')
    .select('region')
    .eq('reference_item_id', itemId);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data) counts.set(row.region, (counts.get(row.region) ?? 0) + 1);
  return [...counts.entries()].map(([region, count]) => ({ region, count }));
}

export async function uploadReferencePhoto(input: {
  itemId: string;
  region: string;
  localUri: string;
  quality: PhotoQuality | null;
}): Promise<void> {
  const context = ImageManipulator.manipulate(input.localUri).resize({ width: UPLOAD_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });
  if (!saved.base64) throw new Error('Falha ao preparar a imagem');

  const bytes = decodeBase64(saved.base64);
  const path = `${input.itemId}/${input.region}/${uniqueName()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from('reference_photos').insert({
    reference_item_id: input.itemId,
    region: input.region,
    storage_path: path,
    meta: { bytes: bytes.byteLength, quality: input.quality },
  });
  if (error) throw error;
}

export async function enqueueReferenceProcessing(itemId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('reference_jobs')
    .select('id')
    .eq('reference_item_id', itemId)
    .in('status', ['queued', 'running'])
    .limit(1);
  if (existing && existing.length > 0) return;
  const { error } = await supabase.from('reference_jobs').insert({ reference_item_id: itemId });
  if (error) throw error;
}

export async function fetchLatestReferenceJob(itemId: string) {
  const { data, error } = await supabase
    .from('reference_jobs')
    .select('id, status, stage, progress, error')
    .eq('reference_item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data[0] ?? null;
}

function uniqueName(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
