-- Catálogo mínimo do Sprint 1: marcas e categorias com checklist de fotos.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id),
  name text not null,
  slug citext unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug citext unique not null,
  aliases text[] not null default '{}',
  -- checklist de fotos por slug de categoria; passos validados por
  -- photoChecklistSchema em @garimpo/contracts. Ex.: {"moletom": [ ...steps ]}
  photo_checklist jsonb not null default '{}'::jsonb,
  -- guia de pontos de verificação usado pelo painel e, depois, pelo RAG
  auth_guide jsonb not null default '{}'::jsonb,
  tier smallint not null default 2 check (tier between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

create index brands_name_trgm on public.brands using gin (name extensions.gin_trgm_ops);

-- Catálogo é público para leitura; escrita só via service role (painel ops).
alter table public.categories enable row level security;
alter table public.brands enable row level security;

create policy "categories_select_all" on public.categories for select using (true);
create policy "brands_select_all" on public.brands for select using (true);
