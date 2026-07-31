# 14 — Estrutura Completa de Pastas (Monorepo)

Turborepo + pnpm workspaces. TS em tudo, exceto `services/ai-pipeline` (Python/uv).

```
garimpo-madruga/
├── apps/
│   ├── mobile/                        # React Native + Expo (app do usuário)
│   │   ├── app/                       # expo-router (file-based)
│   │   │   ├── (auth)/               # login, onboarding
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx         # Home
│   │   │   │   ├── search.tsx
│   │   │   │   ├── check/            # fluxo de legit check
│   │   │   │   │   ├── new.tsx       # escolha da peça
│   │   │   │   │   ├── camera/[step].tsx
│   │   │   │   │   ├── review.tsx    # confirmação + pagamento
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── status.tsx
│   │   │   │   │       └── report.tsx
│   │   │   │   ├── saved.tsx
│   │   │   │   └── profile/
│   │   │   ├── listing/[id].tsx      # anúncio (comprador)
│   │   │   ├── sell/                 # criação/edição de anúncio
│   │   │   ├── order/[id].tsx
│   │   │   └── chat/[conversationId].tsx
│   │   ├── src/
│   │   │   ├── features/             # lógica por domínio (check, listing, order…)
│   │   │   ├── components/           # composições locais (usa packages/ui)
│   │   │   ├── lib/                  # supabase client, api, storage, nfc
│   │   │   ├── hooks/
│   │   │   └── state/                # zustand stores
│   │   ├── assets/
│   │   ├── app.config.ts
│   │   └── eas.json
│   │
│   ├── web/                           # Next.js (Vercel) — público
│   │   ├── app/
│   │   │   ├── (marketing)/          # landing, blog, SEO programático
│   │   │   │   └── preco/[productSlug]/   # "quanto vale X" (SEO)
│   │   │   ├── cert/[code]/          # certificado público + OG image
│   │   │   ├── l/[listingId]/        # anúncio compartilhável (web view)
│   │   │   └── u/[username]/         # perfil público
│   │   └── ...
│   │
│   └── ops/                           # Next.js — painel interno
│       ├── app/
│       │   ├── review/               # fila e caso de revisão
│       │   ├── references/           # curadoria do banco de referência
│       │   ├── catalog/              # brands/products/checklists
│       │   ├── disputes/
│       │   ├── metrics/              # concordância IA×humano, calibração
│       │   └── users/
│       └── ...
│
├── packages/
│   ├── ui/                            # componentes RN compartilhados (Madruga DS)
│   ├── ui-tokens/                     # tokens (TS/JSON) → app + tailwind preset
│   ├── contracts/                     # zod schemas + tipos: API, fila, laudo, eventos
│   ├── db/                            # tipos gerados do Supabase + query helpers
│   ├── analytics/                     # eventos PostHog tipados (1 fonte de verdade)
│   ├── config/                        # eslint, tsconfig, tailwind base
│   └── i18n/                          # strings pt-BR (e futura es-419)
│
├── services/
│   ├── ai-pipeline/                   # Python (uv + FastAPI) — doc 08
│   │   ├── src/
│   │   │   ├── api/                  # endpoints internos (health, reprocess)
│   │   │   ├── worker/               # consumidor da fila
│   │   │   ├── stages/
│   │   │   │   ├── s0_quality.py     # blur, exposição, phash, foto-de-foto
│   │   │   │   ├── s1_identify.py
│   │   │   │   ├── s2_regions.py     # detecção e normalização de crops
│   │   │   │   ├── s3_ocr.py
│   │   │   │   ├── s3_embeddings.py
│   │   │   │   ├── s3_typography.py
│   │   │   │   ├── s3_stitching.py
│   │   │   │   ├── s3_codes.py       # qr/serial/nfc payloads
│   │   │   │   ├── s4_multimodal.py  # Claude + RAG
│   │   │   │   └── s5_aggregate.py   # score + calibração
│   │   │   ├── models/               # carga de modelos, clients Modal
│   │   │   └── lib/                  # supabase, storage, telemetry
│   │   ├── training/                 # fine-tune, calibração, backtests
│   │   │   ├── datasets/
│   │   │   ├── finetune_encoder.py
│   │   │   ├── train_aggregator.py
│   │   │   └── backtest.py           # replay de checks históricos (gate de CI)
│   │   ├── tests/
│   │   │   └── fixtures/known_fakes/ # suite que DEVE reprovar
│   │   └── pyproject.toml
│   │
│   └── jobs/                          # cron TS (Trigger.dev ou pg_cron+functions)
│       ├── escrow-release.ts
│       ├── wishlist-alerts.ts
│       ├── audit-sampler.ts          # 5% re-revisão cega
│       └── price-index.ts
│
├── supabase/
│   ├── migrations/                    # SQL versionado (fonte de verdade do schema)
│   ├── functions/                     # Edge Functions (Deno)
│   │   ├── create-check/
│   │   ├── submit-check/
│   │   ├── payments-webhook/
│   │   ├── publish-listing/
│   │   ├── export-listing/           # pacotes p/ canais externos
│   │   └── _shared/
│   ├── seed/                          # brands, categories, checklists, guias
│   └── config.toml
│
├── tooling/
│   ├── scripts/                       # gen-types, seed, re-embed, backfill
│   └── github/                        # actions reutilizáveis
│
├── docs/                              # este blueprint
├── .github/workflows/                 # ci.yml, deploy-functions.yml, deploy-ai.yml,
│                                      # mobile-eas.yml, backtest-gate.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Regras de dependência

```
apps/*  → packages/*           (nunca o contrário)
apps/*  ✗ services/*           (só via fila/HTTP com contrato em packages/contracts)
services/ai-pipeline ✗ importa TS — contrato via JSON schema exportado de contracts
packages/contracts = fonte única de verdade de todo payload entre sistemas
supabase/migrations = fonte única de verdade do schema (tipos gerados em packages/db)
```
