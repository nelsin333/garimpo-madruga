-- Legit checks e suas fotos (núcleo do produto).
create table public.checks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  brand_id uuid references public.brands (id),
  category_id uuid references public.categories (id),
  status public.check_status not null default 'awaiting_photos',
  -- o que o usuário declarou sobre a peça (modelo, ano, tamanho…)
  declared jsonb not null default '{}'::jsonb,
  consent_training boolean not null default true,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger checks_set_updated_at
  before update on public.checks
  for each row execute function public.set_updated_at();

create index checks_profile_created on public.checks (profile_id, created_at desc);
create index checks_status on public.checks (status);

create table public.check_photos (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id) on delete cascade,
  region text not null,
  storage_path text not null,
  phash text,
  quality jsonb,
  exif jsonb,
  created_at timestamptz not null default now(),
  unique (check_id, region)
);

create index check_photos_phash on public.check_photos (phash);

-- RLS: o dono vê e cria os próprios checks; fotos herdam a regra do check.
alter table public.checks enable row level security;
alter table public.check_photos enable row level security;

create policy "checks_select_own" on public.checks
  for select using (auth.uid() = profile_id);

create policy "checks_insert_own" on public.checks
  for insert with check (auth.uid() = profile_id);

-- Usuário só altera o check enquanto ainda está montando (fotos/envio);
-- transições posteriores são feitas pelo backend (service role ignora RLS).
create policy "checks_update_own_before_submit" on public.checks
  for update using (auth.uid() = profile_id and status = 'awaiting_photos')
  with check (auth.uid() = profile_id);

create policy "check_photos_select_own" on public.check_photos
  for select using (
    exists (
      select 1 from public.checks c
      where c.id = check_id and c.profile_id = auth.uid()
    )
  );

create policy "check_photos_insert_own" on public.check_photos
  for insert with check (
    exists (
      select 1 from public.checks c
      where c.id = check_id and c.profile_id = auth.uid() and c.status = 'awaiting_photos'
    )
  );

create policy "check_photos_delete_own" on public.check_photos
  for delete using (
    exists (
      select 1 from public.checks c
      where c.id = check_id and c.profile_id = auth.uid() and c.status = 'awaiting_photos'
    )
  );

-- Bucket privado para as fotos de check. Caminho: {profile_id}/{check_id}/{region}.jpg
insert into storage.buckets (id, name, public)
values ('check-photos', 'check-photos', false)
on conflict (id) do nothing;

create policy "check_photos_storage_rw_own" on storage.objects
  for all using (
    bucket_id = 'check-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'check-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
