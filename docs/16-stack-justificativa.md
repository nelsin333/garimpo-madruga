# 16 — Tecnologias Recomendadas e Justificativas

## Mobile

| Escolha | Justificativa | Alternativa rejeitada |
|---|---|---|
| **React Native + Expo (expo-router, EAS)** | Um time TS cobre iOS+Android; EAS Update (OTA) permite iterar fluxo de check sem review de loja — crítico com pipeline de IA mudando semanalmente; ecossistema de câmera maduro | Flutter (time TS já cobre web; contratação TS > Dart no Brasil); nativo puro (2 times, sem OTA) |
| **react-native-vision-camera** | Frame processors para validação de qualidade on-device (blur/luz em tempo real) — expo-camera não dá acesso a frames com performance | — |
| **Reanimated + Skia** | Animação do score/anel e geração de cards de share com qualidade nativa | Lottie só (menos controle) |
| **Zustand + TanStack Query** | Estado de servidor cacheado + estado local simples; sem boilerplate | Redux (peso sem ganho aqui) |
| **NativeWind + tokens próprios** | Mesma linguagem de estilo (Tailwind) no app e na web, tokens compartilhados | Tamagui (bom, mas curva/lock-in maior) |

## Web

| Escolha | Justificativa |
|---|---|
| **Next.js (App Router) na Vercel** | Certificados públicos e SEO programático precisam de SSR/ISR excelente; OG images dinâmicas (Satori) para os loops virais; preview deploy por PR |
| **Tailwind + preset de tokens** | Consistência com o app via `ui-tokens` |

## Backend / Dados

| Escolha | Justificativa | Alternativa rejeitada |
|---|---|---|
| **Supabase (Postgres+Auth+Storage+Realtime+Edge Functions)** | Velocidade de MVP sem beco: é Postgres padrão (ejetável), RLS elimina uma API CRUD inteira, Realtime resolve status de check e chat de graça | Backend Node próprio (semanas a mais p/ auth/storage/infra sem diferencial); Firebase (NoSQL trava as queries relacionais pesadas do laudo/pricing e não tem pgvector) |
| **PostgreSQL + pgvector** | Embeddings junto dos metadados = kNN filtrado por SQL (marca/categoria/região/era) — o requisito nº 1 do nosso retrieval; HNSW dá conta de dezenas de milhões de vetores | Pinecone/Weaviate desde o início (duplicaria metadados e custo antes da escala justificar; migração fica fácil porque o contrato é "kNN filtrado") |
| **Upstash Redis (+ BullMQ)** | Fila do pipeline, rate-limit e cache serverless, custo zero em repouso | SQS/RabbitMQ (mais ops no estágio atual) |
| **Cloudflare (DNS/WAF/CDN/Images)** | Latência Brasil, proteção do endpoint público de certificado, variantes de imagem sem servidor próprio |

## IA

| Escolha | Justificativa | Alternativa rejeitada |
|---|---|---|
| **Python + FastAPI para o pipeline** | Ecossistema CV/ML (torch, OpenCV, open-clip) é Python; serviço isolado e stateless | Fazer CV em Deno/Node (nadar contra o ecossistema) |
| **Modal (GPU serverless)** | Embeddings/detecção/fine-tune com custo por segundo, zero GPU ociosa; dev experience excelente para o time pequeno | GPU dedicada (cara e ociosa no início); Replicate (menos controle sobre pipeline próprio) |
| **SigLIP 2 / OpenCLIP → fine-tune LoRA** | Melhor custo/qualidade open-source para embedding de imagem; fine-tune com nossos pares réplica/original é onde nasce a vantagem proprietária | Treinar encoder do zero (sem dados nem verba p/ isso; desnecessário) |
| **Claude API (multimodal) p/ análise e laudo** | Melhor raciocínio visual + geração do laudo explicável em pt-BR num passo; JSON estruturado confiável; prompt caching corta custo do RAG repetido | Modelo multimodal self-hosted (qualidade ainda insuficiente p/ análise forense sutil; revisitar a cada 6 meses) |
| **Google Cloud Vision (OCR)** | Melhor OCR para texto pequeno/curvo de etiquetas; PaddleOCR self-hosted como fallback/redução de custo em escala | Só LLM p/ OCR (bom, mas OCR dedicado é mais barato e determinístico p/ serial) |
| **XGBoost/LogReg + calibração isotônica (agregador)** | Auditável, retreina em minutos, calibração é requisito de produto (score honesto) | Rede neural end-to-end (caixa-preta; explicabilidade é o produto) |

## Pagamentos / Logística / Comms

| Escolha | Justificativa |
|---|---|
| **Mercado Pago** | Pix + cartão parcelado + **split/escrow (marketplace mode)** numa integração só, dominante no Brasil; Stripe fica p/ internacional futuro |
| **Melhor Envio** | Agregador de fretes com etiqueta e rastreio via API, padrão do e-commerce BR |
| **Expo Notifications + WhatsApp Cloud API + Resend** | Push nativo; WhatsApp é o canal que o brasileiro realmente lê; e-mail transacional simples |

## Ferramental

| Escolha | Justificativa |
|---|---|
| **Turborepo + pnpm** | Monorepo com cache de build; um `packages/contracts` como fonte de verdade entre TS e Python |
| **Zod (+ JSON Schema export)** | Contratos runtime-safe entre app, functions e pipeline Python |
| **Sentry + PostHog + Axiom** | Erros, produto analytics (funis dos loops de crescimento) e logs estruturados |
| **GitHub Actions + Maestro + k6** | CI/CD, E2E mobile, load test; gate de backtest do pipeline de IA (doc 13) |
| **Cursor / Claude Code** | Velocidade do time pequeno: geração de CRUD/painel ops, testes e migrações com revisão humana |
