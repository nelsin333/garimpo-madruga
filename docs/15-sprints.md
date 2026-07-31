# 15 — Plano de Desenvolvimento em Sprints

Sprints de 2 semanas. Time da Fase 0: 1 full-stack TS, 1 eng. ML (entra no Sprint 3), design fractional, 2 autenticadores (entram no Sprint 5). Cada sprint tem **demo obrigatória** e um critério de saída verificável.

## Bloco A — Fundações e Check Manual (MVP core)

### Sprint 1 — Esqueleto

- Monorepo, CI, Supabase (prod/staging), migrations iniciais (profiles, brands, categories, checks, check_photos), RLS baseline.
- Expo app com auth completo + onboarding; EAS build nos dois stores (TestFlight/internal track).
- Landing Next.js com lista de espera.
- **Saída:** login → Home no device físico; waitlist no ar.

### Sprint 2 — Câmera guiada e upload

- Checklist dinâmico por marca/categoria (seeds das 10 marcas foco, escritos com os autenticadores).
- Câmera com overlay por região, validação on-device (blur/luz), retake, progresso.
- Upload assinado direto ao Storage + compressão; `submit-check` com validação de completude.
- **Saída:** check completo criado com 9 fotos válidas em < 4 min de uso real.

### Sprint 3 — Pagamento e laudo manual

- Mercado Pago: Pix + cartão, webhook, estados de pagamento; pacotes de créditos.
- Painel ops v1: fila, visualizador, formulário de achados, veredito.
- Relatório no app (score, risco, achados, fotos com bbox) + Realtime + push.
- **Saída:** primeiro check pago end-to-end com laudo humano em staging.

### Sprint 4 — Certificado e polimento do core

- Página pública `cert/[code]` + OG image; QR no laudo; share sheet.
- Estados de erro/reembolso (inconclusivo), histórico de checks no perfil, WhatsApp notify.
- Hardening: rate limit, device fingerprint, pHash anti-reuso.
- **Saída:** beta fechado com 50 usuários da lista; NPS do fluxo ≥ 8.

## Bloco B — IA assistiva

### Sprint 5 — Pipeline v0 (infra)

- Serviço Python + fila + contratos; estágio 0 (qualidade/pHash) e OCR com validadores de serial.
- Coleta semente em andamento (protocolo de estúdio, 10 marcas — trilha paralela de ops).
- **Saída:** todo check novo passa pelo pipeline e anexa OCR+flags ao caso no painel.

### Sprint 6 — Embeddings e comparação

- Modal (GPU) + SigLIP; embeddings por região; pgvector HNSW; kNN filtrado.
- Painel mostra top-k referências lado a lado com zoom sincronizado.
- **Saída:** tempo médio de revisão cai ≥ 50% (medido).

### Sprint 7 — Análise multimodal e laudo assistido

- Claude + RAG de guias; achados JSON com bbox pré-preenchidos; agregador v0 (regras).
- Dashboard de concordância IA×humano por fatia.
- **Saída:** revisor edita em vez de escrever; laudo médio < 5 min.

### Sprint 8 — Lançamento MVP 🚀

- Polimento (animação do score, haptics, empty states), load test, suporte (fluxo de contestação), preços finais.
- Lançamento público com brechós âncora + creators (doc 11).
- **Saída:** app nas lojas, meta de 500 checks no primeiro mês.

## Bloco C — Marketplace (V1)

### Sprint 9 — Anúncio em 1 clique

- Geração de anúncio pela IA a partir do check; tela de revisão; publicação; grid/busca FTS.
- **Saída:** ≥ 30% dos checks aprovados geram rascunho de anúncio.

### Sprint 10 — Checkout e escrow

- Compra: frete (Melhor Envio), Pix/cartão parcelado, split/escrow, state machine de pedido.
- **Saída:** primeira venda real com escrow liberado.

### Sprint 11 — Chat, ofertas e disputas

- Chat Realtime com antileak de contato; ofertas/contra-ofertas; fluxo de disputa no ops.
- **Saída:** funil anúncio→chat→venda instrumentado.

### Sprint 12 — Multi-canal e precificação v1

- Card de compartilhamento (IG/WhatsApp/Threads); exportação assistida Enjoei/OLX; `price_history` + sugestão mín/ideal/premium com tempo estimado.
- **Saída:** 25% dos anúncios exportados p/ ≥ 1 canal externo.

## Bloco D — Automação e social (V1.5 → V2)

### Sprint 13–14 — Fine-tune e auto-veredito

- Dataset de `check_reviews`; fine-tune encoder; agregador treinado + calibração; backtest como gate de CI; auto-veredito nas fatias ≥ 99% de concordância com kill switch.
- **Saída:** ≥ 40% dos checks sem humano, FP auditado = 0.

### Sprint 15–16 — Perfis ricos, wishlist, reputação

- Wishlist com alertas, coleções públicas, reputação/níveis, garantia Garimpo no checkout.

### Sprint 17+ — Feed social, busca visual, custódia piloto (doc 02, V2)

## Rituais

- Weekly de calibração IA (eng ML + autenticadores): revisar divergências da semana — é o ritual mais importante da empresa.
- Métricas por sprint no dashboard: checks, concordância, tempo de veredito, GMV, FP auditado (sempre visível, meta 0).
