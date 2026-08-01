/**
 * Tipos do schema public no formato que o supabase-js consome.
 * Mantidos à mão em sincronia com supabase/migrations até o CI rodar
 * `pnpm --filter @garimpo/db gen:types` contra um projeto real
 * (aí este arquivo passa a reexportar o gerado).
 *
 * IMPORTANTE: rows são `type` (não `interface`) — interfaces não têm index
 * signature implícita e quebram a inferência do supabase-js.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CheckStatus =
  | 'awaiting_photos'
  | 'queued'
  | 'processing'
  | 'in_review'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed';

export type RiskLevel = 'low' | 'medium' | 'high' | 'inconclusive';

export type VerdictSource = 'ai_auto' | 'human_confirmed' | 'human_overridden';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ListingStatus = 'draft' | 'active' | 'reserved' | 'sold' | 'paused' | 'removed';

export type ConditionGrade =
  | 'new_with_tags'
  | 'new_no_tags'
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor';

type ProfileRow = {
  id: string;
  role: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  reputation_score: number;
  level: number;
  settings: Json;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  photo_checklist: Json;
  display_order: number | null;
  created_at: string;
  updated_at: string;
};

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  aliases: string[];
  photo_checklist: Json;
  auth_guide: Json;
  tier: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  brand_id: string;
  category_id: string | null;
  name: string;
  style_code: string | null;
  colorway: string | null;
  release_year: number | null;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CheckRow = {
  id: string;
  profile_id: string;
  brand_id: string | null;
  category_id: string | null;
  product_id: string | null;
  status: CheckStatus;
  declared: Json;
  consent_training: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type CheckPhotoRow = {
  id: string;
  check_id: string;
  region: string;
  storage_path: string;
  phash: string | null;
  quality: Json | null;
  exif: Json | null;
  created_at: string;
};

type CheckJobRow = {
  id: string;
  check_id: string;
  status: JobStatus;
  stage: string | null;
  progress: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type CheckFindingRow = {
  id: string;
  check_id: string;
  photo_id: string | null;
  region: string;
  kind: string;
  polarity: string;
  score: number | null;
  title: string;
  detail_md: string;
  conclusion_md: string;
  bbox: Json | null;
  comparison: Json | null;
  position: number;
  created_at: string;
};

type VerdictRow = {
  id: string;
  check_id: string;
  authenticity_probability: number;
  risk: RiskLevel;
  outcome: string;
  confidence: string;
  source: VerdictSource;
  summary_md: string;
  recommendations_md: string;
  next_steps_md: string;
  ai_model_version: string | null;
  disclaimer_version: string;
  score_breakdown: Json | null;
  created_at: string;
};

type ReferenceItemRow = {
  id: string;
  brand_id: string;
  category_id: string;
  product_id: string | null;
  authenticity: 'authentic' | 'replica';
  source: string;
  era: string | null;
  serial_format: string | null;
  measurements: Json | null;
  notes_md: string | null;
  quality_score: number;
  quarantined: boolean;
  sku: string | null;
  colorway: string | null;
  collection: string | null;
  release_year: number | null;
  country: string | null;
  size_label: string | null;
  material: string | null;
  gender: string | null;
  replica_batch: string | null;
  provenance_confidence: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ReferencePhotoRow = {
  id: string;
  reference_item_id: string;
  region: string;
  storage_path: string;
  meta: Json;
  created_at: string;
};

type ReferenceJobRow = {
  id: string;
  reference_item_id: string;
  status: JobStatus;
  stage: string | null;
  progress: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReferencePhotoAnalysisRow = {
  id: string;
  photo_id: string;
  phash: string | null;
  width: number | null;
  height: number | null;
  sharpness: number | null;
  ocr_provider: string | null;
  ocr_raw: string;
  ocr_normalized: string;
  extracted: Json;
  qr_payloads: string[];
  regions: Json;
  processed_at: string;
};

type ReferenceAnnotationRow = {
  id: string;
  reference_item_id: string;
  photo_id: string | null;
  aspect: string;
  assessment: string;
  note: string;
  created_by: string;
  created_at: string;
};

type ReferenceItemVersionRow = {
  id: string;
  reference_item_id: string;
  version: number;
  data: Json;
  changed_by: string | null;
  changed_at: string;
};

type ListingRow = {
  id: string;
  seller_id: string;
  check_id: string | null;
  certificate_id: string | null;
  brand_id: string | null;
  category_id: string | null;
  product_id: string | null;
  title: string;
  description_md: string;
  condition: ConditionGrade | null;
  size_label: string | null;
  measurements: Json;
  defects_md: string;
  price_cents: number | null;
  currency: string;
  location_city: string | null;
  location_state: string | null;
  shipping_methods: string[];
  hashtags: string[];
  keywords: string[];
  status: ListingStatus;
  ai_generated: Json;
  published_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
};

type ListingPhotoRow = {
  id: string;
  listing_id: string;
  storage_path: string;
  position: number;
  source: string;
  created_at: string;
};

type ListingFavoriteRow = {
  profile_id: string;
  listing_id: string;
  price_cents_at_save: number | null;
  created_at: string;
};

type NotificationRow = {
  id: string;
  profile_id: string;
  kind: string;
  payload: Json;
  read: boolean;
  created_at: string;
};

type CertificateRow = {
  id: string;
  check_id: string;
  public_code: string;
  revoked: boolean;
  revoked_reason: string | null;
  created_at: string;
};

type Insertable<Row, Optional extends keyof Row, Omitted extends keyof Row = never> = Omit<
  Partial<Pick<Row, Optional>> & Omit<Row, Optional | Omitted>,
  Omitted
>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insertable<
          ProfileRow,
          | 'display_name'
          | 'avatar_url'
          | 'bio'
          | 'reputation_score'
          | 'level'
          | 'settings'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Insertable<
          CategoryRow,
          'id' | 'parent_id' | 'photo_checklist' | 'display_order' | 'created_at' | 'updated_at'
        >;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      brands: {
        Row: BrandRow;
        Insert: Insertable<
          BrandRow,
          | 'id'
          | 'aliases'
          | 'photo_checklist'
          | 'auth_guide'
          | 'tier'
          | 'created_by'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<BrandRow>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Insertable<
          ProductRow,
          | 'id'
          | 'category_id'
          | 'style_code'
          | 'colorway'
          | 'release_year'
          | 'source'
          | 'created_by'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      checks: {
        Row: CheckRow;
        Insert: Insertable<
          CheckRow,
          | 'id'
          | 'brand_id'
          | 'category_id'
          | 'product_id'
          | 'status'
          | 'declared'
          | 'consent_training'
          | 'submitted_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<CheckRow>;
        Relationships: [];
      };
      check_photos: {
        Row: CheckPhotoRow;
        Insert: Insertable<CheckPhotoRow, 'id' | 'phash' | 'quality' | 'exif' | 'created_at'>;
        Update: Partial<CheckPhotoRow>;
        Relationships: [];
      };
      check_jobs: {
        Row: CheckJobRow;
        Insert: Insertable<
          CheckJobRow,
          | 'id'
          | 'status'
          | 'stage'
          | 'progress'
          | 'error'
          | 'started_at'
          | 'finished_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<CheckJobRow>;
        Relationships: [];
      };
      check_findings: {
        Row: CheckFindingRow;
        Insert: Insertable<
          CheckFindingRow,
          | 'id'
          | 'photo_id'
          | 'score'
          | 'conclusion_md'
          | 'bbox'
          | 'comparison'
          | 'position'
          | 'created_at'
        >;
        Update: Partial<CheckFindingRow>;
        Relationships: [];
      };
      verdicts: {
        Row: VerdictRow;
        Insert: Insertable<
          VerdictRow,
          | 'id'
          | 'recommendations_md'
          | 'next_steps_md'
          | 'ai_model_version'
          | 'disclaimer_version'
          | 'score_breakdown'
          | 'created_at'
        >;
        Update: Partial<VerdictRow>;
        Relationships: [];
      };
      certificates: {
        Row: CertificateRow;
        Insert: Insertable<CertificateRow, 'id' | 'revoked' | 'revoked_reason' | 'created_at'>;
        Update: Partial<CertificateRow>;
        Relationships: [];
      };
      reference_items: {
        Row: ReferenceItemRow;
        Insert: Insertable<
          ReferenceItemRow,
          | 'id'
          | 'product_id'
          | 'source'
          | 'era'
          | 'serial_format'
          | 'measurements'
          | 'notes_md'
          | 'quality_score'
          | 'quarantined'
          | 'sku'
          | 'colorway'
          | 'collection'
          | 'release_year'
          | 'country'
          | 'size_label'
          | 'material'
          | 'gender'
          | 'replica_batch'
          | 'provenance_confidence'
          | 'created_by'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<ReferenceItemRow>;
        Relationships: [];
      };
      reference_photos: {
        Row: ReferencePhotoRow;
        Insert: Insertable<ReferencePhotoRow, 'id' | 'meta' | 'created_at'>;
        Update: Partial<ReferencePhotoRow>;
        Relationships: [];
      };
      reference_jobs: {
        Row: ReferenceJobRow;
        Insert: Insertable<
          ReferenceJobRow,
          | 'id'
          | 'status'
          | 'stage'
          | 'progress'
          | 'error'
          | 'started_at'
          | 'finished_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<ReferenceJobRow>;
        Relationships: [];
      };
      reference_photo_analysis: {
        Row: ReferencePhotoAnalysisRow;
        Insert: Insertable<
          ReferencePhotoAnalysisRow,
          | 'id'
          | 'phash'
          | 'width'
          | 'height'
          | 'sharpness'
          | 'ocr_provider'
          | 'ocr_raw'
          | 'ocr_normalized'
          | 'extracted'
          | 'qr_payloads'
          | 'regions'
          | 'processed_at'
        >;
        Update: Partial<ReferencePhotoAnalysisRow>;
        Relationships: [];
      };
      reference_annotations: {
        Row: ReferenceAnnotationRow;
        Insert: Insertable<ReferenceAnnotationRow, 'id' | 'photo_id' | 'note' | 'created_at'>;
        Update: Partial<ReferenceAnnotationRow>;
        Relationships: [];
      };
      reference_item_versions: {
        Row: ReferenceItemVersionRow;
        Insert: Insertable<ReferenceItemVersionRow, 'id' | 'changed_by' | 'changed_at'>;
        Update: Partial<ReferenceItemVersionRow>;
        Relationships: [];
      };
      listings: {
        Row: ListingRow;
        Insert: Insertable<
          ListingRow,
          | 'id'
          | 'check_id'
          | 'certificate_id'
          | 'brand_id'
          | 'category_id'
          | 'product_id'
          | 'title'
          | 'description_md'
          | 'condition'
          | 'size_label'
          | 'measurements'
          | 'defects_md'
          | 'price_cents'
          | 'currency'
          | 'location_city'
          | 'location_state'
          | 'shipping_methods'
          | 'hashtags'
          | 'keywords'
          | 'status'
          | 'ai_generated'
          | 'published_at'
          | 'sold_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<ListingRow>;
        Relationships: [];
      };
      listing_photos: {
        Row: ListingPhotoRow;
        Insert: Insertable<ListingPhotoRow, 'id' | 'position' | 'source' | 'created_at'>;
        Update: Partial<ListingPhotoRow>;
        Relationships: [];
      };
      listing_favorites: {
        Row: ListingFavoriteRow;
        Insert: Insertable<ListingFavoriteRow, 'price_cents_at_save' | 'created_at'>;
        Update: Partial<ListingFavoriteRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Insertable<NotificationRow, 'id' | 'payload' | 'read' | 'created_at'>;
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_reference_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_similar_reference_photos: {
        Args: { p_photo_id: string; p_limit?: number };
        Returns: {
          photo_id: string;
          reference_item_id: string;
          region: string;
          similarity: number;
          authenticity: 'authentic' | 'replica';
          brand_name: string | null;
          product_name: string | null;
        }[];
      };
      public_certificate: {
        Args: { p_code: string };
        Returns: Json;
      };
      seller_public_stats: {
        Args: { p_username: string };
        Returns: Json;
      };
    };
    Enums: {
      listing_status: ListingStatus;
      condition_grade: ConditionGrade;
      check_status: CheckStatus;
      risk_level: RiskLevel;
      verdict_source: VerdictSource;
      job_status: JobStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
