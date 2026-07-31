-- Perfis: 1:1 com auth.users, criados por trigger no signup.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext unique not null check (username ~ '^[a-z0-9_\.]{3,30}$'),
  display_name text,
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  reputation_score numeric(3, 2) not null default 0,
  level int not null default 1,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at automático (reutilizado pelas próximas tabelas).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil no signup com username derivado do e-mail + sufixo aleatório
-- (o usuário pode trocar depois; a regra do CHECK é garantida aqui).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base text;
  candidate text;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, 'garimpeiro'), '@', 1), '[^a-z0-9_\.]', '', 'g'));
  base := left(coalesce(nullif(base, ''), 'garimpeiro'), 20);
  if char_length(base) < 3 then
    base := base || 'gm';
    base := rpad(base, 3, '0');
  end if;

  candidate := base || '.' || substr(md5(random()::text), 1, 6);

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: perfis são públicos para leitura (vitrine social); só o dono edita.
alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
