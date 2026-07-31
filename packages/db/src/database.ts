/**
 * Tipos do schema public no formato que o supabase-js consome.
 * Mantidos à mão em sincronia com supabase/migrations até o CI rodar
 * `pnpm --filter @garimpo/db gen:types` contra um projeto real
 * (aí este arquivo passa a reexportar o gerado).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CheckStatus =
  | 'awaiting_photos'
  | 'queued'
  | 'processing'
  | 'in_review'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type RiskLevel = 'low' | 'medium' | 'high' | 'inconclusive';

export type VerdictSource = 'ai_auto' | 'human_confirmed' | 'human_overridden';

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
}

type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  aliases: string[];
  photo_checklist: Json;
  auth_guide: Json;
  tier: number;
  created_at: string;
  updated_at: string;
}

type CheckRow = {
  id: string;
  profile_id: string;
  brand_id: string | null;
  category_id: string | null;
  status: CheckStatus;
  declared: Json;
  consent_training: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

type CheckPhotoRow = {
  id: string;
  check_id: string;
  region: string;
  storage_path: string;
  phash: string | null;
  quality: Json | null;
  exif: Json | null;
  created_at: string;
}

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
        Insert: Insertable<CategoryRow, 'id' | 'parent_id' | 'created_at' | 'updated_at'>;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      brands: {
        Row: BrandRow;
        Insert: Insertable<
          BrandRow,
          'id' | 'aliases' | 'photo_checklist' | 'auth_guide' | 'tier' | 'created_at' | 'updated_at'
        >;
        Update: Partial<BrandRow>;
        Relationships: [];
      };
      checks: {
        Row: CheckRow;
        Insert: Insertable<
          CheckRow,
          | 'id'
          | 'brand_id'
          | 'category_id'
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      check_status: CheckStatus;
      risk_level: RiskLevel;
      verdict_source: VerdictSource;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
