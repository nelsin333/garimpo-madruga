# 13 — Plano Técnico de Implementação

## Fase 0 — Fundações (semanas 1–2)

1. Monorepo Turborepo + pnpm; TypeScript strict; ESLint/Prettier/Biome; Husky.
2. Projetos Supabase (`prod`/`staging`) + supabase CLI com migrations versionadas no repo; CI aplica migrations em staging a cada merge.
3. Expo app com EAS (build/submit/update configurados desde o início — OTA updates são vitais para iterar IA/fluxos sem review da loja).
4. Next.js (Vercel): landing + esqueleto do painel interno (rota protegida por role).
5. Auth end-to-end: Supabase Auth (Apple/Google/e-mail/OTP telefone) + RLS baseline ("usuário só vê o que é dele") + tabela `profiles` com trigger de criação.
6. Observabilidade desde o dia 1: Sentry (app+web+functions), PostHog (eventos nomeados em `packages/analytics`), Axiom para logs das functions.

## Fase 1 — Fluxo de check sem IA (semanas 3–6)

Estratégia: **construir o fluxo completo com humano fazendo 100%** antes de qualquer ML. Valida o produto e começa a gerar dados rotulados imediatamente.

1. Catálogo mínimo: seeds de `brands`, `categories`, `photo_checklist` das 10 marcas foco.
2. Câmera guiada (expo-camera + overlays; validação de blur/luz **on-device** com módulo nativo leve — vision-camera frame processor).
3. Upload direto ao Storage com URLs assinadas; compressão client-side (~2560px, qualidade 0.85, original preservado).
4. Edge Functions: `create-check`, `submit-check`, webhook de pagamento (Mercado Pago Pix/cartão), state machine de status.
5. Painel de revisão v1: fila, visualizador de fotos com zoom, formulário de achados (cria `check_findings` manualmente), veredito + laudo.
6. Relatório no app (renderiza `check_findings` + `verdicts`) + Realtime de status + push (Expo) e WhatsApp template (veredito pronto).
7. Certificado público: página Next.js `cert/[code]` com OG image gerada (Satori) — já nasce como peça de marketing.

**Milestone: primeiro check pago de ponta a ponta com laudo humano.**

## Fase 2 — Pipeline de IA v0 (semanas 5–10, paralelo à Fase 1)

1. Serviço Python (FastAPI) no Fly/Railway; consome fila (BullMQ/Upstash); contrato de entrada/saída tipado (JSON schema compartilhado em `packages/contracts`).
2. Estágio 0: qualidade (OpenCV: Laplaciano, histograma) + pHash + heurísticas foto-de-foto.
3. OCR: Google Vision → normalização de texto → validadores de serial por marca (regras nos seeds).
4. Embeddings: SigLIP 2 pré-treinado via Modal (GPU serverless); gravação em `embeddings` (pgvector); kNN filtrado por marca/categoria/região.
5. Análise multimodal: Claude API com prompt estruturado + RAG do `auth_guide` + top-k referências; saída JSON→`check_findings` com bbox.
6. Agregador v0: pesos manuais + regras (sem treino ainda); calibração inicial grosseira; **tudo vai para humano** — a IA só pré-preenche o painel.
7. Métricas de concordância IA×humano por fatia (dashboard interno) — é o gate da automação futura.

**Milestone: revisor abre caso já 80% preenchido pela IA; tempo de revisão cai de ~20min para ~5min.**

## Fase 3 — Marketplace (semanas 11–18)

1. `listings` + geração de anúncio pela IA (um prompt sobre os dados do check → título/descrição/hashtags; preço v0 = mediana de comparáveis internos/curados).
2. Busca: Postgres FTS (`portuguese` + unaccent + trigram) — suficiente até ~1M anúncios; interface de filtros (marca, tamanho, preço, risco, selo).
3. Checkout: Mercado Pago (Pix + cartão parcelado) com split/escrow; state machine de `orders` com `order_events`; Melhor Envio para etiqueta e rastreio (webhook de tracking).
4. Chat comprador↔vendedor (Supabase Realtime + moderação básica: bloquear troca de contato antes da compra — protege o take rate).
5. Disputas: fluxo interno no painel de ops.
6. Exportação multi-canal: gerador de card de anúncio (imagem via Satori/Skia + texto pronto) → share sheet nativo; exportações estruturadas para Enjoei/OLX (texto+fotos em pacote, deep link).

## Fase 4 — Automação e fine-tune (semanas 16–24, contínuo)

1. Dataset de treino a partir de `check_reviews` (rótulos humanos) + referência semente.
2. Fine-tune do encoder (LoRA, triplet loss) no Modal; avaliação por fatia; versionamento de modelo (`embeddings.model`) e re-embed incremental.
3. Agregador treinado (XGBoost/LogReg) + calibração isotônica; harness de backtest (replay de checks históricos a cada mudança de pipeline — regressão de precisão é bloqueante de deploy).
4. Auto-veredito por fatia com kill switch por marca (rollback instantâneo para 100% humano).
5. Auditoria amostral automatizada (5% re-enfileirados às cegas).

## Testes e qualidade

- Unit: validadores de serial, state machines, agregador (golden files de laudos).
- Integração: pipeline IA com fixtures de fotos (peças de teste próprias, incluindo réplicas) — suite "known fakes" que DEVE reprovar; roda em CI a cada mudança do pipeline.
- E2E: Maestro (mobile) para fluxos críticos: check completo, compra, anúncio.
- Load: k6 nos endpoints de check/checkout antes do lançamento.

## Equipe mínima para executar

- 1 fundador técnico full-stack (TS) — app + web + functions
- 1 eng. ML/CV (Python) — pipeline, treino, calibração
- 1 designer produto (pode ser fractional até V1)
- 2 autenticadores/revisores (viram lideranças de ops)
- (V1) +1 full-stack, +1 ops/suporte
