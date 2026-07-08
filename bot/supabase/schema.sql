-- ============================================================
-- Schema do bot Madruga Club
-- Rodar no SQL Editor do Supabase (projeto que ja tem
-- pecas / vendedores / perfis do site garimpo-madruga).
-- Tudo idempotente: pode rodar mais de uma vez sem quebrar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela pecas ja existe (site admin.html). So adiciona
--    o que o bot precisa pra responder tamanho/estoque.
-- ------------------------------------------------------------
alter table pecas add column if not exists tamanho text;        -- ex: 'P', 'M', 'G', 'GG', '42'
alter table pecas add column if not exists quantidade int default 1;

-- ------------------------------------------------------------
-- 2. Clientes do bot (cadastro automatico pelo WhatsApp).
--    Guarda a cidade pra calcular frete sem perguntar de novo.
-- ------------------------------------------------------------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  whatsapp text unique not null,          -- so numeros, com DDI: 5511999998888
  nome text,
  cidade text,
  uf text,                                -- 'SP', 'RJ', ...
  capital boolean,                        -- true = capital SP/RJ (frete R$10)
  criado_em timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. Pedidos (rastreio). O bot busca pelo whatsapp do cliente.
-- ------------------------------------------------------------
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_whatsapp text not null,
  peca_id uuid references pecas(id),
  descricao text,                         -- ex: 'Camisa Lacoste M azul'
  valor numeric,
  enviado boolean default false,
  codigo_rastreio text,
  criado_em timestamptz default now()
);
create index if not exists pedidos_whatsapp_idx on pedidos (cliente_whatsapp);

-- ------------------------------------------------------------
-- 4. Configuracao do bot (editavel sem mexer em codigo:
--    Supabase Dashboard > Table Editor > bot_config).
-- ------------------------------------------------------------
create table if not exists bot_config (
  chave text primary key,
  valor text,
  atualizado_em timestamptz default now()
);

insert into bot_config (chave, valor) values
  -- Data do proximo drop no formato AAAA-MM-DD.
  -- Se deixar vazio, o bot calcula sozinho o proximo dia 5 ou 20.
  ('proximo_drop', ''),
  -- Texto extra que o bot manda junto com a data do drop (opcional)
  ('drop_info', 'Drops sempre dia 5 e dia 20. Fica ligado no grupo que as pecas voam!'),
  -- Valores de frete (em reais)
  ('frete_capital', '10'),
  ('frete_interior', '12'),
  ('frete_interior_max', '13')
on conflict (chave) do nothing;

-- ------------------------------------------------------------
-- 5. Conversas e mensagens (estado do papo + historico
--    que vai pro seu WhatsApp quando escala).
-- ------------------------------------------------------------
create table if not exists conversas (
  whatsapp text primary key,
  estado text default 'inicio',           -- 'inicio' | 'aguardando_cidade'
  contexto jsonb default '{}',            -- dados temporarios do fluxo
  escalada boolean default false,         -- true = humano assumiu, bot fica quieto
  atualizado_em timestamptz default now()
);

create table if not exists mensagens (
  id bigint generated always as identity primary key,
  whatsapp text not null,
  origem text not null,                   -- 'cliente' | 'bot'
  texto text,
  criado_em timestamptz default now()
);
create index if not exists mensagens_whatsapp_idx on mensagens (whatsapp, criado_em desc);
