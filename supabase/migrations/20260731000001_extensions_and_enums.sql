-- Extensões usadas desde o Sprint 1. pgvector entra no Sprint 3 (pipeline de IA).
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists citext with schema extensions;

-- Enums do domínio de autenticação (espelhados em @garimpo/contracts).
create type public.check_status as enum (
  'awaiting_photos',
  'queued',
  'processing',
  'in_review',
  'completed',
  'cancelled',
  'refunded'
);

create type public.risk_level as enum ('low', 'medium', 'high', 'inconclusive');

create type public.verdict_source as enum ('ai_auto', 'human_confirmed', 'human_overridden');
