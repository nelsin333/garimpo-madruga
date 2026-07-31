# Garimpo Madruga

**A plataforma brasileira de autenticação e revenda de streetwear, vintage e peças premium.**

> Legit App + StockX + Grailed + Enjoei — repensado do zero para o mercado brasileiro.

O usuário fotografa a peça guiado pelo app, uma IA multimodal analisa etiquetas, costuras, tipografia, seriais e QR/NFC contra um banco crescente de peças autênticas, e devolve um **relatório probabilístico de autenticidade** (não um veredito binário). Peças aprovadas ganham o selo **Garimpo Verified** com QR Code rastreável e podem virar anúncio com um clique — no marketplace próprio e exportadas para Enjoei, OLX, Instagram e WhatsApp.

## Documentação (Blueprint completo)

| # | Documento | Conteúdo |
|---|-----------|----------|
| 01 | [Visão do Produto](docs/01-visao-produto.md) | Tese, mercado, posicionamento, princípios |
| 02 | [Roadmap](docs/02-roadmap.md) | MVP → V1 → V2 → V3 |
| 03 | [Arquitetura](docs/03-arquitetura.md) | Diagrama completo, serviços, infra |
| 04 | [Banco de Dados](docs/04-banco-de-dados.md) | Schema PostgreSQL/Supabase completo |
| 05 | [Fluxos do Usuário](docs/05-fluxos-usuario.md) | Legit check, anúncio, compra, disputa |
| 06 | [Wireframes](docs/06-wireframes.md) | Telas principais em ASCII |
| 07 | [Design System](docs/07-design-system.md) | Tokens, componentes, tom de voz |
| 08 | [Sistema de IA](docs/08-sistema-ia.md) | Pipeline de autenticação, embeddings, RAG, revisão humana |
| 09 | [Estratégia de Dados](docs/09-estrategia-dados.md) | Coleta e expansão do banco de peças autênticas |
| 10 | [Monetização](docs/10-monetizacao.md) | Receitas, pricing, unit economics |
| 11 | [Crescimento](docs/11-crescimento.md) | Go-to-market, loops virais, comunidade |
| 12 | [Funcionalidades Futuras](docs/12-funcionalidades-futuras.md) | Visão de longo prazo |
| 13 | [Plano Técnico](docs/13-plano-tecnico.md) | Implementação passo a passo |
| 14 | [Estrutura de Pastas](docs/14-estrutura-pastas.md) | Monorepo completo |
| 15 | [Sprints](docs/15-sprints.md) | Plano de desenvolvimento sprint a sprint |
| 16 | [Stack e Justificativas](docs/16-stack-justificativa.md) | Cada tecnologia e o porquê |
| 17 | [Riscos e Mitigações](docs/17-riscos.md) | Técnicos, legais e operacionais |
| 18 | [Diferenciais Competitivos](docs/18-diferenciais.md) | Como vencer players internacionais no Brasil |

## Princípios inegociáveis

1. **A IA nunca "garante" autenticidade.** Ela estima probabilidade, explica o porquê e escala casos incertos para revisão humana. Confiança se constrói com honestidade estatística.
2. **Cada legit check torna o sistema mais inteligente.** O banco de peças autênticas é o fosso competitivo (moat) — dados > modelo.
3. **Brasil primeiro.** Pix, parcelamento, Correios/Melhor Envio, nota fiscal, WhatsApp, cultura de garimpo e brechó. Não é um clone traduzido.
4. **UX premium.** Referências: Apple, Linear, StockX. Cada tela deve parecer inevitável.
5. **Integrações limpas.** Só APIs oficiais ou fluxos assistidos compatíveis com os termos das plataformas — nunca automação que burla marketplace de terceiros.
