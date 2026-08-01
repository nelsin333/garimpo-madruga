-- Sprint 2: pipeline de processamento (jobs) e laudo (verdicts, findings,
-- certificates). O processador simulado e o pipeline real do Sprint 3
-- escrevem exatamente nas mesmas tabelas.

create type public.job_status as enum ('queued', 'running', 'completed', 'failed');

create table public.check_jobs (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id) on delete cascade,
  status public.job_status not null default 'queued',
  -- estágio atual (contrato jobStageSchema em @garimpo/contracts)
  stage text,
  progress smallint not null default 0 check (progress between 0 and 100),
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger check_jobs_set_updated_at
  before update on public.check_jobs
  for each row execute function public.set_updated_at();

create index check_jobs_check on public.check_jobs (check_id, created_at desc);
create index check_jobs_status on public.check_jobs (status) where status in ('queued', 'running');

-- Evidências do laudo — cada achado ancorado em foto + região + bbox.
create table public.check_findings (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id) on delete cascade,
  photo_id uuid references public.check_photos (id) on delete set null,
  region text not null,
  kind text not null,
  polarity text not null check (polarity in ('positive', 'suspicious', 'neutral')),
  score numeric(4, 3),
  title text not null,
  detail_md text not null,
  conclusion_md text not null default '',
  bbox jsonb,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index check_findings_check on public.check_findings (check_id, position);

create table public.verdicts (
  id uuid primary key default gen_random_uuid(),
  check_id uuid unique not null references public.checks (id) on delete cascade,
  authenticity_probability numeric(4, 3) not null
    check (authenticity_probability between 0 and 1),
  risk public.risk_level not null,
  outcome text not null check (outcome in ('original', 'replica', 'inconclusive')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  source public.verdict_source not null,
  summary_md text not null,
  recommendations_md text not null default '',
  next_steps_md text not null default '',
  ai_model_version text,
  disclaimer_version text not null default 'v1',
  created_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  check_id uuid unique not null references public.checks (id) on delete cascade,
  public_code text unique not null,
  revoked boolean not null default false,
  revoked_reason text,
  created_at timestamptz not null default now()
);

-- RLS: dono do check lê tudo que deriva dele; escrita é do backend
-- (service role, que ignora RLS).
alter table public.check_jobs enable row level security;
alter table public.check_findings enable row level security;
alter table public.verdicts enable row level security;
alter table public.certificates enable row level security;

create policy "check_jobs_select_own" on public.check_jobs
  for select using (
    exists (select 1 from public.checks c where c.id = check_id and c.profile_id = auth.uid())
  );

create policy "check_findings_select_own" on public.check_findings
  for select using (
    exists (select 1 from public.checks c where c.id = check_id and c.profile_id = auth.uid())
  );

create policy "verdicts_select_own" on public.verdicts
  for select using (
    exists (select 1 from public.checks c where c.id = check_id and c.profile_id = auth.uid())
  );

create policy "certificates_select_own" on public.certificates
  for select using (
    exists (select 1 from public.checks c where c.id = check_id and c.profile_id = auth.uid())
  );

-- Usuário pode cancelar o próprio check antes do resultado.
create policy "checks_cancel_own" on public.checks
  for update using (
    auth.uid() = profile_id and status in ('queued', 'processing', 'in_review')
  )
  with check (auth.uid() = profile_id and status = 'cancelled');

-- Realtime: status do job e do check ao vivo na tela de processamento.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.check_jobs;
    alter publication supabase_realtime add table public.checks;
  end if;
end;
$$;
