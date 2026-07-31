# 02 — Roadmap: MVP → V1 → V2 → V3

## Filosofia de sequenciamento

O fosso é o **banco de peças autênticas**. Então a ordem é:

1. MVP gera **demanda de checks** (e portanto dados) mesmo com IA imperfeita, usando revisão humana como rede de segurança.
2. V1 usa os dados para **automatizar a maioria dos checks** e liga o marketplace.
3. V2 adiciona **liquidez e serviços premium** (custódia, garantia, integração profunda).
4. V3 vira **infraestrutura de confiança** para o mercado inteiro (API, B2B, selo como padrão).

---

## MVP — "O Legit Check brasileiro" (meses 0–4)

**Objetivo:** provar que brasileiros pagam por autenticação rápida em português, e começar o banco de dados.

**Escopo:**

- App React Native (Expo) — iOS e Android — + landing Next.js.
- Onboarding + auth (Supabase: e-mail, Apple, Google, telefone).
- **Fluxo de legit check guiado por câmera**: checklist de fotos por categoria (tênis, camiseta, moletom, boné, jaqueta), com overlay de enquadramento e validação de qualidade da foto na hora (blur, luz, distância).
- **Pipeline de IA v0**: OCR de etiquetas/seriais + modelo multimodal (análise de tipografia, costura, tags) + comparação com banco de referência inicial → score preliminar.
- **Revisão humana obrigatória** em 100% dos checks no início (IA assiste o revisor, revisor treina a IA). Vereditos em < 12h, meta < 1h.
- **Relatório completo**: score de probabilidade, nível de risco (baixo/médio/alto), pontos positivos, pontos suspeitos com marcações na foto, comparação lado a lado com referência.
- Selo digital **Garimpo Verified** com QR Code público (página do certificado no Next.js).
- Perfil básico: histórico de checks, coleção.
- Pagamento por check: Pix e cartão (Stripe ou Mercado Pago). Pacotes de créditos.
- Painel interno de revisão (web) para o time de autenticadores.

**Categorias no lançamento (foco = qualidade do banco):** tênis Nike/Adidas/Jordan/Yeezy + camisetas e moletons Supreme, Stussy, Palace, Bape, Carhartt, Nike vintage. Expandir marca a marca.

**Fora do MVP:** marketplace, feed, integrações externas, precificação automática.

**Critério de sucesso:** 3.000 checks pagos/mês, < 1% de contestação de veredito, custo de revisão humana caindo mês a mês.

---

## V1 — "Do laudo ao anúncio" (meses 5–9)

**Objetivo:** monetizar o pós-check e destravar o volante do marketplace.

- **Marketplace próprio**: anúncio gerado em 1 clique a partir do check (título, descrição, medidas, fotos, hashtags já prontos), busca, filtros, chat comprador-vendedor, escrow via Mercado Pago, etiqueta de envio via Melhor Envio.
- **IA de precificação v1**: valor mínimo/ideal/premium, tempo estimado de venda, baseado em vendas internas + comparáveis públicos.
- **Exportação multi-canal**: gerar pacote de anúncio (fotos tratadas + texto + link do certificado) para Instagram/Threads/WhatsApp/Facebook via share sheet; exportação estruturada (CSV/deep-link/preenchimento assistido) para Enjoei e OLX — ver doc 17 sobre conformidade.
- **IA v1**: com ~50–100k imagens rotuladas, ativar **auto-veredito em alta confiança** (score > limiar calibrado): resultado em < 2 min; faixa incerta continua indo para humano.
- Perfis completos: reputação, nível, seguidores, wishlist, favoritos.
- **Garantia Garimpo**: recompra/reembolso se peça com selo "baixo risco" for provada fake (funded pelo take rate — é o que torna o selo crível).

**Critério de sucesso:** 30% dos checks aprovados viram anúncio; GMV R$ 500k/mês; ≥ 50% dos checks resolvidos sem humano.

---

## V2 — "Liquidez e confiança física" (meses 10–18)

- **Feed social** (fits, coleções, achados de garimpo, seguir/curtir/comentar) — só depois que existe massa crítica de usuários e inventário.
- **Custódia física opcional** (modelo StockX): peça passa pelo hub, autenticação física + fotos de estúdio + selo lacrado NFC. Começar com um hub em SP.
- **Tag NFC física** para peças de alto valor (selo digital + chip).
- **Ofertas/lances** (bid/ask estilo StockX) para itens líquidos (sneakers hype).
- **Troca (swap)** assistida com escrow duplo.
- Busca visual: fotografar peça na rua/brechó → identificar modelo, preço de mercado, checks anteriores.
- Programa de autenticadores parceiros (marketplace de expertise, revisores externos certificados).
- App de precificação para brechós (B2B light).

---

## V3 — "Infraestrutura de confiança" (meses 18+)

- **API pública de autenticação e certificados** para marketplaces, brechós, seguradoras e e-commerces ("Verified by Garimpo" embutido no checkout de terceiros).
- **B2B enterprise**: alfândega, marketplaces grandes, resale corporativo de marcas (brand-authorized resale — marcas usam nossa infra para recommerce oficial).
- Expansão LatAm (México, Argentina, Chile — mesmos problemas, mesma solução).
- **Índice de preços Garimpo** (dados de mercado como produto: relatórios, API de pricing).
- Autenticação de novas verticais: bolsas de luxo, relógios, camisas de futebol (mercado gigante no Brasil).
- Financeirização: peça como ativo — carteira de coleção com marcação a mercado, empréstimo com peça em custódia como garantia (com parceiro regulado).
