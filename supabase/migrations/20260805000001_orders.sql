-- Sprint 6: marketplace transacional — pedidos, pagamentos, frete, disputas,
-- chat e recebimento do vendedor.
--
-- Princípios aplicados no schema:
--  * dinheiro sempre em centavos (int) — nunca ponto flutuante;
--  * o cliente nunca escreve estado financeiro: toda transição passa por
--    funções SECURITY DEFINER com transições válidas explícitas;
--  * um anúncio não pode ser vendido duas vezes (índice único parcial);
--  * webhooks são idempotentes por (provider, event_id).

-- ===== Enums =====

create type public.order_status as enum (
  'pending_payment',
  'payment_processing',
  'paid',
  'preparing_shipment',
  'shipped',
  'delivered',
  'completed',
  'payment_failed',
  'expired',
  'cancelled',
  'disputed',
  'returned',
  'refunded'
);

create type public.payment_status as enum (
  'created',
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'refunded',
  'charged_back'
);

create type public.payment_method as enum ('pix', 'credit_card', 'boleto');

create type public.shipment_status as enum (
  'pending',
  'label_created',
  'posted',
  'in_transit',
  'delivered',
  'returned',
  'cancelled'
);

create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'cancelled');

create type public.dispute_resolution as enum (
  'buyer_refund',
  'seller_favor',
  'partial_refund',
  'return_and_refund'
);

create type public.kyc_status as enum (
  'not_started',
  'pending',
  'approved',
  'rejected',
  'blocked'
);

create type public.payout_status as enum ('requested', 'processing', 'paid', 'failed');

-- ===== Endereços (PII: só o dono e o fulfillment do pedido enxergam) =====

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  recipient_name text not null,
  zip_code text not null check (zip_code ~ '^[0-9]{8}$'),
  street text not null,
  number text not null,
  complement text,
  district text not null,
  city text not null,
  state char(2) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

create index addresses_profile on public.addresses (profile_id);

-- ===== Pedidos =====

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id),
  seller_id uuid not null references public.profiles (id),
  listing_id uuid not null references public.listings (id),

  status public.order_status not null default 'pending_payment',

  -- valores congelados no momento da compra (centavos, moeda única por pedido)
  item_cents int not null check (item_cents > 0),
  shipping_cents int not null default 0 check (shipping_cents >= 0),
  buyer_fee_cents int not null default 0 check (buyer_fee_cents >= 0),
  platform_fee_cents int not null default 0 check (platform_fee_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  total_cents int not null check (total_cents > 0),
  seller_amount_cents int not null check (seller_amount_cents >= 0),
  currency char(3) not null default 'BRL',

  -- snapshot do endereço de entrega (o endereço original pode mudar depois)
  shipping_address jsonb not null,
  shipping_option jsonb not null default '{}'::jsonb,

  -- proteção contra double-submit do cliente
  idempotency_key text not null,

  -- identificadores externos (provedores)
  external_payment_id text,
  external_shipment_id text,

  payment_expires_at timestamptz,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  escrow_release_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_total_matches check (
    total_cents = item_cents + shipping_cents + buyer_fee_cents - discount_cents
  ),
  constraint orders_buyer_is_not_seller check (buyer_id <> seller_id),
  unique (buyer_id, idempotency_key)
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_buyer on public.orders (buyer_id, created_at desc);
create index orders_seller on public.orders (seller_id, created_at desc);
create index orders_external_payment on public.orders (external_payment_id);

-- Um anúncio só pode ter UM pedido vivo: impede venda duplicada no banco,
-- independentemente de corrida na aplicação.
create unique index orders_one_live_per_listing on public.orders (listing_id)
  where status in (
    'pending_payment', 'payment_processing', 'paid', 'preparing_shipment',
    'shipped', 'delivered', 'completed', 'disputed', 'returned'
  );

-- Trilha de auditoria: toda mudança relevante vira evento.
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null,
  from_status public.order_status,
  to_status public.order_status,
  actor_id uuid references public.profiles (id),
  actor_kind text not null default 'system'
    check (actor_kind in ('buyer', 'seller', 'system', 'admin', 'provider')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index order_events_order on public.order_events (order_id, created_at);

-- ===== Pagamentos =====

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'mercadopago',
  method public.payment_method not null,
  status public.payment_status not null default 'created',
  amount_cents int not null check (amount_cents > 0),
  external_id text,
  -- dados NÃO sensíveis para o comprador concluir o pagamento
  -- (QR Pix, copia-e-cola, URL do checkout). Nunca dados de cartão.
  checkout jsonb not null default '{}'::jsonb,
  raw_status text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create trigger payment_attempts_set_updated_at
  before update on public.payment_attempts
  for each row execute function public.set_updated_at();

create index payment_attempts_order on public.payment_attempts (order_id, created_at desc);

-- Idempotência de webhook: um evento externo produz efeito uma única vez.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  topic text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ===== Frete =====

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'melhorenvio',
  service_name text,
  status public.shipment_status not null default 'pending',
  external_id text,
  tracking_code text,
  label_url text,
  price_cents int not null default 0 check (price_cents >= 0),
  estimated_days int,
  posted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

create index shipments_order on public.shipments (order_id, created_at desc);
create index shipments_tracking on public.shipments (tracking_code);

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  status public.shipment_status not null,
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index shipment_events_shipment on public.shipment_events (shipment_id, occurred_at desc);

-- ===== Disputas =====

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  opened_by uuid not null references public.profiles (id),
  reason text not null check (reason in (
    'not_received', 'not_as_described', 'damaged', 'suspected_fake', 'other'
  )),
  description text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  status public.dispute_status not null default 'open',
  resolution public.dispute_resolution,
  resolution_note text,
  refund_cents int check (refund_cents is null or refund_cents >= 0),
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger disputes_set_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

create unique index disputes_one_open_per_order on public.disputes (order_id)
  where status in ('open', 'under_review');

create table public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index dispute_messages_dispute on public.dispute_messages (dispute_id, created_at);

-- ===== Chat comprador ↔ vendedor =====

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id),
  seller_id uuid not null references public.profiles (id),
  order_id uuid references public.orders (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_parties check (buyer_id <> seller_id),
  unique (listing_id, buyer_id)
);

create index conversations_buyer on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation on public.messages (conversation_id, created_at desc);
create index messages_unread on public.messages (conversation_id, read_at) where read_at is null;

create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ===== Recebimento do vendedor (KYC + saldo + saque) =====
-- Não guardamos dados bancários sensíveis nem cartões: o provedor de
-- pagamento é o responsável por eles. Aqui ficam só referências externas.

create table public.seller_accounts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  kyc_status public.kyc_status not null default 'not_started',
  kyc_submitted_at timestamptz,
  kyc_reviewed_at timestamptz,
  kyc_rejection_reason text,
  -- documento apenas mascarado para conferência do usuário (ex.: ***.456.789-**)
  document_masked text,
  legal_name text,
  -- identificador da conta no provedor de pagamento (fonte da verdade financeira)
  provider text not null default 'mercadopago',
  provider_account_id text,
  payout_method text check (payout_method in ('pix', 'bank_transfer')),
  payout_key_masked text,
  pending_balance_cents int not null default 0 check (pending_balance_cents >= 0),
  available_balance_cents int not null default 0 check (available_balance_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger seller_accounts_set_updated_at
  before update on public.seller_accounts
  for each row execute function public.set_updated_at();

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  amount_cents int not null check (amount_cents > 0),
  status public.payout_status not null default 'requested',
  provider text not null default 'mercadopago',
  external_id text,
  failure_reason text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payouts_set_updated_at
  before update on public.payouts
  for each row execute function public.set_updated_at();

create index payouts_profile on public.payouts (profile_id, created_at desc);

-- ===== Transições válidas (fonte da verdade no banco) =====

create table public.order_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  primary key (from_status, to_status)
);

insert into public.order_transitions (from_status, to_status) values
  ('pending_payment', 'payment_processing'),
  ('pending_payment', 'paid'),
  ('pending_payment', 'payment_failed'),
  ('pending_payment', 'expired'),
  ('pending_payment', 'cancelled'),
  ('payment_processing', 'paid'),
  ('payment_processing', 'payment_failed'),
  ('payment_processing', 'cancelled'),
  ('payment_failed', 'pending_payment'),
  ('payment_failed', 'cancelled'),
  ('paid', 'preparing_shipment'),
  ('paid', 'cancelled'),
  ('paid', 'disputed'),
  ('paid', 'refunded'),
  ('preparing_shipment', 'shipped'),
  ('preparing_shipment', 'disputed'),
  ('preparing_shipment', 'cancelled'),
  ('shipped', 'delivered'),
  ('shipped', 'disputed'),
  ('delivered', 'completed'),
  ('delivered', 'disputed'),
  ('disputed', 'completed'),
  ('disputed', 'refunded'),
  ('disputed', 'returned'),
  ('returned', 'refunded');

-- ===== Função central de transição (atômica e validada) =====

create or replace function public.apply_order_transition(
  p_order_id uuid,
  p_to_status public.order_status,
  p_kind text,
  p_actor_id uuid,
  p_actor_kind text,
  p_data jsonb default '{}'::jsonb
)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status public.order_status;
  v_listing_id uuid;
  v_seller_id uuid;
  v_seller_amount int;
begin
  select status, listing_id, seller_id, seller_amount_cents
    into current_status, v_listing_id, v_seller_id, v_seller_amount
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  -- Idempotente: repetir a mesma transição não é erro nem gera efeito duplo.
  if current_status = p_to_status then
    return current_status;
  end if;

  if not exists (
    select 1 from public.order_transitions
    where from_status = current_status and to_status = p_to_status
  ) then
    raise exception 'invalid_transition_% _to_%', current_status, p_to_status
      using errcode = 'P0001';
  end if;

  update public.orders
  set status = p_to_status,
      paid_at = case when p_to_status = 'paid' then now() else paid_at end,
      shipped_at = case when p_to_status = 'shipped' then now() else shipped_at end,
      delivered_at = case when p_to_status = 'delivered' then now() else delivered_at end,
      completed_at = case when p_to_status = 'completed' then now() else completed_at end,
      cancelled_at = case
        when p_to_status in ('cancelled', 'expired') then now() else cancelled_at end,
      -- janela de disputa: 3 dias após a entrega
      escrow_release_at = case
        when p_to_status = 'delivered' then now() + interval '3 days' else escrow_release_at end
  where id = p_order_id;

  insert into public.order_events (order_id, kind, from_status, to_status, actor_id, actor_kind, data)
  values (p_order_id, p_kind, current_status, p_to_status, p_actor_id, p_actor_kind, p_data);

  -- Reflete no anúncio: vendido quando concluído, liberado quando o pedido morre.
  if p_to_status = 'completed' then
    update public.listings set status = 'sold', sold_at = now() where id = v_listing_id;
  elsif p_to_status in ('cancelled', 'expired', 'refunded') then
    update public.listings set status = 'active', sold_at = null
    where id = v_listing_id and status = 'reserved';
  end if;

  -- Saldo do vendedor: entra como pendente no pagamento, fica disponível na
  -- conclusão, e é estornado se o pedido virar reembolso.
  if p_to_status = 'paid' then
    insert into public.seller_accounts (profile_id, pending_balance_cents)
    values (v_seller_id, v_seller_amount)
    on conflict (profile_id) do update
      set pending_balance_cents = seller_accounts.pending_balance_cents + v_seller_amount;
  elsif p_to_status = 'completed' then
    update public.seller_accounts
    set pending_balance_cents = greatest(0, pending_balance_cents - v_seller_amount),
        available_balance_cents = available_balance_cents + v_seller_amount
    where profile_id = v_seller_id;
  elsif p_to_status = 'refunded' then
    update public.seller_accounts
    set pending_balance_cents = greatest(0, pending_balance_cents - v_seller_amount)
    where profile_id = v_seller_id;
  end if;

  return p_to_status;
end;
$$;

-- EXECUTE é concedido a PUBLIC por padrão no Postgres: revogar apenas de
-- anon/authenticated NÃO fecha o acesso via PostgREST. Revogamos de PUBLIC.
revoke execute on function public.apply_order_transition(
  uuid, public.order_status, text, uuid, text, jsonb
) from public, anon, authenticated;

-- ===== Criação de pedido (atômica, valida tudo no servidor) =====

create or replace function public.create_order(
  p_buyer_id uuid,
  p_listing_id uuid,
  p_idempotency_key text,
  p_shipping_address jsonb,
  p_shipping_option jsonb,
  p_shipping_cents int,
  p_buyer_fee_cents int,
  p_platform_fee_bps int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_existing uuid;
  v_order_id uuid;
  v_platform_fee int;
  v_total int;
  v_seller_amount int;
begin
  -- Double-submit: mesma chave do mesmo comprador devolve o mesmo pedido.
  select id into v_existing from public.orders
  where buyer_id = p_buyer_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;

  -- Trava o anúncio: serializa compradores simultâneos.
  select id, seller_id, price_cents, status
    into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'listing_not_available' using errcode = 'P0001';
  end if;
  if v_listing.price_cents is null or v_listing.price_cents <= 0 then
    raise exception 'listing_without_price' using errcode = 'P0001';
  end if;
  if v_listing.seller_id = p_buyer_id then
    raise exception 'cannot_buy_own_listing' using errcode = 'P0001';
  end if;

  -- Preço vem do banco, nunca do cliente.
  v_platform_fee := (v_listing.price_cents * p_platform_fee_bps) / 10000;
  v_total := v_listing.price_cents + p_shipping_cents + p_buyer_fee_cents;
  v_seller_amount := v_listing.price_cents - v_platform_fee;

  insert into public.orders (
    buyer_id, seller_id, listing_id, item_cents, shipping_cents,
    buyer_fee_cents, platform_fee_cents, total_cents, seller_amount_cents,
    shipping_address, shipping_option, idempotency_key, payment_expires_at
  )
  values (
    p_buyer_id, v_listing.seller_id, p_listing_id, v_listing.price_cents, p_shipping_cents,
    p_buyer_fee_cents, v_platform_fee, v_total, v_seller_amount,
    p_shipping_address, p_shipping_option, p_idempotency_key, now() + interval '30 minutes'
  )
  returning id into v_order_id;

  update public.listings set status = 'reserved' where id = p_listing_id;

  insert into public.order_events (order_id, kind, to_status, actor_id, actor_kind, data)
  values (
    v_order_id, 'order_created', 'pending_payment', p_buyer_id, 'buyer',
    jsonb_build_object('item_cents', v_listing.price_cents, 'total_cents', v_total)
  );

  return v_order_id;
end;
$$;

revoke execute on function public.create_order(
  uuid, uuid, text, jsonb, jsonb, int, int, int
) from public, anon, authenticated;

-- ===== RLS =====

alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.seller_accounts enable row level security;
alter table public.payouts enable row level security;
alter table public.order_transitions enable row level security;

-- Endereços: exclusivos do dono.
create policy "addresses_own" on public.addresses
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Pedidos: leitura só das próprias pontas. Nenhuma policy de insert/update:
-- criação e transição passam obrigatoriamente pelas funções do backend.
create policy "orders_select_parties" on public.orders
  for select using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "order_events_select_parties" on public.order_events
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

-- Pagamento: só o comprador vê (é quem precisa do QR/link).
create policy "payment_attempts_select_buyer" on public.payment_attempts
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
  );

create policy "shipments_select_parties" on public.shipments
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

create policy "shipment_events_select_parties" on public.shipment_events
  for select using (
    exists (
      select 1 from public.shipments s
      join public.orders o on o.id = s.order_id
      where s.id = shipment_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

create policy "disputes_select_parties" on public.disputes
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

create policy "dispute_messages_select_parties" on public.dispute_messages
  for select using (
    exists (
      select 1 from public.disputes d
      join public.orders o on o.id = d.order_id
      where d.id = dispute_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

create policy "dispute_messages_insert_parties" on public.dispute_messages
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      join public.orders o on o.id = d.order_id
      where d.id = dispute_id
        and d.status in ('open', 'under_review')
        and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

-- Chat: só os dois participantes.
create policy "conversations_select_parties" on public.conversations
  for select using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "conversations_insert_buyer" on public.conversations
  for insert with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = conversations.seller_id and l.status = 'active'
    )
  );

create policy "messages_select_parties" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

create policy "messages_insert_participant" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Marcar como lida: só quem recebeu.
create policy "messages_update_recipient" on public.messages
  for update using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  )
  with check (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Conta do vendedor: leitura própria. Saldo e KYC só mudam pelo backend.
create policy "seller_accounts_select_own" on public.seller_accounts
  for select using (profile_id = auth.uid());

create policy "payouts_select_own" on public.payouts
  for select using (profile_id = auth.uid());

-- webhook_events e order_transitions: nenhuma policy — service role apenas.

-- GRANTs explícitos: o acesso efetivo é decidido pelas policies acima, mas
-- deixamos claro no schema quem pode sequer tentar. Tabelas financeiras não
-- recebem insert/update do cliente — só leitura filtrada por RLS.
grant select, insert, update, delete on public.addresses to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_events to authenticated;
grant select on public.payment_attempts to authenticated;
grant select on public.shipments to authenticated;
grant select on public.shipment_events to authenticated;
grant select on public.disputes to authenticated;
grant select, insert on public.dispute_messages to authenticated;
grant select, insert on public.conversations to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select on public.seller_accounts to authenticated;
grant select on public.payouts to authenticated;

-- Realtime do chat e do pedido.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

-- ===== Solicitação de saque (valida KYC e saldo no servidor) =====

create or replace function public.request_payout(p_profile_id uuid, p_amount_cents int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account record;
  v_payout_id uuid;
begin
  select * into v_account from public.seller_accounts
  where profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'seller_account_not_found' using errcode = 'P0002';
  end if;
  if v_account.kyc_status <> 'approved' then
    raise exception 'kyc_not_approved' using errcode = 'P0001';
  end if;
  if p_amount_cents <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if v_account.available_balance_cents < p_amount_cents then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  update public.seller_accounts
  set available_balance_cents = available_balance_cents - p_amount_cents
  where profile_id = p_profile_id;

  insert into public.payouts (profile_id, amount_cents)
  values (p_profile_id, p_amount_cents)
  returning id into v_payout_id;

  return v_payout_id;
end;
$$;

revoke execute on function public.request_payout(uuid, int) from public, anon, authenticated;

-- As funções financeiras são exclusivas do backend (service role).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.create_order(uuid, uuid, text, jsonb, jsonb, int, int, int) to service_role';
    execute 'grant execute on function public.apply_order_transition(uuid, public.order_status, text, uuid, text, jsonb) to service_role';
    execute 'grant execute on function public.request_payout(uuid, int) to service_role';
  end if;
end;
$$;
