-- Sprint 3: banco de referência, embeddings (pgvector), OCR e regiões
-- detectadas. Tudo escrito exclusivamente pelo pipeline (service role);
-- o cliente só lê o que deriva dos próprios checks.

create extension if not exists vector with schema extensions;

create type public.confirmed_auth as enum ('authentic', 'replica');

-- Itens de referência: exemplares catalogados (originais E réplicas — os
-- negativos são tão valiosos quanto os positivos para o kNN).
create table public.reference_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  category_id uuid not null references public.categories (id),
  product_id uuid references public.products (id),
  authenticity public.confirmed_auth not null,
  source text not null default 'curated'
    check (source in ('curated', 'verified_check', 'partner', 'purchased')),
  era text,
  serial_format text,
  measurements jsonb,
  notes_md text,
  quality_score smallint not null default 3 check (quality_score between 1 and 5),
  quarantined boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reference_items_set_updated_at
  before update on public.reference_items
  for each row execute function public.set_updated_at();

create index reference_items_brand_cat
  on public.reference_items (brand_id, category_id, authenticity);

create table public.reference_photos (
  id uuid primary key default gen_random_uuid(),
  reference_item_id uuid not null references public.reference_items (id) on delete cascade,
  region text not null,
  storage_path text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index reference_photos_item on public.reference_photos (reference_item_id, region);

insert into storage.buckets (id, name, public)
values ('reference-photos', 'reference-photos', false)
on conflict (id) do nothing;

-- Embeddings por região (foto de check OU foto de referência), com filtros
-- desnormalizados para o kNN filtrado por marca/categoria/região.
create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  photo_kind text not null check (photo_kind in ('check', 'reference')),
  photo_id uuid not null,
  region text not null,
  model text not null,
  embedding extensions.vector(512) not null,
  brand_id uuid references public.brands (id),
  category_id uuid references public.categories (id),
  product_id uuid references public.products (id),
  authenticity public.confirmed_auth,
  created_at timestamptz not null default now(),
  unique (photo_kind, photo_id, region, model)
);

create index embeddings_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops);
create index embeddings_filter
  on public.embeddings (photo_kind, brand_id, category_id, region, model);

-- Regiões detectadas automaticamente em cada foto (CV clássico + Claude).
create table public.photo_regions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.check_photos (id) on delete cascade,
  label text not null,
  bbox jsonb not null,
  source text not null check (source in ('cv', 'claude')),
  confidence numeric(4, 3),
  created_at timestamptz not null default now()
);

create index photo_regions_photo on public.photo_regions (photo_id);

-- Resultado de OCR por foto: texto bruto + campos estruturados extraídos.
create table public.check_ocr (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id) on delete cascade,
  photo_id uuid not null references public.check_photos (id) on delete cascade,
  provider text not null,
  raw_text text not null default '',
  normalized_text text not null default '',
  -- extrações estruturadas: dates[], countries[], composition[], rn[], ca[],
  -- serials[], style_codes[], internal_codes[]
  extracted jsonb not null default '{}'::jsonb,
  qr_payloads text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (photo_id, provider)
);

create index check_ocr_check on public.check_ocr (check_id);

-- Laudo ganha rastreabilidade do score e comparações por evidência.
alter table public.check_findings add column if not exists comparison jsonb;
alter table public.verdicts add column if not exists score_breakdown jsonb;

-- RLS
alter table public.reference_items enable row level security;
alter table public.reference_photos enable row level security;
alter table public.embeddings enable row level security;
alter table public.photo_regions enable row level security;
alter table public.check_ocr enable row level security;

-- reference_* e embeddings: NENHUMA policy — acesso só via service role.
-- O gabarito nunca é exposto a clientes (anti-engenharia reversa).

create policy "photo_regions_select_own" on public.photo_regions
  for select using (
    exists (
      select 1
      from public.check_photos p
      join public.checks c on c.id = p.check_id
      where p.id = photo_id and c.profile_id = auth.uid()
    )
  );

create policy "check_ocr_select_own" on public.check_ocr
  for select using (
    exists (select 1 from public.checks c where c.id = check_id and c.profile_id = auth.uid())
  );
