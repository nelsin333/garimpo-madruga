# 04 — Estrutura do Banco de Dados (PostgreSQL / Supabase)

Convenções: `snake_case`, UUID v7 como PK (ordenável no tempo), `created_at/updated_at` em tudo (omitidos abaixo por brevidade), RLS habilitado em todas as tabelas, enums nativos do Postgres. `pgvector` para embeddings.

## Diagrama (módulos)

```
IDENTIDADE            CATÁLOGO                 AUTENTICAÇÃO (core)
profiles ──┐          brands                   checks ── check_photos
addresses  │          product_lines            check_findings
devices    │          products (SKU)           check_reviews
           │          product_attributes       verdicts / certificates
           │                                   reference_items ── reference_photos
           │                                   embeddings (pgvector)
           ▼
MARKETPLACE                       SOCIAL                 FINANCEIRO
listings ── listing_photos        follows                orders ── order_events
offers                            likes                  payments
conversations ── messages         saves                  payouts
external_publications             posts ── post_media    shipping_labels
price_history                     comments               fees
wishlists                         notifications
collection_items                  reports (denúncias)
```

## DDL essencial

```sql
-- ===== EXTENSÕES =====
create extension if not exists vector;        -- pgvector
create extension if not exists pg_trgm;       -- busca fuzzy
create extension if not exists unaccent;      -- busca sem acento (pt-BR!)

-- ===== ENUMS =====
create type check_status as enum (
  'awaiting_photos','queued','processing','in_review','completed','cancelled','refunded');
create type risk_level as enum ('low','medium','high','inconclusive');
create type verdict_source as enum ('ai_auto','human_confirmed','human_overridden');
create type listing_status as enum ('draft','active','reserved','sold','paused','removed');
create type order_status as enum (
  'pending_payment','paid','shipped','delivered','completed','disputed','cancelled','refunded');
create type condition_grade as enum ('new_with_tags','new_no_tags','excellent','good','fair','poor');

-- ===== IDENTIDADE =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null check (username ~ '^[a-z0-9_\.]{3,30}$'),
  display_name text,
  avatar_url text,
  bio text,
  cpf_encrypted bytea,             -- pgsodium; exigido só p/ vender (KYC)
  phone_verified boolean default false,
  reputation_score numeric(3,2) default 0,   -- 0.00–5.00
  level int default 1,                        -- gamificação
  seller_stats jsonb default '{}',            -- vendas, tempo médio de envio…
  settings jsonb default '{}'
);

create table addresses (
  id uuid primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  label text, zip_code text not null, street text, number text,
  complement text, district text, city text, state char(2),
  is_default boolean default false
);

-- ===== CATÁLOGO =====
create table brands (
  id uuid primary key,
  name text unique not null,                 -- 'Supreme'
  slug citext unique not null,
  aliases text[] default '{}',               -- ['sup','supreme ny']
  auth_guide jsonb default '{}',             -- pontos de verificação por categoria
  photo_checklist jsonb default '{}',        -- checklist de fotos exigidas por categoria
  tier smallint default 2                    -- 1=cobertura profunda, 2=parcial, 3=sob demanda
);

create table categories (
  id uuid primary key,
  parent_id uuid references categories(id),
  name text not null, slug citext unique not null,  -- tenis > basquete; roupas > moletom
  size_chart jsonb                                   -- grade de medidas esperadas
);

-- Produto = SKU catalogado (nível StockX: "Supreme Box Logo Hoodie FW23 Black")
create table products (
  id uuid primary key,
  brand_id uuid not null references brands(id),
  category_id uuid not null references categories(id),
  name text not null,
  style_code text,                           -- SKU oficial (ex.: 'DD1391-100')
  colorway text, season text, release_year int,
  retail_price_cents int, currency char(3) default 'BRL',
  attributes jsonb default '{}',             -- tecido, gramatura, made_in…
  search_tsv tsvector generated always as (
    to_tsvector('portuguese', unaccent(coalesce(name,'') || ' ' ||
      coalesce(style_code,'') || ' ' || coalesce(colorway,''))) ) stored
);
create index on products using gin(search_tsv);
create index on products using gin(name gin_trgm_ops);

-- ===== BANCO DE REFERÊNCIA (o moat) =====
create table reference_items (
  id uuid primary key,
  product_id uuid references products(id),
  brand_id uuid not null references brands(id),
  category_id uuid not null references categories(id),
  source text not null,          -- 'verified_check' | 'partner' | 'curated' | 'purchased'
  authenticity confirmed_auth,   -- enum: 'authentic' | 'replica' (guardamos réplicas também!)
  era text,                      -- '2003-2006' p/ vintage sem SKU
  measurements jsonb,            -- {chest_cm: 58, length_cm: 71 ...}
  serial_format text,            -- regex/padrão do serial daquela era
  notes_md text,                 -- conhecimento curado por especialista
  quality_score smallint default 3   -- confiança na própria referência (1–5)
);

create table reference_photos (
  id uuid primary key,
  reference_item_id uuid not null references reference_items(id) on delete cascade,
  storage_path text not null,
  region text not null,          -- 'neck_tag','wash_tag','stitch_hem','logo_front',
                                 -- 'zipper','button','serial','qr','box_label'...
  meta jsonb default '{}'        -- resolução, iluminação, dispositivo
);

-- Embeddings: um por foto+modelo. HNSW por região p/ kNN rápido e filtrável.
create table embeddings (
  id uuid primary key,
  photo_id uuid not null,             -- reference_photos.id OU check_photos.id
  photo_kind text not null check (photo_kind in ('reference','check')),
  region text not null,
  model text not null,                -- 'siglip2-so400m' | 'clip-vit-l' | 'finetune-v3'
  embedding vector(1152) not null,
  brand_id uuid, category_id uuid, product_id uuid   -- desnormalizado p/ filtro no kNN
);
create index on embeddings using hnsw (embedding vector_cosine_ops);
create index on embeddings (brand_id, category_id, region, model);

-- ===== LEGIT CHECKS =====
create table checks (
  id uuid primary key,
  profile_id uuid not null references profiles(id),
  brand_id uuid references brands(id),
  category_id uuid references categories(id),
  product_id uuid references products(id),   -- identificado pela IA quando possível
  status check_status not null default 'awaiting_photos',
  declared jsonb default '{}',               -- o que o usuário declarou (modelo, ano…)
  paid_amount_cents int, payment_id uuid,
  sla_deadline timestamptz,
  consent_training boolean not null default true   -- consentimento p/ virar referência
);

create table check_photos (
  id uuid primary key,
  check_id uuid not null references checks(id) on delete cascade,
  region text not null,
  storage_path text not null,
  phash text,                    -- hash perceptual (anti-reuso de fotos)
  quality jsonb,                 -- {blur: .92, exposure: .7, ok: true}
  exif jsonb
);
create index on check_photos (phash);

-- Cada achado do pipeline (explicabilidade do laudo)
create table check_findings (
  id uuid primary key,
  check_id uuid not null references checks(id) on delete cascade,
  photo_id uuid references check_photos(id),
  region text not null,
  kind text not null,            -- 'typography','stitch_density','label_position',
                                 -- 'serial_format','qr_valid','fabric_texture','ocr_text'...
  polarity text not null check (polarity in ('positive','suspicious','neutral')),
  score numeric(4,3),            -- contribuição p/ o score final
  detail_md text not null,       -- explicação legível ("espaçamento entre letras 12% maior…")
  bbox jsonb,                    -- região marcada na foto [x,y,w,h]
  comparison_ref_photo_id uuid references reference_photos(id)  -- lado a lado
);

create table verdicts (
  id uuid primary key,
  check_id uuid unique not null references checks(id),
  authenticity_probability numeric(4,3) not null,  -- 0.000–1.000 CALIBRADO
  risk risk_level not null,
  source verdict_source not null,
  ai_raw_score numeric(4,3),
  ai_model_version text,
  reviewer_id uuid references profiles(id),
  summary_md text not null,
  disclaimer_version text not null      -- versão do texto legal exibido
);

create table check_reviews (              -- trilha da revisão humana
  id uuid primary key,
  check_id uuid not null references checks(id),
  reviewer_id uuid not null references profiles(id),
  action text not null,                  -- 'approved_ai','edited','overridden','escalated'
  before jsonb, after jsonb,             -- diffs (vira dado de treino/calibração)
  notes text
);

create table certificates (
  id uuid primary key,
  check_id uuid unique not null references checks(id),
  public_code text unique not null,      -- ex.: 'GM-7F3K-9Q2A' (no QR)
  revoked boolean default false, revoked_reason text,
  transfer_history jsonb default '[]'    -- cadeia de posse na revenda
);

-- ===== MARKETPLACE =====
create table listings (
  id uuid primary key,
  seller_id uuid not null references profiles(id),
  check_id uuid references checks(id),           -- anúncio nascido de um check
  certificate_id uuid references certificates(id),
  product_id uuid references products(id),
  title text not null, description_md text,
  condition condition_grade not null,
  size_label text, measurements jsonb,
  price_cents int not null, accepts_offers boolean default true,
  min_offer_cents int,
  status listing_status not null default 'draft',
  hashtags text[] default '{}',
  ai_generated jsonb default '{}',       -- payload sugerido pela IA (auditável)
  search_tsv tsvector generated always as (
    to_tsvector('portuguese', unaccent(coalesce(title,'')||' '||coalesce(description_md,'')))) stored
);
create index on listings using gin(search_tsv);

create table listing_photos (
  id uuid primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null, position int not null default 0
);

create table price_history (             -- alimenta a IA de precificação
  id uuid primary key,
  product_id uuid references products(id),
  listing_id uuid references listings(id),
  event text not null,                   -- 'listed','offer','sold','price_drop','external_comp'
  price_cents int not null,
  condition condition_grade, size_label text,
  source text default 'internal',        -- 'internal' | 'enjoei' | 'droper' | 'manual'
  occurred_at timestamptz not null
);
create index on price_history (product_id, occurred_at);

create table offers (
  id uuid primary key,
  listing_id uuid not null references listings(id),
  buyer_id uuid not null references profiles(id),
  amount_cents int not null,
  status text not null default 'pending',  -- pending/accepted/declined/expired/countered
  counter_of uuid references offers(id),
  expires_at timestamptz
);

create table orders (
  id uuid primary key,
  listing_id uuid not null references listings(id),
  buyer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  status order_status not null default 'pending_payment',
  item_cents int not null, shipping_cents int not null,
  fee_cents int not null,                 -- take rate
  escrow_release_at timestamptz,          -- libera N dias após entrega sem disputa
  shipping jsonb                          -- transportadora, código de rastreio
);

create table order_events (
  id uuid primary key,
  order_id uuid not null references orders(id) on delete cascade,
  kind text not null,                     -- 'paid','label_created','shipped','delivered',
                                          -- 'dispute_opened','released','refunded'
  data jsonb, actor uuid
);

create table external_publications (      -- rastro das exportações multi-canal
  id uuid primary key,
  listing_id uuid not null references listings(id),
  channel text not null,                  -- 'instagram','whatsapp','enjoei_export','olx_export'
  method text not null,                   -- 'api','share_sheet','csv_export','assisted'
  external_ref text, published_at timestamptz
);

-- ===== SOCIAL =====
create table follows (
  follower_id uuid references profiles(id) on delete cascade,
  followed_id uuid references profiles(id) on delete cascade,
  primary key (follower_id, followed_id)
);
create table posts (
  id uuid primary key,
  author_id uuid not null references profiles(id),
  kind text not null,                     -- 'fit_pic','collection','find','listing_share'
  caption text, listing_id uuid references listings(id),
  media jsonb not null default '[]'
);
create table likes (
  profile_id uuid references profiles(id) on delete cascade,
  target_kind text not null, target_id uuid not null,   -- post | listing
  primary key (profile_id, target_kind, target_id)
);
create table saves (like likes including all);          -- mesmo shape
create table comments (
  id uuid primary key,
  author_id uuid not null references profiles(id),
  target_kind text not null, target_id uuid not null,
  body text not null, parent_id uuid references comments(id)
);
create table wishlists (
  id uuid primary key,
  profile_id uuid not null references profiles(id),
  product_id uuid references products(id),
  query jsonb,                            -- busca salva ("camiseta nike 2004 tam G")
  notify boolean default true
);
create table collection_items (           -- vault do colecionador
  id uuid primary key,
  profile_id uuid not null references profiles(id),
  product_id uuid references products(id),
  check_id uuid references checks(id),
  acquired_at date, acquired_price_cents int,
  visibility text default 'public'
);
```

## Pontos de design importantes

1. **`check_findings` é o coração da explicabilidade.** O laudo não é um número: é uma lista de achados com região, polaridade, bbox na foto e referência de comparação. O app renderiza o relatório direto dessa tabela.
2. **Guardamos réplicas no banco de referência** (`authenticity='replica'`). Detectar fake melhora muito com exemplares negativos — réplicas conhecidas de cada geração ("batch") são tão valiosas quanto originais.
3. **Embeddings desnormalizados com brand/category/region** para kNN filtrado: `WHERE brand_id=? AND region='neck_tag'` antes do `ORDER BY embedding <=> $1`. Índice HNSW + filtro é o padrão pgvector 0.7+.
4. **`consent_training` explícito** no check (LGPD): o usuário consente que fotos anonimizadas alimentem o banco de referência. Sem consentimento, a foto serve só ao laudo.
5. **`price_history` unificada** (interno + comparáveis externos coletados manualmente/parcerias) alimenta a IA de precificação sem acoplamento.
6. **Certificado com `transfer_history`**: revenda de peça verificada transfere o certificado — o histórico completo é o produto ("Carfax da peça").
7. **RLS**: usuário só lê os próprios checks; laudos/certificados públicos via views dedicadas; painel de revisão exige claim `role=reviewer` no JWT; `reference_items` nunca é exposto ao cliente (anti-engenharia reversa).
