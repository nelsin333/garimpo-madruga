import type { Condition, ListingEdit, ListingStatus } from '@garimpo/contracts';
import type { Json } from '@garimpo/db';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

export const LISTING_BUCKET = 'listing-photos';
const UPLOAD_WIDTH = 2048;

/** URL pública do bucket de anúncios (bucket é público — sem assinatura). */
export function listingPhotoUrl(storagePath: string): string {
  return supabase.storage.from(LISTING_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

// ---------- Criação a partir do check ----------

export async function createListingFromCheck(checkId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-listing', {
    body: { check_id: checkId },
  });
  if (error) throw error;
  return (data as { listing_id: string }).listing_id;
}

export async function findListingByCheck(checkId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('listings')
    .select('id')
    .eq('check_id', checkId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// ---------- Edição ----------

export interface ListingDraft {
  id: string;
  seller_id: string;
  status: ListingStatus;
  title: string;
  description_md: string;
  condition: Condition | null;
  size_label: string | null;
  measurements: Record<string, number>;
  defects_md: string;
  price_cents: number | null;
  location_city: string | null;
  location_state: string | null;
  shipping_methods: string[];
  hashtags: string[];
  keywords: string[];
  brandName: string | null;
  categoryName: string | null;
  productName: string | null;
  certificateCode: string | null;
  photos: { id: string; storage_path: string; position: number; url: string }[];
}

export async function fetchListingDraft(listingId: string): Promise<ListingDraft> {
  const [{ data, error }, { data: photos }] = await Promise.all([
    supabase
      .from('listings')
      .select('*, brands(name), categories(name), products(name), certificates(public_code)')
      .eq('id', listingId)
      .single(),
    supabase
      .from('listing_photos')
      .select('id, storage_path, position')
      .eq('listing_id', listingId)
      .order('position'),
  ]);
  if (error) throw error;

  const row = data as unknown as Record<string, unknown>;
  return {
    id: row.id as string,
    seller_id: row.seller_id as string,
    status: row.status as ListingStatus,
    title: row.title as string,
    description_md: row.description_md as string,
    condition: (row.condition as Condition | null) ?? null,
    size_label: (row.size_label as string | null) ?? null,
    measurements: (row.measurements as Record<string, number>) ?? {},
    defects_md: (row.defects_md as string) ?? '',
    price_cents: (row.price_cents as number | null) ?? null,
    location_city: (row.location_city as string | null) ?? null,
    location_state: (row.location_state as string | null) ?? null,
    shipping_methods: (row.shipping_methods as string[]) ?? [],
    hashtags: (row.hashtags as string[]) ?? [],
    keywords: (row.keywords as string[]) ?? [],
    brandName: (row.brands as { name: string } | null)?.name ?? null,
    categoryName: (row.categories as { name: string } | null)?.name ?? null,
    productName: (row.products as { name: string } | null)?.name ?? null,
    certificateCode: (row.certificates as { public_code: string } | null)?.public_code ?? null,
    photos: ((photos as { id: string; storage_path: string; position: number }[]) ?? []).map(
      (photo) => ({ ...photo, url: listingPhotoUrl(photo.storage_path) }),
    ),
  };
}

export async function saveListingDraft(listingId: string, edit: ListingEdit): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({
      title: edit.title,
      description_md: edit.description_md,
      condition: edit.condition,
      size_label: edit.size_label,
      price_cents: edit.price_cents,
      defects_md: edit.defects_md,
      measurements: edit.measurements as unknown as Json,
      location_city: edit.location_city,
      location_state: edit.location_state,
      shipping_methods: edit.shipping_methods,
      hashtags: edit.hashtags,
    })
    .eq('id', listingId);
  if (error) throw error;
}

export async function publishListing(listingId: string): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({ status: 'active', published_at: new Date().toISOString() })
    .eq('id', listingId);
  if (error) throw error;
}

export async function setListingStatus(listingId: string, status: ListingStatus): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({ status, sold_at: status === 'sold' ? new Date().toISOString() : null })
    .eq('id', listingId);
  if (error) throw error;
}

// ---------- Fotos do anúncio ----------

export async function reorderListingPhotos(photoIds: string[]): Promise<void> {
  await Promise.all(
    photoIds.map((id, position) =>
      supabase.from('listing_photos').update({ position }).eq('id', id),
    ),
  );
}

export async function removeListingPhoto(photoId: string, storagePath: string): Promise<void> {
  await supabase.storage.from(LISTING_BUCKET).remove([storagePath]);
  const { error } = await supabase.from('listing_photos').delete().eq('id', photoId);
  if (error) throw error;
}

export async function uploadListingPhoto(input: {
  listingId: string;
  sellerId: string;
  localUri: string;
  position: number;
}): Promise<void> {
  const context = ImageManipulator.manipulate(input.localUri).resize({ width: UPLOAD_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new Error('Falha ao preparar a imagem');

  const path = `${input.sellerId}/${input.listingId}/extra-${Date.now().toString(36)}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(LISTING_BUCKET)
    .upload(path, decodeBase64(saved.base64), { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from('listing_photos').insert({
    listing_id: input.listingId,
    storage_path: path,
    position: input.position,
    source: 'upload',
  });
  if (error) throw error;
}

// ---------- Marketplace: busca ----------

export interface MarketFilters {
  query?: string;
  brandId?: string;
  categoryId?: string;
  condition?: Condition;
  sizeLabel?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  verifiedOnly?: boolean;
  state?: string;
  city?: string;
  sort?: 'recent' | 'price_asc' | 'price_desc';
}

export interface MarketListing {
  id: string;
  title: string;
  price_cents: number | null;
  condition: Condition | null;
  size_label: string | null;
  location_city: string | null;
  location_state: string | null;
  certificate_id: string | null;
  coverUrl: string | null;
  probability: number | null;
  brandName: string | null;
}

export async function searchListings(filters: MarketFilters): Promise<MarketListing[]> {
  let builder = supabase
    .from('listings')
    .select(
      'id, title, price_cents, condition, size_label, location_city, location_state, certificate_id, brands(name), listing_photos(storage_path, position), checks(verdicts(authenticity_probability))',
    )
    .eq('status', 'active');

  if (filters.query) {
    builder = builder.textSearch('search_tsv', filters.query, {
      type: 'websearch',
      config: 'portuguese',
    });
  }
  if (filters.brandId) builder = builder.eq('brand_id', filters.brandId);
  if (filters.categoryId) builder = builder.eq('category_id', filters.categoryId);
  if (filters.condition) builder = builder.eq('condition', filters.condition);
  if (filters.sizeLabel) builder = builder.ilike('size_label', filters.sizeLabel);
  if (filters.minPriceCents != null) builder = builder.gte('price_cents', filters.minPriceCents);
  if (filters.maxPriceCents != null) builder = builder.lte('price_cents', filters.maxPriceCents);
  if (filters.verifiedOnly) builder = builder.not('certificate_id', 'is', null);
  if (filters.state) builder = builder.eq('location_state', filters.state);
  if (filters.city) builder = builder.ilike('location_city', `%${filters.city}%`);

  builder =
    filters.sort === 'price_asc'
      ? builder.order('price_cents', { ascending: true })
      : filters.sort === 'price_desc'
        ? builder.order('price_cents', { ascending: false })
        : builder.order('created_at', { ascending: false });

  const { data, error } = await builder.limit(60);
  if (error) throw error;

  return (data as unknown as Array<Record<string, unknown>>).map((row) => {
    const photos = (row.listing_photos as { storage_path: string; position: number }[]) ?? [];
    const cover = [...photos].sort((a, b) => a.position - b.position)[0];
    const check = row.checks as { verdicts: { authenticity_probability: number } | null } | null;
    return {
      id: row.id as string,
      title: row.title as string,
      price_cents: (row.price_cents as number | null) ?? null,
      condition: (row.condition as Condition | null) ?? null,
      size_label: (row.size_label as string | null) ?? null,
      location_city: (row.location_city as string | null) ?? null,
      location_state: (row.location_state as string | null) ?? null,
      certificate_id: (row.certificate_id as string | null) ?? null,
      coverUrl: cover ? listingPhotoUrl(cover.storage_path) : null,
      probability: check?.verdicts?.authenticity_probability ?? null,
      brandName: (row.brands as { name: string } | null)?.name ?? null,
    };
  });
}

// ---------- Marketplace: detalhe ----------

export interface ListingDetail extends ListingDraft {
  probability: number | null;
  risk: string | null;
  outcome: string | null;
  summary_md: string | null;
  checkedAt: string | null;
  publishedAt: string | null;
  seller: { id: string; username: string; display_name: string | null; reputation_score: number };
  favorited: boolean;
}

export async function fetchListingDetail(
  listingId: string,
  viewerId: string | null,
): Promise<ListingDetail> {
  const draft = await fetchListingDraft(listingId);

  const [{ data: extra }, favorite] = await Promise.all([
    supabase
      .from('listings')
      .select(
        'published_at, profiles!listings_seller_id_fkey(id, username, display_name, reputation_score), checks(submitted_at, verdicts(authenticity_probability, risk, outcome, summary_md))',
      )
      .eq('id', listingId)
      .single(),
    viewerId
      ? supabase
          .from('listing_favorites')
          .select('listing_id')
          .eq('listing_id', listingId)
          .eq('profile_id', viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const row = (extra ?? {}) as Record<string, unknown>;
  const check = row.checks as {
    submitted_at: string | null;
    verdicts: {
      authenticity_probability: number;
      risk: string;
      outcome: string;
      summary_md: string;
    } | null;
  } | null;
  const seller = row.profiles as {
    id: string;
    username: string;
    display_name: string | null;
    reputation_score: number;
  } | null;

  return {
    ...draft,
    probability: check?.verdicts?.authenticity_probability ?? null,
    risk: check?.verdicts?.risk ?? null,
    outcome: check?.verdicts?.outcome ?? null,
    summary_md: check?.verdicts?.summary_md ?? null,
    checkedAt: check?.submitted_at ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    seller: seller ?? {
      id: draft.seller_id,
      username: 'vendedor',
      display_name: null,
      reputation_score: 0,
    },
    favorited: Boolean(favorite.data),
  };
}

// ---------- Favoritos ----------

export async function toggleFavorite(input: {
  listingId: string;
  profileId: string;
  favorited: boolean;
  priceCents: number | null;
}): Promise<void> {
  if (input.favorited) {
    const { error } = await supabase
      .from('listing_favorites')
      .delete()
      .eq('listing_id', input.listingId)
      .eq('profile_id', input.profileId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('listing_favorites').insert({
    listing_id: input.listingId,
    profile_id: input.profileId,
    price_cents_at_save: input.priceCents,
  });
  if (error) throw error;
}

export async function fetchFavorites(profileId: string): Promise<MarketListing[]> {
  const { data, error } = await supabase
    .from('listing_favorites')
    .select(
      'price_cents_at_save, listings(id, title, price_cents, condition, size_label, location_city, location_state, certificate_id, brands(name), listing_photos(storage_path, position))',
    )
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data as unknown as Array<Record<string, unknown>>)
    .map((row) => row.listings as Record<string, unknown> | null)
    .filter((listing): listing is Record<string, unknown> => listing !== null)
    .map((listing) => {
      const photos = (listing.listing_photos as { storage_path: string; position: number }[]) ?? [];
      const cover = [...photos].sort((a, b) => a.position - b.position)[0];
      return {
        id: listing.id as string,
        title: listing.title as string,
        price_cents: (listing.price_cents as number | null) ?? null,
        condition: (listing.condition as Condition | null) ?? null,
        size_label: (listing.size_label as string | null) ?? null,
        location_city: (listing.location_city as string | null) ?? null,
        location_state: (listing.location_state as string | null) ?? null,
        certificate_id: (listing.certificate_id as string | null) ?? null,
        coverUrl: cover ? listingPhotoUrl(cover.storage_path) : null,
        probability: null,
        brandName: (listing.brands as { name: string } | null)?.name ?? null,
      };
    });
}

// ---------- Notificações (alerta de preço) ----------

export interface AppNotification {
  id: string;
  kind: string;
  payload: {
    listing_id?: string;
    title?: string;
    old_price_cents?: number;
    new_price_cents?: number;
  };
  read: boolean;
  created_at: string;
}

export async function fetchNotifications(profileId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, payload, read, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as unknown as AppNotification[];
}

export async function markNotificationsRead(profileId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('profile_id', profileId)
    .eq('read', false);
}

// ---------- Perfil público do vendedor ----------

export interface SellerProfile {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    reputation_score: number;
    level: number;
    member_since: string;
  };
  sales_count: number;
  active_listings_count: number;
  checks_count: number;
  verified_count: number;
}

export async function fetchSellerProfile(username: string): Promise<SellerProfile | null> {
  const { data, error } = await supabase.rpc('seller_public_stats', { p_username: username });
  if (error) throw error;
  return (data as unknown as SellerProfile | null) ?? null;
}

export async function fetchSellerListings(sellerId: string): Promise<MarketListing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, title, price_cents, condition, size_label, location_city, location_state, certificate_id, brands(name), listing_photos(storage_path, position)',
    )
    .eq('seller_id', sellerId)
    .in('status', ['active', 'sold'])
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;

  return (data as unknown as Array<Record<string, unknown>>).map((listing) => {
    const photos = (listing.listing_photos as { storage_path: string; position: number }[]) ?? [];
    const cover = [...photos].sort((a, b) => a.position - b.position)[0];
    return {
      id: listing.id as string,
      title: listing.title as string,
      price_cents: (listing.price_cents as number | null) ?? null,
      condition: (listing.condition as Condition | null) ?? null,
      size_label: (listing.size_label as string | null) ?? null,
      location_city: (listing.location_city as string | null) ?? null,
      location_state: (listing.location_state as string | null) ?? null,
      certificate_id: (listing.certificate_id as string | null) ?? null,
      coverUrl: cover ? listingPhotoUrl(cover.storage_path) : null,
      probability: null,
      brandName: (listing.brands as { name: string } | null)?.name ?? null,
    };
  });
}

// ---------- Meus anúncios ----------

export async function fetchMyListings(sellerId: string) {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, price_cents, status, created_at, listing_photos(storage_path, position)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Array<Record<string, unknown>>).map((listing) => {
    const photos = (listing.listing_photos as { storage_path: string; position: number }[]) ?? [];
    const cover = [...photos].sort((a, b) => a.position - b.position)[0];
    return {
      id: listing.id as string,
      title: listing.title as string,
      price_cents: (listing.price_cents as number | null) ?? null,
      status: listing.status as ListingStatus,
      created_at: listing.created_at as string,
      coverUrl: cover ? listingPhotoUrl(cover.storage_path) : null,
    };
  });
}
