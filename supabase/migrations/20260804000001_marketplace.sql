-- Sprint 5: marketplace — anúncios nascidos do legit check, favoritos com
-- alerta de preço, certificado público e perfil de vendedor.

create type public.listing_status as enum (
  'draft', 'active', 'reserved', 'sold', 'paused', 'removed'
);

create type public.condition_grade as enum (
  'new_with_tags', 'new_no_tags', 'excellent', 'good', 'fair', 'poor'
);

-- unaccent não é immutable; wrapper para uso em coluna gerada.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id),
  check_id uuid unique references public.checks (id),
  certificate_id uuid references public.certificates (id),
  brand_id uuid references public.brands (id),
  category_id uuid references public.categories (id),
  product_id uuid references public.products (id),
  title text not null default '',
  description_md text not null default '',
  condition public.condition_grade,
  size_label text,
  measurements jsonb not null default '{}'::jsonb,
  defects_md text not null default '',
  price_cents int check (price_cents is null or price_cents > 0),
  currency char(3) not null default 'BRL',
  location_city text,
  location_state char(2),
  shipping_methods text[] not null default '{}',
  hashtags text[] not null default '{}',
  keywords text[] not null default '{}',
  status public.listing_status not null default 'draft',
  ai_generated jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_tsv tsvector generated always as (
    to_tsvector(
      'portuguese',
      public.immutable_unaccent(
        coalesce(title, '') || ' ' || coalesce(description_md, '')
      )
    )
  ) stored
);

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

create index listings_search on public.listings using gin (search_tsv);
create index listings_browse
  on public.listings (status, created_at desc) where status = 'active';
create index listings_seller on public.listings (seller_id, created_at desc);
create index listings_filters
  on public.listings (brand_id, category_id, condition, price_cents) where status = 'active';

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  position int not null default 0,
  source text not null default 'check' check (source in ('check', 'upload')),
  created_at timestamptz not null default now()
);

create index listing_photos_listing on public.listing_photos (listing_id, position);

create table public.listing_favorites (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  price_cents_at_save int,
  created_at timestamptz not null default now(),
  primary key (profile_id, listing_id)
);

create index listing_favorites_listing on public.listing_favorites (listing_id);

-- Notificações in-app (alerta de preço hoje; outros tipos no futuro).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_inbox
  on public.notifications (profile_id, created_at desc) where not read;

-- Preço mudou → notifica quem favoritou.
create or replace function public.notify_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and old.price_cents is distinct from new.price_cents then
    insert into public.notifications (profile_id, kind, payload)
    select f.profile_id,
           'price_change',
           jsonb_build_object(
             'listing_id', new.id,
             'title', new.title,
             'old_price_cents', old.price_cents,
             'new_price_cents', new.price_cents
           )
    from public.listing_favorites f
    where f.listing_id = new.id and f.profile_id <> new.seller_id;
  end if;
  return new;
end;
$$;

create trigger listings_notify_price_change
  after update on public.listings
  for each row execute function public.notify_price_change();

-- ===== RLS =====
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.listing_favorites enable row level security;
alter table public.notifications enable row level security;

create policy "listings_select_active_or_own" on public.listings
  for select using (status = 'active' or status = 'sold' or seller_id = auth.uid());

create policy "listings_insert_own" on public.listings
  for insert with check (seller_id = auth.uid());

create policy "listings_update_own" on public.listings
  for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());

create policy "listing_photos_select" on public.listing_photos
  for select using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.status in ('active', 'sold') or l.seller_id = auth.uid())
    )
  );

create policy "listing_photos_write_own" on public.listing_photos
  for all using (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
  )
  with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
  );

create policy "favorites_select_own" on public.listing_favorites
  for select using (profile_id = auth.uid());
create policy "favorites_insert_own" on public.listing_favorites
  for insert with check (profile_id = auth.uid());
create policy "favorites_delete_own" on public.listing_favorites
  for delete using (profile_id = auth.uid());

create policy "notifications_select_own" on public.notifications
  for select using (profile_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Fotos de anúncio: bucket público (leitura aberta), escrita na pasta do vendedor.
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "listing_photos_storage_write_own" on storage.objects
  for all using (
    bucket_id = 'listing-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'listing-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ===== Certificado público (QR aponta para cá) =====
create or replace function public.public_certificate(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'code', c.public_code,
    'revoked', c.revoked,
    'issued_at', c.created_at,
    'authenticity_probability', v.authenticity_probability,
    'risk', v.risk,
    'outcome', v.outcome,
    'confidence', v.confidence,
    'summary_md', v.summary_md,
    'piece', jsonb_build_object(
      'brand', b.name,
      'category', cat.name,
      'model', coalesce(p.name, ch.declared ->> 'model_name')
    ),
    'checked_at', ch.submitted_at,
    -- evidências públicas: título/região/polaridade/conclusão.
    -- Detalhes e comparações com o gabarito NUNCA são expostos.
    'public_findings', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'title', f.title, 'region', f.region,
            'polarity', f.polarity, 'conclusion', f.conclusion_md
          ) order by f.position
        ), '[]'::jsonb
      )
      from check_findings f
      where f.check_id = ch.id and f.polarity in ('positive', 'suspicious')
    ),
    'listing_id', (
      select l.id from listings l
      where l.check_id = ch.id and l.status = 'active'
      limit 1
    )
  )
  into result
  from certificates c
  join checks ch on ch.id = c.check_id
  join verdicts v on v.check_id = ch.id
  left join brands b on b.id = ch.brand_id
  left join categories cat on cat.id = ch.category_id
  left join products p on p.id = ch.product_id
  where c.public_code = upper(p_code);

  return result;
end;
$$;

grant execute on function public.public_certificate(text) to anon, authenticated;

-- ===== Perfil público do vendedor =====
create or replace function public.seller_public_stats(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', pr.id,
      'username', pr.username,
      'display_name', pr.display_name,
      'avatar_url', pr.avatar_url,
      'bio', pr.bio,
      'reputation_score', pr.reputation_score,
      'level', pr.level,
      'member_since', pr.created_at
    ),
    'sales_count',
      (select count(*) from listings l where l.seller_id = pr.id and l.status = 'sold'),
    'active_listings_count',
      (select count(*) from listings l where l.seller_id = pr.id and l.status = 'active'),
    'checks_count',
      (select count(*) from checks c where c.profile_id = pr.id and c.status = 'completed'),
    'verified_count', (
      select count(*)
      from checks c
      join verdicts v on v.check_id = c.id
      where c.profile_id = pr.id and v.outcome = 'original'
    )
  )
  into result
  from profiles pr
  where pr.username = p_username;

  return result;
end;
$$;

grant execute on function public.seller_public_stats(text) to anon, authenticated;
