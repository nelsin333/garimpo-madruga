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

type ProfileRow = {
  id: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
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
