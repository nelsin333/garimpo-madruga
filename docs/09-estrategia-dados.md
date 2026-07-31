# 09 — Estratégia de Coleta e Expansão do Banco de Dados

O banco de referência é o fosso. A estratégia tem 4 fontes, em ordem de escala:

## 1. Aquisição direta (semente — meses 0–3)

- **Comprar e fotografar em protocolo**: ~200 peças autênticas + ~100 réplicas conhecidas das 10 marcas foco. Protocolo de estúdio: mesmas regiões do checklist do app, 3 condições de luz, macro real das etiquetas/costuras. Cada peça rende 30–60 fotos rotuladas por região.
- Réplicas: comprar deliberadamente os batches em circulação no Brasil (grupos de réplica são públicos) — exemplares negativos catalogados por batch/geração são raros no mercado e valem ouro no kNN.
- Peças autênticas são revendidas depois de catalogadas (recupera 70–90% do custo) — o estoque de dados se paga quase sozinho.

## 2. Parcerias (alavancagem — meses 1–6)

- **Lojas de consignação e brechós premium** (SP/RJ/POA/BH): catalogamos o acervo deles de graça (fotos + medidas + laudo), eles ganham selo nas peças e páginas de certificado; nós ganhamos referência com procedência.
- **Colecionadores conhecidos**: checks vitalícios grátis + selo de "acervo verificado" em troca de sessão de catalogação.
- **Autenticadores independentes**: contratar como revisores; o conhecimento tácito deles vira `auth_guide` estruturado (entrevistas → guias por marca/era).
- Importante: só ingerir dados de terceiros com licença/consentimento por escrito (ver doc 17).

## 3. O próprio produto (o volante — permanente)

```
mais checks → mais fotos consentidas → banco maior → IA melhor e mais barata
     ▲                                                        │
     └── preço menor / veredito mais rápido / mais confiança ◄┘
```

- Cada check com `consent_training=true` (opt-in claro, LGPD) alimenta o banco após curadoria.
- **Curadoria em duas camadas**: automática (qualidade de foto, veredito de alta confiança, sem flags de fraude) + amostral humana. Só entra como referência `quality_score ≥ 3`; peso no kNN proporcional à confiança da referência.
- Vereditos contestados e revertidos = dados de máxima qualidade (rotulados por sênior).
- Cuidado com **contaminação**: réplica aprovada por engano que vira referência envenena o banco. Mitigação: referência nova fica em "quarentena" (não participa de kNN decisivo) por N dias / até segunda confirmação independente.

## 4. Dados de mercado (para precificação)

- Vendas internas (`price_history`) — a fonte primária e proprietária.
- Comparáveis externos: coleta **manual/curada** de preços públicos (equipe registra comparáveis; sem scraping automatizado que viole ToS — ver doc 17), parcerias de dados com brechós (eles compartilham vendas em troca do painel de pricing B2B).
- Sinais de demanda internos: buscas, wishlists, ofertas rejeitadas (ninguém mais tem isso no Brasil).

## Metas de cobertura

| Marco  | Banco de referência                           | Efeito                          |
| ------ | --------------------------------------------- | ------------------------------- |
| Mês 3  | 10 marcas × categorias core, ~50k crops       | IA assiste humano               |
| Mês 6  | ~150k crops, réplicas de 30+ batches          | auto-veredito nas fatias fortes |
| Mês 12 | ~500k crops, 25 marcas, eras vintage mapeadas | 70% automático                  |
| Mês 24 | milhões de crops, cobertura LatAm             | API B2B viável                  |

## Governança do dado

- Versionamento: toda referência com `source`, licença, data, autor da curadoria.
- Fotos de usuários anonimizadas antes de virar referência (strip EXIF, sem rosto/ambiente — crop só da região).
- Banco de referência **nunca exposto publicamente** (nem via certificado): falsificador não pode usar nosso gabarito para melhorar a réplica. Laudos públicos mostram a foto DO USUÁRIO com marcações, e miniaturas degradadas da referência quando necessário.
- Backup/lineage: referência removível por pedido do titular (LGPD) sem quebrar o índice (soft delete + re-index).
