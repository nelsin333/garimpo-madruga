# 10 — Estratégia de Monetização

## Fontes de receita (em ordem de ativação)

### 1. Legit check pago (MVP)

| Produto                     | Preço  | Nota                             |
| --------------------------- | ------ | -------------------------------- |
| Check padrão (IA + revisão) | R$ 39  | veredito < 1h útil               |
| Check expresso              | R$ 69  | fila prioritária, < 20 min       |
| Check IA instantâneo (V1)   | R$ 19  | só fatias de alta confiança      |
| Pacote 5 checks             | R$ 149 | p/ revendedores                  |
| Pacote 20 checks            | R$ 490 | assinatura implícita de reseller |

Referência de mercado: Legit App cobra US$ 3–30 por check; nosso preço em BRL com Pix, sem fricção cambial. Custo marginal (doc 08) dá margem bruta > 70% no check padrão mesmo com humano no loop.

### 2. Take rate do marketplace (V1) — a receita principal no longo prazo

- **9% do vendedor** (peça verificada) — abaixo dos ~13–20% do Enjoei e ~9–12% StockX, sustentável porque o check já foi pago e o custo de confiança é amortizado.
- Peça sem selo pode ser anunciada com taxa maior (12%) — incentivo permanente a verificar.
- Comprador paga taxa de serviço fixa pequena (R$ 9,90) que financia a **Garantia Garimpo** (recompra se laudo baixo risco se provar errado).

### 3. Assinatura "Garimpo Pro" (V1)

R$ 49/mês para revendedores: X checks inclusos, taxa reduzida (7%), selo de vendedor pro, análise de precificação avançada (tendência, raridade, melhor momento de venda), exportação multi-canal ilimitada, destaque na busca.

### 4. Serviços físicos (V2)

- Custódia + autenticação física + fotos de estúdio: R$ 59–99/peça (embutido no preço de venda).
- Tag NFC física para peças > R$ 2k: R$ 29.

### 5. B2B / API (V3)

- API de autenticação para marketplaces e e-commerces (por chamada).
- Painel de precificação para brechós (SaaS R$ 199–499/mês).
- Dados de mercado (índice de preços, relatórios de tendência).
- Brand-authorized resale: infraestrutura de recommerce para marcas (revenue share).

## Unit economics alvo (V1, por coorte mensal)

```
Check padrão:  preço R$ 39 · custo direto ~R$ 8–12 (IA + rateio revisor) → MC ~70%
Venda média:   ticket R$ 600 · take 9% = R$ 54 · custos (MP ~2,5% + garantia
               provisionada 1% + suporte) ~R$ 25 → MC ~R$ 29/venda
CAC alvo:      ≤ R$ 25 (orgânico/comunidade pesado — doc 11)
LTV (12m):     usuário médio 4 checks + 1,5 vendas ≈ R$ 150 de margem → LTV/CAC ≈ 6
```

## Princípios de pricing

1. **O check é porta de entrada, não a vaca leiteira**: pode ser subsidiado (o dado coletado tem valor) para maximizar volume; o marketplace monetiza.
2. **Nunca cobrar para VER laudo/certificado** — laudo público gera confiança e aquisição (cada QR compartilhado é marketing).
3. **Preço em BRL, Pix nativo, parcelamento no marketplace** — metade da vantagem sobre gringos está aqui.
4. Garantia Garimpo provisionada como % do GMV desde o dia 1 (fundo de sinistro) — é custo de marketing de confiança, não "perda".
