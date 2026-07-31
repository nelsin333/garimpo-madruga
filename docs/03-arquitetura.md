# 03 — Arquitetura Completa

## Visão geral

Monorepo TypeScript (Turborepo + pnpm). Supabase como espinha dorsal (Postgres + Auth + Storage + Realtime + Edge Functions), um serviço de IA em Python isolado (o único pedaço que não é TS), fila para o pipeline de autenticação, e CDN/edge na Cloudflare.

```
┌────────────────────────────── CLIENTES ──────────────────────────────┐
│                                                                      │
│  📱 App Mobile              🌐 Web                🖥️ Painel Interno   │
│  React Native + Expo        Next.js (Vercel)      Next.js (Vercel)   │
│  (usuário final)            - landing/SEO         - fila de revisão  │
│                             - certificado QR      - curadoria do     │
│                             - marketplace web     - banco de refs    │
│                             - perfil público      - ops/admin        │
└──────────┬──────────────────────┬──────────────────────┬─────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────── EDGE / API LAYER ─────────────────────────────┐
│  Cloudflare (DNS, CDN, WAF, rate-limit, Images para thumbnails)      │
│                                                                      │
│  Supabase Auth ──── RLS em tudo (JWT com claims de role)             │
│  PostgREST (CRUD simples direto do cliente, protegido por RLS)       │
│  Supabase Edge Functions (Deno) — lógica de negócio:                 │
│    /checks (criar, status)      /listings (publicar, exportar)       │
│    /payments (webhooks MP)      /certificates (QR público)           │
│    /pricing (sugestão de preço) /notifications (push via Expo)       │
└──────────┬───────────────────────────────────────────────┬───────────┘
           │                                               │
           ▼                                               ▼
┌───────────────────────┐               ┌─────────────────────────────┐
│  DADOS                │               │  PIPELINE DE IA (Python)     │
│                       │               │  Fly.io ou Railway (GPU:     │
│  PostgreSQL (Supabase)│               │  Modal/Replicate p/ burst)   │
│  + pgvector (embeds)  │◄── grava ─────│                              │
│  + PostGIS (v2, geo)  │   resultados  │  FastAPI + workers           │
│                       │               │  1. Pré-processo (blur/luz/  │
│  Supabase Storage     │── lê fotos ──►│     crop/normalização)       │
│  (fotos originais)    │               │  2. OCR (etiquetas/serial)   │
│                       │               │  3. Detecção de regiões      │
│  Cloudflare Images    │               │     (logo, tag, costura)     │
│  (variantes/thumbs)   │               │  4. Embeddings (CLIP/SigLIP) │
│                       │               │  5. Busca kNN no pgvector    │
│  Upstash Redis        │               │  6. Análise multimodal       │
│  (cache, rate-limit,  │               │     (Claude API) c/ RAG de   │
│   fila BullMQ, locks) │               │     referências da marca     │
│                       │               │  7. Score calibrado + laudo  │
└───────────────────────┘               └─────────────┬───────────────┘
                                                      │ score < limiar
                                                      ▼
                                        ┌─────────────────────────────┐
                                        │  FILA DE REVISÃO HUMANA      │
                                        │  (painel interno; SLA;       │
                                        │   decisões viram dados de    │
                                        │   treino — active learning)  │
                                        └─────────────────────────────┘

┌────────────────────── SERVIÇOS EXTERNOS ─────────────────────────────┐
│ Pagamentos: Mercado Pago (Pix, cartão, escrow/split) │ Stripe (intl) │
│ Envio: Melhor Envio (etiquetas, rastreio)                            │
│ Push: Expo Notifications  │ E-mail: Resend  │ WhatsApp: Cloud API    │
│ Analytics: PostHog  │ Erros: Sentry  │ Observabilidade: Axiom/Grafana│
│ LLM: Claude API (análise multimodal + geração de anúncio)            │
│ OCR: Google Cloud Vision (fallback: Claude vision / PaddleOCR)       │
└──────────────────────────────────────────────────────────────────────┘
```

## Decisões-chave e porquês

### 1. Supabase como núcleo
- **Postgres + Auth + Storage + Realtime + RLS** em um só lugar = velocidade de MVP sem dívida arquitetural (é só Postgres por baixo; dá para ejetar).
- **pgvector no mesmo banco** dos metadados: a busca de similaridade (kNN de embeddings) pode ser filtrada por SQL (`WHERE brand_id = X AND category = Y`) — crucial, porque comparamos etiqueta de moletom Supreme com etiquetas de moletom Supreme, não com o banco inteiro. Um vector DB separado (Pinecone etc.) obrigaria a duplicar metadados; adiar até >50M vetores.
- **RLS (Row Level Security)** como camada de autorização primária: cliente fala direto com PostgREST para leitura (feed, busca, perfil) sem backend intermediário.

### 2. Serviço de IA em Python separado (o único serviço "de verdade")
- Ecossistema de CV/ML é Python (OpenCV, torch, open-clip, Pillow, scikit). Não lutar contra isso em Deno.
- Stateless, escala horizontal, consome fila (BullMQ no Upstash Redis; migrar p/ SQS se precisar), grava resultado no Postgres e dispara realtime.
- **GPU serverless (Modal ou Replicate) para picos**: embeddings e detecção rodam em GPU sob demanda, custo por segundo; sem GPU ociosa.

### 3. Fluxo de um legit check (sequência)

```
App                Edge Fn           Storage        Fila         IA Worker        Humano
 │ POST /checks ─────►│                                                            
 │ (categoria, marca) │ cria check(status=awaiting_photos), retorna upload URLs    
 │ upload fotos ──────────────────────►│                                           
 │ (assinadas, direto p/ Storage)      │                                           
 │ POST /checks/:id/submit ──►│ valida checklist completo                          
 │                    │ status=queued ──────────────►│                             
 │                    │                              │──► consome job              
 │                    │                              │    pré-processa, OCR,       
 │                    │                              │    embeddings, kNN,         
 │                    │                              │    análise multimodal       
 │                    │                              │    score + laudo draft      
 │                    │                              │    ┌──────────────────┐     
 │                    │                              │    │ score na zona     │     
 │                    │                              │    │ de confiança?     │     
 │                    │                              │    └──┬───────────┬───┘     
 │                    │                              │    sim│        não│         
 │                    │   status=completed ◄─────────────────┘           ▼         
 │ ◄─ realtime push ──│   (laudo publicado)              status=in_review ────────►│
 │                    │                                                  laudo     │
 │                    │   status=completed ◄──────────── aprova/edita/reverte ◄────│
 │ ◄─ push notif ─────│                                  (decisão vira treino)     
```

### 4. Storage e imagens
- Original em Supabase Storage (bucket privado, retenção integral — é dado de treino).
- Cloudflare Images gera variantes públicas (thumbs de anúncio, comparações do laudo) — nunca expor original de referência (anti-engenharia reversa por falsificadores).
- EXIF é preservado no original (metadados de câmera ajudam antifraude: foto de foto, screenshots), mas removido nas variantes públicas (privacidade).

### 5. Realtime e notificações
- Supabase Realtime: status do check ao vivo, chat do marketplace.
- Expo Push + WhatsApp Cloud API (opt-in) para veredito pronto — no Brasil, WhatsApp converte mais que push.

### 6. Segurança e antifraude (desenho desde o dia 1)
- Upload direto com URL assinada de curta duração; validação server-side de mimetype/tamanho.
- Detecção de "foto de foto"/screenshot no pré-processamento (moiré, bordas de tela, EXIF ausente/inconsistente) — falsificador vai tentar submeter fotos de peça original baixadas da internet.
- Hash perceptual (pHash) de toda foto submetida: detectar reuso de imagens entre contas/checks.
- Rate limit por usuário/dispositivo (Upstash), device fingerprint no app.
- Certificado público mostra fotos da peça — quem compra confere se a peça em mãos bate com a do certificado (o QR não é prova sozinho; o par QR+fotos é).

## Ambientes
- `prod`, `staging` (projeto Supabase separado cada), `preview` (Vercel por PR, apontando p/ staging).
- IaC leve: migrations SQL versionadas (supabase CLI), seeds de referência, GitHub Actions para CI/CD (lint, typecheck, testes, deploy Edge Functions e serviço Python).
