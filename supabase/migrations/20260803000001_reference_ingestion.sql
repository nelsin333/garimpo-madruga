-- Sprint 4: ingestão de referências — cadastro completo, versionamento,
-- fila de processamento, anotações de especialista e acesso por papel.

-- Papéis: usuários comuns nunca enxergam o banco de referência; especialistas
-- e admins operam o acervo (painel ops e modo especialista no app).
alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'expert', 'admin'));

create or replace function public.is_expert()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('expert', 'admin')
  );
$$;

-- Cadastro completo da peça de referência.
alter table public.reference_items
  add column if not exists sku text,
  add column if not exists colorway text,
  add column if not exists collection text,
  add column if not exists release_year int,
  add column if not exists country text,
  add column if not exists size_label text,
  add column if not exists material text,
  add column if not exists gender text
    check (gender is null or gender in ('masculino', 'feminino', 'unissex', 'infantil')),
  add column if not exists replica_batch text,
  add column if not exists provenance_confidence smallint not null default 3
    check (provenance_confidence between 1 and 5),
  add column if not exists created_by uuid references public.profiles (id);

create index if not exists reference_items_sku on public.reference_items (sku);
create index if not exists reference_items_collection
  on public.reference_items (collection, release_year);

-- Versionamento: toda atualização preserva o estado anterior via trigger.
create table public.reference_item_versions (
  id uuid primary key default gen_random_uuid(),
  reference_item_id uuid not null references public.reference_items (id) on delete cascade,
  version int not null,
  data jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  unique (reference_item_id, version)
);

create or replace function public.snapshot_reference_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version int;
begin
  select coalesce(max(version), 0) + 1 into next_version
  from public.reference_item_versions
  where reference_item_id = old.id;

  insert into public.reference_item_versions (reference_item_id, version, data, changed_by)
  values (old.id, next_version, to_jsonb(old), auth.uid());
  return new;
end;
$$;

create trigger reference_items_snapshot
  before update on public.reference_items
  for each row
  when (old.* is distinct from new.*)
  execute function public.snapshot_reference_item();

-- Fila de processamento de referências (mesma semântica de check_jobs).
create table public.reference_jobs (
  id uuid primary key default gen_random_uuid(),
  reference_item_id uuid not null references public.reference_items (id) on delete cascade,
  status public.job_status not null default 'queued',
  stage text,
  progress smallint not null default 0 check (progress between 0 and 100),
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reference_jobs_set_updated_at
  before update on public.reference_jobs
  for each row execute function public.set_updated_at();

create index reference_jobs_status
  on public.reference_jobs (status) where status in ('queued', 'running');
create index reference_jobs_item on public.reference_jobs (reference_item_id, created_at desc);

-- Resultado do processamento por foto de referência.
create table public.reference_photo_analysis (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid unique not null references public.reference_photos (id) on delete cascade,
  phash text,
  width int,
  height int,
  sharpness numeric(10, 2),
  ocr_provider text,
  ocr_raw text not null default '',
  ocr_normalized text not null default '',
  extracted jsonb not null default '{}'::jsonb,
  qr_payloads text[] not null default '{}',
  regions jsonb not null default '[]'::jsonb,
  processed_at timestamptz not null default now()
);

create index reference_photo_analysis_phash on public.reference_photo_analysis (phash);

-- Anotações do modo especialista, vinculadas à peça (e opcionalmente à foto).
create table public.reference_annotations (
  id uuid primary key default gen_random_uuid(),
  reference_item_id uuid not null references public.reference_items (id) on delete cascade,
  photo_id uuid references public.reference_photos (id) on delete set null,
  aspect text not null check (aspect in (
    'stitching', 'label', 'logo', 'typography', 'qr', 'embroidery',
    'wash_tag', 'material', 'hardware', 'print', 'other'
  )),
  assessment text not null check (assessment in ('correct', 'incorrect', 'uncertain')),
  note text not null default '',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index reference_annotations_item
  on public.reference_annotations (reference_item_id, created_at desc);

-- ===== RLS: acesso de especialista =====
alter table public.reference_item_versions enable row level security;
alter table public.reference_jobs enable row level security;
alter table public.reference_photo_analysis enable row level security;
alter table public.reference_annotations enable row level security;

create policy "reference_items_expert_select" on public.reference_items
  for select using (public.is_expert());
create policy "reference_items_expert_insert" on public.reference_items
  for insert with check (public.is_expert());
create policy "reference_items_expert_update" on public.reference_items
  for update using (public.is_expert()) with check (public.is_expert());

create policy "reference_photos_expert_select" on public.reference_photos
  for select using (public.is_expert());
create policy "reference_photos_expert_insert" on public.reference_photos
  for insert with check (public.is_expert());
create policy "reference_photos_expert_delete" on public.reference_photos
  for delete using (public.is_expert());

create policy "reference_versions_expert_select" on public.reference_item_versions
  for select using (public.is_expert());

create policy "reference_jobs_expert_select" on public.reference_jobs
  for select using (public.is_expert());
create policy "reference_jobs_expert_insert" on public.reference_jobs
  for insert with check (public.is_expert());

create policy "reference_analysis_expert_select" on public.reference_photo_analysis
  for select using (public.is_expert());

create policy "reference_annotations_expert_select" on public.reference_annotations
  for select using (public.is_expert());
create policy "reference_annotations_expert_insert" on public.reference_annotations
  for insert with check (public.is_expert() and created_by = auth.uid());
create policy "reference_annotations_expert_delete" on public.reference_annotations
  for delete using (public.is_expert() and created_by = auth.uid());

-- Storage do acervo: apenas especialistas.
create policy "reference_photos_storage_expert" on storage.objects
  for all using (bucket_id = 'reference-photos' and public.is_expert())
  with check (bucket_id = 'reference-photos' and public.is_expert());

-- ===== Funções administrativas (gated por papel) =====

create or replace function public.admin_reference_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_expert() then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'items_total', (select count(*) from reference_items),
    'items_authentic', (select count(*) from reference_items where authenticity = 'authentic'),
    'items_replica', (select count(*) from reference_items where authenticity = 'replica'),
    'items_quarantined', (select count(*) from reference_items where quarantined),
    'brands_covered', (select count(distinct brand_id) from reference_items),
    'products_covered',
      (select count(distinct product_id) from reference_items where product_id is not null),
    'photos_total', (select count(*) from reference_photos),
    'photos_processed', (select count(*) from reference_photo_analysis),
    'embeddings_total', (select count(*) from embeddings where photo_kind = 'reference'),
    'annotations_total', (select count(*) from reference_annotations),
    'storage_bytes',
      (select coalesce(sum((meta ->> 'bytes')::bigint), 0) from reference_photos
       where meta ? 'bytes')
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_similar_reference_photos(
  p_photo_id uuid,
  p_limit int default 10
)
returns table (
  photo_id uuid,
  reference_item_id uuid,
  region text,
  similarity numeric,
  authenticity public.confirmed_auth,
  brand_name text,
  product_name text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  query_embedding extensions.vector(512);
  query_region text;
begin
  if not public.is_expert() then
    raise exception 'forbidden';
  end if;

  select e.embedding, e.region into query_embedding, query_region
  from embeddings e
  where e.photo_kind = 'reference' and e.photo_id = p_photo_id
  limit 1;

  if query_embedding is null then
    return;
  end if;

  return query
  select e.photo_id, rp.reference_item_id, e.region,
         round((1 - (e.embedding <=> query_embedding))::numeric, 4) as similarity,
         ri.authenticity, b.name as brand_name, p.name as product_name
  from embeddings e
  join reference_photos rp on rp.id = e.photo_id
  join reference_items ri on ri.id = rp.reference_item_id
  left join brands b on b.id = ri.brand_id
  left join products p on p.id = ri.product_id
  where e.photo_kind = 'reference'
    and e.region = query_region
    and e.photo_id <> p_photo_id
  order by e.embedding <=> query_embedding
  limit p_limit;
end;
$$;
