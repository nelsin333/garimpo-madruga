# 05 — Fluxos do Usuário

## 1. Onboarding

```
Splash → Carrossel de valor (3 telas: "Autentique", "Valorize", "Venda")
  → Login (Apple / Google / e-mail / telefone)
  → Escolha de interesses (marcas + categorias — alimenta feed e wishlist)
  → Pedir push permission SÓ depois do primeiro check (momento de valor)
  → Home
```

Princípio: usuário chega à Home em < 30 segundos. KYC (CPF, endereço) só é exigido no primeiro saque/venda, nunca no cadastro.

## 2. Legit Check (fluxo core)

```
Home ► [Fazer Legit Check]
 │
 ├─ 1. O que é a peça?
 │     • Busca ("Supreme box logo") → sugestões do catálogo com foto
 │     • ou Categoria → Marca (→ Modelo, opcional)
 │     • ou "Não sei o modelo" → IA identifica pelas fotos depois
 │
 ├─ 2. Checklist de fotos (dinâmico por marca+categoria, vem de brands.photo_checklist)
 │     Ex. moletom Supreme: frente, costas, etiqueta de gola (close),
 │     etiqueta de lavagem, costura do bolso, bordado do logo (macro),
 │     zíper/puller, tag + serial, embalagem (opcional), nota fiscal (opcional)
 │     • Câmera com overlay de silhueta + dica por foto ("encoste a câmera a 10cm")
 │     • Validação imediata: blur/luz/enquadramento → "Refazer" na hora
 │     • Barra de progresso (7/9 fotos)
 │
 ├─ 3. Confirmação + pagamento
 │     • Resumo das fotos • Preço do check (ou usar crédito do pacote)
 │     • Pix (QR na tela, confirma em segundos) ou cartão
 │     • Consentimento LGPD: "usar fotos anonimizadas p/ melhorar o sistema" (toggle, default on)
 │
 ├─ 4. Processamento (tela de status com Realtime)
 │     "Analisando etiquetas… ✓  Comparando com 1.284 referências… ✓"
 │     • Alta confiança → resultado em ~2 min
 │     • Zona incerta → "Nossos especialistas estão revisando — até 1h" + push/WhatsApp
 │
 └─ 5. Relatório
       ┌──────────────────────────────────────────────┐
       │ 92% de probabilidade de autenticidade         │
       │ 🟢 BAIXO RISCO                                │
       │──────────────────────────────────────────────│
       │ ✓ 7 pontos positivos  ⚠ 1 ponto de atenção   │
       │ [foto com marcações] [comparação lado a lado] │
       │ "A tipografia da etiqueta de gola confere com │
       │  a referência FW23 (espaçamento, serifa)…"    │
       │──────────────────────────────────────────────│
       │ [Ver certificado]  [Anunciar por R$ 1.450 →] │
       └──────────────────────────────────────────────┘
       • Risco médio/alto: linguagem cuidadosa, sem acusação ("encontramos
         desvios em relação às referências"), opção de segunda opinião humana
       • Inconclusivo: reembolso parcial automático + pedir fotos extras
```

## 3. Do check ao anúncio (1 clique)

```
Relatório ► [Anunciar]
 │  A IA já preencheu: título, marca, modelo, ano/coleção, cor, categoria,
 │  medidas (das fotos + declaradas), estado, descrição, hashtags,
 │  preço sugerido (mín / ideal / premium) com "tempo estimado de venda"
 │
 ├─ Tela única de revisão (tudo editável inline)
 │  Preço: slider entre mín—premium, com feedback vivo:
 │  "R$ 1.450 → vende em ~9 dias | R$ 1.700 → ~23 dias"
 │
 ├─ [Publicar no Garimpo]  → anúncio ativo com selo 🛡️
 │
 └─ "Publicar também em:" (pós-publicação)
      [Instagram] [WhatsApp] [Threads]  → share sheet com imagem-card
        gerada (foto tratada + selo + QR do certificado + preço)
      [Enjoei] [OLX]  → exportação assistida: texto+fotos prontos copiados,
        deep-link abre o app de destino; usuário cola e publica
        (compatível com os termos — ver doc 17)
```

## 4. Compra com escrow

```
Comprador: Busca/Feed → Anúncio (com laudo público resumido + selo)
 → [Comprar] ou [Fazer oferta]
 → Checkout: endereço → frete (Melhor Envio) → Pix/cartão (parcelado)
 → Dinheiro fica em escrow (Mercado Pago split)
Vendedor: recebe etiqueta pronta → posta em 3 dias úteis (senão auto-cancela)
 → rastreio automático na thread do pedido
Comprador: recebe → 3 dias p/ abrir disputa
 → sem disputa: escrow libera, reputação++ dos dois lados
 → disputa: fluxo de mediação (fotos, chat, time de ops decide; laudo da peça
   é a âncora da decisão)
```

## 5. Verificação de certificado (quem está fora do app)

```
QR na tag/anúncio → página web pública (Next.js, sem login):
  • Código GM-7F3K-9Q2A • Peça, fotos, data do check
  • Probabilidade + risco • Histórico de transferências
  • Aviso: "confira se a peça em mãos corresponde às fotos"
  • CTA: baixar o app
```

## 6. Wishlist inteligente

```
Busca "camiseta Nike 2004 tam G" sem resultado
 → [🔔 Me avise] salva a busca (wishlists.query)
 → novo anúncio que casa com a busca → push/WhatsApp na hora
 → (é também sinal de demanda p/ IA de precificação)
```

## 7. Revisão humana (painel interno)

```
Fila priorizada por SLA → Revisor abre caso:
  fotos em alta + achados da IA lado a lado + referências kNN mais próximas
  → Aprova score | Ajusta achados | Reverte veredito | Pede fotos extras | Escala p/ sênior
  → Toda ação gravada em check_reviews (vira dado de treino e de calibração)
Duplo-cego para casos de alto valor (2 revisores independentes; divergência → sênior)
```
