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
  'new_with_tags' | 'new_no_tags' | 'excellent' | 'good' | 'fair' | 'poor';

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
  parcel_weight_grams: number;
  parcel_length_cm: number;
  parcel_width_cm: number;
  parcel_height_cm: number;
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

// ===== Sprint 6: pedidos, pagamento, frete, disputa, saque =====

export type OrderStatus =
  | 'pending_payment'
  | 'payment_processing'
  | 'paid'
  | 'preparing_shipment'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'payment_failed'
  | 'expired'
  | 'cancelled'
  | 'disputed'
  | 'returned'
  | 'refunded';

export type PaymentStatus =
  'created' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';

export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

export type ShipmentStatus =
  'pending' | 'label_created' | 'posted' | 'in_transit' | 'delivered' | 'returned' | 'cancelled';

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';

export type DisputeResolution =
  'refund_buyer' | 'release_seller' | 'partial_refund' | 'return_and_refund';

export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected';

export type PayoutStatus = 'requested' | 'processing' | 'paid' | 'failed';

type AddressRow = {
  id: string;
  profile_id: string;
  label: string | null;
  recipient_name: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  status: OrderStatus;
  item_cents: number;
  shipping_cents: number;
  buyer_fee_cents: number;
  platform_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  seller_amount_cents: number;
  currency: string;
  shipping_address: Json;
  shipping_option: Json;
  idempotency_key: string;
  external_payment_id: string | null;
  external_shipment_id: string | null;
  payment_expires_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  escrow_release_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrderEventRow = {
  id: string;
  order_id: string;
  kind: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  actor_id: string | null;
  actor_kind: 'buyer' | 'seller' | 'system' | 'admin' | 'provider';
  data: Json;
  created_at: string;
};

type PaymentAttemptRow = {
  id: string;
  order_id: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount_cents: number;
  external_id: string | null;
  checkout: Json;
  raw_status: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type ShipmentRow = {
  id: string;
  order_id: string;
  provider: string;
  service_name: string | null;
  status: ShipmentStatus;
  external_id: string | null;
  tracking_code: string | null;
  label_url: string | null;
  price_cents: number;
  estimated_days: number | null;
  posted_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

type ShipmentEventRow = {
  id: string;
  shipment_id: string;
  status: ShipmentStatus;
  description: string | null;
  occurred_at: string;
  created_at: string;
};

type ShippingQuoteRow = {
  id: string;
  profile_id: string;
  listing_id: string;
  provider: string;
  service_id: string;
  service_name: string;
  carrier: string;
  price_cents: number;
  estimated_days: number | null;
  from_zip: string;
  to_zip: string;
  expires_at: string;
  created_at: string;
};

type DisputeRow = {
  id: string;
  order_id: string;
  opened_by: string;
  reason: 'not_received' | 'not_as_described' | 'damaged' | 'suspected_fake' | 'other';
  description: string;
  evidence: Json;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolution_note: string | null;
  refund_cents: number | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type DisputeMessageRow = {
  id: string;
  dispute_id: string;
  author_id: string;
  body: string;
  attachments: Json;
  created_at: string;
};

type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  order_id: string | null;
  last_message_at: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type SellerAccountRow = {
  profile_id: string;
  kyc_status: KycStatus;
  kyc_submitted_at: string | null;
  kyc_reviewed_at: string | null;
  kyc_rejection_reason: string | null;
  document_masked: string | null;
  legal_name: string | null;
  provider: string;
  provider_account_id: string | null;
  payout_method: 'pix' | 'bank_transfer' | null;
  payout_key_masked: string | null;
  pending_balance_cents: number;
  available_balance_cents: number;
  created_at: string;
  updated_at: string;
};

type PayoutRow = {
  id: string;
  profile_id: string;
  amount_cents: number;
  status: PayoutStatus;
  provider: string;
  external_id: string | null;
  failure_reason: string | null;
  requested_at: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
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
          | 'parcel_weight_grams'
          | 'parcel_length_cm'
          | 'parcel_width_cm'
          | 'parcel_height_cm'
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
      addresses: {
        Row: AddressRow;
        Insert: Insertable<
          AddressRow,
          'id' | 'label' | 'complement' | 'is_default' | 'created_at' | 'updated_at'
        >;
        Update: Partial<AddressRow>;
        Relationships: [];
      };
      // Escrita exclusiva do backend: o app só lê (ver RLS e GRANTs da
      // migration 20260805000001_orders.sql).
      orders: {
        Row: OrderRow;
        Insert: Insertable<OrderRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<OrderRow>;
        Relationships: [];
      };
      order_events: {
        Row: OrderEventRow;
        Insert: Insertable<OrderEventRow, 'id' | 'data' | 'actor_kind' | 'created_at'>;
        Update: Partial<OrderEventRow>;
        Relationships: [];
      };
      payment_attempts: {
        Row: PaymentAttemptRow;
        Insert: Insertable<
          PaymentAttemptRow,
          'id' | 'provider' | 'status' | 'checkout' | 'created_at' | 'updated_at'
        >;
        Update: Partial<PaymentAttemptRow>;
        Relationships: [];
      };
      shipments: {
        Row: ShipmentRow;
        Insert: Insertable<
          ShipmentRow,
          'id' | 'provider' | 'status' | 'price_cents' | 'created_at' | 'updated_at'
        >;
        Update: Partial<ShipmentRow>;
        Relationships: [];
      };
      shipment_events: {
        Row: ShipmentEventRow;
        Insert: Insertable<ShipmentEventRow, 'id' | 'occurred_at' | 'created_at'>;
        Update: Partial<ShipmentEventRow>;
        Relationships: [];
      };
      shipping_quotes: {
        Row: ShippingQuoteRow;
        Insert: Insertable<ShippingQuoteRow, 'id' | 'provider' | 'created_at'>;
        Update: Partial<ShippingQuoteRow>;
        Relationships: [];
      };
      disputes: {
        Row: DisputeRow;
        Insert: Insertable<
          DisputeRow,
          'id' | 'description' | 'evidence' | 'status' | 'created_at' | 'updated_at'
        >;
        Update: Partial<DisputeRow>;
        Relationships: [];
      };
      dispute_messages: {
        Row: DisputeMessageRow;
        Insert: Insertable<DisputeMessageRow, 'id' | 'attachments' | 'created_at'>;
        Update: Partial<DisputeMessageRow>;
        Relationships: [];
      };
      conversations: {
        Row: ConversationRow;
        Insert: Insertable<ConversationRow, 'id' | 'order_id' | 'last_message_at' | 'created_at'>;
        Update: Partial<ConversationRow>;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: Insertable<MessageRow, 'id' | 'read_at' | 'created_at'>;
        Update: Partial<MessageRow>;
        Relationships: [];
      };
      seller_accounts: {
        Row: SellerAccountRow;
        Insert: Insertable<
          SellerAccountRow,
          | 'kyc_status'
          | 'provider'
          | 'pending_balance_cents'
          | 'available_balance_cents'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<SellerAccountRow>;
        Relationships: [];
      };
      payouts: {
        Row: PayoutRow;
        Insert: Insertable<
          PayoutRow,
          'id' | 'status' | 'provider' | 'requested_at' | 'created_at' | 'updated_at'
        >;
        Update: Partial<PayoutRow>;
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
      // Funções financeiras: EXECUTE só para service_role. Declaradas aqui
      // porque as Edge Functions as chamam com o cliente tipado.
      create_order: {
        Args: {
          p_buyer_id: string;
          p_listing_id: string;
          p_idempotency_key: string;
          p_shipping_address: Json;
          p_shipping_option: Json;
          p_shipping_cents: number;
          p_buyer_fee_cents: number;
          p_platform_fee_bps: number;
        };
        Returns: string;
      };
      apply_order_transition: {
        Args: {
          p_order_id: string;
          p_to_status: OrderStatus;
          p_kind: string;
          p_actor_id: string | null;
          p_actor_kind: string;
          p_data?: Json;
        };
        Returns: OrderStatus;
      };
      request_payout: {
        Args: { p_profile_id: string; p_amount_cents: number };
        Returns: string;
      };
      purge_expired_shipping_quotes: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      listing_status: ListingStatus;
      condition_grade: ConditionGrade;
      check_status: CheckStatus;
      risk_level: RiskLevel;
      verdict_source: VerdictSource;
      job_status: JobStatus;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      shipment_status: ShipmentStatus;
      dispute_status: DisputeStatus;
      dispute_resolution: DisputeResolution;
      kyc_status: KycStatus;
      payout_status: PayoutStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
