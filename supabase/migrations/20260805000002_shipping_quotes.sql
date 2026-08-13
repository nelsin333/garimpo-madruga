-- Cotações de frete emitidas pelo servidor.
--
-- Sem isto o comprador escolheria o próprio frete no corpo do checkout. A rota
-- shipping-quote consulta a transportadora, grava cada opção aqui e devolve os
-- ids; create-order só aceita uma cotação nossa, não expirada, do mesmo
-- comprador e do mesmo anúncio.

-- Dimensões da encomenda. Ficam no anúncio porque variam por peça (um tênis
-- na caixa não é uma camiseta). Os defaults descrevem um pacote de vestuário
-- padrão, de forma que anúncios do Sprint 5 continuem cotáveis sem edição.
alter table public.listings
  add column if not exists parcel_weight_grams int not null default 800
    check (parcel_weight_grams between 50 and 30000),
  add column if not exists parcel_length_cm int not null default 30
    check (parcel_length_cm between 11 and 100),
  add column if not exists parcel_width_cm int not null default 25
    check (parcel_width_cm between 8 and 100),
  add column if not exists parcel_height_cm int not null default 10
    check (parcel_height_cm between 2 and 100);

create table if not exists public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  provider text not null default 'melhorenvio',
  service_id text not null,
  service_name text not null,
  carrier text not null,
  price_cents int not null check (price_cents >= 0),
  estimated_days int,
  from_zip char(8) not null,
  to_zip char(8) not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists shipping_quotes_lookup
  on public.shipping_quotes (profile_id, listing_id, created_at desc);

alter table public.shipping_quotes enable row level security;

-- O comprador lê as próprias cotações; escrita é exclusiva do backend.
drop policy if exists shipping_quotes_select_own on public.shipping_quotes;
create policy shipping_quotes_select_own on public.shipping_quotes
  for select using (profile_id = auth.uid());

grant select on public.shipping_quotes to authenticated;

-- Limpeza das cotações vencidas — chamada pelo backend, não pelo cliente.
create or replace function public.purge_expired_shipping_quotes()
returns int
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.shipping_quotes
    where expires_at < now() - interval '1 day'
    returning 1
  )
  select count(*)::int from deleted;
$$;

-- EXECUTE é concedido a PUBLIC por padrão: revogar só de anon/authenticated
-- não fecharia o acesso via PostgREST.
revoke execute on function public.purge_expired_shipping_quotes() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.purge_expired_shipping_quotes() to service_role;
    grant select, insert, delete on public.shipping_quotes to service_role;
  end if;
end
$$;
